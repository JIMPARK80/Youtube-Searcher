// ui-renderer.js - UI 렌더링 기능

import { PAGINATION_CONFIG } from './config.js';
import { parseDuration, formatRelativeTime, formatNumber } from './utils.js';

/**
 * 비디오 카드 렌더링
 * @param {Array} videos - 비디오 배열
 * @param {Object} channelMap - 채널 정보 맵
 * @param {Array} items - 커스텀 메트릭 배열
 * @param {number} page - 현재 페이지
 * @returns {string} HTML 문자열
 */
export function renderVideoCards(videos, channelMap, items, page = 1) {
    const start = (page - 1) * PAGINATION_CONFIG.itemsPerPage;
    const end = start + PAGINATION_CONFIG.itemsPerPage;
    const pageVideos = videos.slice(start, end);

    let html = '';
    
    pageVideos.forEach((video, idx) => {
        const globalIdx = start + idx;
        const item = items[globalIdx];
        const channel = channelMap[video.snippet.channelId];
        
        const videoId = video.id.videoId || video.id;
        const thumbnailUrl = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '';
        const title = video.snippet.title || '제목 없음';
        const channelTitle = video.snippet.channelTitle || '채널명 없음';
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        const likeCount = parseInt(video.statistics?.likeCount || 0);
        const commentCount = parseInt(video.statistics?.commentCount || 0);
        const duration = video.contentDetails?.duration || 'PT0S';
        const publishedAt = video.snippet.publishedAt || '';
        const subscriberCount = parseInt(channel?.statistics?.subscriberCount || 0);
        
        html += `
            <div class="video-card" data-vpd="${item?.vpd || 0}" data-views="${viewCount}" data-date="${publishedAt}">
                <div class="thumbnail-container">
                    <img src="${thumbnailUrl}" alt="${title}" class="thumbnail">
                    <span class="duration">${parseDuration(duration)}</span>
                </div>
                <div class="video-info">
                    <h3 class="video-title">
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${title}</a>
                    </h3>
                    <div class="channel-info">
                        <span class="channel-name">${channelTitle}</span>
                        <span class="subscriber-count">구독자 ${formatNumber(subscriberCount)}</span>
                        <span class="channel-band">${item?.cband || ''}</span>
                    </div>
                    <div class="video-stats">
                        <span>👁️ ${formatNumber(viewCount)}</span>
                        <span>👍 ${formatNumber(likeCount)}</span>
                        <span>💬 ${formatNumber(commentCount)}</span>
                        <span>📅 ${formatRelativeTime(publishedAt)}</span>
                    </div>
                    <div class="video-metrics">
                        <span class="vpd-badge">일평균: ${formatNumber(item?.vpd || 0)}</span>
                        <span class="vclass-badge">${item?.vclass || ''}</span>
                    </div>
                </div>
            </div>
        `;
    });

    return html;
}

/**
 * 페이지네이션 렌더링
 * @param {number} currentPage - 현재 페이지
 * @param {number} totalItems - 전체 아이템 수
 * @param {Function} onPageChange - 페이지 변경 콜백
 * @returns {string} HTML 문자열
 */
export function renderPagination(currentPage, totalItems, onPageChange) {
    const totalPages = Math.ceil(totalItems / PAGINATION_CONFIG.itemsPerPage);
    
    if (totalPages <= 1) {
        return '';
    }

    let html = '<div class="pagination">';
    
    // 이전 버튼
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}">이전</button>`;
    }
    
    // 페이지 번호
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="page-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        html += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="page-ellipsis">...</span>`;
        }
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // 다음 버튼
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}">다음</button>`;
    }
    
    html += '</div>';
    
    // 이벤트 리스너 등록
    setTimeout(() => {
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                onPageChange(page);
            });
        });
    }, 0);
    
    return html;
}

/**
 * 검색 결과 통계 렌더링
 * @param {number} totalItems - 전체 아이템 수
 * @param {number} filteredItems - 필터링된 아이템 수
 * @returns {string} HTML 문자열
 */
export function renderStats(totalItems, filteredItems) {
    return `
        <div class="search-stats">
            <span>전체 결과: ${totalItems}개</span>
            ${filteredItems < totalItems ? `<span>필터링됨: ${filteredItems}개</span>` : ''}
        </div>
    `;
}

/**
 * 데이터 소스 표시 업데이트
 * @param {string} source - 데이터 소스 ('google' 또는 'serpapi')
 */
export function updateDataSourceIndicator(source) {
    const indicator = document.getElementById('searchModeIndicator');
    if (!indicator) return;

    if (source === 'google') {
        indicator.innerHTML = '<span class="mode-text">현재 검색 모드: 🟢 Google API</span>';
        indicator.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    } else if (source === 'serpapi') {
        indicator.innerHTML = '<span class="mode-text">현재 검색 모드: 🔵 SerpAPI</span>';
        indicator.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
    }
}

/**
 * 빈 결과 메시지 렌더링
 * @returns {string} HTML 문자열
 */
export function renderEmptyResult() {
    return `
        <div class="empty-result">
            <div class="empty-icon">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어로 다시 시도해보세요.</p>
        </div>
    `;
}

/**
 * 로딩 스피너 표시
 * @param {HTMLElement} container - 로딩을 표시할 컨테이너
 */
export function showLoadingSpinner(container) {
    container.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>검색 중입니다...</p>
        </div>
    `;
}

/**
 * 에러 메시지 표시
 * @param {HTMLElement} container - 에러를 표시할 컨테이너
 * @param {string} message - 에러 메시지
 * @param {string} errorType - 에러 타입 ('api', 'network', 'firebase', 'general')
 */
export function showErrorMessage(container, message, errorType = 'general') {
    const errorConfig = {
        api: {
            icon: '🔑',
            title: 'API 키 오류',
            message: message || 'YouTube API 키를 확인할 수 없습니다.',
            solutions: [
                'API 키가 Firebase에 올바르게 설정되어 있는지 확인하세요.',
                '<a href="setup.html" style="color: #4CAF50; text-decoration: underline;">API 키 설정 페이지</a>에서 키를 확인하세요.',
                '인터넷 연결을 확인하고 페이지를 새로고침하세요.'
            ]
        },
        network: {
            icon: '🌐',
            title: '네트워크 오류',
            message: message || '인터넷 연결을 확인할 수 없습니다.',
            solutions: [
                '인터넷 연결을 확인하세요.',
                '방화벽이나 VPN이 연결을 차단하고 있는지 확인하세요.',
                '잠시 후 다시 시도하세요.'
            ]
        },
        firebase: {
            icon: '🔥',
            title: 'Firebase 연결 오류',
            message: message || '데이터베이스 연결에 실패했습니다.',
            solutions: [
                '인터넷 연결을 확인하세요.',
                '다른 검색어로 시도해보세요 (오프라인 캐시 사용).',
                '페이지를 새로고침하세요.'
            ]
        },
        general: {
            icon: '⚠️',
            title: '오류가 발생했습니다',
            message: message || '예기치 않은 오류가 발생했습니다.',
            solutions: [
                '페이지를 새로고침해보세요.',
                '브라우저 캐시를 삭제하고 다시 시도하세요.',
                '문제가 계속되면 개발자에게 문의하세요.'
            ]
        }
    };

    const config = errorConfig[errorType] || errorConfig.general;
    
    container.innerHTML = `
        <div class="error-container" style="max-width: 600px; margin: 40px auto; padding: 30px; text-align: center;">
            <div class="error-icon" style="font-size: 64px; margin-bottom: 20px;">${config.icon}</div>
            <h3 style="font-size: 24px; margin-bottom: 10px; color: #333;">${config.title}</h3>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">${config.message}</p>
            
            <div class="error-solutions" style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <h4 style="font-size: 16px; margin-bottom: 15px; color: #555;">해결 방법:</h4>
                <ul style="list-style: none; padding: 0;">
                    ${config.solutions.map((solution, index) => `
                        <li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
                            <span style="position: absolute; left: 0; color: #4CAF50;">${index + 1}.</span>
                            <span style="color: #666;">${solution}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="error-actions" style="display: flex; gap: 10px; justify-content: center;">
                <button class="retry-btn" onclick="location.reload()" 
                        style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    🔄 다시 시도
                </button>
                <button class="retry-btn" onclick="window.location.href='setup.html'" 
                        style="padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    ⚙️ 설정 확인
                </button>
            </div>
        </div>
    `;
}

/**
 * 스크롤을 최상단으로 이동
 */
export function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * 토스트 알림 표시
 * @param {string} message - 알림 메시지
 * @param {string} type - 알림 타입 ('success', 'error', 'info')
 */
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
