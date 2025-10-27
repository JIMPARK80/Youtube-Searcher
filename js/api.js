// API and search-related functions

// Get API keys from Firebase
async function getApiKeys() {
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

// Update search mode indicator
function updateSearchModeIndicator(mode) {
    const indicator = document.getElementById('searchModeIndicator');
    if (!indicator) {
        console.log('⚠️ Search mode indicator not found, skipping update');
        return;
    }
    
    const modeText = indicator.querySelector('.mode-text');
    if (!modeText) {
        console.log('⚠️ Mode text element not found, skipping update');
        return;
    }
    
    if (mode === 'serpapi') {
        indicator.classList.add('serpapi');
        modeText.innerHTML = '현재 검색 모드: 🔵 SerpAPI (Google API 한도초과)';
        currentSearchMode = 'serpapi';
        updateFilterStatusIndicators('serpapi');
    } else {
        indicator.classList.remove('serpapi');
        modeText.innerHTML = '현재 검색 모드: 🟢 Google API';
        currentSearchMode = 'google';
        updateFilterStatusIndicators('google');
    }
}

// Update filter status indicators based on current search mode
function updateFilterStatusIndicators(mode) {
    const uploadDateStatus = document.getElementById('uploadDateFilterStatus');
    const durationStatus = document.getElementById('durationFilterStatus');
    const viewCountStatus = document.getElementById('viewCountFilterStatus');
    const velocityStatus = document.getElementById('velocityFilterStatus');
    const channelSizeStatus = document.getElementById('channelSizeFilterStatus');
    
    if (mode === 'serpapi') {
        // SerpAPI mode - show what's available vs unavailable
        if (uploadDateStatus) {
            uploadDateStatus.textContent = '✅ 가능';
            uploadDateStatus.className = 'filter-status available';
            uploadDateStatus.title = 'SerpAPI는 업로드 날짜 데이터를 제공합니다';
        }
        if (durationStatus) {
            durationStatus.textContent = '✅ 가능';
            durationStatus.className = 'filter-status available';
            durationStatus.title = 'SerpAPI는 비디오 길이 데이터를 제공합니다';
        }
        if (viewCountStatus) {
            viewCountStatus.textContent = '✅ 가능';
            viewCountStatus.className = 'filter-status available';
            viewCountStatus.title = 'SerpAPI는 조회수 데이터를 제공합니다';
        }
        if (velocityStatus) {
            velocityStatus.textContent = '✅ 가능';
            velocityStatus.className = 'filter-status available';
            velocityStatus.title = 'SerpAPI에서는 성장속도 계산이 가능합니다';
        }
        if (channelSizeStatus) {
            channelSizeStatus.textContent = '⚠️ 제한적';
            channelSizeStatus.className = 'filter-status limited';
            channelSizeStatus.title = 'SerpAPI는 일부 채널의 구독자 수만 제공합니다';
        }
    } else {
        // Google API mode - all filters available
        if (uploadDateStatus) {
            uploadDateStatus.textContent = '✅ 가능';
            uploadDateStatus.className = 'filter-status available';
            uploadDateStatus.title = 'Google API는 업로드 날짜 데이터를 제공합니다';
        }
        if (durationStatus) {
            durationStatus.textContent = '✅ 가능';
            durationStatus.className = 'filter-status available';
            durationStatus.title = 'Google API는 비디오 길이 데이터를 제공합니다';
        }
        if (viewCountStatus) {
            viewCountStatus.textContent = '✅ 가능';
            viewCountStatus.className = 'filter-status available';
            viewCountStatus.title = 'Google API는 조회수 데이터를 제공합니다';
        }
        if (velocityStatus) {
            velocityStatus.textContent = '✅ 가능';
            velocityStatus.className = 'filter-status available';
            velocityStatus.title = 'Google API에서는 성장속도 계산이 가능합니다';
        }
        if (channelSizeStatus) {
            channelSizeStatus.textContent = '✅ 가능';
            channelSizeStatus.className = 'filter-status available';
            channelSizeStatus.title = 'Google API는 채널 구독자 수를 제공합니다';
        }
    }
}

// Wrapper for updateSearchModeIndicator alias
function updateDataSourceIndicator(source) {
    updateSearchModeIndicator(source === 'serpapi' ? 'serpapi' : 'google');
}

// SerpAPI search function
async function searchWithSerpAPI(query) {
    try {
        console.log('🔄 SerpAPI로 검색 중...');
        // Get SerpAPI key from Firebase server first
        const keys = await getApiKeys();
        const serpApiKey = keys.serpapi;
        if (!serpApiKey) {
            throw new Error('SerpAPI 키가 설정되지 않았습니다. API 키 설정에서 SerpAPI 키를 입력해주세요.');
        }
        
        const serpUrl = `https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(query)}&api_key=${serpApiKey}`;
        
        // Use CORS proxy to avoid CORS issues
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(serpUrl)}`;
        const res = await fetch(proxyUrl);
        const data = await res.json();

        if (!data.video_results || data.video_results.length === 0) {
            throw new Error('SerpAPI에서 검색 결과를 찾을 수 없습니다.');
        }

        // Convert SerpAPI format to our format
        const videos = data.video_results.map(v => {
            const videoId = v.link.split('v=')[1]?.split('&')[0] || '';
            
            // Parse published date safely (improved with relative date support)
            let publishedAtISO = '';
            try {
                // First, try to parse published_date field
                if (v.published_date) {
                    const parsedDate = parseRelativeDate(v.published_date);
                    
                    if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getTime() > 0) {
                        publishedAtISO = parsedDate.toISOString();
                    }
                }
                
                // If published_date parsing failed, try to extract from description
                if (!publishedAtISO && v.description) {
                    const datePatterns = [
                        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
                        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.\s+\d{1,2},?\s+\d{4}/gi,
                        /\d{4}년\s+\d{1,2}월\s+\d{1,2}일/gi
                    ];
                    
                    for (const pattern of datePatterns) {
                        const matches = v.description.match(pattern);
                        if (matches && matches.length > 0) {
                            const extractedDate = new Date(matches[0]);
                            if (!isNaN(extractedDate.getTime())) {
                                publishedAtISO = extractedDate.toISOString();
                                break;
                            }
                        }
                    }
                }
                
                // If still no date, use default (1 week ago)
                if (!publishedAtISO) {
                    publishedAtISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                }
            } catch (e) {
                console.error('❌ Error parsing published date:', e);
                publishedAtISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            }
            
            // Ensure we never have an empty string
            if (!publishedAtISO || publishedAtISO === '') {
                publishedAtISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            }
            
            // Extract channel subscriber count from SerpAPI data
            let channelSubscriberCount = '0';
            let subscriberDataAvailable = false;
            
            if (v.channel?.subscribers) {
                subscriberDataAvailable = true;
                
                if (typeof v.channel.subscribers === 'number') {
                    channelSubscriberCount = v.channel.subscribers.toString();
                } else if (typeof v.channel.subscribers === 'string') {
                    const subStr = v.channel.subscribers.toLowerCase().trim();
                    let mult = 1;
                    
                    if (subStr.includes('m')) {
                        mult = 1000000;
                        const num = parseFloat(subStr);
                        if (!isNaN(num)) {
                            channelSubscriberCount = Math.floor(num * mult).toString();
                        }
                    } else if (subStr.includes('k')) {
                        mult = 1000;
                        const num = parseFloat(subStr);
                        if (!isNaN(num)) {
                            channelSubscriberCount = Math.floor(num * mult).toString();
                        }
                    } else {
                        const numMatch = subStr.match(/[\d.]+/);
                        if (numMatch) {
                            const num = parseFloat(numMatch[0]);
                            if (!isNaN(num)) {
                                channelSubscriberCount = Math.floor(num).toString();
                            }
                        }
                    }
                }
            }
            
            // Parse views
            let viewCount = '0';
            if (v.views !== undefined && v.views !== null) {
                if (typeof v.views === 'number') {
                    viewCount = v.views.toString();
                } else if (typeof v.views === 'string') {
                    const viewStr = v.views.toLowerCase().trim();
                    
                    if (viewStr.includes('m')) {
                        const num = parseFloat(viewStr);
                        if (!isNaN(num)) {
                            viewCount = Math.floor(num * 1000000).toString();
                        }
                    } else if (viewStr.includes('k')) {
                        const num = parseFloat(viewStr);
                        if (!isNaN(num)) {
                            viewCount = Math.floor(num * 1000).toString();
                        }
                    } else {
                        const numMatch = viewStr.match(/[\d.]+/);
                        if (numMatch) {
                            const num = parseFloat(numMatch[0]);
                            if (!isNaN(num)) {
                                viewCount = Math.floor(num).toString();
                            }
                        }
                    }
                }
            }
            
            // Parse likes
            let likeCount = '0';
            if (v.likes !== undefined && v.likes !== null) {
                if (typeof v.likes === 'number') {
                    likeCount = v.likes.toString();
                } else if (typeof v.likes === 'string') {
                    const likeStr = v.likes.toLowerCase().trim();
                    
                    if (likeStr.includes('m')) {
                        const num = parseFloat(likeStr);
                        if (!isNaN(num)) {
                            likeCount = Math.floor(num * 1000000).toString();
                        }
                    } else if (likeStr.includes('k')) {
                        const num = parseFloat(likeStr);
                        if (!isNaN(num)) {
                            likeCount = Math.floor(num * 1000).toString();
                        }
                    } else {
                        const numMatch = likeStr.match(/[\d.]+/);
                        if (numMatch) {
                            const num = parseFloat(numMatch[0]);
                            if (!isNaN(num)) {
                                likeCount = Math.floor(num).toString();
                            }
                        }
                    }
                }
            }
            
            return {
                id: videoId,
                snippet: {
                    title: v.title,
                    channelTitle: v.channel?.name || 'Unknown Channel',
                    channelId: v.channel?.id || '',
                    publishedAt: publishedAtISO,
                    description: v.description || '',
                    thumbnails: {
                        maxres: { url: v.thumbnail?.static || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` },
                        standard: { url: v.thumbnail?.static || `https://img.youtube.com/vi/${videoId}/sddefault.jpg` },
                        high: { url: v.thumbnail?.static || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` },
                        medium: { url: v.thumbnail?.static || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` },
                        default: { url: v.thumbnail?.static || `https://img.youtube.com/vi/${videoId}/default.jpg` }
                    }
                },
                statistics: {
                    viewCount: viewCount,
                    likeCount: likeCount,
                    commentCount: v.comments || '0'
                },
                contentDetails: {
                    duration: v.duration || 'PT0S'
                },
                serpData: {
                    channel: v.channel,
                    channelSubscribers: channelSubscriberCount,
                    subscriberDataAvailable: subscriberDataAvailable,
                    views: viewCount,
                    published_date: v.published_date,
                    original_published_date: v.published_date,
                    extracted_date_from_description: publishedAtISO,
                    description: v.description,
                    likes: likeCount,
                    comments: v.comments,
                    duration: v.duration,
                    thumbnail: v.thumbnail,
                    link: v.link
                }
            };
        });

        return videos;

    } catch (error) {
        console.error('SerpAPI 오류:', error);
        throw new Error(`SerpAPI 검색 실패: ${error.message}`);
    }
}

