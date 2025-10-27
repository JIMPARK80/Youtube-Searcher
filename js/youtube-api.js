// youtube-api.js - YouTube API 호출 기능

import { API_ENDPOINTS } from './config.js';
import { calculateVPD, getVPDClass, getChannelBand } from './utils.js';

/**
 * API 키 가져오기
 * @returns {Promise<Object>} API 키 객체 { youtube, serpapi }
 */
export async function getApiKeys() {
    try {
        const response = await fetch(API_ENDPOINTS.getKeys);
        if (!response.ok) {
            throw new Error('API 키를 가져올 수 없습니다.');
        }
        const keys = await response.json();
        return keys;
    } catch (error) {
        console.error('❌ API 키 로드 오류:', error);
        return { youtube: null, serpapi: null };
    }
}

/**
 * Google YouTube API로 검색
 * @param {string} query - 검색어
 * @param {number} maxResults - 최대 결과 수
 * @returns {Promise<Object>} 검색 결과 { videos, channels, items, dataSource }
 */
export async function searchWithGoogleAPI(query, maxResults = 100) {
    const keys = await getApiKeys();
    const apiKey = keys.youtube;
    
    if (!apiKey) {
        throw new Error('YouTube API 키가 설정되지 않았습니다.');
    }

    try {
        console.log('🌐 Google API 호출 중...');
        const startTime = performance.now();

        // 1. 검색 API 호출
        const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}&type=video`
        );

        if (!searchResponse.ok) {
            if (searchResponse.status === 403) {
                throw new Error('API_QUOTA_EXCEEDED');
            }
            throw new Error(`HTTP ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.items || searchData.items.length === 0) {
            return { videos: [], channels: {}, items: [], dataSource: 'google' };
        }

        // 2. 비디오 상세 정보 가져오기
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
        );
        const detailsData = await detailsResponse.json();

        // 3. 채널 정보 가져오기
        const channelIds = [...new Set(detailsData.items.map(item => item.snippet.channelId))];
        const channelsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds.join(',')}&key=${apiKey}`
        );
        const channelsData = await channelsResponse.json();

        const endTime = performance.now();
        console.log(`✅ Google API 호출 완료 (${(endTime - startTime).toFixed(2)}ms)`);

        // 데이터 가공
        const videos = detailsData.items;
        const channelMap = {};
        channelsData.items.forEach(channel => {
            channelMap[channel.id] = channel;
        });

        // 커스텀 메트릭 계산
        const items = videos.map((video, index) => {
            const channel = channelMap[video.snippet.channelId];
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const vpd = calculateVPD(viewCount, video.snippet.publishedAt);
            const subs = parseInt(channel?.statistics?.subscriberCount || 0);

            return {
                vpd,
                vclass: getVPDClass(vpd),
                cband: getChannelBand(subs),
                subs,
                index
            };
        });

        return {
            videos,
            channels: channelMap,
            items,
            dataSource: 'google'
        };
    } catch (error) {
        console.error('❌ Google API 오류:', error);
        throw error;
    }
}

/**
 * SerpAPI로 검색
 * @param {string} query - 검색어
 * @returns {Promise<Object>} 검색 결과 { videos, channels, items, dataSource }
 */
export async function searchWithSerpAPI(query) {
    const keys = await getApiKeys();
    const serpApiKey = keys.serpapi;
    
    if (!serpApiKey) {
        throw new Error('SerpAPI 키가 설정되지 않았습니다.');
    }

    try {
        console.log('🔍 SerpAPI 호출 중...');
        const startTime = performance.now();

        const response = await fetch(
            `https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(query)}&api_key=${serpApiKey}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const endTime = performance.now();
        console.log(`✅ SerpAPI 호출 완료 (${(endTime - startTime).toFixed(2)}ms)`);

        if (!data.video_results || data.video_results.length === 0) {
            return { videos: [], channels: {}, items: [], dataSource: 'serpapi' };
        }

        // SerpAPI 데이터를 YouTube API 형식으로 변환
        const videos = data.video_results.map(video => ({
            id: video.link?.split('v=')[1]?.split('&')[0] || '',
            snippet: {
                title: video.title || '',
                channelTitle: video.channel?.name || '',
                channelId: video.channel?.link?.split('channel/')[1] || '',
                publishedAt: video.published_date || '',
                thumbnails: {
                    high: { url: video.thumbnail?.static || '' }
                }
            },
            statistics: {
                viewCount: video.views || 0,
                likeCount: 0,
                commentCount: 0
            },
            contentDetails: {
                duration: video.length || ''
            }
        }));

        // 채널 맵 생성
        const channelMap = {};
        data.video_results.forEach(video => {
            if (video.channel) {
                const channelId = video.channel.link?.split('channel/')[1] || '';
                channelMap[channelId] = {
                    id: channelId,
                    snippet: {
                        title: video.channel.name || ''
                    },
                    statistics: {
                        subscriberCount: video.channel.subscribers || 0
                    }
                };
            }
        });

        // 커스텀 메트릭 계산
        const items = videos.map((video, index) => {
            const channel = channelMap[video.snippet.channelId];
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const vpd = calculateVPD(viewCount, video.snippet.publishedAt);
            const subs = parseInt(channel?.statistics?.subscriberCount || 0);

            return {
                vpd,
                vclass: getVPDClass(vpd),
                cband: getChannelBand(subs),
                subs,
                index
            };
        });

        return {
            videos,
            channels: channelMap,
            items,
            dataSource: 'serpapi'
        };
    } catch (error) {
        console.error('❌ SerpAPI 오류:', error);
        throw error;
    }
}

/**
 * 자동으로 최적의 API 선택하여 검색
 * @param {string} query - 검색어
 * @returns {Promise<Object>} 검색 결과
 */
export async function searchYouTube(query) {
    try {
        // 먼저 Google API 시도
        return await searchWithGoogleAPI(query);
    } catch (error) {
        if (error.message === 'API_QUOTA_EXCEEDED') {
            console.log('⚠️ Google API 할당량 초과, SerpAPI로 전환');
            try {
                return await searchWithSerpAPI(query);
            } catch (serpError) {
                console.error('❌ SerpAPI도 실패:', serpError);
                throw new Error('모든 API 호출이 실패했습니다.');
            }
        } else {
            throw error;
        }
    }
}
