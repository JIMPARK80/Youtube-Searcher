// ============================================
// API Provider Abstraction Layer
// 
// 중요: 이 모듈은 오로지 VPH(Views Per Hour) 데이터 수집에만 사용됩니다.
// 
// 키워드 검색, 영상 정보, 채널 정보는 무조건 YouTube API만 사용합니다.
// (js/api.js, js/supabase-api.js에서 직접 YouTube API 호출)
// 
// 현재는 YouTube API만 사용합니다.
// ============================================

// API Provider 타입
export const API_PROVIDER_TYPES = {
    YOUTUBE_API: 'youtube_api',
    WEB_SCRAPING: 'web_scraping',
    THIRD_PARTY: 'third_party',
    HYBRID: 'hybrid'
};

// 현재 사용할 Provider (환경 변수나 설정에서 가져올 수 있음)
let currentProvider = API_PROVIDER_TYPES.YOUTUBE_API;

export function setApiProvider(provider) {
    if (Object.values(API_PROVIDER_TYPES).includes(provider)) {
        currentProvider = provider;
    }
}

export function getApiProvider() {
    return currentProvider;
}

// ============================================
// YouTube API Provider (기존 방식)
// ============================================

/**
 * YouTube API를 사용하여 VPH 데이터 가져오기
 * - YouTube 영상 ID
 * - 시간 (timestamp)
 * - 조회수 (view count)
 */
async function fetchFromYouTubeAPI(videoIds, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', videoIds.join(','));
    url.searchParams.set('key', apiKey);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    const fetchedAt = new Date(); // VPH 계산에 필요한 시간 정보
    
    return (data.items || []).map(item => ({
        videoId: item.id,
        viewCount: Number(item.statistics?.viewCount || 0),
        fetchedAt // VPH 계산에 필요한 시간 정보
    }));
}

// ============================================
// Web Scraping Provider (대체 옵션)
// ============================================

async function fetchFromWebScraping(videoIds) {
    // YouTube 페이지에서 직접 조회수 추출
    // 주의: ToS 위반 가능, 구조 변경 시 깨질 수 있음
    const results = [];
    
    for (const videoId of videoIds) {
        try {
            // YouTube 페이지 URL
            const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            // CORS 문제로 직접 fetch 불가능
            // 서버 사이드 프록시 필요 또는 브라우저 확장 프로그램 사용
            // 예시: Edge Function을 통해 스크래핑
            
            // 임시로 YouTube oEmbed API 사용 (조회수 없음)
            const oembedUrl = `https://www.youtube.com/oembed?url=${pageUrl}&format=json`;
            const response = await fetch(oembedUrl);
            
            if (response.ok) {
                const data = await response.json();
                // oEmbed는 조회수를 제공하지 않으므로 null
            const fetchedAt = new Date();
            results.push({
                videoId,
                viewCount: null, // 스크래핑 필요
                fetchedAt
            });
            }
        } catch (error) {
            console.warn(`Failed to fetch ${videoId}:`, error);
        }
    }
    
    return results;
}

// ============================================
// Third Party API Provider (예시: Social Blade)
// ============================================

async function fetchFromThirdParty(videoIds, apiKey) {
    // 서드파티 API 예시 (실제 구현 필요)
    // const url = `https://api.socialblade.com/v2/youtube/video/${videoIds.join(',')}`;
    // const response = await fetch(url, {
    //     headers: { 'Authorization': `Bearer ${apiKey}` }
    // });
    // ...
    
    throw new Error('Third party API not implemented');
}

// ============================================
// Hybrid Provider (YouTube API + Web Scraping)
// ============================================

async function fetchFromHybrid(videoIds, apiKey) {
    try {
        // 먼저 YouTube API 시도
        return await fetchFromYouTubeAPI(videoIds, apiKey);
    } catch (error) {
        // 할당량 초과 등 실패 시 웹 스크래핑으로 폴백
        console.warn('YouTube API failed, falling back to web scraping:', error);
        return await fetchFromWebScraping(videoIds);
    }
}

// ============================================
// 통합 Fetch 함수
// ============================================

/**
 * VPH 계산에 필요한 최소 데이터 가져오기
 * - YouTube 영상 ID
 * - 시간 (timestamp)
 * - 조회수 (view count)
 * 
 * @param {string[]} videoIds - YouTube 비디오 ID 배열
 * @param {string} apiKey - API 키 (필요한 경우)
 * @returns {Promise<Array>} VPH 데이터 배열 [{ videoId, viewCount, fetchedAt }]
 */
export async function fetchVideoStatistics(videoIds, apiKey = null) {
    if (!videoIds || videoIds.length === 0) {
        return [];
    }
    
    // 50개씩 배치 처리
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }
    
    const allResults = [];
    
    for (const chunk of chunks) {
        let results = [];
        
        try {
            switch (currentProvider) {
                case API_PROVIDER_TYPES.YOUTUBE_API:
                    results = await fetchFromYouTubeAPI(chunk, apiKey);
                    break;
                    
                case API_PROVIDER_TYPES.WEB_SCRAPING:
                    results = await fetchFromWebScraping(chunk);
                    break;
                    
                case API_PROVIDER_TYPES.THIRD_PARTY:
                    results = await fetchFromThirdParty(chunk, apiKey);
                    break;
                    
                case API_PROVIDER_TYPES.HYBRID:
                    results = await fetchFromHybrid(chunk, apiKey);
                    break;
                    
                default:
                    throw new Error(`Unknown provider: ${currentProvider}`);
            }
            
            allResults.push(...results);
        } catch (error) {
            console.error(`Failed to fetch statistics for chunk:`, error);
            // 에러 발생 시 빈 결과 추가 (나중에 재시도 가능)
            const fetchedAt = new Date();
            chunk.forEach(videoId => {
                allResults.push({
                    videoId,
                    viewCount: null,
                    fetchedAt
                });
            });
        }
    }
    
    return allResults;
}

// ============================================
// 채널 정보 가져오기 (동일한 패턴)
// ============================================

async function fetchChannelFromYouTubeAPI(channelIds, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', channelIds.join(','));
    url.searchParams.set('key', apiKey);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    return (data.items || []).map(item => ({
        channelId: item.id,
        subscriberCount: Number(item.statistics?.subscriberCount || 0),
        videoCount: Number(item.statistics?.videoCount || 0),
        viewCount: Number(item.statistics?.viewCount || 0)
    }));
}

export async function fetchChannelStatistics(channelIds, apiKey = null) {
    if (!channelIds || channelIds.length === 0) {
        return [];
    }
    
    // Provider에 따라 다른 방식으로 가져오기
    // 현재는 YouTube API만 구현
    return await fetchChannelFromYouTubeAPI(channelIds, apiKey);
}

