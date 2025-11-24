// ============================================
// UI.JS - UI 관련 함수 모음
// 검색, 필터링, 페이지네이션, 렌더링
// ============================================

import {
    getApiKeys,
    loadFromFirebase,
    saveToFirebase,
    searchYouTubeAPI,
    saveUserLastSearchKeyword,
    fetchNext50WithToken,
    hydrateDetailsOnlyForNew,
    mergeCacheWithMore,
    CACHE_TTL_MS
} from './api.js';
import { t } from './i18n.js';
import { getRecentVelocityForVideo } from './view-history.js';

// Global variables for pagination
export let allVideos = [];
export let allItems = [];
export const pageSize = 8;
export let currentPage = 1;
export let allChannelMap = {};
export let currentSearchQuery = '';
let currentVelocityMetric = 'day';
const PUBLIC_DEFAULT_QUERY = '인생사연';
const PUBLIC_DEFAULT_QUERY_NORMALIZED = PUBLIC_DEFAULT_QUERY.toLowerCase();

// ============================================
// 유틸리티 함수
// ============================================

export function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    // 1000 미만의 숫자도 소수점 1자리로 반올림
    return Number(num).toFixed(1);
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

function isPublicDefaultQuery(value) {
    return (value || '').trim().toLowerCase() === PUBLIC_DEFAULT_QUERY_NORMALIZED;
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

function getVelocityValue(item, metric = currentVelocityMetric) {
    const base = Number(item?.vpd || 0);
    if (metric === 'hour') {
        return base / 24;
    }
    return base;
}

function formatVelocityBadge(value, metric = currentVelocityMetric) {
    const unit = metric === 'hour' ? '/hr' : '/day';
    return `+${formatNumber(value)}${unit}`;
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
        case 'small': return '👥 소형';
        case 'mid': return '👥 중형';
        case 'large': return '👥 대형';
        case 'hidden': return '👥 비공개';
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
    const isDefaultPublicQuery = isPublicDefaultQuery(query);
    if (!window.currentUser && !wasDefaultSearch && !isDefaultPublicQuery) {
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
    if (window.currentUser && !window.isDefaultSearch && !isDefaultPublicQuery) {
        saveUserLastSearchKeyword(window.currentUser.uid, query);
    }
    
    // Reset pagination
    currentPage = 1;
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    // ============================================
    // 캐시 로직: 스마트 캐시 전략
    // ============================================
    
    const firebaseData = await loadFromFirebase(query);
    
    if (firebaseData) {
        const age = Date.now() - firebaseData.timestamp;
        const isExpired = age >= CACHE_TTL_MS;
        const count = firebaseData.videos?.length || 0;
        const meta = firebaseData.meta || {};
        const cacheSource = firebaseData.dataSource || meta.source || 'unknown';
        
        console.log(`📦 캐시 정보: ${count}개, 소스=${cacheSource}, 만료=${isExpired ? 'Y' : 'N'}`);
        
        // Google 데이터가 아닌 캐시는 최신 Google 데이터로 갱신
        if (cacheSource !== 'google') {
            console.log('🔄 Google 외 캐시 감지 → 전체 갱신');
            await performFullGoogleSearch(query, apiKeyValue);
            return;
        }
        
        // 신선한 Google 캐시 사용
        if (!isExpired) {
            console.log('✅ 신선한 Google 캐시 사용 (호출 0)');
            restoreFromCache(firebaseData);
            renderPage(1);
            return;
        }
        
        // 72시간 경과 + pagination 토큰 존재 → 토핑
        if (count === 50 && meta.nextPageToken) {
            console.log('🔝 토핑 모드: 추가 50개만 fetch');
            await performTopUpUpdate(query, apiKeyValue, firebaseData);
            return;
        }
        
        console.log('🔄 Google 캐시 만료 → 전체 갱신');
        await performFullGoogleSearch(query, apiKeyValue);
        return;
    }

    // 캐시 없음 → 전체 검색
    await performFullGoogleSearch(query, apiKeyValue);
}

// ============================================
// 검색 실행 함수들
// ============================================

async function performFullGoogleSearch(query, apiKeyValue) {
    try {
        console.log('🌐 Google API 전체 검색 (최대 300개)');
        const result = await searchYouTubeAPI(query, apiKeyValue);
        console.log(`🎯 fetch 완료: ${result.videos.length}개`);
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

        // Save to Firebase with nextPageToken
        await saveToFirebase(query, allVideos, allChannelMap, allItems, 'google', result.nextPageToken);
        renderPage(1);

    } catch (googleError) {
        console.error('❌ YouTube API 오류:', googleError);
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `<div class="error">${t('search.error')}</div>`;
    }
}

async function performTopUpUpdate(query, apiKeyValue, firebaseData) {
    try {
        const meta = firebaseData.meta || {};
        console.log('🔝 토핑: search.list 1회 + 신규 50개 상세 정보');
        
        // 1) 다음 50개 검색
        const more = await fetchNext50WithToken(query, apiKeyValue, meta.nextPageToken);
        
        // 2) 신규 50개 비디오/채널 상세
        const { videoDetails, channelsMap } = await hydrateDetailsOnlyForNew(more, apiKeyValue);
        
        // 3) 기존 캐시와 merge (압축 형태로 저장)
        const merged = mergeCacheWithMore(firebaseData, videoDetails, channelsMap);
        
        // 4) 압축된 데이터 복원
        const restoredVideos = merged.videos.map(v => ({
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
            }
        }));
        
        allVideos = restoredVideos;
        allChannelMap = merged.channels;
        
        // 5) items 재계산
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
        
        // 6) Firebase 저장 (meta 업데이트)
        await saveToFirebase(query, restoredVideos, allChannelMap, allItems, 'google', more.nextPageToken);
        renderPage(1);
        
    } catch (error) {
        console.error('❌ 토핑 실패:', error);
        await performFullGoogleSearch(query, apiKeyValue);
    }
}


// ============================================
// 렌더링 함수
// ============================================

function dedupeItemsByVideo(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const videoId = item?.raw?.id;
        if (!videoId) continue;
        if (seen.has(videoId)) continue;
        seen.add(videoId);
        result.push(item);
    }
    return result;
}

function getFilteredDedupedItems() {
    const filteredItems = applyFilters(allItems);
    return dedupeItemsByVideo(filteredItems);
}

export function renderPage(page) {
    currentPage = page;
    
    // Apply filters and dedupe results
    const dedupedItems = getFilteredDedupedItems();
    const velocityMetricSelect = document.getElementById('velocityMetricSelect');
    currentVelocityMetric = velocityMetricSelect?.value || 'day';
    
    // Sort by views per day if requested
    const sortSelect = document.getElementById('sortVpdSelect');
    const sortValue = sortSelect?.value || 'none';
    if (sortValue === 'asc') {
        dedupedItems.sort((a, b) => getVelocityValue(a) - getVelocityValue(b));
    } else if (sortValue === 'desc') {
        dedupedItems.sort((a, b) => getVelocityValue(b) - getVelocityValue(a));
    }
    
    // Pagination
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageItems = dedupedItems.slice(startIdx, endIdx);
    
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
    updatePaginationControls(dedupedItems.length);
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
    
    // 업로드 경과일수 계산
    const uploadedDays = ageDays(video.snippet.publishedAt);
    const daysText = uploadedDays < 1 ? '< 1d' : `${Math.floor(uploadedDays)}d`;
    
    const velocityValue = getVelocityValue(item);
    const videoId = video.id || video?.raw?.id || item?.raw?.id;
    card.innerHTML = `
        <div class="thumbnail-container">
            <img src="${thumbnail}" alt="${video.snippet.title}" loading="lazy">
            ${video.contentDetails?.duration ? `<div class="duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
            <div class="vpd-badge">${formatVelocityBadge(velocityValue)}</div>
        </div>
        <div class="video-info">
            <h3 class="video-title">${video.snippet.title}</h3>
            <div class="channel-info">
                <span class="channel-name">${video.snippet.channelTitle}</span>
            </div>
            <div class="stats">
                <span class="stat-item">👁 ${formatNumber(video.statistics?.viewCount || 0)}</span>
                <span class="stat-item">👍 ${formatNumber(video.statistics?.likeCount || 0)}</span>
                <span class="stat-item">👥 ${formatNumber(item.subs || 0)}</span>
                <span class="stat-item">📅 ${daysText}</span>
            </div>
            <div class="velocity-panel">
                <div class="velocity-row">
                    <span class="label" data-i18n="velocity.recent">${t('velocity.recent')}</span>
                    <span class="value recent-vph">${t('velocity.loading')}</span>
                </div>
                <div class="velocity-row">
                    <span class="label" data-i18n="velocity.daily">${t('velocity.daily')}</span>
                    <span class="value daily-vpd">${formatNumber(item.vpd || 0)}/day</span>
                </div>
            </div>
        </div>
    `;

    hydrateVelocityPanel(videoId, card.querySelector('.velocity-panel'), item.vpd);
    
    return card;
}

function hydrateVelocityPanel(videoId, panelEl, baseVpd = 0) {
    if (!panelEl) return;
    const recentEl = panelEl.querySelector('.recent-vph');
    const dailyEl = panelEl.querySelector('.daily-vpd');
    if (dailyEl) {
        dailyEl.textContent = `${formatNumber(baseVpd || 0)}/day`;
    }
    if (!videoId) {
        if (recentEl) recentEl.textContent = t('velocity.unavailable');
        return;
    }
    getRecentVelocityForVideo(videoId)
        .then((stats) => {
            if (!stats) {
                if (recentEl) recentEl.textContent = t('velocity.unavailable');
                return;
            }
            if (recentEl) {
                recentEl.textContent = `${formatNumber(stats.vph || 0)}/hr`;
            }
            if (dailyEl) {
                dailyEl.textContent = `${formatNumber(stats.vpd || baseVpd || 0)}/day`;
            }
        })
        .catch((error) => {
            console.warn('⚠️ 최근 VPH 로드 실패:', error);
            if (recentEl) recentEl.textContent = t('velocity.unavailable');
        });
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
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            
            // Handle custom range filter
            if (viewFilter === 'custom') {
                const minViews = parseInt(document.getElementById('viewCountMin')?.value || 0);
                const maxViews = parseInt(document.getElementById('viewCountMax')?.value || Infinity);
                
                if (viewCount < minViews || viewCount > maxViews) return false;
            } else if (viewFilter.includes('-')) {
                // Handle range filters (e.g., "0-1000" for Grade 5)
                const [min, max] = viewFilter.split('-').map(Number);
                if (viewCount < min || viewCount > max) return false;
            } else {
                // Handle minimum filters (e.g., "1000000" for Grade 1)
                const minViews = parseInt(viewFilter);
                if (viewCount < minViews) return false;
            }
        }
        
        // Subscriber filter
        if (subFilter !== 'all') {
            // Handle custom range filter
            if (subFilter === 'custom') {
                const minSubs = parseInt(document.getElementById('subCountMin')?.value || 0);
                const maxSubs = parseInt(document.getElementById('subCountMax')?.value || Infinity);
                
                if (item.subs < minSubs || item.subs > maxSubs) return false;
            } else if (subFilter.includes('-')) {
                // Handle range filters
                const [min, max] = subFilter.split('-').map(Number);
                if (item.subs < min || item.subs > max) return false;
            } else {
                // Handle minimum filters (e.g., "10000000" for Diamond)
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
            
            // Handle custom range filter (in minutes)
            if (durationFilter === 'custom') {
                const minMinutes = parseInt(document.getElementById('durationMin')?.value || 0);
                const maxMinutes = parseInt(document.getElementById('durationMax')?.value || Infinity);
                const minSeconds = minMinutes * 60;
                const maxSeconds = maxMinutes === Infinity ? Infinity : maxMinutes * 60;
                
                if (seconds < minSeconds || seconds > maxSeconds) return false;
            } else {
                // Handle preset range filters
                const [min, max] = durationFilter.split('-').map(Number);
                if (max) {
                    // Range filter (e.g., "60-600" for 1-10min)
                    if (seconds < min || seconds > max) return false;
                } else {
                    // Minimum filter (e.g., "3600" for 1hr+)
                    if (seconds < min) return false;
                }
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
        const dedupedItems = getFilteredDedupedItems();
        const totalPages = Math.ceil(dedupedItems.length / pageSize);
        if (currentPage < totalPages) {
            renderPage(currentPage + 1);
        }
    });
}

// ============================================
// 검색 모드 표시기
// ============================================

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
        }
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
    
    // Filter changes (radio and checkbox)
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            // Show/hide custom view count range
            if (input.name === 'viewCountFilter') {
                const customRange = document.getElementById('viewCountCustom');
                if (customRange) {
                    customRange.style.display = input.value === 'custom' ? 'block' : 'none';
                }
            }
            // Show/hide custom subscriber count range
            if (input.name === 'subCountFilter') {
                const customRange = document.getElementById('subCountCustom');
                if (customRange) {
                    customRange.style.display = input.value === 'custom' ? 'block' : 'none';
                }
            }
            // Show/hide custom duration range
            if (input.name === 'durationFilter') {
                const customRange = document.getElementById('durationCustom');
                if (customRange) {
                    customRange.style.display = input.value === 'custom' ? 'block' : 'none';
                }
            }
            renderPage(1);
        });
    });
    
    // Custom view count range input changes
    ['viewCountMin', 'viewCountMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                const viewFilter = document.querySelector('input[name="viewCountFilter"]:checked')?.value;
                if (viewFilter === 'custom') {
                    renderPage(1);
                }
            });
        }
    });
    
    // Custom subscriber count range input changes
    ['subCountMin', 'subCountMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                const subFilter = document.querySelector('input[name="subCountFilter"]:checked')?.value;
                if (subFilter === 'custom') {
                    renderPage(1);
                }
            });
        }
    });
    
    // Custom duration range input changes
    ['durationMin', 'durationMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                const durationFilter = document.querySelector('input[name="durationFilter"]:checked')?.value;
                if (durationFilter === 'custom') {
                    renderPage(1);
                }
            });
        }
    });
    
    // Pagination
    setupPaginationHandlers();
    
    // Sort controls
    document.getElementById('sortVpdSelect')?.addEventListener('change', () => {
        renderPage(1);
    });
    document.getElementById('velocityMetricSelect')?.addEventListener('change', () => {
        renderPage(1);
    });
}

// ============================================
// 초기화
// ============================================

export function initializeUI() {
    setupEventListeners();
    console.log('✅ UI 초기화 완료');
}
