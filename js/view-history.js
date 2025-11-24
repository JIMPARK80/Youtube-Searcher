// ============================================
// VIEW-HISTORY.JS - View snapshot helpers
// Handles Supabase view_history table + VPH calculations
// ============================================

import { supabase } from './supabase-config.js';

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_RETENTION_HOURS = 240; // 10 days

const velocityCache = new Map();
let browserTrackerTimer = null;

async function getViewTrackingConfig() {
    try {
        const { data, error } = await supabase
            .from('view_tracking_config')
            .select('*')
            .limit(1)
            .single();
        
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

async function pruneHistory(videoId, retentionHours = DEFAULT_RETENTION_HOURS) {
    try {
        const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();
        
        const { error } = await supabase
            .from('view_history')
            .delete()
            .eq('video_id', videoId)
            .lt('fetched_at', cutoff);
        
        if (error) {
            console.warn('⚠️ 히스토리 정리 실패:', error);
        }
    } catch (error) {
        console.warn('⚠️ 히스토리 정리 실패:', error);
    }
}

async function captureViewsForIds(videoIds = [], apiKey) {
    if (!videoIds.length || !apiKey) return;
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
            await pruneHistory(item.id);
        }
    }
}

export async function initializeViewTrackingFallback() {
    const config = await getViewTrackingConfig();
    if (!config?.browserFallbackEnabled) {
        console.log('ℹ️ Browser view tracker disabled');
        return;
    }
    if (browserTrackerTimer) {
        console.log('ℹ️ Browser view tracker already running');
        return;
    }
    const intervalMinutes = Number(config.intervalMinutes || DEFAULT_INTERVAL_MINUTES);
    const intervalMs = Math.max(intervalMinutes, 15) * 60 * 1000;

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
    };

    // 첫 실행 즉시
    runTick().catch(console.error);
    browserTrackerTimer = setInterval(() => {
        runTick().catch(console.error);
    }, intervalMs);
}

