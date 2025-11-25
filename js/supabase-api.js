// ============================================
// SUPABASE-API.JS - Supabase API 함수 모음
// Firestore 대신 Supabase 사용
// ============================================

import { supabase } from './supabase-config.js';

const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const CACHE_TTL_HOURS = 72;

// ============================================
// 캐시 로드 함수
// ============================================

export async function loadFromSupabase(query) {
    try {
        const keyword = query.trim().toLowerCase();
        
        // Check search_cache first
        const { data: cacheMeta, error: cacheError } = await supabase
            .from('search_cache')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (cacheError || !cacheMeta) {
            console.log(`🔭 Supabase 캐시 없음: "${keyword}"`);
            return null;
        }

        const age = Date.now() - new Date(cacheMeta.updated_at).getTime();
        const ageHours = age / (1000 * 60 * 60);

        // Check cache version
        const CURRENT_VERSION = '1.32';
        if (cacheMeta.cache_version < CURRENT_VERSION) {
            console.warn(`🔄 구버전 캐시 (v${cacheMeta.cache_version} → v${CURRENT_VERSION})`);
            return null;
        }

        // Check if expired
        if (age >= CACHE_TTL_MS) {
            console.log(`⏰ Supabase 캐시 만료 (${CACHE_TTL_HOURS}시간 초과)`);
            return null;
        }

        // Load videos for this keyword
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('keyword', keyword)
            .order('created_at', { ascending: false });

        if (videosError || !videos?.length) {
            console.log('⚠️ Supabase에서 비디오 데이터 없음');
            return null;
        }

        console.log(`☁️ Supabase 캐시 발견: ${videos.length}개 항목, ${ageHours.toFixed(1)}시간 전`);
        console.log(`📊 캐시 소스: ${cacheMeta.data_source || 'unknown'}`);

        // Convert to Firestore-compatible format
        const channels = {};
        videos.forEach(v => {
            if (v.channel_id && !channels[v.channel_id]) {
                channels[v.channel_id] = {
                    id: v.channel_id,
                    snippet: { title: v.channel_title },
                    statistics: {}
                };
            }
        });

        const items = videos.map(v => ({
            raw: {
                id: v.video_id,
                snippet: {
                    title: v.title,
                    channelId: v.channel_id,
                    channelTitle: v.channel_title,
                    publishedAt: v.published_at,
                    thumbnails: {
                        maxres: { url: v.thumbnail_url || `https://img.youtube.com/vi/${v.video_id}/maxresdefault.jpg` }
                    }
                },
                statistics: {
                    viewCount: String(v.view_count || 0),
                    likeCount: String(v.like_count || 0)
                },
                contentDetails: {
                    duration: v.duration || 'PT0S'
                }
            }
        }));

        return {
            videos: videos.map(v => ({
                id: v.video_id,
                title: v.title,
                channelId: v.channel_id,
                channelTitle: v.channel_title,
                publishedAt: v.published_at,
                viewCount: v.view_count,
                likeCount: v.like_count,
                duration: v.duration
            })),
            channels,
            items,
            timestamp: new Date(cacheMeta.updated_at).getTime(),
            cacheVersion: cacheMeta.cache_version,
            dataSource: cacheMeta.data_source || 'google',
            meta: {
                total: cacheMeta.total_count,
                nextPageToken: cacheMeta.next_page_token,
                source: cacheMeta.data_source
            }
        };
    } catch (error) {
        console.error('❌ Supabase 캐시 로드 실패:', error);
        return null;
    }
}

// ============================================
// 캐시 저장 함수
// ============================================

export async function saveToSupabase(query, videos, channels, items, dataSource = 'google', nextPageToken = null) {
    try {
        const keyword = query.trim().toLowerCase();
        const now = new Date().toISOString();

        // Upsert search_cache
        const { error: cacheError } = await supabase
            .from('search_cache')
            .upsert({
                keyword,
                total_count: videos.length,
                data_source: dataSource,
                cache_version: '1.32',
                next_page_token: nextPageToken,
                updated_at: now
            }, {
                onConflict: 'keyword'
            });

        if (cacheError) {
            console.error('❌ search_cache 저장 실패:', cacheError);
        }

        // Delete old videos for this keyword
        await supabase
            .from('videos')
            .delete()
            .eq('keyword', keyword);

        // Insert new videos
        const videoRecords = videos.map(v => ({
            video_id: v.id,
            keyword,
            title: v.snippet?.title,
            channel_id: v.snippet?.channelId,
            channel_title: v.snippet?.channelTitle,
            published_at: v.snippet?.publishedAt,
            view_count: Number(v.statistics?.viewCount || 0),
            like_count: Number(v.statistics?.likeCount || 0),
            duration: v.contentDetails?.duration,
            thumbnail_url: v.snippet?.thumbnails?.maxres?.url || 
                          v.snippet?.thumbnails?.high?.url ||
                          `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`
        }));

        // Insert in batches of 1000
        for (let i = 0; i < videoRecords.length; i += 1000) {
            const batch = videoRecords.slice(i, i + 1000);
            const { error: insertError } = await supabase
                .from('videos')
                .insert(batch);

            if (insertError) {
                console.error(`❌ 비디오 저장 실패 (batch ${i}):`, insertError);
            } else {
                console.log(`✅ Supabase 캐시 저장 완료: ${batch.length}개 (batch ${i / 1000 + 1})`);
            }
        }

        // Auto-track video IDs
        await trackVideoIdsForViewHistory(videos);

    } catch (error) {
        console.error('❌ Supabase 캐시 저장 실패:', error);
    }
}

// ============================================
// Video ID 자동 추적
// ============================================

export async function trackVideoIdsForViewHistory(videos) {
    try {
        // video.id는 이미 문자열 (videos.list 응답)
        // video.id.videoId는 search.list 응답에서만 사용
        const ids = Array.from(new Set(
            (videos || [])
                .map(video => {
                    // videos.list 응답: video.id는 직접 문자열
                    // search.list 응답: video.id.videoId
                    const id = video?.id?.videoId || video?.id;
                    if (!id) {
                        console.warn('⚠️ videoId 추출 실패:', video);
                        return null;
                    }
                    return id;
                })
                .filter(Boolean)
        ));
        
        if (!ids.length) {
            console.warn('⚠️ trackVideoIdsForViewHistory: 추출된 videoId가 없습니다');
            return;
        }
        
        console.log(`📌 추출된 videoId 목록 (${ids.length}개):`, ids.slice(0, 5)); // 처음 5개만 로그

        // Get current config
        const { data: config } = await supabase
            .from('view_tracking_config')
            .select('id, video_ids')
            .limit(1)
            .single();

        const existing = config?.video_ids || [];
        const newIds = ids.filter(id => !existing.includes(id));

        if (!newIds.length) return;

        // Update config
        const merged = Array.from(new Set([...existing, ...newIds]));
        const payload = {
            video_ids: merged,
            updated_at: new Date().toISOString()
        };
        if (config?.id) {
            payload.id = config.id;
        }
        await supabase
            .from('view_tracking_config')
            .upsert(payload, {
                onConflict: 'id'
            });

        console.log(`📌 viewTracking에 ${newIds.length}개 videoId 추가`);
    } catch (error) {
        console.warn('⚠️ viewTracking videoId 업데이트 실패:', error);
    }
}

// ============================================
// YouTube API 검색 (기존과 동일)
// ============================================

const chunk = (a, n = 50) => Array.from({length: Math.ceil(a.length/n)}, (_,i)=>a.slice(i*n, (i+1)*n));

// Throttle helper: API 요청 사이 딜레이 추가
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_THROTTLE_MS = 200; // 요청 사이 200ms 딜레이

export async function searchYouTubeAPI(query, apiKeyValue) {
    try {
        console.log('🌐 Google API 호출 중...');
        
        let searchItems = [];
        let nextPageToken = null;
        const MAX_RESULTS = 10; // Reduced to 10 for minimal API calls
        
        // Only fetch first page (10 results) to minimize API calls
        for (let page = 0; page < 1 && searchItems.length < MAX_RESULTS; page++) {
            // Throttle: 첫 페이지 이후 딜레이 추가
            if (page > 0) {
                await delay(API_THROTTLE_MS);
            }
            
            const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&order=relevance&key=${apiKeyValue}${pageParam}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.error && searchData.error.code === 403) {
                console.warn("⚠️ Google API 한도 초과");
                throw new Error("quotaExceeded");
            }
            
            searchItems.push(...(searchData.items || []));
            nextPageToken = searchData.nextPageToken;
            
            if (!nextPageToken || searchItems.length >= MAX_RESULTS) break;
        }
        
        // 10개로 제한
        searchItems = searchItems.slice(0, MAX_RESULTS);
        
        console.log(`✅ Google API 정상 작동 (${searchItems.length}개 검색 결과)`);

        const videoIds = searchItems.map(item => item.id.videoId).filter(Boolean);
        console.log(`📋 비디오 ID 추출: ${videoIds.length}개`);
        
        let videoDetails = [];
        const videoIdChunks = chunk(videoIds, 50);
        for (let i = 0; i < videoIdChunks.length; i++) {
            // Throttle: 배치 사이 딜레이
            if (i > 0) {
                await delay(API_THROTTLE_MS);
            }
            
            const ids = videoIdChunks[i];
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${apiKeyValue}`;
            const r = await fetch(url);
            const d = await r.json();
            videoDetails.push(...(d.items || []));
        }
        console.log(`📹 비디오 상세 정보: ${videoDetails.length}개`);

        const channelIds = [...new Set(videoDetails.map(v => v.snippet.channelId))];
        let channelsMap = {};
        const channelIdChunks = chunk(channelIds, 50);
        for (let i = 0; i < channelIdChunks.length; i++) {
            // Throttle: 배치 사이 딜레이
            if (i > 0) {
                await delay(API_THROTTLE_MS);
            }
            
            const ids = channelIdChunks[i];
            const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${apiKeyValue}`;
            const r = await fetch(url);
            const d = await r.json();
            (d.items || []).forEach(ch => { channelsMap[ch.id] = ch; });
        }
        console.log(`👥 채널 정보: ${Object.keys(channelsMap).length}개`);

        return {
            videos: videoDetails,
            channels: channelsMap,
            nextPageToken
        };
    } catch (error) {
        console.error('❌ YouTube API 오류:', error);
        throw error;
    }
}

// ============================================
// VPH 데이터 가져오기 (다층 캐싱: LocalStorage → Supabase → Server)
// ============================================

const VPH_LOCAL_CACHE_PREFIX = 'vph_snapshot_';
const VPH_CACHE_TTL = 5 * 60 * 1000; // 5분

// LocalStorage의 오래된 VPH 캐시 정리 (주기적으로 실행)
export function cleanupOldVphCache() {
    try {
        const now = Date.now();
        let cleanedCount = 0;
        const keysToRemove = [];
        
        // 모든 localStorage 키 확인
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(VPH_LOCAL_CACHE_PREFIX)) {
                try {
                    const cached = localStorage.getItem(key);
                    if (!cached) continue;
                    
                    const data = JSON.parse(cached);
                    const age = now - (data.cachedAt || 0);
                    
                    // TTL을 초과한 캐시는 삭제 대상
                    if (age >= VPH_CACHE_TTL) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // 파싱 실패한 항목도 삭제
                    keysToRemove.push(key);
                }
            }
        }
        
        // 삭제 실행
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            cleanedCount++;
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 VPH LocalStorage 캐시 정리 완료: ${cleanedCount}개 삭제`);
        }
        
        return cleanedCount;
    } catch (error) {
        console.warn('⚠️ VPH 캐시 정리 실패:', error);
        return 0;
    }
}

// LocalStorage에서 VPH 스냅샷 로드
function loadVphFromLocalStorage(videoId) {
    try {
        const cacheKey = `${VPH_LOCAL_CACHE_PREFIX}${videoId}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const age = Date.now() - (data.cachedAt || 0);
        
        if (age < VPH_CACHE_TTL && data.stats) {
            console.log(`💾 VPH 로컬 캐시 사용 (${videoId})`);
            return data.stats;
        }
        
        // 만료된 캐시 삭제
        localStorage.removeItem(cacheKey);
        return null;
    } catch (error) {
        return null;
    }
}

// LocalStorage에 VPH 스냅샷 저장
function saveVphToLocalStorage(videoId, stats) {
    try {
        const cacheKey = `${VPH_LOCAL_CACHE_PREFIX}${videoId}`;
        const data = {
            stats,
            cachedAt: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
        console.log(`💾 VPH LocalStorage 저장 완료: ${cacheKey}`);
    } catch (error) {
        // 용량 초과 등 에러는 무시
        console.warn(`⚠️ VPH LocalStorage 저장 실패 (${videoId}):`, error);
    }
}

export async function getRecentVelocityForVideo(videoId) {
    try {
        if (!videoId) {
            console.warn('⚠️ VPH 계산: videoId가 없습니다');
            return null;
        }
        
        // ⚠️ 중요: 항상 서버(Supabase) 데이터를 우선 사용
        // LocalStorage는 오프라인 폴백용으로만 사용하며, 주기적으로 정리됨
        console.log(`🔍 Supabase view_history 쿼리 시작: video_id="${videoId}"`);
        
        // 최근 2개 스냅샷 가져오기 (VPH 계산용)
        const { data: recentData, error: recentError } = await supabase
            .from('view_history')
            .select('view_count, fetched_at')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: false })
            .limit(2);

        if (recentError) {
            console.warn(`⚠️ VPH 데이터 로드 실패 (${videoId}):`, recentError);
            return null;
        }
        
        console.log(`📊 Supabase 쿼리 결과 (${videoId}): ${recentData?.length || 0}개 스냅샷 발견`);
        if (recentData && recentData.length > 0) {
            console.log(`  - 최신: ${recentData[0].fetched_at} (조회수: ${recentData[0].view_count})`);
            if (recentData.length > 1) {
                console.log(`  - 이전: ${recentData[1].fetched_at} (조회수: ${recentData[1].view_count})`);
            }
        }
        
        if (!recentData || recentData.length < 2) {
            console.log(`⚪ VPH 데이터 없음 (${videoId}): 스냅샷 ${recentData?.length || 0}개 (2개 필요)`);
            // video_id로 전체 스냅샷 개수 확인
            const { count } = await supabase
                .from('view_history')
                .select('*', { count: 'exact', head: true })
                .eq('video_id', videoId);
            console.log(`  📊 view_history 테이블에 ${videoId}의 총 스냅샷: ${count || 0}개`);
            return null;
        }

        // 최초 스냅샷 가져오기 (전체 경과 시간 계산용)
        const { data: firstData, error: firstError } = await supabase
            .from('view_history')
            .select('view_count, fetched_at')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        
        if (firstError) {
            console.warn(`⚠️ 최초 스냅샷 로드 실패 (${videoId}):`, firstError);
        }

        const [latest, previous] = recentData;
        const growth = latest.view_count - previous.view_count;
        const diffHours = (new Date(latest.fetched_at).getTime() - new Date(previous.fetched_at).getTime()) / (1000 * 60 * 60);
        const vph = diffHours > 0 ? growth / diffHours : 0;

        // 최초 데이터와 현재 시간 정보
        const first = firstData || null;
        const now = new Date();
        
        // 전체 경과 시간 계산
        let totalElapsedHours = 0;
        let totalElapsedDays = 0;
        let totalGrowth = 0;
        
        if (first) {
            totalElapsedHours = (now.getTime() - new Date(first.fetched_at).getTime()) / (1000 * 60 * 60);
            totalElapsedDays = totalElapsedHours / 24;
            totalGrowth = latest.view_count - first.view_count;
        }

        const stats = {
            vph,
            vpd: vph * 24,
            recentGrowth: growth,
            diffHours,
            latest: { viewCount: latest.view_count, fetchedAt: new Date(latest.fetched_at) },
            previous: { viewCount: previous.view_count, fetchedAt: new Date(previous.fetched_at) },
            first: first ? { viewCount: first.view_count, fetchedAt: new Date(first.fetched_at) } : null,
            now: now,
            totalElapsedHours,
            totalElapsedDays,
            totalGrowth
        };
        
        // 2️⃣ LocalStorage에 단기 캐시 저장 (오프라인 폴백용, 5분 TTL)
        // 주의: 이 캐시는 주기적으로 정리되므로 서버 데이터를 항상 우선 사용
        saveVphToLocalStorage(videoId, stats);
        console.log(`✅ VPH 서버 데이터(Supabase)로 계산 완료 (${videoId})`);
        
        return stats;
    } catch (error) {
        console.warn('⚠️ VPH 서버 데이터 로드 실패:', error);
        
        // 서버 데이터 로드 실패 시 LocalStorage 폴백 (오프라인 지원)
        const localStats = loadVphFromLocalStorage(videoId);
        if (localStats) {
            console.log(`💾 VPH 로컬 캐시 폴백 사용 (${videoId})`);
            return localStats;
        }
        
        return null;
    }
}

// Export constants
export { CACHE_TTL_MS, CACHE_TTL_HOURS };

