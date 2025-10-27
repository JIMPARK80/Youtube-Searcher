// YouTube API and SerpAPI search functions

// Search with Google YouTube API
async function searchWithGoogleAPI(query, apiKey) {
    try {
        console.log('🌐 Google API 호출 중...');
        
        let allSearchItems = [];
        let nextPageToken = null;
        const maxPages = 4; // 4 pages × 50 = 200 results
        
        // Fetch multiple pages
        for (let page = 1; page <= maxPages; page++) {
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&order=relevance&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
            
            console.log(`📄 ${page}/4 페이지 로딩 중...`);
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            // Check for quota exceeded
            if (searchData.error && searchData.error.code === 403) {
                throw new Error("quotaExceeded");
            }
            
            if (searchData.items && searchData.items.length > 0) {
                allSearchItems.push(...searchData.items);
                console.log(`✅ ${page}페이지: ${searchData.items.length}개 (총 ${allSearchItems.length}개)`);
            }
            
            nextPageToken = searchData.nextPageToken;
            if (!nextPageToken) break;
        }
        
        console.log(`✅ Google API 정상 작동 (총 ${allSearchItems.length}개 결과)`);
        
        // Get video details
        const videoIds = allSearchItems.map(item => item.id.videoId).join(',');
        const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`;
        const videoDetailsResponse = await fetch(videoDetailsUrl);
        const videoDetailsData = await videoDetailsResponse.json();
        
        // Get channel details
        const channelIds = [...new Set(allSearchItems.map(item => item.snippet.channelId))].join(',');
        const channelDetailsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${apiKey}`;
        const channelDetailsResponse = await fetch(channelDetailsUrl);
        const channelDetailsData = await channelDetailsResponse.json();
        
        // Combine data
        const videos = allSearchItems.map(searchItem => {
            const videoDetails = videoDetailsData.items.find(v => v.id === searchItem.id.videoId);
            const channel = channelDetailsData.items.find(c => c.id === searchItem.snippet.channelId);
            
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
        
        return { videos, channels: channelDetailsData.items };
        
    } catch (error) {
        console.error('❌ Google API 오류:', error);
        throw error;
    }
}

// Search with SerpAPI (reuse from api.js)
// searchWithSerpAPI is already defined in api.js

