// ============================================
// API.JS - API 관련 함수 모음
// YouTube API, SerpAPI, Firebase 캐싱
// ============================================

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
export async function saveToFirebase(query, videos, channels, items, dataSource = 'google') {
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
        
        const data = {
            query: query,
            videos: (videos || []).map(shrinkVideo),
            channels: channels || {},
            items: (items || []).map(shrinkItem),
            timestamp: Date.now(),
            cacheVersion: '1.1',
            dataSource: dataSource
        };
        
        // 디버깅: 데이터 크기 확인
        const dataSize = JSON.stringify(data).length;
        console.log(`📊 저장할 데이터 크기: ${(dataSize / 1024).toFixed(2)} KB`);
        
        if (dataSize > 1000000) { // 1MB 초과
            console.warn('⚠️ 데이터가 너무 큽니다. 일부만 저장합니다.');
            data.videos = data.videos.slice(0, 50);
            data.items = data.items.slice(0, 50);
        }
        
        await window.firebaseSetDoc(cacheRef, data);
        console.log('✅ Firebase 캐시 저장 완료');
    } catch (error) {
        console.error('❌ Firebase 캐시 저장 실패:', error);
    }
}

// ============================================
// YOUTUBE API 검색
// ============================================

export async function searchYouTubeAPI(query, apiKeyValue) {
    try {
        console.log('🌐 Google API 호출 중...');
        
        // Step 1: Search for videos
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=100&q=${encodeURIComponent(query)}&order=relevance&key=${apiKeyValue}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        // Check for quota exceeded error
        if (searchData.error && searchData.error.code === 403) {
            console.warn("⚠️ Google API 한도 초과");
            throw new Error("quotaExceeded");
        }
        
        console.log('✅ Google API 정상 작동');

        // Step 2: Get detailed video information
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKeyValue}`;
        const videosResponse = await fetch(videosUrl);
        const videosData = await videosResponse.json();

        // Step 3: Get channel information
        const channelIds = [...new Set(searchData.items.map(item => item.snippet.channelId))].join(',');
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${apiKeyValue}`;
        const channelsResponse = await fetch(channelsUrl);
        const channelsData = await channelsResponse.json();

        // Build channel map
        const channelMap = {};
        channelsData.items.forEach(channel => {
            channelMap[channel.id] = channel;
        });

        return {
            videos: videosData.items,
            channels: channelMap
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
