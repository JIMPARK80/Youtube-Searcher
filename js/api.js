// ============================================
// API.JS - API 관련 함수 모음
// YouTube API, SerpAPI, Firebase 캐싱
// ============================================

// 유틸: 배열을 n개씩 청크로 나누기 (기본 50개)
const chunk = (a, n = 50) => Array.from({length: Math.ceil(a.length/n)}, (_,i)=>a.slice(i*n, (i+1)*n));

// API 키 관리
export let apiKey = null;
export let serpApiKey = null;

// Helper function to get API keys from Firebase server
export async function getApiKeys() {
    // Try to load API keys from Firebase if not already loaded
    if (!window.serverApiKeys && window.loadApiKeysFromFirebase) {
        console.log('🔄 Firebase에서 API 키 로드 시도 중...');
        await window.loadApiKeysFromFirebase();
    }
    
    // Check if API keys are available
    if (window.serverApiKeys && window.serverApiKeys.youtube) {
        console.log('✅ Firebase에서 API 키 로드 성공');
        return {
            youtube: window.serverApiKeys.youtube,
            serpapi: window.serverApiKeys.serpapi
        };
    }
    
    // Firebase 로딩 실패 시 에러 표시
    console.error('❌ Firebase API 키 로드 실패');
    alert('API 키를 Firebase에서 가져올 수 없습니다. 서버 환경에서 실행해주세요.');
    return {
        youtube: null,
        serpapi: null
    };
}

// Initialize API keys
export async function initializeApiKeys() {
    const keys = await getApiKeys();
    apiKey = keys.youtube;
    serpApiKey = keys.serpapi;
    
    // DOM에 hidden input 동적 생성 (HTML에 노출 방지)
    createHiddenApiKeyInputs(keys);
    
    return { apiKey, serpApiKey };
}

// Hidden input 생성 함수 (베스트 프랙티스)
function createHiddenApiKeyInputs(keys) {
    // 기존 input이 있으면 제거
    const existingApiKey = document.getElementById('apiKey');
    const existingSerpApiKey = document.getElementById('serpApiKey');
    if (existingApiKey) existingApiKey.remove();
    if (existingSerpApiKey) existingSerpApiKey.remove();
    
    // YouTube API 키
    if (keys.youtube) {
        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'hidden'; // password 대신 hidden 사용
        apiKeyInput.id = 'apiKey';
        apiKeyInput.value = keys.youtube;
        document.body.appendChild(apiKeyInput);
    }
    
    // SerpAPI 키
    if (keys.serpapi) {
        const serpApiKeyInput = document.createElement('input');
        serpApiKeyInput.type = 'hidden';
        serpApiKeyInput.id = 'serpApiKey';
        serpApiKeyInput.value = keys.serpapi;
        document.body.appendChild(serpApiKeyInput);
    }
    
    console.log('🔐 API 키 hidden input 생성 완료');
}

// ============================================
// FIREBASE 캐싱 함수
// ============================================

// Load from Firebase cloud cache
export async function loadFromFirebase(query) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseGetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return null;
        }
        
        // Sanitize document ID
        const docId = window.toDocId(query);
        console.log(`🔍 Firebase 캐시 확인 중: 검색어="${query}" -> 문서 ID: "${docId}"`);
        
        const cacheRef = window.firebaseDoc(window.firebaseDb, 'searchCache', docId);
        const cacheSnap = await window.firebaseGetDoc(cacheRef);
        
        if (cacheSnap.exists()) {
            const data = cacheSnap.data();
            const age = Date.now() - data.timestamp;
            const ageHours = age / (1000 * 60 * 60);
            
            console.log(`☁️ Firebase 캐시 발견: ${ageHours.toFixed(1)}시간 전 데이터`);
            console.log(`📊 캐시 정보: ${data.items?.length || 0}개 항목, 소스: ${data.dataSource || 'unknown'}`);
            
            // 24시간 이내면 유효
            if (age < 24 * 60 * 60 * 1000) {
                console.log('✅ 유효한 Firebase 캐시 사용');
                return data;
            } else {
                console.log('⏰ Firebase 캐시 만료 (24시간 초과)');
            }
        } else {
            console.log(`🔭 Firebase 캐시 없음 (문서 ID: "${docId}")`);
        }
        
        return null;
    } catch (error) {
        console.error('❌ Firebase 캐시 로드 실패:', error);
        return null;
    }
}

// Save to Firebase cloud cache
export async function saveToFirebase(query, videos, channels, items, dataSource = 'google', nextPageToken = null) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return;
        }
        
        // Sanitize document ID
        const docId = window.toDocId(query);
        console.log(`💾 문서 ID: "${query}" -> "${docId}"`);
        
        const cacheRef = window.firebaseDoc(window.firebaseDb, 'searchCache', docId);
        
        // Shrink data to prevent payload size issues
        const shrinkVideo = v => ({
            id: v.id,
            title: v.snippet?.title,
            channelId: v.snippet?.channelId,
            channelTitle: v.snippet?.channelTitle,
            publishedAt: v.snippet?.publishedAt,
            viewCount: v.statistics?.viewCount ?? null,
            likeCount: v.statistics?.likeCount ?? null,
            duration: v.contentDetails?.duration ?? null,
            serp: v.serpData ? {
                subs: v.serpData.channelSubscribers ?? null,
                views: v.serpData.views ?? null,
                link: v.serpData.link ?? null,
                extracted_date: v.serpData.extracted_date_from_description ?? null
            } : null
        });
        
        const shrinkItem = x => ({
            id: x?.raw?.id,
            vpd: x.vpd,
            vclass: x.vclass,
            cband: x.cband,
            subs: x.subs
        });
        
        const videoCount = (videos || []).length;
        const data = {
            query: query,
            videos: (videos || []).map(shrinkVideo),
            channels: channels || {},
            items: (items || []).map(shrinkItem),
            timestamp: Date.now(),
            cacheVersion: '1.2',
            dataSource: dataSource,
            meta: {
                fetchedPages: videoCount <= 50 ? 1 : 2,
                nextPageToken: nextPageToken || null,
                resultLimit: videoCount,
                source: dataSource
            }
        };
        
        // 디버깅: 데이터 크기 확인
        const dataSize = JSON.stringify(data).length;
        console.log(`📊 저장할 데이터 크기: ${(dataSize / 1024).toFixed(2)} KB`);
        
        if (dataSize > 1000000) { // 1MB 초과
            console.warn('⚠️ 데이터가 커서 일부만 저장합니다 (최대 100개까지 유지).');
            data.videos = data.videos.slice(0, 100);
            data.items = data.items.slice(0, 100);
        }
        
        await window.firebaseSetDoc(cacheRef, data);
        console.log('✅ Firebase 캐시 저장 완료');
    } catch (error) {
        console.error('❌ Firebase 캐시 저장 실패:', error);
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
        duration: v.contentDetails?.duration ?? null,
        serp: null
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

export async function searchYouTubeAPI(query, apiKeyValue) {
    try {
        console.log('🌐 Google API 호출 중...');
        
        // ① Step 1: Search for videos (최대 100개, 50개씩 2페이지)
        let searchItems = [];
        let nextPageToken = null;
        
        for (let page = 0; page < 2; page++) {
            const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&order=relevance&key=${apiKeyValue}${pageParam}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            // Check for quota exceeded error
            if (searchData.error && searchData.error.code === 403) {
                console.warn("⚠️ Google API 한도 초과");
                throw new Error("quotaExceeded");
            }
            
            searchItems.push(...(searchData.items || []));
            nextPageToken = searchData.nextPageToken;
            
            if (!nextPageToken) break; // 더 이상 결과 없음
        }
        
        console.log(`✅ Google API 정상 작동 (${searchItems.length}개 검색 결과)`);

        // ② Step 2: Get detailed video information (50개씩 배치)
        const videoIds = searchItems.map(item => item.id.videoId).filter(Boolean);
        let videoDetails = [];
        for (const ids of chunk(videoIds, 50)) {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${apiKeyValue}`;
            const r = await fetch(url);
            const d = await r.json();
            videoDetails.push(...(d.items || []));
        }

        // ③ Step 3: Get channel information (50개씩 배치)
        const channelIds = [...new Set(videoDetails.map(v => v.snippet.channelId))];
        let channelsMap = {};
        for (const ids of chunk(channelIds, 50)) {
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

// ============================================
// SERPAPI 검색 (백업용)
// ============================================

export async function searchWithSerpAPI(query) {
    const serpApiKeyValue = serpApiKey || window.serverApiKeys?.serpapi;
    
    if (!serpApiKeyValue) {
        console.warn('⚠️ SerpAPI 키가 없습니다.');
        return [];
    }

    try {
        console.log('🔍 SerpAPI로 검색 중...');
        const serpUrl = `https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(query)}&api_key=${serpApiKeyValue}`;
        const serpResponse = await fetch(serpUrl);
        const serpData = await serpResponse.json();

        if (serpData.video_results) {
            return serpData.video_results.map(video => {
                // Parse relative date
                let publishedAt = new Date().toISOString();
                if (video.published_date) {
                    const relativeDate = parseRelativeDate(video.published_date);
                    if (relativeDate) {
                        publishedAt = relativeDate.toISOString();
                    }
                }

                return {
                    id: video.link?.split('v=')[1]?.split('&')[0] || '',
                    snippet: {
                        title: video.title || '',
                        channelId: video.channel?.link?.split('channel/')[1] || '',
                        channelTitle: video.channel?.name || '',
                        publishedAt: publishedAt,
                        thumbnails: {
                            default: { url: video.thumbnail?.static || '' },
                            medium: { url: video.thumbnail?.static || '' },
                            high: { url: video.thumbnail?.static || '' }
                        }
                    },
                    statistics: {
                        viewCount: video.views || 0,
                        likeCount: 0
                    },
                    contentDetails: {
                        duration: null
                    },
                    serpData: {
                        views: video.views || 0,
                        link: video.link || '',
                        channelSubscribers: video.channel?.subscribers || null,
                        extracted_date_from_description: video.published_date || null
                    }
                };
            });
        }

        return [];
    } catch (error) {
        console.error('❌ SerpAPI 오류:', error);
        return [];
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
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
            return;
        }
        
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', uid);
        await window.firebaseSetDoc(userDocRef, {
            lastSearchKeyword: keyword,
            lastSearchTime: Date.now()
        }, { merge: true });
        
        console.log('✅ 사용자 검색어 저장:', keyword);
    } catch (error) {
        console.warn('⚠️ 검색어 저장 실패:', error);
    }
}
