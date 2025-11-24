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

async function trackVideoIdsForViewHistory(videos) {
    try {
        const ids = Array.from(new Set(
            (videos || [])
                .map(video => video?.id?.videoId || video?.id)
                .filter(Boolean)
        ));
        if (!ids.length) return;

        // Get current config
        const { data: config } = await supabase
            .from('view_tracking_config')
            .select('video_ids')
            .limit(1)
            .single();

        const existing = config?.video_ids || [];
        const newIds = ids.filter(id => !existing.includes(id));

        if (!newIds.length) return;

        // Update config
        const merged = Array.from(new Set([...existing, ...newIds]));
        await supabase
            .from('view_tracking_config')
            .upsert({
                video_ids: merged,
                updated_at: new Date().toISOString()
            }, {
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
        const MAX_RESULTS = 70;
        
        for (let page = 0; page < 2 && searchItems.length < MAX_RESULTS; page++) {
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
        
        // 70개로 제한
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
// VPH 데이터 가져오기
// ============================================

export async function getRecentVelocityForVideo(videoId) {
    try {
        const { data, error } = await supabase
            .from('view_history')
            .select('view_count, fetched_at')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: false })
            .limit(2);

        if (error || !data || data.length < 2) {
            return null;
        }

        const [latest, previous] = data;
        const growth = latest.view_count - previous.view_count;
        const diffHours = (new Date(latest.fetched_at).getTime() - new Date(previous.fetched_at).getTime()) / (1000 * 60 * 60);
        const vph = diffHours > 0 ? growth / diffHours : 0;

        return {
            vph,
            vpd: vph * 24,
            recentGrowth: growth,
            diffHours,
            latest: { viewCount: latest.view_count, fetchedAt: new Date(latest.fetched_at) },
            previous: { viewCount: previous.view_count, fetchedAt: new Date(previous.fetched_at) }
        };
    } catch (error) {
        console.warn('⚠️ VPH 데이터 로드 실패:', error);
        return null;
    }
}

// Export constants
export { CACHE_TTL_MS, CACHE_TTL_HOURS };

