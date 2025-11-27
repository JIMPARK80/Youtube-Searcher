// ============================================
// SUPABASE-API.JS - Supabase API 함수 모음
// Firestore 대신 Supabase 사용
// ============================================

import { supabase } from './supabase-config.js';
import { formatDateTorontoSimple } from './ui.js';

const CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const CACHE_TTL_HOURS = 72;

// ============================================
// 캐시 로드 함수
// ============================================

export async function loadFromSupabase(query, ignoreExpiry = false) {
    try {
        const keyword = query.trim().toLowerCase();
        
        // Check search_cache first
        const { data: cacheMeta, error: cacheError } = await supabase
            .from('search_cache')
            .select('*')
            .eq('keyword', keyword)
            .single();

        if (cacheError || !cacheMeta) {
            return null;
        }

        const age = Date.now() - new Date(cacheMeta.updated_at).getTime();
        const ageHours = age / (1000 * 60 * 60);

        // Check cache version (할당량 초과 시에는 버전 체크 스킵)
        if (!ignoreExpiry) {
            const CURRENT_VERSION = '1.32';
            if (cacheMeta.cache_version < CURRENT_VERSION) {
                console.warn(`🔄 구버전 캐시 (v${cacheMeta.cache_version} → v${CURRENT_VERSION})`);
                return null;
            }

            if (age >= CACHE_TTL_MS) {
                return null;
            }
        }
        

        // Load videos for this keyword (제한 없이 모든 데이터 가져오기)
        // Supabase 기본 제한은 1000개이므로 페이지네이션 사용
        let allVideos = [];
        let from = 0;
        const pageSize = 1000; // Supabase 기본 제한
        let hasMore = true;
        let videosError = null; // 루프 밖에서도 접근 가능하도록 선언
        
        while (hasMore) {
            // keyword가 배열 타입인 경우를 대비
            // 먼저 .eq() 시도, 배열 에러 발생 시 .cs() (contains) 사용
            let query = supabase
                .from('videos')
                .select('video_id, channel_id, title, view_count, like_count, subscriber_count, duration, channel_title, published_at, thumbnail_url')
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1);
            
            // keyword 필터 적용 (배열 타입이므로 contains 사용)
            // keyword 컬럼이 배열 타입이므로 처음부터 .contains() 사용
            query = query.contains('keyword', [keyword]);
            
            const { data: videos, error: error } = await query;
            
            videosError = error; // 에러 저장
            
            if (videosError) {
                console.error('❌ Supabase 비디오 로드 오류:', videosError);
                break;
            }
            
            if (!videos || videos.length === 0) {
                hasMore = false;
                break;
            }
            
            allVideos = allVideos.concat(videos);
            
            // 1000개 미만이면 마지막 페이지
            if (videos.length < pageSize) {
                hasMore = false;
            } else {
                from += pageSize;
            }
        }
        
        const videos = allVideos;

        if (videosError || !videos?.length) {
            return null;
        }

        const cacheTimeToronto = formatDateTorontoSimple(new Date(cacheMeta.updated_at));
        
        // 디버그: 구독자 수 데이터 확인 (첫 3개만 - 성능 최적화)
        if (videos.length > 0) {
            videos.slice(0, 3).forEach(v => {
            });
        }

        // Convert to Firestore-compatible format
        // 채널 정보는 로컬 캐시에서 가져오거나 items에서 복원
        const channels = {};
        
        // 로컬 캐시에서 채널 정보 가져오기 시도
        try {
            const localCacheKey = `cache_${keyword}`;
            const localCache = localStorage.getItem(localCacheKey);
            if (localCache) {
                const localData = JSON.parse(localCache);
                if (localData.channels) {
                    Object.assign(channels, localData.channels);
                }
            }
        } catch (e) {
            // 로컬 캐시 로드 실패 시 무시
        }
        
        // 로컬 캐시에 없으면 기본 채널 정보만 생성 (구독자 수는 items에서 복원)
        videos.forEach(v => {
            if (v.channel_id && !channels[v.channel_id]) {
                channels[v.channel_id] = {
                    id: v.channel_id,
                    snippet: { title: v.channel_title },
                    statistics: {} // 구독자 수는 items에서 복원됨
                };
            }
        });

        // 로컬 캐시에서 items 정보 가져오기 (subs 포함)
        let localItems = null;
        try {
            const localCacheKey = `cache_${keyword}`;
            const localCache = localStorage.getItem(localCacheKey);
            if (localCache) {
                const localData = JSON.parse(localCache);
                if (localData.items && Array.isArray(localData.items)) {
                    localItems = new Map(localData.items.map(item => [item.id, item]));
                }
            }
        } catch (e) {
            // 로컬 캐시 로드 실패 시 무시
        }
        
        const items = videos.map(v => {
            const localItem = localItems?.get(v.video_id);
            const channelId = v.channel_id;
            const channel = channels[channelId];
            
            // 구독자 수: Supabase 저장값 > 로컬 캐시 > 채널 정보 순으로 우선순위
            // -1은 구독자 수가 숨겨진 경우를 의미하므로 0으로 처리
            let subscriberCount = 0;
            
            // Supabase에서 구독자 수 확인 (null, undefined가 아니고 -1이 아닌 경우)
            // 0도 유효한 값이므로 명시적으로 체크
            if (v.subscriber_count !== null && v.subscriber_count !== undefined && v.subscriber_count !== -1) {
                const parsedCount = Number(v.subscriber_count);
                // NaN이 아니고 유효한 숫자인 경우만 사용
                if (!isNaN(parsedCount) && isFinite(parsedCount)) {
                    subscriberCount = parsedCount;
                } else {
                    // 파싱 실패 시 로컬 캐시나 채널 정보 사용
                    subscriberCount = localItem?.subs ?? (channel?.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : 0);
                }
            } else if (v.subscriber_count === -1) {
                // 숨겨진 경우
                subscriberCount = 0;
            } else {
                // Supabase에 없으면 로컬 캐시나 채널 정보 사용
                subscriberCount = localItem?.subs ?? (channel?.statistics?.subscriberCount ? Number(channel.statistics.subscriberCount) : 0);
            }
            
            // 디버그: 구독자 수 로드 확인 (첫 번째 항목만)
            if (v.video_id === videos[0]?.video_id) {
            }
            
            // 채널 정보에 구독자 수 추가 (로컬 캐시에 없을 때)
            if (channel && !channel.statistics?.subscriberCount && subscriberCount > 0) {
                if (!channel.statistics) channel.statistics = {};
                channel.statistics.subscriberCount = subscriberCount;
            }
            
            return {
                id: v.video_id,
                vpd: localItem?.vpd ?? 0,
                vclass: localItem?.vclass ?? 'unknown',
                cband: localItem?.cband ?? 'unknown',
                subs: subscriberCount, // Supabase에서 구독자 수 복원
                raw: {
                    id: v.video_id,
                    snippet: {
                        title: v.title,
                        channelId: channelId,
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
            };
        });

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

        // 기존 total_count 확인 (더 큰 값 유지)
        const { data: existingCache } = await supabase
            .from('search_cache')
            .select('total_count')
            .eq('keyword', keyword)
            .single();
        
        const currentCount = videos.length;
        const existingTotalCount = existingCache?.total_count || 0;
        
        // 기존 total_count와 비교해서 더 큰 값 사용 (total_count가 줄어들지 않도록)
        const totalCount = Math.max(currentCount, existingTotalCount);
        
        
        const { error: cacheError } = await supabase
            .from('search_cache')
            .upsert({
                keyword,
                total_count: totalCount,
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

        // 기존 비디오의 구독자 수를 먼저 조회 (서버 데이터 우선 사용)
        const existingVideoIds = videos.map(v => v.id);
        const { data: existingVideos } = await supabase
            .from('videos')
            .select('video_id, subscriber_count')
            .in('video_id', existingVideoIds);
        
        const existingSubscriberMap = new Map();
        if (existingVideos) {
            existingVideos.forEach(v => {
                if (v.subscriber_count !== null && v.subscriber_count !== undefined && v.subscriber_count !== -1) {
                    existingSubscriberMap.set(v.video_id, Number(v.subscriber_count));
                }
            });
        }

        // Note: 기존 비디오 삭제 제거 - upsert로 중복 처리하므로 불필요
        // Delete old videos for this keyword - REMOVED to prevent data loss on insert failure
        
        // Prepare video records (구독자 수 포함)
        // 중복 제거를 위해 Map 사용 (video_id를 키로, 마지막 값이 우선)
        const videoRecordsMap = new Map();
        
        videos.forEach(v => {
            const channelId = v.snippet?.channelId;
            const channel = channels?.[channelId];
            
            // 구독자 수 추출: 서버 기존 데이터 > YouTube API > null 순으로 우선순위
            let subscriberCount = null;
            
            // 1. 서버에 기존 구독자 수가 있으면 우선 사용
            if (existingSubscriberMap.has(v.id)) {
                subscriberCount = existingSubscriberMap.get(v.id);
            } else if (channel) {
                // 2. YouTube API에서 가져온 채널 정보 사용
                if (channel.statistics && channel.statistics.subscriberCount) {
                    subscriberCount = Number(channel.statistics.subscriberCount);
                } else if (channel.statistics && channel.statistics.hiddenSubscriberCount) {
                    // 구독자 수가 숨겨진 경우
                    subscriberCount = -1; // 숨겨진 경우 -1로 마킹
                }
            }
            
            // 디버그 로그는 조용히 처리 (서버에 데이터가 있으면 경고 없음)
            if (subscriberCount && subscriberCount > 0) {
                // 조용히 처리 (필요시 주석 해제)
            } else if (subscriberCount === -1) {
                // 숨겨진 경우는 조용히 처리
            }
            // 경고는 제거 (서버에 데이터가 있으면 나중에 로드됨)
            
            // Map에 추가 (중복이면 마지막 값으로 덮어쓰기)
            // keyword는 배열 타입이므로 배열로 변환
            const keywordArray = Array.isArray(keyword) ? keyword : [keyword];
            videoRecordsMap.set(v.id, {
                video_id: v.id,
                keyword: keywordArray, // 배열로 저장
                title: v.snippet?.title,
                channel_id: channelId,
                channel_title: v.snippet?.channelTitle,
                published_at: v.snippet?.publishedAt,
                view_count: Number(v.statistics?.viewCount || 0),
                like_count: Number(v.statistics?.likeCount || 0),
                subscriber_count: subscriberCount, // 구독자 수 추가
                duration: v.contentDetails?.duration,
                thumbnail_url: v.snippet?.thumbnails?.maxres?.url || 
                              v.snippet?.thumbnails?.high?.url ||
                              `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`
            });
        });
        
        // Map에서 배열로 변환 (중복 제거됨)
        const videoRecords = Array.from(videoRecordsMap.values());

        // Upsert in batches of 1000 (handle duplicate video_id gracefully)
        for (let i = 0; i < videoRecords.length; i += 1000) {
            const batch = videoRecords.slice(i, i + 1000);
            const { error: upsertError } = await supabase
                .from('videos')
                .upsert(batch, {
                    onConflict: 'video_id',
                    ignoreDuplicates: false // Update existing records
                });

            if (upsertError) {
                // 21000: 같은 배치 내 중복 키 에러, 23505: 일반 중복 키 에러
                if (upsertError.code === '21000' || upsertError.code === '23505' || upsertError.message?.includes('duplicate') || upsertError.message?.includes('ON CONFLICT')) {
                    console.warn(`⚠️ 중복 비디오 감지 (batch ${i / 1000 + 1}), 배치 내 중복 제거 후 재시도...`);
                    // 배치 내 중복 제거
                    const uniqueBatch = Array.from(
                        new Map(batch.map(record => [record.video_id, record])).values()
                    );
                    
                    if (uniqueBatch.length < batch.length) {
                    }
                    
                    // 중복 제거된 배치로 재시도
                    const { error: retryError } = await supabase
                        .from('videos')
                        .upsert(uniqueBatch, { onConflict: 'video_id' });
                    
                    if (retryError) {
                        // 재시도 실패 시 개별 upsert로 처리
                        console.warn(`  → 배치 재시도 실패, 개별 처리로 전환...`);
                        let successCount = 0;
                        for (const record of uniqueBatch) {
                            const { error: singleError } = await supabase
                                .from('videos')
                                .upsert(record, { onConflict: 'video_id' });
                            if (!singleError) successCount++;
                        }
                        } else {
                    }
                } else {
                    console.error(`❌ 비디오 저장 실패 (batch ${i / 1000 + 1}):`, upsertError);
                }
            } else {
            }
        }

        // Auto-track video IDs
        await trackVideoIdsForViewHistory(videos);

    } catch (error) {
        console.error('❌ Supabase 캐시 저장 실패:', error);
    }
}

// ============================================
// NULL 데이터 업데이트 함수 (모든 필드, 2회 시도 후 스킵)
// ============================================

export async function updateMissingData(apiKeyValue, limit = 100, maxAttempts = 2, keyword = null) {
    try {
        const keywordFilter = keyword ? ` (검색어: "${keyword}")` : '';
        
        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const API_THROTTLE_MS = 200;
        
        // 시도 횟수 추적용 Map (video_id -> attempt_count)
        const attemptMap = new Map();
        const skippedVideoIds = new Set();
        let updatedCount = 0; // 전체 업데이트 카운터 (루프 밖에서 초기화)
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            
            // 1. NULL 필드가 있는 비디오 조회 (특정 검색어가 있으면 해당 검색어만)
            // subscriber_count가 -1인 경우는 제외 (구독자 수가 숨겨진 경우)
            // NULL만 명시적으로 찾기 위해 .is.null 사용
            let query = supabase
                .from('videos')
                .select('video_id, channel_id, title, view_count, like_count, subscriber_count, duration, channel_title, published_at')
                .or('subscriber_count.is.null,view_count.is.null,like_count.is.null,title.is.null,channel_id.is.null,duration.is.null,published_at.is.null')
                .limit(limit);
            
            // subscriber_count가 -1이 아닌 경우만 (NULL은 포함, -1만 제외)
            // NULL과 -1을 구분하기 위해 별도 필터링 필요
            
            // 특정 검색어가 있으면 해당 검색어의 비디오만 체크
            // keyword 컬럼이 배열 타입이므로 .contains() 사용
            if (keyword) {
                const normalizedKeyword = keyword.trim().toLowerCase();
                query = query.contains('keyword', [normalizedKeyword]);
            }
            
            // 스킵된 비디오 제외
            if (skippedVideoIds.size > 0) {
                const skippedArray = Array.from(skippedVideoIds);
                // Supabase는 .not().in()을 지원하지 않으므로, 각각 .neq()로 처리하거나
                // 클라이언트 측에서 필터링
            }
            
            let { data: videosWithNulls, error: fetchError } = await query;
            
            if (fetchError) {
                console.error('❌ NULL 데이터 비디오 조회 실패:', fetchError);
                return { updated: 0, skipped: 0, error: fetchError };
            }
            
            // 디버그: 조회 결과 확인
            
            // 디버그: 조회된 비디오 정보 출력
            if (videosWithNulls && videosWithNulls.length > 0) {
                // 첫 5개만 상세 출력
                videosWithNulls.slice(0, 5).forEach(v => {
                    const nullFields = [];
                    if (v.subscriber_count === null || v.subscriber_count === undefined) nullFields.push('subscriber_count');
                    if (v.view_count === null || v.view_count === undefined) nullFields.push('view_count');
                    if (v.like_count === null || v.like_count === undefined) nullFields.push('like_count');
                    if (!v.title) nullFields.push('title');
                    if (!v.channel_id) nullFields.push('channel_id');
                    if (!v.duration) nullFields.push('duration');
                    if (!v.published_at) nullFields.push('published_at');
                });
            } else {
                // 결과가 없을 때도 디버그 정보 출력
            }
            
            // 스킵된 비디오 및 -1 값 필터링 (NULL은 유지, -1만 제외)
            const videosToProcess = (videosWithNulls || []).filter(v => {
                // 스킵된 비디오 제외
                if (skippedVideoIds.has(v.video_id)) return false;
                // subscriber_count가 -1인 경우 제외 (NULL은 포함)
                if (v.subscriber_count === -1) return false;
                return true;
            });
            
            if (videosToProcess.length === 0) {
                break;
            }
            
            // 2. video_id 수집 (중복 제거)
            const videoIds = [...new Set(videosToProcess.map(v => v.video_id).filter(Boolean))];
            
            if (videoIds.length === 0) {
                break;
            }
            
            // 3. YouTube API로 비디오 정보 조회 (50개씩 배치)
            let videoDetailsMap = {};
            const videoIdChunks = chunk(videoIds, 50);
            
            for (let i = 0; i < videoIdChunks.length; i++) {
                if (i > 0) {
                    await delay(API_THROTTLE_MS);
                }
                
                const ids = videoIdChunks[i];
                const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${apiKeyValue}`;
                const r = await fetch(url);
                const d = await r.json();
                
                if (d.error) {
                    console.error('❌ YouTube API 오류:', d.error);
                    continue;
                }
                
                (d.items || []).forEach(v => { 
                    videoDetailsMap[v.id] = v;
                });
            }
            
            
            // 4. 채널 ID 수집 및 채널 정보 조회
            const channelIds = [...new Set(
                Object.values(videoDetailsMap)
                    .map(v => v.snippet?.channelId)
                    .filter(Boolean)
            )];
            
            let channelsMap = {};
            if (channelIds.length > 0) {
                const channelIdChunks = chunk(channelIds, 50);
                for (let i = 0; i < channelIdChunks.length; i++) {
                    if (i > 0) {
                        await delay(API_THROTTLE_MS);
                    }
                    
                    const ids = channelIdChunks[i];
                    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(",")}&key=${apiKeyValue}`;
                    const r = await fetch(url);
                    const d = await r.json();
                    
                    if (d.error) {
                        console.error('❌ YouTube API 오류:', d.error);
                        continue;
                    }
                    
                    (d.items || []).forEach(ch => { 
                        channelsMap[ch.id] = ch;
                    });
                }
            }
            
            // 5. Supabase 업데이트
            // updatedCount는 루프 밖에서 이미 초기화됨
            
            for (const video of videosToProcess) {
                const videoId = video.video_id;
                const videoDetail = videoDetailsMap[videoId];
                
                if (!videoDetail) {
                    // API에서 비디오를 찾을 수 없음 (삭제되었을 수 있음)
                    attemptMap.set(videoId, (attemptMap.get(videoId) || 0) + 1);
                    if (attemptMap.get(videoId) >= maxAttempts) {
                        skippedVideoIds.add(videoId);
                    }
                    continue;
                }
                
                const channelId = videoDetail.snippet?.channelId;
                const channel = channelId ? channelsMap[channelId] : null;
                
                // 업데이트할 필드 수집
                const updateData = {};
                let hasUpdate = false;
                
                // 비디오 정보 업데이트
                if (!video.title && videoDetail.snippet?.title) {
                    updateData.title = videoDetail.snippet.title;
                    hasUpdate = true;
                }
                if (!video.channel_id && channelId) {
                    updateData.channel_id = channelId;
                    hasUpdate = true;
                }
                if (!video.channel_title && videoDetail.snippet?.channelTitle) {
                    updateData.channel_title = videoDetail.snippet.channelTitle;
                    hasUpdate = true;
                }
                if (!video.published_at && videoDetail.snippet?.publishedAt) {
                    updateData.published_at = videoDetail.snippet.publishedAt;
                    hasUpdate = true;
                }
                if ((video.view_count === null || video.view_count === undefined) && videoDetail.statistics?.viewCount) {
                    updateData.view_count = Number(videoDetail.statistics.viewCount);
                    hasUpdate = true;
                }
                if ((video.like_count === null || video.like_count === undefined) && videoDetail.statistics?.likeCount) {
                    updateData.like_count = Number(videoDetail.statistics.likeCount);
                    hasUpdate = true;
                }
                if (!video.duration && videoDetail.contentDetails?.duration) {
                    updateData.duration = videoDetail.contentDetails.duration;
                    hasUpdate = true;
                }
                
                // 채널 정보 업데이트 (구독자 수)
                if ((video.subscriber_count === null || video.subscriber_count === undefined) && channel?.statistics) {
                    if (channel.statistics.subscriberCount) {
                        // 구독자 수가 있는 경우
                        updateData.subscriber_count = Number(channel.statistics.subscriberCount);
                        hasUpdate = true;
                    } else if (channel.statistics.hiddenSubscriberCount === true) {
                        // 구독자 수가 숨겨진 경우: -1로 마킹하여 더 이상 업데이트 시도하지 않음
                        updateData.subscriber_count = -1;
                        hasUpdate = true;
                    }
                }
                
                // 업데이트 실행
                if (hasUpdate) {
                    const { error: updateError } = await supabase
                        .from('videos')
                        .update(updateData)
                        .eq('video_id', videoId);
                    
                    if (updateError) {
                        console.error(`❌ 비디오 ${videoId} 업데이트 실패:`, updateError);
                        attemptMap.set(videoId, (attemptMap.get(videoId) || 0) + 1);
                        if (attemptMap.get(videoId) >= maxAttempts) {
                            skippedVideoIds.add(videoId);
                        }
                    } else {
                        updatedCount++;
                        // 업데이트 성공 시 시도 횟수 초기화
                        attemptMap.delete(videoId);
                        skippedVideoIds.delete(videoId);
                    }
                } else {
                    // 여전히 NULL 필드가 있음
                    attemptMap.set(videoId, (attemptMap.get(videoId) || 0) + 1);
                    if (attemptMap.get(videoId) >= maxAttempts) {
                        skippedVideoIds.add(videoId);
                    }
                }
            }
            
            if (attempt < maxAttempts && skippedVideoIds.size < videosToProcess.length) {
                await delay(1000);
            }
        }
        
        // 6. 2회 시도 후에도 NULL인 비디오 삭제
        let deletedCount = 0;
        if (skippedVideoIds.size > 0) {
            const skippedArray = Array.from(skippedVideoIds);
            
            // 배치로 삭제 (한 번에 너무 많이 삭제하지 않도록)
            const deleteChunks = chunk(skippedArray, 50);
            for (let i = 0; i < deleteChunks.length; i++) {
                const chunk = deleteChunks[i];
                const { error: deleteError } = await supabase
                    .from('videos')
                    .delete()
                    .in('video_id', chunk);
                
                if (deleteError) {
                    console.error(`❌ 비디오 삭제 실패 (chunk ${i + 1}):`, deleteError);
                } else {
                    deletedCount += chunk.length;
                }
            }
        }
        
        return { updated: updatedCount, deleted: deletedCount, skipped: skippedVideoIds.size };
        
    } catch (error) {
        console.error('❌ NULL 데이터 업데이트 실패:', error);
        return { updated: 0, deleted: 0, skipped: 0, error };
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

export async function searchYouTubeAPI(query, apiKeyValue, maxResults = 30, excludeVideoIds = []) {
    try {
        const excludeSet = new Set(excludeVideoIds);
        
        let searchItems = [];
        let nextPageToken = null;
        const MAX_RESULTS = maxResults; // 동적으로 설정된 최대 결과 수
        let attempts = 0;
        const MAX_ATTEMPTS = 10; // 최대 10페이지까지 시도
        
        // 기존 ID를 제외하고 필요한 수만큼 가져올 때까지 반복
        while (searchItems.length < MAX_RESULTS && attempts < MAX_ATTEMPTS) {
            attempts++;
            
            // Throttle: 첫 페이지 이후 딜레이 추가
            if (attempts > 1) {
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
            
            // 기존 ID 제외하고 필터링
            const newItems = (searchData.items || []).filter(item => {
                const videoId = item.id?.videoId;
                return videoId && !excludeSet.has(videoId);
            });
            
            searchItems.push(...newItems);
            nextPageToken = searchData.nextPageToken;
            
            // 필요한 수만큼 모았거나 더 이상 결과가 없으면 종료
            if (!nextPageToken || searchItems.length >= MAX_RESULTS) {
                break;
            }
        }
        
        // 필요한 수만큼만 제한
        searchItems = searchItems.slice(0, MAX_RESULTS);
        
        const videoIds = searchItems.map(item => item.id.videoId).filter(Boolean);
        
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
// VPH 데이터 가져오기 (Supabase 서버 데이터만 사용)
// ============================================

export async function getRecentVelocityForVideo(videoId) {
    try {
        if (!videoId) {
            console.warn('⚠️ VPH 계산: videoId가 없습니다');
            return null;
        }
        
        // ⚠️ 중요: 항상 서버(Supabase) 데이터만 사용
        // 로그 최소화 (성능 향상 - 50개 영상 시 로그 폭주 방지)
        
        // 전체 스냅샷 개수 확인
        const { count: totalSnapshotCount } = await supabase
            .from('view_history')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', videoId);

        // 최초 스냅샷 가져오기
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

        // 최신 스냅샷 가져오기
        const { data: latestData, error: latestError } = await supabase
            .from('view_history')
            .select('view_count, fetched_at')
            .eq('video_id', videoId)
            .order('fetched_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestError) {
            console.warn(`⚠️ 최신 스냅샷 로드 실패 (${videoId}):`, latestError);
            return null;
        }

        // 최소 2개 스냅샷 필요
        if (!firstData || !latestData || totalSnapshotCount < 2) {
            return {
                insufficient: true,
                snapshotCount: totalSnapshotCount || 0,
                requiredCount: 2,
                message: totalSnapshotCount === 1 
                    ? '데이터 수집 중 (1/2)' 
                    : '데이터 없음'
            };
        }

        // 현재 시간 정의
        const now = new Date();

        // VPH 계산 방식 결정
        // max_entries 제한으로 최초 스냅샷이 삭제될 수 있으므로
        // 스냅샷이 많을 때는 최근 일정 기간(최근 24시간 또는 최근 48시간) 사용
        // 또는 최근 N개 스냅샷의 첫 번째와 마지막 사용
        let growth, diffHours, vph;
        let calculationBase = null; // 계산 기준 스냅샷 (가장 오래된 것)
        
        if (totalSnapshotCount >= 3) {
            // 스냅샷이 많을 때는 최근 일정 기간 사용 (더 안정적)
            // 최근 24시간 또는 최근 48시간의 첫 번째와 마지막 사용
            const recentHours = totalSnapshotCount >= 48 ? 48 : 24; // 스냅샷이 48개 이상이면 48시간, 아니면 24시간
            const cutoffTime = new Date(now.getTime() - recentHours * 60 * 60 * 1000);
            
            // 최근 기간 내의 모든 스냅샷 가져오기
            const { data: recentPeriodData } = await supabase
                .from('view_history')
                .select('view_count, fetched_at')
                .eq('video_id', videoId)
                .gte('fetched_at', cutoffTime.toISOString())
                .order('fetched_at', { ascending: true });
            
            if (recentPeriodData && recentPeriodData.length >= 2) {
                // 최근 기간 내의 첫 번째와 마지막 사용
                const periodFirst = recentPeriodData[0];
                const periodLast = recentPeriodData[recentPeriodData.length - 1];
                calculationBase = periodFirst;
                growth = periodLast.view_count - periodFirst.view_count;
                diffHours = (new Date(periodLast.fetched_at).getTime() - new Date(periodFirst.fetched_at).getTime()) / (1000 * 60 * 60);
                vph = diffHours > 0 ? growth / diffHours : 0;
            } else {
                // 최근 기간 내 데이터가 부족하면 전체 데이터 사용
                // (firstData는 현재 존재하는 가장 오래된 스냅샷)
                calculationBase = firstData;
                growth = latestData.view_count - firstData.view_count;
                diffHours = (new Date(latestData.fetched_at).getTime() - new Date(firstData.fetched_at).getTime()) / (1000 * 60 * 60);
                vph = diffHours > 0 ? growth / diffHours : 0;
            }
        } else {
            // 스냅샷이 2개일 때는 최근 2개 사용
            const { data: recentData } = await supabase
                .from('view_history')
                .select('view_count, fetched_at')
                .eq('video_id', videoId)
                .order('fetched_at', { ascending: false })
                .limit(2);
            
            if (!recentData || recentData.length < 2) {
                return {
                    insufficient: true,
                    snapshotCount: recentData?.length || 0,
                    requiredCount: 2,
                    message: '데이터 없음'
                };
            }
            
            const [latest, previous] = recentData;
            calculationBase = previous;
            growth = latest.view_count - previous.view_count;
            diffHours = (new Date(latest.fetched_at).getTime() - new Date(previous.fetched_at).getTime()) / (1000 * 60 * 60);
            vph = diffHours > 0 ? growth / diffHours : 0;
        }

        // 최초 데이터와 현재 시간 정보
        const first = firstData; // 현재 존재하는 가장 오래된 스냅샷 (삭제되었을 수 있음)
        const latest = latestData;
        // now는 이미 972번 줄에서 선언되었으므로 재사용
        
        // 전체 경과 시간 계산 (first가 존재하는 경우만)
        const totalElapsedHours = first ? (now.getTime() - new Date(first.fetched_at).getTime()) / (1000 * 60 * 60) : 0;
        const totalElapsedDays = totalElapsedHours / 24;
        const totalGrowth = first ? (latest.view_count - first.view_count) : 0;

        // previous 정보 가져오기 (스냅샷이 2개일 때만 필요)
        let previous = null;
        if (totalSnapshotCount === 2) {
            const { data: recentData } = await supabase
                .from('view_history')
                .select('view_count, fetched_at')
                .eq('video_id', videoId)
                .order('fetched_at', { ascending: false })
                .limit(2);
            if (recentData && recentData.length >= 2) {
                previous = recentData[1];
            }
        }

        // VPH 그래프용 데이터: 최근 20개 구간 + 현재값
        let graphData = null;
        let trend = null;
        
        if (totalSnapshotCount >= 2) {
            // 최근 21개 스냅샷 가져오기 (20개 구간 + 현재값 표시용)
            const limitCount = Math.min(21, totalSnapshotCount);
            const { data: recentSnapshots, error: snapshotError } = await supabase
                .from('view_history')
                .select('view_count, fetched_at')
                .eq('video_id', videoId)
                .order('fetched_at', { ascending: false })
                .limit(limitCount);

            if (snapshotError) {
                console.warn(`⚠️ 그래프 데이터 로드 실패 (${videoId}):`, snapshotError);
            }

            if (recentSnapshots && recentSnapshots.length >= 2) {
                // 시간순으로 정렬 (오래된 것부터)
                const sortedSnapshots = [...recentSnapshots].reverse();
                
                // 각 구간의 VPH 계산 (최근 20개 구간)
                const vphSegments = [];
                for (let i = 1; i < sortedSnapshots.length; i++) {
                    const prev = sortedSnapshots[i - 1];
                    const curr = sortedSnapshots[i];
                    const segmentGrowth = curr.view_count - prev.view_count;
                    const segmentHours = (new Date(curr.fetched_at).getTime() - new Date(prev.fetched_at).getTime()) / (1000 * 60 * 60);
                    const segmentVph = segmentHours > 0 ? segmentGrowth / segmentHours : 0;
                    
                    vphSegments.push({
                        vph: segmentVph,
                        from: new Date(prev.fetched_at),
                        to: new Date(curr.fetched_at),
                        fromViews: prev.view_count,
                        toViews: curr.view_count,
                        index: i - 1 // 구간 인덱스 (0부터 시작)
                    });
                }
                
                // 최근 20개 구간만 선택 (그래프용)
                const recent20Segments = vphSegments.slice(-20);
                
                // 그래프 데이터는 최소 1개 구간만 있어도 생성
                if (recent20Segments.length >= 1) {
                    // 현재값 (가장 최신 구간의 VPH)
                    const currentVph = recent20Segments[recent20Segments.length - 1].vph;
                    
                    // 그래프 데이터 구성
                    graphData = {
                        segments: recent20Segments.map((seg, idx) => ({
                            vph: seg.vph,
                            time: seg.to, // 구간 종료 시간 (표시용)
                            label: `구간 ${idx + 1}`,
                            isCurrent: idx === recent20Segments.length - 1 // 마지막 구간이 현재값
                        })),
                        currentVph: currentVph,
                        currentIndex: recent20Segments.length - 1 // 현재 구간 인덱스
                    };
                }
                
                // 전체 추세 분석 (기존 로직 유지)
                if (totalSnapshotCount >= 3) {
                    // 최근 10개 스냅샷 가져오기 (또는 전체가 10개 미만이면 전체)
                    const trendLimitCount = Math.min(10, totalSnapshotCount);
                    const { data: allSnapshots } = await supabase
                        .from('view_history')
                        .select('view_count, fetched_at')
                        .eq('video_id', videoId)
                        .order('fetched_at', { ascending: true })
                        .limit(trendLimitCount);

                    if (allSnapshots && allSnapshots.length >= 3) {
                        // 각 구간의 VPH 계산 (전체 추세 분석용)
                        const allVphSegments = [];
                        for (let i = 1; i < allSnapshots.length; i++) {
                            const prev = allSnapshots[i - 1];
                            const curr = allSnapshots[i];
                            const segmentGrowth = curr.view_count - prev.view_count;
                            const segmentHours = (new Date(curr.fetched_at).getTime() - new Date(prev.fetched_at).getTime()) / (1000 * 60 * 60);
                            const segmentVph = segmentHours > 0 ? segmentGrowth / segmentHours : 0;
                            
                            allVphSegments.push({
                                vph: segmentVph,
                                from: new Date(prev.fetched_at),
                                to: new Date(curr.fetched_at),
                                fromViews: prev.view_count,
                                toViews: curr.view_count
                            });
                        }

                        // 최고 VPH 구간 찾기 (Peak)
                        const peakSegment = allVphSegments.reduce((max, seg) => seg.vph > max.vph ? seg : max, allVphSegments[0]);
                        
                        // 최근 3개 구간의 평균 VPH (최근 추세)
                        const recentSegments = allVphSegments.slice(-3);
                        const recentAvgVph = recentSegments.reduce((sum, seg) => sum + seg.vph, 0) / recentSegments.length;
                        
                        // 초반 3개 구간의 평균 VPH (초반 추세)
                        const earlySegments = allVphSegments.slice(0, 3);
                        const earlyAvgVph = earlySegments.reduce((sum, seg) => sum + seg.vph, 0) / earlySegments.length;
                        
                        // 추세 분석
                        const isExploding = recentAvgVph > earlyAvgVph * 1.5; // 최근이 초반보다 50% 이상 높으면 폭발
                        const isDeclining = recentAvgVph < peakSegment.vph * 0.7; // 최근이 peak의 70% 미만이면 하락
                        const isAtPeak = peakSegment === allVphSegments[allVphSegments.length - 1] || 
                                        peakSegment === allVphSegments[allVphSegments.length - 2]; // 최근 2개 구간 중 하나가 peak
                        
                        trend = {
                            segments: allVphSegments,
                            peak: {
                                vph: peakSegment.vph,
                                from: peakSegment.from,
                                to: peakSegment.to,
                                fromViews: peakSegment.fromViews,
                                toViews: peakSegment.toViews
                            },
                            recentAvgVph,
                            earlyAvgVph,
                            isExploding,
                            isDeclining,
                            isAtPeak,
                            trendDirection: isExploding ? 'exploding' : (isDeclining ? 'declining' : 'stable')
                        };
                    }
                }
            }
        }

        const stats = {
            vph,
            vpd: vph * 24,
            recentGrowth: growth,
            diffHours,
            latest: { viewCount: latest.view_count, fetchedAt: new Date(latest.fetched_at) },
            previous: previous ? { viewCount: previous.view_count, fetchedAt: new Date(previous.fetched_at) } : null,
            first: { viewCount: first.view_count, fetchedAt: new Date(first.fetched_at) },
            now: now,
            totalElapsedHours,
            totalElapsedDays,
            totalGrowth,
            snapshotCount: totalSnapshotCount,
            calculationMethod: totalSnapshotCount >= 3 ? 'first-to-latest' : 'recent-2',
            trend, // VPH 추세 분석 결과
            graphData // VPH 그래프용 데이터 (최근 20개 구간 + 현재값)
        };
        
        // 로그 최소화 (성능 향상)
        
        return stats;
    } catch (error) {
        console.warn('⚠️ VPH 서버 데이터 로드 실패:', error);
        return null;
    }
}

// Export constants
export { CACHE_TTL_MS, CACHE_TTL_HOURS };

// ============================================
// Edge Function 수동 호출
// ============================================

/**
 * Edge Function을 수동으로 호출하는 함수
 * ⚠️ SECURITY: 클라이언트 사이드에서는 Service Role Key를 사용하지 않습니다.
 * Supabase의 anon key를 사용하거나, RLS 정책을 통해 보호된 함수만 호출합니다.
 * 
 * @param {string} functionName - 호출할 Edge Function 이름
 * @returns {Promise<Object>} - Edge Function 응답
 */
export async function invokeEdgeFunction(functionName) {
    try {
        // Supabase config에서 URL 가져오기
        const supabaseUrl = window.supabase?.supabaseUrl || 'https://hteazdwvhjaexjxwiwwl.supabase.co';
        
        // ⚠️ SECURITY: 클라이언트에서는 anon key만 사용합니다.
        // Service Role Key는 서버 사이드에서만 사용해야 합니다.
        // Edge Function이 RLS로 보호되어 있다면 anon key로도 호출 가능합니다.
        const anonKey = window.supabase?.supabaseKey || '';
        
        if (!anonKey) {
            throw new Error('Supabase anon key가 설정되지 않았습니다. supabase-config.js를 확인하세요.');
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function 호출 실패: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Edge Function 호출 실패: ${functionName}`, error);
        throw error;
    }
}


