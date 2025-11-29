// ============================================
// API.JS - API 관련 함수 모음
// YouTube API (키워드 검색, 영상 정보, 채널 정보)
// 
// 중요: 키워드 검색과 영상/채널 정보는 무조건 YouTube API만 사용합니다.
// ============================================

// 유틸: 배열을 n개씩 청크로 나누기 (기본 50개)
const chunk = (a, n = 50) => Array.from({length: Math.ceil(a.length/n)}, (_,i)=>a.slice(i*n, (i+1)*n));

export const CACHE_TTL_HOURS = 72;
export const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

// API 키 관리
export let apiKey = null;

// Helper function to get API keys from Supabase
export async function getApiKeys() {
    try {
        const { supabase } = await import('./supabase-config.js');
        
        // Load API keys from Supabase config table
        const { data, error } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'apiKeys')
            .single();
        
        if (error) {
            if (window.serverApiKeys?.youtube) {
                return { youtube: window.serverApiKeys.youtube };
            }
            return { youtube: null };
        }
        
        if (data?.value?.youtube) {
            window.serverApiKeys = data.value;
            return { youtube: data.value.youtube };
        }
        return {
            youtube: null
        };
    } catch (error) {
        console.error('❌ API 키 로드 중 오류:', error);
        return {
            youtube: null
        };
    }
}

// Initialize API keys
export async function initializeApiKeys() {
    const keys = await getApiKeys();
    apiKey = keys.youtube;
    
    // DOM에 hidden input 동적 생성 (HTML에 노출 방지)
    createHiddenApiKeyInputs(keys);
    
    return { apiKey };
}

// Hidden input 생성 함수 (베스트 프랙티스)
function createHiddenApiKeyInputs(keys) {
    // 기존 input이 있으면 제거
    const existingApiKey = document.getElementById('apiKey');
    if (existingApiKey) existingApiKey.remove();
    
    // YouTube API 키
    if (keys.youtube) {
        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'hidden'; // password 대신 hidden 사용
        apiKeyInput.id = 'apiKey';
        apiKeyInput.value = keys.youtube;
        document.body.appendChild(apiKeyInput);
    }

}


// ============================================
// 토핑(Top-up) 함수들 - 캐시 최적화용
// ============================================

// 1) 다음 50개만 가져오기: search.list 1회
export async function fetchNext50WithToken(query, apiKey, pageToken) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&maxResults=50&q=${encodeURIComponent(query)}&key=${apiKey}&pageToken=${pageToken}`;
    const r = await fetch(url);
    const d = await r.json();
    return {
        items: (d.items || []),
        nextPageToken: d.nextPageToken || null
    };
}

// 2) 신규 비디오/채널 상세만 배치 호출(최소화)
export async function hydrateDetailsOnlyForNew(nextPage, apiKey) {
    const ids = nextPage.items.map(it => it.id.videoId).filter(Boolean);
    // videos.list (50개 배치 한 번)
    const vr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`);
    const vd = await vr.json();
    const videoDetails = vd.items || [];

    // channels.list (신규 채널만)
    const channelIds = [...new Set(videoDetails.map(v => v.snippet.channelId))];
    let channelsMap = {};
    if (channelIds.length) {
        const cr = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`);
        const cd = await cr.json();
        (cd.items || []).forEach(ch => { channelsMap[ch.id] = ch; });
    }
    return { videoDetails, channelsMap };
}

// 3) 기존 캐시 + 신규 50개 머지 (videos/channels/items)
export function mergeCacheWithMore(cache, newVideos, newChannelsMap) {
    // Shrink new videos to match cache format
    const shrinkVideo = v => ({
        id: v.id,
        title: v.snippet?.title,
        channelId: v.snippet?.channelId,
        channelTitle: v.snippet?.channelTitle,
        publishedAt: v.snippet?.publishedAt,
        viewCount: v.statistics?.viewCount ?? null,
        likeCount: v.statistics?.likeCount ?? null,
        duration: v.contentDetails?.duration ?? null
    });
    
    // videos: 기존 압축 데이터 + 새 압축 데이터
    const videos = [...(cache.videos || []), ...newVideos.map(shrinkVideo)];

    // channels: 기존 채널 + 새 채널
    const channels = { ...(cache.channels || {}) };
    Object.entries(newChannelsMap).forEach(([id, ch]) => { channels[id] = ch; });

    return { videos, channels, meta: cache.meta || {} };
}

// ============================================
// YOUTUBE API 검색
// ============================================

// Throttle helper: API 요청 사이 딜레이 추가
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_THROTTLE_MS = 200; // 요청 사이 200ms 딜레이

export async function searchYouTubeAPI(query, apiKeyValue, maxResults = 30, excludeVideoIds = []) {
    try {
        const excludeSet = new Set(excludeVideoIds);
        
        // ① Step 1: Search for videos (동적 최대 개수, 기존 ID 제외)
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

            // Check for quota exceeded error
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
        console.log(`🔍 YouTube API 검색: ${searchItems.length}개 비디오 ID 발견 (요청: ${MAX_RESULTS}개, 시도: ${attempts}페이지)`);
        
        // ② Step 2: Get detailed video information (50개씩 배치, throttle 적용)
        const videoIds = searchItems.map(item => item.id.videoId).filter(Boolean);
        let videoDetails = [];
        const videoIdChunks = chunk(videoIds, 50);
        console.log(`📥 상세 정보 조회: ${videoIds.length}개 비디오 (${videoIdChunks.length}개 배치)`);
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
        console.log(`✅ 상세 정보 조회 완료: ${videoDetails.length}개 비디오`);
        // ③ Step 3: Get channel information (50개씩 배치, throttle 적용)
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
            nextPageToken: nextPageToken  // 다음 페이지 토큰 저장
        };
    } catch (error) {
        console.error('❌ YouTube API 오류:', error);
        throw error;
    }
}


// Parse relative date strings (e.g., "3 days ago")
function parseRelativeDate(relativeDateStr) {
    if (!relativeDateStr) return null;
    
    const str = relativeDateStr.toLowerCase().trim();
    const now = Date.now();
    
    if (str.includes('ago')) {
        const matches = str.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
        if (matches) {
            const value = parseInt(matches[1]);
            const unit = matches[2];
            
            let milliseconds = 0;
            switch(unit) {
                case 'second': milliseconds = value * 1000; break;
                case 'minute': milliseconds = value * 60 * 1000; break;
                case 'hour': milliseconds = value * 60 * 60 * 1000; break;
                case 'day': milliseconds = value * 24 * 60 * 60 * 1000; break;
                case 'week': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
                case 'month': milliseconds = value * 30 * 24 * 60 * 60 * 1000; break;
                case 'year': milliseconds = value * 365 * 24 * 60 * 60 * 1000; break;
            }
            
            return new Date(now - milliseconds);
        }
    }
    
    const parsedDate = new Date(relativeDateStr);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
    }
    
    return null;
}

// ============================================
// 사용자 검색어 저장
// ============================================

export async function saveUserLastSearchKeyword(uid, keyword) {
    try {
        const { supabase } = await import('./supabase-config.js');
        const { data: sessionData } = await supabase.auth.getSession();

        const supabaseSession = sessionData?.session;
        const supabaseUserId = supabaseSession?.user?.id;

        // RLS requires a Supabase Auth session. Skip if user isn't logged in via Supabase.
        if (!supabaseUserId) return;
        
        await supabase
            .from('users')
            .upsert({
                uid: supabaseUserId,
                last_search_keyword: keyword,
                last_search_time: Date.now(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'uid'
            });
    } catch (error) {
        console.warn('⚠️ 검색어 저장 실패:', error);
    }
}
