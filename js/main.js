// Main application logic
// This file initializes the app and coordinates between modules

// Global variables (declared here but will be managed by modules)
let allVideos = [];
let allItems = [];
let allChannelMap = {};
let searchCache = {};
let currentPage = 1;
let currentSearchQuery = '';
let currentSearchMode = 'google';
let pageSize = CONFIG?.PAGE_SIZE || 8;

// Search function
async function search() {
    const query = document.getElementById('searchInput').value.trim();
    
    // Reset isDefaultSearch flag at the start of any manual search
    const wasDefaultSearch = window.isDefaultSearch;
    window.isDefaultSearch = false;
    
    // Check if user is logged in (only for manual searches, not default search or 'news' query)
    const isNewsQuery = query.toLowerCase() === 'news';
    if (!window.currentUser && !wasDefaultSearch && !isNewsQuery) {
        // Show login modal
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.classList.add('active');
            alert('검색하려면 로그인이 필요합니다.');
        }
        return;
    }
    
    if (!query) {
        alert('검색어를 입력해주세요!');
        return;
    }
    
    // Get API key from Firebase server first, then input field, then localStorage
    const keys = await getApiKeys();
    const apiKeyValue = keys.youtube || document.getElementById('apiKey').value.trim();
    
    if (!apiKeyValue) {
        alert('API 키를 입력해주세요! 서버에 API 키가 저장되어 있지 않습니다.');
        return;
    }

    currentSearchQuery = query;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading">⏳ 검색 중...</div>';
    
    // Save user's last search keyword if logged in and not a default search
    if (window.currentUser && !window.isDefaultSearch && query !== 'news') {
        saveUserLastSearchKeyword(window.currentUser.uid, query);
    }
    
    // Reset pagination for new search
    currentPage = 1;
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    // 1. Check Firebase cloud cache first
    const firebaseData = await loadFromFirebase(query);
    if (firebaseData) {
        console.log('☁️ Firebase 캐시 발견');
        console.log(`📊 데이터 출처: ${firebaseData.dataSource || 'unknown'}`);
        
        // Check if data is older than 24 hours
        const age = Date.now() - firebaseData.timestamp;
        const ageHours = age / (1000 * 60 * 60);
        const isExpired = ageHours >= 24;
        
        console.log(`⏰ 캐시 데이터 연령: ${ageHours.toFixed(1)}시간 (만료: ${isExpired ? '예' : '아니오'})`);
        
        // SerpAPI 모드에서 Google 데이터가 있으면 업데이트 안함
        if (firebaseData.dataSource === 'google' && currentSearchMode === 'serpapi') {
            console.log('✅ SerpAPI 모드: Google 데이터 사용 (업데이트 안함)');
            
            // Update search mode indicator
            updateSearchModeIndicator('google');
            
            // Restore full structure from compressed Firebase data
            const restoredVideos = firebaseData.videos.map(v => ({
                id: v.id,
                snippet: {
                    title: v.title,
                    channelId: v.channelId,
                    channelTitle: v.channelTitle,
                    publishedAt: v.publishedAt,
                    thumbnails: {
                        maxres: { url: `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg` },
                        standard: { url: `https://img.youtube.com/vi/${v.id}/sddefault.jpg` },
                        high: { url: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg` },
                        medium: { url: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg` },
                        default: { url: `https://img.youtube.com/vi/${v.id}/default.jpg` }
                    }
                },
                statistics: {
                    viewCount: v.viewCount,
                    likeCount: v.likeCount
                },
                contentDetails: {
                    duration: v.duration
                },
                serpData: v.serp
            }));
            
            allVideos = restoredVideos;
            allChannelMap = firebaseData.channels || {};
            
            // Map items by video id to ensure proper matching
            const videoById = new Map(restoredVideos.map(v => [v.id, v]));
            allItems = (firebaseData.items || []).map(item => ({
                raw: videoById.get(item.id), // Use id match instead of index
                vpd: item.vpd,
                vclass: item.vclass,
                cband: item.cband,
                subs: item.subs
            })).filter(item => item.raw); // Remove items without matching video
            
            renderPage(1);
            return;
        }
        
        // If SerpAPI data exists, replace with Google API data
        if (firebaseData.dataSource === 'serpapi') {
            console.log('🔄 SerpAPI 데이터 발견 → Google API로 업데이트 진행');
            // Skip cache and continue to API call
        } else if (!isExpired || (isExpired && currentSearchMode !== 'google')) {
            console.log('✅ Firebase 캐시 사용 (만료 전 또는 SerpAPI 모드)');
            
            // Update search mode indicator based on data source
            if (firebaseData.dataSource === 'serpapi') {
                updateSearchModeIndicator('serpapi');
            } else {
                updateSearchModeIndicator('google');
            }
            
            // Restore full structure from compressed Firebase data
            const restoredVideos = firebaseData.videos.map(v => ({
                id: v.id,
                snippet: {
                    title: v.title,
                    channelId: v.channelId,
                    channelTitle: v.channelTitle,
                    publishedAt: v.publishedAt,
                    thumbnails: {
                        maxres: { url: `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg` },
                        standard: { url: `https://img.youtube.com/vi/${v.id}/sddefault.jpg` },
                        high: { url: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg` },
                        medium: { url: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg` },
                        default: { url: `https://img.youtube.com/vi/${v.id}/default.jpg` }
                    },
                    description: '',
                    tags: []
                },
                statistics: {
                    viewCount: v.viewCount || '0',
                    likeCount: v.likeCount || '0',
                    commentCount: '0'
                },
                contentDetails: {
                    duration: v.duration || 'PT0S'
                },
                serpData: v.serp ? {
                    channelSubscribers: v.serp.subs,
                    views: v.serp.views,
                    link: v.serp.link,
                    extracted_date_from_description: v.serp.extracted_date
                } : null
            }));
            
            // Restore items with full structure
            const restoredItems = firebaseData.items.map((x, idx) => ({
                raw: restoredVideos[idx],
                vpd: x.vpd,
                vclass: x.vclass,
                cband: x.cband,
                subs: x.subs
            }));
            
            allVideos = restoredVideos;
            allChannelMap = firebaseData.channels || {};
            allItems = restoredItems;
            renderPage(1);
            return;
        } else if (isExpired && currentSearchMode === 'google') {
            // Expired and Google API mode - need to update
            console.log('🔄 Google API 모드: 캐시 만료 (24시간 경과) - 업데이트 진행');
        }
    } else {
        console.log('📭 Firebase 캐시 없음 - API 호출 진행');
    }
    
    // 2. Check memory cache second
    const cacheKey = query.toLowerCase();
    if (searchCache[cacheKey]) {
        console.log('📦 메모리 캐시에서 결과 로드');
        const cachedData = searchCache[cacheKey];
        allVideos = cachedData.videos;
        allChannelMap = cachedData.channels;
        allItems = cachedData.items;
        // Save to Firebase for persistence
        saveSearchData(query, allVideos, allChannelMap, allItems);
        renderPage(1);
        return;
    }

    try {
        // Try Google API first with pagination (200 results)
        try {
            console.log('🌐 Google API 호출 중... (최대 200개 결과)');
            
            // ========== 1단계: 4페이지 검색 (200개) ==========
            let allSearchItems = [];
            let nextPageToken = null;
            const maxPages = 4; // 50개 × 4 = 200개
            
            for (let page = 1; page <= maxPages; page++) {
                // 로딩 상태 업데이트
                resultsDiv.innerHTML = `<div class="loading">⏳ 검색 중... ${page}/4 페이지 (${allSearchItems.length}개 발견)</div>`;
                
                // 페이지 토큰 포함한 검색 URL
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&order=relevance&key=${apiKeyValue}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
                
                console.log(`📄 ${page}/4 페이지 로딩 중...`);
                const searchResponse = await fetch(searchUrl);
                const searchData = await searchResponse.json();

                // 할당량 초과 체크
                if (searchData.error && searchData.error.code === 403) {
                    console.warn("⚠️ Google API 한도 초과 — SerpAPI로 전환합니다.");
                    updateSearchModeIndicator('serpapi');
                    throw new Error("quotaExceeded");
                }
                
                // 결과 추가
                if (searchData.items && searchData.items.length > 0) {
                    allSearchItems.push(...searchData.items);
                    console.log(`✅ ${page}페이지: ${searchData.items.length}개 (총 ${allSearchItems.length}개)`);
                }
                
                // 다음 페이지 토큰
                nextPageToken = searchData.nextPageToken;
                
                // 더 이상 페이지가 없으면 중단
                if (!nextPageToken) {
                    console.log(`🏁 마지막 페이지 도달 (총 ${allSearchItems.length}개)`);
                    break;
                }
            }
            
            // Google API 정상 작동
            console.log(`✅ Google API 정상 작동 (총 ${allSearchItems.length}개 결과)`);
            updateSearchModeIndicator('google');

            // ========== 2단계: 비디오 상세 정보 가져오기 ==========
            console.log('📹 비디오 상세 정보 가져오는 중...');
            const videoIds = allSearchItems.map(item => item.id.videoId).join(',');
            const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${apiKeyValue}`;
            const videoDetailsResponse = await fetch(videoDetailsUrl);
            const videoDetailsData = await videoDetailsResponse.json();

            // ========== 3단계: 채널 정보 가져오기 ==========
            console.log('👤 채널 정보 가져오는 중...');
            const channelIds = [...new Set(allSearchItems.map(item => item.snippet.channelId))].join(',');
            const channelDetailsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${apiKeyValue}`;
            const channelDetailsResponse = await fetch(channelDetailsUrl);
            const channelDetailsData = await channelDetailsResponse.json();

            // Combine all data
            const videos = allSearchItems.map(searchItem => {
                const videoDetails = videoDetailsData.items.find(v => v.id === searchItem.id.videoId);
                const channel = channelDetailsData.items.find(c => c.id === searchItem.snippet.channelId);
                
                if (channel) {
                    allChannelMap[channel.id] = channel;
                }
                
                return {
                    id: videoDetails.id,
                    snippet: {
                        ...videoDetails.snippet,
                        channelId: searchItem.snippet.channelId,
                        channelTitle: searchItem.snippet.channelTitle
                    },
                    statistics: videoDetails.statistics,
                    contentDetails: videoDetails.contentDetails
                };
            });

            // Filter by video duration and view count if needed
            let filteredVideos = videos || [];
            const videoDuration = null; // Duration filter disabled
            const viewCount = null; // View count filter disabled

            // Apply filters if specified
            if (videoDuration || viewCount) {
                filteredVideos = videos.filter(video => {
                    // Duration filter
                    if (videoDuration) {
                        const duration = video.contentDetails?.duration || '';
                        const seconds = parseDurationToSeconds(duration);
                        
                        let passesDurationFilter = false;
                        switch(videoDuration) {
                            case 'short':
                                passesDurationFilter = seconds < 240; // Less than 4 minutes
                                break;
                            case 'medium':
                                passesDurationFilter = seconds >= 240 && seconds < 1200; // 4 to 20 minutes
                                break;
                            case 'long':
                                passesDurationFilter = seconds >= 1200; // 20 minutes or more
                                break;
                            default:
                                passesDurationFilter = true;
                        }
                        if (!passesDurationFilter) return false;
                    }

                    // View count filter
                    if (viewCount) {
                        const minViews = parseInt(viewCount);
                        const videoViews = parseInt(video.statistics?.viewCount || 0);
                        if (videoViews < minViews) return false;
                    }

                    return true;
                });
            }

            // Save all filtered videos
            allVideos = filteredVideos;

            // Enrich videos with velocity and channel data
            allItems = filteredVideos.map(video => {
                const channel = allChannelMap[video.snippet.channelId];
                const vpd = viewVelocityPerDay(video);
                const vclass = classifyVelocity(vpd);
                const cband = channelSizeBand(channel);
                const subs = Number(channel?.statistics?.subscriberCount ?? 0);
                
                return {
                    raw: video,
                    vpd: vpd,
                    vclass: vclass,
                    cband: cband,
                    subs: subs
                };
            });

            // Cache the results
            searchCache[cacheKey] = {
                videos: allVideos,
                channels: allChannelMap,
                items: allItems
            };

            // Save to Firebase for persistence
            saveSearchData(query, allVideos, allChannelMap, allItems);

            // Display first page (8 items - 4×2 grid)
            renderPage(1);

        } catch (googleError) {
            if (googleError.message === "quotaExceeded") {
                // Switch to SerpAPI
                console.log('🔄 SerpAPI로 자동 전환합니다...');
                resultsDiv.innerHTML = '<div class="loading">🔄 SerpAPI로 전환 중...</div>';
                
                const serpVideos = await searchWithSerpAPI(query);
                allVideos = serpVideos;
                
                // Build channel map from SerpAPI data
                allChannelMap = {};
                serpVideos.forEach(video => {
                    if (video.snippet.channelId && video.serpData?.channelSubscribers) {
                        allChannelMap[video.snippet.channelId] = {
                            id: video.snippet.channelId,
                            snippet: {
                                title: video.snippet.channelTitle,
                                thumbnails: { default: { url: '' } }
                            },
                            statistics: {
                                subscriberCount: video.serpData.channelSubscribers
                            }
                        };
                    }
                });
                
                // Create enriched items for SerpAPI results
                allItems = serpVideos.map(video => {
                    const vpd = viewVelocityPerDay(video);
                    const vclass = classifyVelocity(vpd);
                    const channel = allChannelMap[video.snippet.channelId];
                    const cband = channelSizeBand(channel);
                    const subs = Number(channel?.statistics?.subscriberCount ?? 0);
                    
                    return {
                        raw: video,
                        vpd: vpd,
                        vclass: vclass,
                        cband: cband,
                        subs: subs
                    };
                });

                // Cache the results
                searchCache[cacheKey] = {
                    videos: allVideos,
                    channels: allChannelMap,
                    items: allItems
                };

                // Save to Firebase for persistence
                saveSearchData(query, allVideos, allChannelMap, allItems, 'serpapi');

                // Display results
                renderPage(1);
            } else {
                throw googleError;
            }
        }

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="error">
                <strong>❌ 오류 발생:</strong> ${error.message}
            </div>
        `;
        console.error('Error:', error);
    }
}

// Page navigation functions
function goToNextPage() {
    if (currentPage < totalPages()) {
        renderPage(currentPage + 1);
    }
}

function goToPrevPage() {
    if (currentPage > 1) {
        renderPage(currentPage - 1);
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase to load, then initialize
    setTimeout(async () => {
        const keys = await getApiKeys();
        apiKey = keys.youtube;
        serpApiKey = keys.serpapi;
    }, 500);

    // Search button and input event listeners
    document.getElementById('searchBtn').addEventListener('click', search);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            search();
        }
    });

    // Pagination event listeners
    document.getElementById('prevPage').addEventListener('click', goToPrevPage);
    document.getElementById('nextPage').addEventListener('click', goToNextPage);
});

