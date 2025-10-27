// filter.js - 필터링 로직

import { VIEW_COUNT_FILTERS, SUB_COUNT_RANGES, SORT_OPTIONS } from './config.js';

/**
 * 조회수 필터 적용
 * @param {Array} videos - 비디오 배열
 * @param {string} filterValue - 필터 값
 * @returns {Array} 필터링된 비디오 배열
 */
export function applyViewCountFilter(videos, filterValue) {
    if (filterValue === VIEW_COUNT_FILTERS.ALL || !filterValue) {
        return videos;
    }

    const minViews = parseInt(filterValue);
    return videos.filter(video => {
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        return viewCount >= minViews;
    });
}

/**
 * 구독자 수 필터 적용
 * @param {Array} videos - 비디오 배열
 * @param {Object} channelMap - 채널 정보 맵
 * @param {string} filterValue - 필터 값
 * @returns {Array} 필터링된 비디오 배열
 */
export function applySubscriberFilter(videos, channelMap, filterValue) {
    if (filterValue === SUB_COUNT_RANGES.ALL || !filterValue) {
        return videos;
    }

    const [min, max] = filterValue.split('-').map(v => parseInt(v));
    
    return videos.filter(video => {
        const channel = channelMap[video.snippet.channelId];
        const subCount = parseInt(channel?.statistics?.subscriberCount || 0);
        
        if (max) {
            return subCount >= min && subCount <= max;
        } else {
            return subCount >= min;
        }
    });
}

/**
 * 정렬 적용
 * @param {Array} videos - 비디오 배열
 * @param {Array} items - 커스텀 메트릭 배열
 * @param {string} sortOption - 정렬 옵션
 * @returns {Array} 정렬된 { videos, items } 객체
 */
export function applySorting(videos, items, sortOption) {
    // 원본 배열 복사
    const sortedVideos = [...videos];
    const sortedItems = [...items];

    // 인덱스 배열 생성 및 정렬
    const indices = sortedVideos.map((_, index) => index);

    switch (sortOption) {
        case SORT_OPTIONS.VPD_DESC:
            indices.sort((a, b) => (sortedItems[b]?.vpd || 0) - (sortedItems[a]?.vpd || 0));
            break;
        case SORT_OPTIONS.VPD_ASC:
            indices.sort((a, b) => (sortedItems[a]?.vpd || 0) - (sortedItems[b]?.vpd || 0));
            break;
        case SORT_OPTIONS.VIEW_DESC:
            indices.sort((a, b) => {
                const viewsA = parseInt(sortedVideos[a]?.statistics?.viewCount || 0);
                const viewsB = parseInt(sortedVideos[b]?.statistics?.viewCount || 0);
                return viewsB - viewsA;
            });
            break;
        case SORT_OPTIONS.VIEW_ASC:
            indices.sort((a, b) => {
                const viewsA = parseInt(sortedVideos[a]?.statistics?.viewCount || 0);
                const viewsB = parseInt(sortedVideos[b]?.statistics?.viewCount || 0);
                return viewsA - viewsB;
            });
            break;
        case SORT_OPTIONS.DATE_DESC:
            indices.sort((a, b) => {
                const dateA = new Date(sortedVideos[a]?.snippet?.publishedAt || 0);
                const dateB = new Date(sortedVideos[b]?.snippet?.publishedAt || 0);
                return dateB - dateA;
            });
            break;
        case SORT_OPTIONS.DATE_ASC:
            indices.sort((a, b) => {
                const dateA = new Date(sortedVideos[a]?.snippet?.publishedAt || 0);
                const dateB = new Date(sortedVideos[b]?.snippet?.publishedAt || 0);
                return dateA - dateB;
            });
            break;
        default:
            return { videos: sortedVideos, items: sortedItems };
    }

    // 정렬된 인덱스로 배열 재구성
    const finalVideos = indices.map(i => sortedVideos[i]);
    const finalItems = indices.map(i => sortedItems[i]);

    return { videos: finalVideos, items: finalItems };
}

/**
 * 모든 필터 적용
 * @param {Array} videos - 비디오 배열
 * @param {Object} channelMap - 채널 정보 맵
 * @param {Array} items - 커스텀 메트릭 배열
 * @param {Object} filters - 필터 설정 { viewCount, subscriberCount, sort }
 * @returns {Object} 필터링 및 정렬된 { videos, items } 객체
 */
export function applyAllFilters(videos, channelMap, items, filters) {
    let filteredVideos = [...videos];
    let filteredItems = [...items];

    // 1. 조회수 필터
    if (filters.viewCount) {
        const minViews = parseInt(filters.viewCount);
        const validIndices = [];
        
        filteredVideos = filteredVideos.filter((video, index) => {
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const isValid = viewCount >= minViews;
            if (isValid) {
                validIndices.push(index);
            }
            return isValid;
        });
        
        filteredItems = validIndices.map(i => filteredItems[i]);
    }

    // 2. 구독자 필터
    if (filters.subscriberCount && filters.subscriberCount !== SUB_COUNT_RANGES.ALL) {
        const [min, max] = filters.subscriberCount.split('-').map(v => parseInt(v));
        const validIndices = [];
        
        filteredVideos = filteredVideos.filter((video, index) => {
            const channel = channelMap[video.snippet.channelId];
            const subCount = parseInt(channel?.statistics?.subscriberCount || 0);
            
            let isValid;
            if (max) {
                isValid = subCount >= min && subCount <= max;
            } else {
                isValid = subCount >= min;
            }
            
            if (isValid) {
                validIndices.push(index);
            }
            return isValid;
        });
        
        filteredItems = validIndices.map(i => filteredItems[i]);
    }

    // 3. 정렬
    if (filters.sort) {
        const sorted = applySorting(filteredVideos, filteredItems, filters.sort);
        filteredVideos = sorted.videos;
        filteredItems = sorted.items;
    }

    return { videos: filteredVideos, items: filteredItems };
}

/**
 * 필터 상태 가져오기
 * @returns {Object} 현재 필터 설정
 */
export function getFilterState() {
    const viewCountFilter = document.querySelector('input[name="viewCountFilter"]:checked')?.value || VIEW_COUNT_FILTERS.ALL;
    const subCountFilter = document.querySelector('input[name="subCountFilter"]:checked')?.value || SUB_COUNT_RANGES.ALL;
    const sortOption = document.getElementById('sortSelect')?.value || SORT_OPTIONS.VPD_DESC;

    return {
        viewCount: viewCountFilter,
        subscriberCount: subCountFilter,
        sort: sortOption
    };
}

/**
 * 필터 리셋
 */
export function resetFilters() {
    // 조회수 필터 리셋
    const viewAllRadio = document.querySelector('input[name="viewCountFilter"][value="all"]');
    if (viewAllRadio) viewAllRadio.checked = true;

    // 구독자 필터 리셋
    const subAllRadio = document.querySelector('input[name="subCountFilter"][value="all"]');
    if (subAllRadio) subAllRadio.checked = true;

    // 정렬 리셋
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = SORT_OPTIONS.VPD_DESC;
}

/**
 * 필터 이벤트 리스너 설정
 * @param {Function} onFilterChange - 필터 변경 콜백
 */
export function setupFilterListeners(onFilterChange) {
    // 조회수 필터
    document.querySelectorAll('input[name="viewCountFilter"]').forEach(radio => {
        radio.addEventListener('change', onFilterChange);
    });

    // 구독자 필터
    document.querySelectorAll('input[name="subCountFilter"]').forEach(radio => {
        radio.addEventListener('change', onFilterChange);
    });

    // 정렬
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', onFilterChange);
    }

    console.log('✅ 필터 이벤트 리스너 등록 완료');
}
