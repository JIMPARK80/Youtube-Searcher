// ============================================
// VIEW-HISTORY.JS - View snapshot helpers
// Handles Supabase view_history table + VPH calculations
// ============================================

import { supabase } from './supabase-config.js';

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_INTERVAL_MINUTES = 60; // 1시간마다
const DEFAULT_RETENTION_HOURS = 240; // 10 days

const velocityCache = new Map();
let browserTrackerTimer = null;

async function getViewTrackingConfig() {
    try {
        // 타임아웃 추가 (5초)
        const configPromise = supabase
            .from('view_tracking_config')
            .select('*')
            .limit(1)
            .single();
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('View tracking config 타임아웃')), 5000)
        );
        
        const { data, error } = await Promise.race([configPromise, timeoutPromise]);
        
        if (error || !data) return null;
        
        return {
            videoIds: data.video_ids || [],
            retentionHours: data.retention_hours || DEFAULT_RETENTION_HOURS,
            maxEntries: data.max_entries || 240,
            browserFallbackEnabled: true, // Supabase에서는 항상 활성화
            intervalMinutes: DEFAULT_INTERVAL_MINUTES
        };
    } catch (error) {
        console.warn('⚠️ viewTracking 설정 로드 실패:', error);
        return null;
    }
}

async function fetchHistorySnapshots(videoId, limitCount = 2) {
    try {
        const { data, error } = await supabase
            .from('view_history')
            .select('view_count, fetched_at')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: false })
            .limit(limitCount);
        
        if (error || !data) return [];
        
        return data.map(item => ({
            viewCount: Number(item.view_count || 0),
            fetchedAt: new Date(item.fetched_at)
        }));
    } catch (error) {
        console.warn('⚠️ 히스토리 스냅샷 로드 실패:', error);
        return [];
    }
}

function computeRecentVph(latest, previous) {
    if (!latest || !previous) return null;
    const growth = latest.viewCount - previous.viewCount;
    const diffHours = Math.max(
        (latest.fetchedAt.getTime() - previous.fetchedAt.getTime()) / (1000 * 60 * 60),
        1 / 60
    );
    const vph = growth / diffHours;
    return {
        vph,
        vpd: vph * 24,
        recentGrowth: growth,
        diffHours,
        latest,
        previous,
    };
}

// Note: This function is kept for backward compatibility
// ui.js uses getRecentVelocityForVideo from supabase-api.js
export async function getRecentVelocityForVideo(videoId, { cacheTtl = DEFAULT_CACHE_TTL } = {}) {
    if (!videoId) return null;
    const cached = velocityCache.get(videoId);
    if (cached && Date.now() - cached.cachedAt < cacheTtl) {
        return cached.value;
    }
    const snapshots = await fetchHistorySnapshots(videoId, 2);
    if (snapshots.length < 2) return null;
    const stats = computeRecentVph(snapshots[0], snapshots[1]);
    velocityCache.set(videoId, {
        cachedAt: Date.now(),
        value: stats,
    });
    return stats;
}

async function persistSnapshot(videoId, viewCount, fetchedAt = new Date()) {
    try {
        const { error } = await supabase
            .from('view_history')
            .insert({
                video_id: videoId,
                view_count: Number(viewCount),
                fetched_at: fetchedAt.toISOString()
            });
        
        if (error) {
            console.warn('⚠️ 스냅샷 저장 실패:', error);
        }
    } catch (error) {
        console.warn('⚠️ 스냅샷 저장 실패:', error);
    }
}

async function pruneHistory(videoId, retentionHours = DEFAULT_RETENTION_HOURS, maxEntries = 240) {
    try {
        // 1. 시간 기반 정리: retention_hours 이전 데이터 삭제
        const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();
        
        const { error: timeError } = await supabase
            .from('view_history')
            .delete()
            .eq('video_id', videoId)
            .lt('fetched_at', cutoff);
        
        if (timeError) {
            console.warn('⚠️ 히스토리 시간 기반 정리 실패:', timeError);
        }
        
        // 2. 개수 기반 정리: max_entries 초과 시 오래된 것 삭제
        const { data: allRecords, error: countError } = await supabase
            .from('view_history')
            .select('id')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: false });
        
        if (countError) {
            console.warn('⚠️ 히스토리 개수 확인 실패:', countError);
            return;
        }
        
        if (allRecords && allRecords.length > maxEntries) {
            const toDelete = allRecords.slice(maxEntries).map(r => r.id);
            const { error: deleteError } = await supabase
                .from('view_history')
                .delete()
                .in('id', toDelete);
            
            if (deleteError) {
                console.warn('⚠️ 히스토리 개수 기반 정리 실패:', deleteError);
            } else {
                console.log(`🧹 ${videoId}: ${toDelete.length}개 오래된 스냅샷 삭제 (최대 ${maxEntries}개 유지)`);
            }
        }
    } catch (error) {
        console.warn('⚠️ 히스토리 정리 실패:', error);
    }
}

async function captureViewsForIds(videoIds = [], apiKey) {
    if (!videoIds.length || !apiKey) return;
    
    // 설정 가져오기
    const config = await getViewTrackingConfig();
    const retentionHours = config?.retentionHours || DEFAULT_RETENTION_HOURS;
    const maxEntries = config?.maxEntries || 240;
    
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }
    for (const chunkIds of chunks) {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'statistics');
        url.searchParams.set('id', chunkIds.join(','));
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            console.error('❌ VPH 폴백 fetch 실패', await response.text());
            continue;
        }
        const payload = await response.json();
        const now = new Date();
        for (const item of payload.items || []) {
            const viewCount = Number(item.statistics?.viewCount ?? 0);
            await persistSnapshot(item.id, viewCount, now);
            await pruneHistory(item.id, retentionHours, maxEntries);
        }
    }
}

// 마지막 스냅샷 시간 확인 함수
async function getLastSnapshotTime() {
    try {
        // 타임아웃 추가 (5초)
        const queryPromise = supabase
            .from('view_history')
            .select('fetched_at')
            .order('fetched_at', { ascending: false })
            .limit(1)
            .single();
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('getLastSnapshotTime 타임아웃')), 5000)
        );
        
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        
        if (error || !data) {
            return null;
        }
        
        return new Date(data.fetched_at).getTime();
    } catch (error) {
        console.warn('⚠️ 마지막 스냅샷 시간 확인 실패:', error);
        return null;
    }
}

export async function initializeViewTrackingFallback() {
    // 이미 실행 중이면 중복 초기화 방지
    if (browserTrackerTimer) {
        console.log('ℹ️ Browser view tracker already running');
        return;
    }
    
    let config;
    try {
        config = await getViewTrackingConfig();
        if (!config?.browserFallbackEnabled) {
            console.log('ℹ️ Browser view tracker disabled');
            return;
        }
    } catch (error) {
        console.warn('⚠️ View tracking config 로드 실패:', error);
        return;
    }
    
    const intervalMinutes = Number(config.intervalMinutes || DEFAULT_INTERVAL_MINUTES);
    const intervalMs = Math.max(intervalMinutes, 15) * 60 * 1000; // 최소 15분

    let lastRunTime = Date.now();
    let countdownTimer = null;

    const runTick = async () => {
        const latestConfig = await getViewTrackingConfig();
        const ids = latestConfig?.videoIds || [];
        const apiKey = window.serverApiKeys?.youtube || document.getElementById('apiKey')?.value;
        if (!apiKey || !ids.length) {
            console.warn('⚠️ Browser tracker: missing API key or video IDs');
            return;
        }
        console.log(`🕒 Browser tracker 업데이트 실행 (${ids.length}개 영상)`);
        await captureViewsForIds(ids, apiKey);
        lastRunTime = Date.now();
        
        // 다음 실행까지 남은 시간 표시 시작
        startCountdown(intervalMs);
    };

    // 남은 시간 표시 함수
    const startCountdown = (intervalMs) => {
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }
        
        const updateCountdown = () => {
            const elapsed = Date.now() - lastRunTime;
            const remaining = intervalMs - elapsed;
            
            if (remaining <= 0) {
                console.log(`⏰ 다음 VPH 스냅샷: 곧 실행됩니다...`);
                return;
            }
            
            const remainingSeconds = Math.floor(remaining / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            
            if (remainingSeconds <= 10 || remainingSeconds % 30 === 0) {
                // 마지막 10초는 매초, 그 외에는 30초마다 표시
                console.log(`⏰ 다음 VPH 스냅샷까지: ${minutes}분 ${seconds}초 남음`);
            }
        };
        
        // 즉시 한 번 표시
        updateCountdown();
        
        // 1초마다 업데이트
        countdownTimer = setInterval(updateCountdown, 1000);
    };

    // 새로고침 시: 마지막 스냅샷 시간 확인 후 남은 시간 계산
    const lastSnapshotTime = await getLastSnapshotTime();
    if (lastSnapshotTime) {
        const elapsed = Date.now() - lastSnapshotTime;
        const remaining = intervalMs - elapsed;
        
        if (remaining > 0) {
            const remainingSeconds = Math.floor(remaining / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            const lastSnapshotDate = new Date(lastSnapshotTime).toLocaleString();
            console.log(`📊 마지막 VPH 스냅샷: ${lastSnapshotDate}`);
            console.log(`⏰ 다음 VPH 스냅샷까지: ${minutes}분 ${seconds}초 남음`);
            
            // 남은 시간만큼 대기 후 첫 실행
            setTimeout(() => {
                runTick().catch(console.error);
                browserTrackerTimer = setInterval(() => {
                    runTick().catch(console.error);
                }, intervalMs);
                startCountdown(intervalMs);
            }, remaining);
        } else {
            // 이미 시간이 지났으면 즉시 실행
            console.log(`⏰ 마지막 스냅샷 이후 ${Math.floor(elapsed / 1000)}초 경과 → 즉시 실행`);
            runTick().catch(console.error);
            browserTrackerTimer = setInterval(() => {
                runTick().catch(console.error);
            }, intervalMs);
            startCountdown(intervalMs);
        }
    } else {
        // 스냅샷이 없으면 즉시 실행
        console.log(`📊 VPH 스냅샷 없음 → 첫 스냅샷 즉시 생성`);
        runTick().catch(console.error);
        browserTrackerTimer = setInterval(() => {
            runTick().catch(console.error);
        }, intervalMs);
        startCountdown(intervalMs);
    }
}

