// ============================================
// UI.JS - UI 관련 함수 모음
// 검색, 필터링, 페이지네이션, 렌더링
// ============================================

import { 
    getApiKeys, 
    loadFromFirebase, 
    saveToFirebase, 
    searchYouTubeAPI, 
    searchWithSerpAPI,
    saveUserLastSearchKeyword 
} from './api.js';
import { t } from './i18n.js';

// Global variables for pagination
export let allVideos = [];
export let allItems = [];
export const pageSize = 8;
export let currentPage = 1;
export let allChannelMap = {};
export let currentSearchQuery = '';
export let currentSearchMode = 'google';
export let currentDataSource = 'google';

// ============================================
// 유틸리티 함수
// ============================================

export function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

export function formatDuration(duration) {
    if (!duration) return '0:00';
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    let result = '';
    if (hours) result += hours + ':';
    result += (minutes || '0').padStart(2, '0') + ':';
    result += (seconds || '0').padStart(2, '0');
    return result;
}

export function parseDurationToSeconds(duration) {
    if (!duration) return 0;
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    
    const hours = parseInt((match[1] || '').replace('H', '')) || 0;
    const minutes = parseInt((match[2] || '').replace('M', '')) || 0;
    const seconds = parseInt((match[3] || '').replace('S', '')) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

export function getPublishedAfterDate(period) {
    if (!period) return '';
    
    const now = new Date();
    let date = new Date();
    const value = parseInt(period);

    if (!isNaN(value) && value > 0) {
        date.setDate(now.getDate() - value);
        console.log(`📅 기간 필터 계산: ${value}일 전`);
    } else {
        return '';
    }

    return date.toISOString();
}

// ============================================
// 속도 계산 함수
// ============================================

function ageDays(publishedAt) {
    const now = Date.now();
    const publishedTime = Date.parse(publishedAt);
    
    if (isNaN(publishedTime)) {
        console.warn('Invalid publishedAt date:', publishedAt);
        return 0.25;
    }
    
    const ageMs = Math.max(1, now - publishedTime);
    const d = ageMs / (1000 * 60 * 60 * 24);
    return d;
}

export function viewVelocityPerDay(video) {
    const views = Number(video.statistics?.viewCount || 0);
    const days = ageDays(video.snippet.publishedAt);
    
    if (days < 1) {
        const hours = Math.max(1, days * 24);
        return (views / hours) * 24;
    }
    return views / days;
}

export function classifyVelocity(vpd) {
    if (vpd >= 10_000) return 'viral';
    if (vpd >= 1_000) return 'hot';
    if (vpd >= 100) return 'normal';
    return 'cold';
}

export function channelSizeBand(channel) {
    const sub = Number(channel?.statistics?.subscriberCount ?? NaN);
    if (Number.isNaN(sub)) return 'hidden';
    if (sub < 10_000) return 'small';
    if (sub < 100_000) return 'mid';
    return 'large';
}

export function getChannelSizeEmoji(cband) {
    switch(cband) {
        case 'small': return '🌱';
        case 'mid': return '🌿';
        case 'large': return '🌳';
        case 'hidden': return '❓';
        default: return '';
    }
}

// ============================================
// 검색 함수
// ============================================

export async function search() {
    const query = document.getElementById('searchInput').value.trim();
    
    // Reset isDefaultSearch flag
    const wasDefaultSearch = window.isDefaultSearch;
    window.isDefaultSearch = false;
    
    // Check if user is logged in
    const isNewsQuery = query.toLowerCase() === 'news';
    if (!window.currentUser && !wasDefaultSearch && !isNewsQuery) {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.classList.add('active');
            alert(t('search.loginRequired'));
        }
        return;
    }
    
    if (!query) {
        alert(t('search.enterQuery'));
        return;
    }
    
    const keys = await getApiKeys();
    const apiKeyValue = keys.youtube;
    
    if (!apiKeyValue) {
        alert(t('search.apiKeyRequired'));
        return;
    }

    currentSearchQuery = query;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="loading">${t('search.loading')}</div>`;
    
    // Save search keyword
    if (window.currentUser && !window.isDefaultSearch && query !== 'news') {
        saveUserLastSearchKeyword(window.currentUser.uid, query);
    }
    
    // Reset pagination
    currentPage = 1;
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    // Check Firebase cache
    const firebaseData = await loadFromFirebase(query);
    if (firebaseData) {
        console.log('☁️ Firebase 캐시 발견');
        restoreFromCache(firebaseData);
        renderPage(1);
        return;
    }

    // Perform API search
    try {
        const result = await searchYouTubeAPI(query, apiKeyValue);
        allVideos = result.videos;
        allChannelMap = result.channels;
        
        // Enrich with velocity data
        allItems = allVideos.map(video => {
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

        // Save to Firebase
        await saveToFirebase(query, allVideos, allChannelMap, allItems, 'google');
        updateSearchModeIndicator('google');
        renderPage(1);

    } catch (googleError) {
        if (googleError.message === "quotaExceeded") {
            console.log('🔄 SerpAPI로 전환...');
            const serpVideos = await searchWithSerpAPI(query);
            allVideos = serpVideos;
            
            allItems = serpVideos.map(video => {
                const vpd = viewVelocityPerDay(video);
                return {
                    raw: video,
                    vpd: vpd,
                    vclass: classifyVelocity(vpd),
                    cband: 'hidden',
                    subs: 0
                };
            });

            await saveToFirebase(query, allVideos, allChannelMap, allItems, 'serpapi');
            updateSearchModeIndicator('serpapi');
            renderPage(1);
        } else {
            resultsDiv.innerHTML = `<div class="error">${t('search.error')}</div>`;
        }
    }
}

// ============================================
// 렌더링 함수
// ============================================

export function renderPage(page) {
    currentPage = page;
    
    // Apply filters
    const filteredItems = applyFilters(allItems);
    
    // Pagination
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageItems = filteredItems.slice(startIdx, endIdx);
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    if (pageItems.length === 0) {
        resultsDiv.innerHTML = `<div class="error">${t('search.noResults')}</div>`;
        return;
    }
    
    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'card-grid';
    
    // Use DocumentFragment to prevent layout thrashing
    const fragment = document.createDocumentFragment();
    
    pageItems.forEach(item => {
        const video = item.raw;
        const card = createVideoCard(video, item);
        if (card) { // Only append if card is not null
            fragment.appendChild(card);
        }
    });
    
    gridContainer.appendChild(fragment);
    resultsDiv.appendChild(gridContainer);
    
    // Update pagination
    updatePaginationControls(filteredItems.length);
}

function createVideoCard(video, item) {
    // Safety check: If video is undefined, return null
    if (!video || !video.snippet) {
        console.error('⚠️ Invalid video data:', video);
        return null;
    }
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
    
    const thumbnail = video.snippet.thumbnails?.maxres?.url || 
                     video.snippet.thumbnails?.high?.url || 
                     video.snippet.thumbnails?.default?.url;
    
    card.innerHTML = `
        <div class="thumbnail-container">
            <img src="${thumbnail}" alt="${video.snippet.title}" loading="lazy">
            ${video.contentDetails?.duration ? `<div class="duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
        </div>
        <div class="video-info">
            <h3 class="video-title">${video.snippet.title}</h3>
            <div class="channel-info">
                <span class="channel-name">${video.snippet.channelTitle}</span>
            </div>
            <div class="stats">
                <span class="stat-item">👁️ ${formatNumber(video.statistics?.viewCount || 0)}</span>
                <span class="stat-item">👍 ${formatNumber(video.statistics?.likeCount || 0)}</span>
            </div>
            <div class="velocity-info">
                <span>📈 ${formatNumber(item.vpd)}/day</span>
                <span>${getChannelSizeEmoji(item.cband)}</span>
            </div>
        </div>
    `;
    
    return card;
}

// ============================================
// 필터 함수
// ============================================

export function applyFilters(items) {
    const viewFilter = document.querySelector('input[name="viewCountFilter"]:checked')?.value;
    const subFilter = document.querySelector('input[name="subCountFilter"]:checked')?.value;
    const dateFilter = document.querySelector('input[name="uploadDateFilter"]:checked')?.value;
    const durationFilter = document.querySelector('input[name="durationFilter"]:checked')?.value;
    
    return items.filter(item => {
        const video = item.raw;
        
        // Safety check: Skip items without essential data
        if (!video || !video.snippet || !video.snippet.title) {
            console.warn('⚠️ Filtering out invalid video item (missing raw/snippet):', {
                id: item.id,
                hasRaw: !!video,
                hasSnippet: !!(video?.snippet),
                hasTitle: !!(video?.snippet?.title)
            });
            return false;
        }
        
        // View count filter
        if (viewFilter !== 'all') {
            const minViews = parseInt(viewFilter);
            if (parseInt(video.statistics?.viewCount || 0) < minViews) return false;
        }
        
        // Subscriber filter
        if (subFilter !== 'all') {
            if (subFilter.includes('-')) {
                const [min, max] = subFilter.split('-').map(Number);
                if (item.subs < min || item.subs > max) return false;
            } else {
                const minSubs = parseInt(subFilter);
                if (item.subs < minSubs) return false;
            }
        }
        
        // Upload date filter
        if (dateFilter !== 'all') {
            const days = parseInt(dateFilter);
            if (!video.snippet.publishedAt) {
                return false; // Skip items without published date when date filter is active
            }
            const publishedDate = new Date(video.snippet.publishedAt);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            if (publishedDate < cutoffDate) return false;
        }
        
        // Duration filter
        if (durationFilter !== 'all') {
            const seconds = parseDurationToSeconds(video.contentDetails?.duration);
            const [min, max] = durationFilter.split('-').map(Number);
            if (max) {
                if (seconds < min || seconds > max) return false;
            } else {
                if (seconds < min) return false;
            }
        }
        
        return true;
    });
}

// ============================================
// 페이지네이션
// ============================================

export function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const pageInfo = document.getElementById('pageInfo');
    const totalCount = document.getElementById('totalCount');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.innerHTML = `${currentPage} / ${totalPages} <span data-i18n="result.page">${t('result.page')}</span>`;
    }
    if (totalCount) totalCount.textContent = totalItems;
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

export function setupPaginationHandlers() {
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            renderPage(currentPage - 1);
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const filteredItems = applyFilters(allItems);
        const totalPages = Math.ceil(filteredItems.length / pageSize);
        if (currentPage < totalPages) {
            renderPage(currentPage + 1);
        }
    });
}

// ============================================
// 검색 모드 표시기
// ============================================

export function updateSearchModeIndicator(mode) {
    currentSearchMode = mode;
    const indicator = document.getElementById('searchModeIndicator');
    if (indicator) {
        const modeText = indicator.querySelector('.mode-text');
        if (mode === 'google') {
            modeText.textContent = `${t('search.mode')}: ${t('search.modeGoogle')}`;
        } else {
            modeText.textContent = `${t('search.mode')}: ${t('search.modeSerpAPI')}`;
        }
    }
}

// ============================================
// 캐시 복원
// ============================================

function restoreFromCache(firebaseData) {
    // Restore videos from compressed cache
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
            viewCount: v.viewCount || '0',
            likeCount: v.likeCount || '0'
        },
        contentDetails: {
            duration: v.duration || 'PT0S'
        },
        serpData: v.serp || null
    }));
    
    allVideos = restoredVideos;
    allChannelMap = firebaseData.channels || {};
    
    // Restore items with proper video mapping by ID
    const videoById = new Map(restoredVideos.map(v => [v.id, v]));
    allItems = (firebaseData.items || []).map(item => ({
        raw: videoById.get(item.id), // Connect to restored video by ID
        vpd: item.vpd,
        vclass: item.vclass,
        cband: item.cband,
        subs: item.subs
    })).filter(item => item.raw); // Remove items without matching video
    
    console.log(`✅ Firebase 캐시 복원 완료: ${allItems.length}개 항목`);
    
    if (firebaseData.dataSource) {
        currentDataSource = firebaseData.dataSource;
        updateSearchModeIndicator(firebaseData.dataSource);
    }
}

// ============================================
// 이벤트 리스너 설정
// ============================================

export function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn')?.addEventListener('click', search);
    
    // Enter key
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search();
    });
    
    // Filter changes
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => renderPage(1));
    });
    
    // Pagination
    setupPaginationHandlers();
}

// ============================================
// 초기화
// ============================================

export function initializeUI() {
    setupEventListeners();
    console.log('✅ UI 초기화 완료');
}
