// ============================================
// UI.JS - UI related functions
// Search, filtering, rendering
// ============================================

import {
    getApiKeys,
    searchYouTubeAPI,
    saveUserLastSearchKeyword,
    fetchNext50WithToken,
    hydrateDetailsOnlyForNew,
    mergeCacheWithMore
} from './api.js';
import {
    loadFromSupabase,
    saveToSupabase,
    updateMissingData
} from './supabase-api.js';
import { supabase } from './supabase-config.js';
import { t } from './i18n.js';

// Global variables
export let allVideos = [];
export let allItems = [];
export let allChannelMap = {};
export let currentSearchQuery = '';
// Track server's total_count
export let currentTotalCount = 0;
// Track background collection status to prevent duplicate API calls
const backgroundCollectionStatus = new Map(); // query -> { isCollecting: boolean }

// Maximum number of videos per keyword
const MAX_RESULTS_LIMIT = 200;

export function getMaxResults() {
    return 'max';
}


export function setMaxResults(count) {
    if (count === 'max') {
        localStorage.setItem(MAX_RESULTS_STORAGE_KEY, 'max');
    } else {
        const limitedCount = Math.min(count, MAX_RESULTS_LIMIT);
        localStorage.setItem(MAX_RESULTS_STORAGE_KEY, limitedCount.toString());
    }
}

// Prevent duplicate background updates
let isUpdatingMissingData = false;
// Default: average daily views (VPD)
let currentVelocityMetric = 'day';

// Auto-refresh management
let lastUIUpdateTime = Date.now();
let autoRefreshTimer = null;
// Auto-refresh if no UI updates for 5 minutes
const AUTO_REFRESH_INACTIVE_MS = 5 * 60 * 1000;

// Debug mode (log output only during development)
// Debug logging removed for production
const debugLog = () => {}; // No-op function

// Console cleanup removed for production
const PUBLIC_DEFAULT_QUERY = '인생사연';
const PUBLIC_DEFAULT_QUERY_NORMALIZED = PUBLIC_DEFAULT_QUERY.toLowerCase();

// ============================================
// Utility functions
// ============================================

export function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    // Round numbers less than 1000 to 1 decimal place
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

// Thumbnail cache to avoid repeated fetches
const thumbnailCache = new Map();

/**
 * Get the best available YouTube thumbnail URL
 * Tests each thumbnail size and returns the first working one
 * This is the safest auto-fallback mechanism to fix all 404 thumbnail errors
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string|null>} - First available thumbnail URL or null
 */
async function getBestThumbnail(videoId) {
    if (!videoId) return null;
    
    // Check cache first
    if (thumbnailCache.has(videoId)) {
        return thumbnailCache.get(videoId);
    }
    
    const urls = [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    ];
    
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                thumbnailCache.set(videoId, url);
                return url;
            }
        } catch (error) {
            // Continue to next URL
            continue;
        }
    }
    
    // If all fail, cache null to avoid repeated attempts
    thumbnailCache.set(videoId, null);
    return null;
}

export function getPublishedAfterDate(period) {
    if (!period) return '';
    
    const now = new Date();
    let date = new Date();
    const value = parseInt(period);

    if (!isNaN(value) && value > 0) {
        date.setDate(now.getDate() - value);
    } else {
        return '';
    }

    return date.toISOString();
}

function isPublicDefaultQuery(value) {
    return (value || '').trim().toLowerCase() === PUBLIC_DEFAULT_QUERY_NORMALIZED;
}

// ============================================
// Timezone utility functions (Canada Toronto Eastern Time)
// ============================================

// Canada Toronto (Eastern) timezone (automatically handles EST/EDT)
const TORONTO_TIMEZONE = 'America/Toronto';

// Format date in Toronto timezone
export function formatDateToronto(date, options = {}) {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    const defaultOptions = {
        timeZone: TORONTO_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        ...options
    };
    
    return new Intl.DateTimeFormat('ko-KR', defaultOptions).format(dateObj);
}

// Convert date to Toronto timezone and return as simple string
export function formatDateTorontoSimple(date) {
    return formatDateToronto(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate elapsed time based on Toronto timezone
export function getElapsedTimeToronto(startDate, endDate = null) {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();
    
    // Calculate millisecond difference (accurate regardless of timezone)
    return end.getTime() - start.getTime();
}

// ============================================
// Velocity calculation functions
// ============================================

function ageDays(publishedAt) {
    // Calculate time in UTC, display in Toronto timezone
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
    // Calculate vpd if not available
    let base = Number(item?.vpd || 0);
    if (base === 0 && item?.raw) {
        base = viewVelocityPerDay(item.raw);
    }
    if (metric === 'hour') {
        return base / 24;
    }
    return base;
}

function formatVelocityBadge(value, metric = currentVelocityMetric) {
    let unit = '/day';
    if (metric === 'hour') {
        unit = '/hr';
    }
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
// Search function
// ============================================

// Track search state (prevent duplicate searches)
let isSearching = false;
// Timer to prevent freezing
let searchTimeoutTimer = null;
// Quota exceeded flag
let isQuotaExceeded = false;

export async function search(shouldReload = false) {
    // Prevent duplicate searches (except auto search)
    if (isSearching && !shouldReload) {
        debugLog('ℹ️ 검색이 이미 진행 중입니다. 대기 중...');
        return;
    }
    
    // Reset quota exceeded flag
    isQuotaExceeded = false;
    
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    try {
        isSearching = true;
        
        // Disable search button
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.textContent = t('search.searching') || '검색 중...';
        }
        if (searchInput) {
            searchInput.disabled = true;
        }
        
        const query = document.getElementById('searchInput')?.value?.trim();
        
        // Prevent freezing: auto-refresh and auto-search after 3 seconds
        if (searchTimeoutTimer) {
            clearTimeout(searchTimeoutTimer);
        }
        searchTimeoutTimer = setTimeout(() => {
            // Auto-refresh if search not completed after 3 seconds
            if (isSearching && query) {
                // Save search query
                localStorage.setItem('autoRefreshLastQuery', query);
                localStorage.setItem('autoSearchOnLoad', 'true');
                // Reload page
                location.reload();
            }
        }, 3000);
        
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
            // 타이머 클리어
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            isSearching = false;
            if (searchBtn) searchBtn.disabled = false;
            if (searchInput) searchInput.disabled = false;
            return;
        }
        
        if (!query) {
            // 타이머 클리어
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            alert(t('search.enterQuery'));
            isSearching = false;
            if (searchBtn) searchBtn.disabled = false;
            if (searchInput) searchInput.disabled = false;
            return;
        }
        
        const keys = await getApiKeys();
        const apiKeyValue = keys.youtube;
        
        if (!apiKeyValue) {
            // 타이머 클리어
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            alert(t('search.apiKeyRequired'));
            isSearching = false;
            if (searchBtn) searchBtn.disabled = false;
            if (searchInput) searchInput.disabled = false;
            return;
        }

        // 검색어를 localStorage에 저장하고 새로고침 (shouldReload가 false일 때만)
        if (!shouldReload) {
            localStorage.setItem('autoRefreshLastQuery', query);
            localStorage.setItem('autoSearchOnLoad', 'true'); // 자동 검색 플래그
            // 검색어 저장 후 새로고침
            location.reload();
            return; // 새로고침되므로 이후 코드는 실행되지 않음
        }

        currentSearchQuery = query;
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `<div class="loading">${t('search.loading')}</div>`;
    
    // Save search keyword
    if (window.currentUser && !window.isDefaultSearch && !isDefaultPublicQuery) {
        saveUserLastSearchKeyword(window.currentUser.uid, query);
    }
    
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    // ============================================
    // 캐시 로직: 서버 우선 전략
    // 1순위: 서버(Supabase) 데이터 (API 호출 여부 결정 기준)
    // 2순위: 로컬 캐시 (백업용, 서버 연결 실패 시만 사용)
    // ============================================
    
    // 로컬 캐시 확인 (백업용, 서버 연결 실패 시 사용)
    debugLog(`💾 로컬 캐시 확인 중 (백업용): "${query}"`);
    let localCacheData = loadFromLocalCache(query);
    let localCount = 0;
    if (localCacheData) {
        localCount = localCacheData.videos?.length || 0;
        if (localCount > 0) {
            debugLog(`✅ 로컬 캐시 발견 (${localCount}개) - 백업용`);
        }
    }
    
    // 선택한 최대 결과 수 확인
    const maxResults = getMaxResults();
    // 'max'인 경우 MAX_RESULTS_LIMIT 사용 (Infinity 대신)
    const targetCount = maxResults === 'max' ? MAX_RESULTS_LIMIT : maxResults;
    
    // 1️⃣ 서버(Supabase) 데이터 확인 (API 호출 여부 결정 기준)
    console.log(`📊 서버 데이터 확인 중 (API 호출 여부 결정 기준)...`);
    debugLog(`🔍 Supabase 캐시 확인 중: "${query}" (API 호출 여부 결정)`);
    
    let supabaseData = null;
    try {
        supabaseData = await loadFromSupabase(query, true); // ignoreExpiry = true
    } catch (serverError) {
        // 서버 연결 실패 시 로컬 캐시 사용 (백업)
        console.warn(`⚠️ 서버 연결 실패: ${serverError.message} → 로컬 캐시 사용 (백업)`);
        if (localCacheData && localCount > 0) {
            console.log(`📦 로컬 캐시 사용 (백업, ${localCount}개)`);
            restoreFromCache(localCacheData);
            renderPage();
            lastUIUpdateTime = Date.now();
            return;
        } else {
            // 로컬 캐시도 없으면 에러 표시
            const resultsDiv = document.getElementById('results');
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div class="error">⚠️ 서버 연결 실패<br>로컬 캐시도 없습니다.<br>인터넷 연결을 확인해주세요.</div>`;
            }
            return;
        }
    }
    
    if (supabaseData && supabaseData.videos && supabaseData.videos.length > 0) {
        const supabaseCount = supabaseData.videos.length;
        const supabaseTotal = supabaseData.meta?.total || supabaseCount;
        
        console.log(`📊 서버 데이터 확인: ${supabaseCount}개 비디오 (total_count: ${supabaseTotal})`);
        
        // total_count와 실제 비디오 개수 불일치 확인 및 수정
        if (supabaseTotal > supabaseCount) {
            console.warn(`⚠️ total_count 불일치 감지: total_count=${supabaseTotal}, 실제 비디오=${supabaseCount}개`);
            console.log(`📊 total_count를 실제 비디오 개수(${supabaseCount}개)로 조정`);
            
            // total_count를 실제 비디오 개수로 업데이트
            try {
                const { error: updateError } = await supabase
                    .from('search_cache')
                    .update({ total_count: supabaseCount })
                    .eq('keyword', query.trim().toLowerCase());
                
                if (updateError) {
                    console.warn('⚠️ total_count 업데이트 실패:', updateError);
                } else {
                    console.log(`✅ total_count 업데이트 완료: ${supabaseTotal} → ${supabaseCount}`);
                    supabaseTotal = supabaseCount;
                    supabaseData.meta.total = supabaseCount;
                }
            } catch (err) {
                console.warn('⚠️ total_count 업데이트 중 오류:', err);
            }
        }
        
        // 이미 MAX_RESULTS_LIMIT에 도달했으면 추가 검색 중단 (가장 먼저 확인)
        if (supabaseCount >= MAX_RESULTS_LIMIT) {
            console.log(`✅ 서버에 충분한 데이터 있음 (${supabaseCount}개 >= ${MAX_RESULTS_LIMIT}개) → API 호출 생략`);
            debugLog(`✅ Supabase 캐시 충분 (${supabaseCount}개 >= ${MAX_RESULTS_LIMIT}개) → API 호출 생략`);
            
            restoreFromCache(supabaseData);
            
            // total_count 업데이트
            currentTotalCount = Math.max(supabaseCount, supabaseTotal);
            
            // 로컬 캐시 업데이트 (서버 데이터로 동기화)
            saveToLocalCache(query, supabaseData);
            console.log(`💾 로컬 캐시 업데이트 완료 (서버 데이터로 동기화: ${supabaseCount}개)`);
            
            // 타이머 클리어
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            
            renderPage();
            lastUIUpdateTime = Date.now();
            
            // 백그라운드에서 NULL 데이터 자동 업데이트
            if (apiKeyValue) {
                updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
                    console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
                });
            }
            return;
        }
        
        // 서버 데이터가 충분하면 서버 데이터 사용, API 호출 안 함
        if (supabaseCount >= targetCount || supabaseTotal >= targetCount) {
            const reason = supabaseCount >= targetCount ? `실제 비디오(${supabaseCount}개)` : `total_count(${supabaseTotal}개)`;
            console.log(`✅ 서버에 충분한 데이터 있음 (${reason} >= ${targetCount}개) → API 호출 생략`);
            debugLog(`✅ Supabase 캐시 충분 (${reason} >= ${targetCount}개) → API 호출 생략`);
            
            restoreFromCache(supabaseData);
            
            // total_count 업데이트
            currentTotalCount = Math.max(supabaseCount, supabaseTotal);
            
            // 로컬 캐시 업데이트 (서버 데이터로 동기화)
            saveToLocalCache(query, supabaseData);
            console.log(`💾 로컬 캐시 업데이트 완료 (서버 데이터로 동기화: ${supabaseCount}개)`);
            
            // 타이머 클리어
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            
            renderPage();
            lastUIUpdateTime = Date.now();
            
            // 백그라운드에서 NULL 데이터 자동 업데이트
            if (apiKeyValue) {
                updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
                    console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
                });
            }
            return;
        }
        
        // 서버 데이터가 부족하면 서버 데이터를 기반으로 추가 검색
        console.log(`📊 서버 데이터 부족 (${supabaseCount}개 < ${targetCount}개) → 추가 검색 필요`);
        
        // 서버 데이터 복원
        restoreFromCache(supabaseData);
        
        // 로컬 캐시 업데이트 (서버 데이터로 동기화)
        saveToLocalCache(query, supabaseData);
        console.log(`💾 로컬 캐시 업데이트 완료 (서버 데이터로 동기화: ${supabaseCount}개)`);
        
        // 기존 ID 제외하고 필요한 수만 추가로 가져오기
        const existingVideoIds = supabaseData.videos.map(v => v.id).filter(Boolean);
        // targetCount는 이미 MAX_RESULTS_LIMIT로 제한되어 있으므로 단순 계산
        const neededCount = Math.min(targetCount - supabaseCount, MAX_RESULTS_LIMIT - supabaseCount);
        
        console.log(`🔍 추가 검색 필요: ${neededCount}개 (서버: ${supabaseCount}개, 목표: ${targetCount}개)`);
        debugLog(`📈 서버 데이터 부족 → 기존 ID 제외하고 ${neededCount}개 추가 필요`);
        
        await fetchAdditionalVideos(query, apiKeyValue, neededCount, existingVideoIds);
        return;
    }
    
    // 서버에 데이터가 없으면 로컬 캐시 백업용으로 사용 후 API 호출
    console.log(`⚠️ 서버에 데이터 없음 → 로컬 캐시 확인 후 API 호출`);
    
    // 로컬 캐시가 있으면 백업용으로 표시 (빠른 로딩, API 호출은 서버 데이터 기준)
    // TTL 체크 제거: 캐시는 만료되지 않고 계속 유지됨
    if (localCacheData && localCount > 0) {
        console.log(`📦 로컬 캐시 사용 (백업, ${localCount}개) - API 호출은 서버 데이터 기준`);
        restoreFromCache(localCacheData);
        renderPage();
        lastUIUpdateTime = Date.now();
    }
    
    // 서버에 데이터가 없으므로 API 호출 필요 (로컬 캐시와 무관하게)
    console.log(`🔍 서버에 데이터 없음 → YouTube API 호출 (로컬 캐시 무관)`);
    await performFullGoogleSearch(query, apiKeyValue);
    return;
    } catch (error) {
        console.error('❌ 검색 중 오류 발생:', error);
        
        // API 할당량 초과 시 만료된 캐시라도 사용 시도
        const errorMsg = (error && typeof error === 'object' && error.message) 
            ? error.message 
            : (typeof error === 'string' ? error : '');
        if (errorMsg === 'quotaExceeded' || errorMsg?.includes('quota') || 
            (errorMsg && errorMsg.includes('할당량'))) {
            console.warn('⚠️ API 할당량 초과 → 만료된 캐시라도 사용 시도');
            isQuotaExceeded = true;
            
            // 만료된 캐시라도 로드 시도
            try {
                const cacheData = await loadFromSupabase(query, true); // ignoreExpiry = true
                console.log('🔍 캐시 로드 결과:', cacheData ? `${cacheData.videos?.length || 0}개 비디오` : '없음');
                
                if (cacheData && cacheData.videos && cacheData.videos.length > 0) {
                    console.log('✅ 캐시 데이터 복원 중...');
                    restoreFromCache(cacheData);
                    const resultsDiv = document.getElementById('results');
                    if (resultsDiv) {
                        resultsDiv.innerHTML = `<div class="info">⚠️ API 할당량 초과로 캐시 데이터를 사용합니다 (${allVideos.length}개)</div>`;
                    }
                    renderPage();
                    lastUIUpdateTime = Date.now();
                    return; // 캐시 데이터 사용, 정상 종료
                } else {
                    console.warn('⚠️ 캐시 데이터가 없거나 비어있음');
                }
            } catch (cacheError) {
                console.error('❌ 캐시 로드 중 에러:', cacheError);
            }
            
            // 캐시도 없으면 에러 표시
            const resultsDiv = document.getElementById('results');
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div class="error">⚠️ YouTube API 할당량 초과<br>캐시 데이터도 없습니다.<br>내일 다시 시도해주세요.</div>`;
            }
            return; // 에러 표시 후 종료 (throw하지 않음)
        }
        
        // UI 상태 복구
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">${t('search.error') || '검색 중 오류가 발생했습니다.'}</div>`;
        }
        
        // 사용자에게 알림 (에러 메시지가 너무 길면 간단하게)
        const errorMessage = (error && typeof error === 'object' && error.message) 
            ? error.message 
            : (typeof error === 'string' ? error : '알 수 없는 오류');
        const shortMessage = errorMessage.length > 50 ? '검색 중 오류가 발생했습니다. 다시 시도해주세요.' : errorMessage;
        alert(shortMessage);
        
        // 앱이 멈추지 않도록 에러를 처리
    } finally {
        // 타이머 클리어
        if (searchTimeoutTimer) {
            clearTimeout(searchTimeoutTimer);
            searchTimeoutTimer = null;
        }
        
        // 검색 완료 후 UI 상태 복구
        isSearching = false;
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = t('search.button') || '검색';
        }
        if (searchInput) {
            searchInput.disabled = false;
        }
    }
}

// ============================================
// 검색 실행 함수들
// ============================================

// 기존 비디오 ID를 제외하고 필요한 수만 추가로 가져오기
async function fetchAdditionalVideos(query, apiKeyValue, neededCount, excludeVideoIds) {
    // 현재 저장된 비디오 개수 확인
    const currentVideoCount = excludeVideoIds.length;
    
    // 이미 MAX_RESULTS_LIMIT(200개)에 도달했으면 추가 검색 중단
    if (currentVideoCount >= MAX_RESULTS_LIMIT) {
        console.log(`⏹️ 추가 검색 중단: 이미 ${currentVideoCount}개 저장됨 (최대 제한: ${MAX_RESULTS_LIMIT}개)`);
        debugLog(`⏹️ 추가 검색 중단: 이미 ${currentVideoCount}개 >= ${MAX_RESULTS_LIMIT}개`);
        return;
    }
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('추가 검색 타임아웃: 60초 내에 응답이 없습니다.')), 60000);
    });
    
    try {
        // Infinity나 잘못된 값 방지
        // 남은 개수만큼만 요청 (MAX_RESULTS_LIMIT를 초과하지 않도록)
        const remainingCount = MAX_RESULTS_LIMIT - currentVideoCount;
        const safeNeededCount = neededCount === Infinity || neededCount <= 0 || !isFinite(neededCount) 
            ? remainingCount 
            : Math.min(neededCount, remainingCount);
        
        // 남은 개수가 0 이하면 중단
        if (safeNeededCount <= 0) {
            console.log(`⏹️ 추가 검색 중단: 남은 개수 없음 (현재: ${currentVideoCount}개, 최대: ${MAX_RESULTS_LIMIT}개)`);
            debugLog(`⏹️ 추가 검색 중단: safeNeededCount = ${safeNeededCount}`);
            return;
        }
        
        console.log(`🔍 추가 비디오 검색 시도: 첫 페이지(50개) 먼저 수집 (현재: ${currentVideoCount}개, 최대: ${MAX_RESULTS_LIMIT}개)`);
        debugLog(`🔍 기존 ${excludeVideoIds.length}개 ID 제외하고 첫 페이지 추가 검색`);
        
        // 첫 페이지(50개)만 먼저 수집 (나머지는 백그라운드에서)
        const result = await Promise.race([
            searchYouTubeAPI(query, apiKeyValue, 50, excludeVideoIds, true), // firstPageOnly = true
            timeoutPromise
        ]).catch(error => {
            // API 할당량 초과 시 기존 캐시만 사용
            if (error.message === 'quotaExceeded' || error.message?.includes('quota')) {
                console.warn('⚠️ API 할당량 초과 → 기존 캐시만 사용');
                return null;
            }
            throw error;
        });
        
        if (!result) {
            // API 할당량 초과로 실패한 경우 Supabase에서 모든 데이터 가져오기
            debugLog(`⚠️ 추가 비디오 검색 실패 (할당량 초과) → Supabase에서 모든 데이터 가져오기`);
            isQuotaExceeded = true; // 할당량 초과 플래그 설정
            
            // Supabase에서 모든 데이터 가져오기 (만료 여부 무시)
            const cacheData = await loadFromSupabase(query, true); // ignoreExpiry = true
            if (cacheData && cacheData.videos && cacheData.videos.length > 0) {
                restoreFromCache(cacheData);
                
                // 할당량 초과 시에는 제한 없이 모든 데이터 사용
                renderPage();
                lastUIUpdateTime = Date.now();
                return;
            }
            
            // Supabase에도 없으면 기존 캐시만 사용
            debugLog(`⚠️ Supabase에도 데이터 없음, 기존 캐시만 사용`);
            return;
        }
        
        if (!result || result.videos.length === 0) {
            debugLog(`⚠️ 추가 비디오 없음, 기존 캐시만 사용`);
            
            // 추가 검색 결과가 0개이면 total_count를 실제 비디오 개수로 조정
            const currentVideoCount = allVideos.length;
            try {
                const supabaseData = await loadFromSupabase(query, true);
                if (supabaseData?.meta?.total && supabaseData.meta.total > currentVideoCount) {
                    console.warn(`⚠️ 추가 검색 결과 0개: total_count(${supabaseData.meta.total})를 실제 비디오 개수(${currentVideoCount})로 조정`);
                    
                    const { error: updateError } = await supabase
                        .from('search_cache')
                        .update({ total_count: currentVideoCount })
                        .eq('keyword', query.trim().toLowerCase());
                    
                    if (updateError) {
                        console.warn('⚠️ total_count 업데이트 실패:', updateError);
                    } else {
                        console.log(`✅ total_count 업데이트 완료: ${supabaseData.meta.total} → ${currentVideoCount}`);
                        currentTotalCount = currentVideoCount;
                    }
                } else if (supabaseData?.meta?.total) {
                    currentTotalCount = supabaseData.meta.total;
                }
            } catch (err) {
                console.warn('⚠️ total_count 업데이트 중 오류:', err);
            }
            
            // 기존 캐시 데이터로 UI 업데이트
            console.log(`🎬 렌더링 시작: 기존 캐시 데이터 ${allVideos.length}개 비디오`);
            renderPage();
            return;
        }
        
        debugLog(`✅ 추가 비디오 ${result.videos.length}개 가져옴`);
        console.log(`✅ 추가 비디오 ${result.videos.length}개 가져옴 (기존: ${allVideos.length}개)`);
        
        // 기존 비디오와 병합
        allVideos = [...allVideos, ...result.videos];
        Object.assign(allChannelMap, result.channels);
        console.log(`📊 병합 후 총 ${allVideos.length}개 비디오 (기존 ${allVideos.length - result.videos.length}개 + 추가 ${result.videos.length}개)`);
        
        // Enrich with velocity data
        const newItems = result.videos.map(video => {
            const channel = result.channels[video.snippet.channelId];
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
        
        allItems = [...allItems, ...newItems];
        console.log(`📊 병합 후 총 ${allItems.length}개 items (기존 ${allItems.length - newItems.length}개 + 추가 ${newItems.length}개)`);
        
        // 제한하기 전의 전체 개수 저장 (나중에 total_count 업데이트에 사용)
        const savedVideoCount = allVideos.length; // 제한 전 전체 개수
        
        // Save to Supabase (제한하기 전에 전체 데이터 저장)
        console.log(`💾 Supabase 저장 시작: ${savedVideoCount}개 비디오 (제한 전 전체 데이터)`);
        await saveToSupabase(query, allVideos, allChannelMap, allItems, 'google', result.nextPageToken)
            .catch(err => console.warn('⚠️ Supabase 저장 실패:', err));
        
        // total_count 업데이트: 저장된 전체 비디오 개수로 먼저 업데이트
        // (제한하기 전에 업데이트하여 제한 로직이 올바른 값을 사용하도록)
        if (savedVideoCount > 0) {
            // Supabase에서 최신 total_count 확인
            try {
                const supabaseData = await loadFromSupabase(query, true);
                if (supabaseData?.meta?.total) {
                    // 저장된 개수와 Supabase의 total_count 중 더 큰 값 사용
                    currentTotalCount = Math.max(savedVideoCount, supabaseData.meta.total);
                    console.log(`📊 total_count 업데이트: ${currentTotalCount}개 (저장된: ${savedVideoCount}개, Supabase: ${supabaseData.meta.total}개)`);
                } else {
                    currentTotalCount = savedVideoCount;
                    console.log(`📊 total_count 업데이트: ${currentTotalCount}개 (저장된 개수)`);
                }
                
                // 서버 데이터 저장 후 로컬 캐시 동기화 (서버 데이터로 업데이트)
                if (supabaseData) {
                    saveToLocalCache(query, supabaseData);
                    console.log(`💾 로컬 캐시 동기화 완료 (서버 데이터로 업데이트: ${supabaseData.videos?.length || 0}개)`);
                }
            } catch (_err) {
                currentTotalCount = savedVideoCount;
                console.log(`📊 total_count 업데이트: ${currentTotalCount}개 (에러 발생, 저장된 개수 사용)`);
            }
        }
        
        // 제한 로직: 
        // - currentTotalCount가 MAX_RESULTS_LIMIT 미만이면 실제 DB 값 사용
        // - MAX_RESULTS_LIMIT 이상이면 MAX_RESULTS_LIMIT으로 제한
        let effectiveLimit;
        if (currentTotalCount > 0) {
            if (currentTotalCount < MAX_RESULTS_LIMIT) {
                // DB에 저장된 실제 값이 MAX_RESULTS_LIMIT 미만이면 그 값을 사용
                effectiveLimit = currentTotalCount;
                console.log(`📊 제한 값: ${effectiveLimit}개 (DB 실제 값, MAX_RESULTS_LIMIT(${MAX_RESULTS_LIMIT}개) 미만)`);
            } else {
                // DB 값이 MAX_RESULTS_LIMIT 이상이면 MAX_RESULTS_LIMIT로 제한
                effectiveLimit = MAX_RESULTS_LIMIT;
                console.log(`📊 제한 값: ${effectiveLimit}개 (MAX_RESULTS_LIMIT, DB 값: ${currentTotalCount}개)`);
            }
        } else {
            // currentTotalCount가 없으면 MAX_RESULTS_LIMIT 사용
            effectiveLimit = MAX_RESULTS_LIMIT;
            console.log(`📊 제한 값: ${effectiveLimit}개 (MAX_RESULTS_LIMIT, currentTotalCount 없음)`);
        }
        
        if (allVideos.length > effectiveLimit) {
            const beforeCount = allVideos.length;
            debugLog(`✂️ 병합 후 ${allVideos.length}개 → ${effectiveLimit}개로 제한`);
            console.log(`✂️ ${beforeCount}개 → ${effectiveLimit}개로 제한`);
            allVideos = allVideos.slice(0, effectiveLimit);
            allItems = allItems.slice(0, effectiveLimit);
        } else {
            console.log(`✅ 제한 없음: ${allVideos.length}개 (effectiveLimit: ${effectiveLimit})`);
        }
        
        
        console.log(`🎬 렌더링 시작: 총 ${allVideos.length}개 비디오, ${allItems.length}개 items`);
        renderPage();
        
        // 백그라운드에서 나머지 페이지들을 점진적으로 수집 및 저장 (50개씩)
        if (result.nextPageToken && allVideos.length < MAX_RESULTS_LIMIT) {
            const keyword = query.trim().toLowerCase();
            // 중복 실행 방지: 이미 백그라운드 수집이 진행 중이면 스킵
            if (!backgroundCollectionStatus.get(keyword)?.isCollecting) {
                backgroundCollectionStatus.set(keyword, { isCollecting: true });
                console.log(`🔄 백그라운드에서 나머지 페이지 수집 시작 (현재: ${allVideos.length}개, 목표: ${MAX_RESULTS_LIMIT}개)`);
                collectRemainingPagesInBackground(query, apiKeyValue, result.nextPageToken, allVideos.length, MAX_RESULTS_LIMIT)
                    .finally(() => {
                        // 수집 완료 후 플래그 해제
                        backgroundCollectionStatus.set(keyword, { isCollecting: false });
                    })
                    .catch(err => console.warn('⚠️ 백그라운드 수집 실패:', err));
            } else {
                console.log(`⏸️ 백그라운드 수집이 이미 진행 중입니다. 중복 실행 방지.`);
            }
        }
    } catch (error) {
        console.error('❌ 추가 비디오 검색 오류:', error);
        // 에러 발생 시 기존 캐시만 사용
        renderPage();
    }
}

// Load More 버튼 클릭 시 추가 비디오 가져오기
async function loadMore() {
    const query = currentSearchQuery || document.getElementById('searchInput')?.value?.trim();
    if (!query) {
        console.warn('⚠️ 검색어가 없습니다');
        return;
    }
    
    const apiKeyValue = await getApiKeys();
    if (!apiKeyValue) {
        console.error('❌ API 키가 없습니다');
        return;
    }
    
    const keyword = query.trim().toLowerCase();
    
    // 하루 제한 확인
    const remainingDailyLimit = getRemainingDailyLoadMoreCount(keyword);
    if (remainingDailyLimit <= 0) {
        console.warn(`⚠️ 하루 추가 로드 제한 도달 (키워드당 ${DAILY_LOAD_MORE_LIMIT}개)`);
        alert(`Daily data limit reached. (Maximum ${DAILY_LOAD_MORE_LIMIT} per keyword per day)\n\nThis is the limit for new video data acquisition excluding other API usage.`);
        updateLoadMoreButton();
        return;
    }
    
    const currentCount = allVideos.length;
    
    // 최대 제한 확인 (키워드당 1000개)
    if (currentCount >= MAX_RESULTS_LIMIT) {
        updateLoadMoreButton();
        return;
    }
    
    // total_count 확인
    if (currentTotalCount > 0 && currentCount >= currentTotalCount) {
        updateLoadMoreButton();
        return;
    }
    
    // 남은 개수 계산: 하루 제한, 최대 제한, total_count, LOAD_MORE_INCREMENT 중 최소값
    const remainingMaxLimit = MAX_RESULTS_LIMIT - currentCount;
    let neededCount = Math.min(LOAD_MORE_INCREMENT, remainingDailyLimit, remainingMaxLimit);
    if (currentTotalCount > 0) {
        const remaining = currentTotalCount - currentCount;
        neededCount = Math.min(neededCount, remaining);
    }
    
    if (neededCount <= 0) {
        console.warn(`⚠️ 추가 로드할 데이터 없음`);
        updateLoadMoreButton();
        return;
    }
    
    const targetCount = currentCount + neededCount;
    
    // 기존 비디오 ID 추출
    const existingVideoIds = allVideos.map(v => v.id).filter(Boolean);
    
    
    // 추가 비디오 가져오기 (YouTube API 호출)
    await fetchAdditionalVideos(query, apiKeyValue, neededCount, existingVideoIds);
    
    // 하루 사용량 증가
    incrementDailyLoadMoreCount(keyword, neededCount);
    
    // total_count 업데이트 (Supabase에서 확인)
    try {
        const supabaseData = await loadFromSupabase(query, true);
        if (supabaseData) {
            const actualCount = supabaseData.videos?.length || 0;
            const metaTotal = supabaseData.meta?.total || 0;
            currentTotalCount = Math.max(actualCount, metaTotal);
        }
    } catch (err) {
        console.warn('⚠️ total_count 업데이트 실패:', err);
    }
    
    updateLoadMoreButton();
}

// Load More 버튼 상태 업데이트 (현재는 사용 안 함)
function updateLoadMoreButton() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) {
        // loadMoreBtn 요소가 없으면 조용히 반환 (경고 제거)
        return;
    }
    
    const currentCount = allVideos.length;
    const maxResults = getMaxResults();
    
    // 버튼 표시 조건: maxResults가 'max'일 때만 표시
    if (maxResults !== 'max') {
        // max 선택이 아니면 버튼 숨김
        loadMoreBtn.style.display = 'none';
        return;
    }
    
    // 버튼은 항상 표시 (max 선택 시)
    loadMoreBtn.style.display = 'inline-block';
    loadMoreBtn.style.visibility = 'visible';
    
    // 하루 제한 확인
    const keyword = currentSearchQuery.trim().toLowerCase();
    const remainingDailyLimit = getRemainingDailyLoadMoreCount(keyword);
    
    // 최대 제한 확인 (키워드당 1000개)
    const remainingMaxLimit = MAX_RESULTS_LIMIT - currentCount;
    const isMaxLimitReached = currentCount >= MAX_RESULTS_LIMIT;
    
    // 더 가져올 데이터가 있는지 확인
    let hasMoreData = false;
    if (isMaxLimitReached) {
        // 최대 제한 도달 (1000개)
        hasMoreData = false;
    } else if (currentTotalCount === 0) {
        // total_count를 알 수 없으면 활성화 (더 가져올 수 있을 수도 있음)
        // 단, 하루 제한과 최대 제한이 남아있어야 함
        hasMoreData = remainingDailyLimit > 0 && remainingMaxLimit > 0;
    } else if (currentTotalCount > 0) {
        // total_count가 있으면 현재 개수와 비교
        hasMoreData = currentCount < currentTotalCount && remainingDailyLimit > 0 && remainingMaxLimit > 0;
    }
    
    // 하루 제한 도달 시 비활성화
    if (remainingDailyLimit <= 0) {
        hasMoreData = false;
    }
    
    // 버튼 활성화/비활성화
    loadMoreBtn.disabled = !hasMoreData;
    
    // 버튼 텍스트 설정
    if (hasMoreData) {
        // 남은 개수 계산: 하루 제한, 최대 제한, total_count, LOAD_MORE_INCREMENT 중 최소값
        let remaining = Math.min(LOAD_MORE_INCREMENT, remainingDailyLimit, remainingMaxLimit);
        if (currentTotalCount > 0 && currentCount < currentTotalCount) {
            remaining = Math.min(remaining, currentTotalCount - currentCount);
        }
        const dailyLimitText = remainingDailyLimit < DAILY_LOAD_MORE_LIMIT ? ` (하루 남은: ${remainingDailyLimit}개)` : '';
        const maxLimitText = remainingMaxLimit < MAX_RESULTS_LIMIT ? ` (최대: ${MAX_RESULTS_LIMIT}개)` : '';
        loadMoreBtn.textContent = `데이터 더 확보 (+${remaining}개)${dailyLimitText}${maxLimitText}`;
    } else {
        // 더 이상 데이터가 없거나 하루 제한 도달 또는 최대 제한 도달
        if (isMaxLimitReached) {
            loadMoreBtn.textContent = `최대 제한 도달 (${MAX_RESULTS_LIMIT}개)`;
        } else if (remainingDailyLimit <= 0) {
            loadMoreBtn.textContent = `하루 제한 도달 (키워드당 ${DAILY_LOAD_MORE_LIMIT}개/일)`;
        } else if (currentTotalCount > 0 && currentCount >= currentTotalCount) {
            // 최종 결과 수 표시
            loadMoreBtn.textContent = `모두 표시됨 (${currentTotalCount}개)`;
        } else {
            loadMoreBtn.textContent = `데이터 더 확보 (+${LOAD_MORE_INCREMENT}개)`;
        }
    }
    
}

async function performFullGoogleSearch(query, apiKeyValue) {
    // 타임아웃 설정 (60초)
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('검색 타임아웃: 60초 내에 응답이 없습니다.')), 60000);
    });
    
    try {
        // 최대 200개로 제한
        const targetCount = MAX_RESULTS_LIMIT;
        console.log(`🔍 YouTube API 검색 시작: 첫 페이지(50개) 먼저 수집 후 저장`);
        debugLog(`🌐 Google API 전체 검색 (첫 페이지 우선)`);
        
        // 첫 페이지(50개)만 먼저 수집
        const firstPageResult = await Promise.race([
            searchYouTubeAPI(query, apiKeyValue, 50, [], true), // firstPageOnly = true
            timeoutPromise
        ]).catch(async error => {
            // API 할당량 초과 시 캐시에서 최대 데이터 가져오기
            if (error.message === 'quotaExceeded' || error.message?.includes('quota')) {
                console.warn('⚠️ YouTube API 할당량 초과 → 캐시에서 최대 데이터 가져오기');
                isQuotaExceeded = true; // 할당량 초과 플래그 설정
                
                // 캐시에서 최대 데이터 가져오기 시도 (만료 여부 무시)
                const cacheData = await loadFromSupabase(query, true); // ignoreExpiry = true
                if (cacheData && cacheData.videos && cacheData.videos.length > 0) {
                    console.log(`📦 캐시에서 복원: ${cacheData.videos.length}개 비디오 (API 할당량 초과로 캐시 사용)`);
                    restoreFromCache(cacheData);
                    console.log(`📊 최종 표시: ${allVideos.length}개 비디오`);
                    
                    // 할당량 초과 시에는 제한 없이 모든 데이터 사용
                    // targetCount 제한을 적용하지 않음
                    const resultsDiv = document.getElementById('results');
                    if (resultsDiv) {
                        resultsDiv.innerHTML = `<div class="info">⚠️ API 할당량 초과로 캐시 데이터를 사용합니다 (${allVideos.length}개)</div>`;
                    }
                    
                    renderPage();
                    lastUIUpdateTime = Date.now();
                    return; // 캐시 데이터 사용, 정상 종료
                }
                
                // 캐시도 없으면 에러 표시
                console.error('❌ YouTube API 할당량 초과: 캐시 데이터도 없습니다.');
                const resultsDiv = document.getElementById('results');
                if (resultsDiv) {
                    resultsDiv.innerHTML = `<div class="error">⚠️ YouTube API 할당량 초과<br>캐시 데이터도 없습니다.<br>내일 다시 시도해주세요.</div>`;
                }
                throw error;
            }
            throw error;
        });
        console.log(`📥 첫 페이지 API 호출 결과: ${firstPageResult.videos.length}개 비디오 가져옴`);
        allVideos = firstPageResult.videos;
        allChannelMap = firstPageResult.channels;
        
        // 최대 200개로 제한 (API가 더 많이 반환할 수 있으므로)
        if (allVideos.length > targetCount) {
            console.log(`✂️ 결과 ${allVideos.length}개 → ${targetCount}개로 제한`);
            allVideos = allVideos.slice(0, targetCount);
        }
        console.log(`📊 최종 저장/표시: ${allVideos.length}개 비디오`);
        
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

        // 검색 후 자동 정렬 (기본값: 높은 순)
        const sortSelect = document.getElementById('sortVpdSelect');
        const velocityMetricSelect = document.getElementById('velocityMetricSelect');
        let sortValue = sortSelect?.value || 'desc';
        if (sortValue === 'none') {
            sortValue = 'desc'; // 'none'이면 기본값인 'desc'로 설정
        }
        currentVelocityMetric = velocityMetricSelect?.value || 'day';
        
        // allItems 정렬 (일일 조회수 기준)
        if (sortValue === 'asc') {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valA - valB;
            });
        } else {
            // 'desc' 또는 기본값: 높은 순
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valB - valA; // 높은 순
            });
        }

        // 첫 페이지(50개) 즉시 저장
        console.log(`💾 첫 페이지(50개) 즉시 저장 시작`);
        await saveToSupabase(query, allVideos, allChannelMap, allItems, 'google', firstPageResult.nextPageToken)
            .catch(err => console.warn('⚠️ Supabase 저장 실패:', err));
        
        // 서버 데이터 저장 후 로컬 캐시 동기화 (서버 데이터로 업데이트)
        try {
            const updatedSupabaseData = await loadFromSupabase(query, true);
            if (updatedSupabaseData) {
                saveToLocalCache(query, updatedSupabaseData);
                console.log(`💾 로컬 캐시 동기화 완료 (서버 데이터로 업데이트: ${updatedSupabaseData.videos?.length || 0}개)`);
            }
        } catch (syncError) {
            console.warn('⚠️ 로컬 캐시 동기화 실패:', syncError);
        }
        
        // 이미 정렬했으므로 skipSort=true로 전달
        renderPage(true);
        lastUIUpdateTime = Date.now(); // UI 업데이트 시간 갱신
        
        // 백그라운드에서 나머지 페이지들을 점진적으로 수집 및 저장 (50개씩)
        if (firstPageResult.nextPageToken && allVideos.length < targetCount) {
            console.log(`🔄 백그라운드에서 나머지 페이지 수집 시작 (현재: ${allVideos.length}개, 목표: ${targetCount}개)`);
            collectRemainingPagesInBackground(query, apiKeyValue, firstPageResult.nextPageToken, allVideos.length, targetCount)
                .catch(err => console.warn('⚠️ 백그라운드 수집 실패:', err));
        }
        
        // 백그라운드에서 NULL 데이터 자동 업데이트 (검색 성능에 영향 없음, 현재 검색어 우선)
        updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
            console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
        });

    } catch (googleError) {
        console.error('❌ YouTube API 오류:', googleError);
        
        // 타임아웃 에러인지 확인
        if (googleError.message && googleError.message.includes('타임아웃')) {
            console.warn('⏰ 검색 타임아웃 발생');
        }
        
        // UI 상태 복구
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">${t('search.error') || '검색 중 오류가 발생했습니다.'}</div>`;
        }
        
        // 에러를 다시 throw하여 상위에서 처리
        throw googleError;
    }
}

// 백그라운드에서 나머지 페이지들을 점진적으로 수집 및 저장 (50개씩)
async function collectRemainingPagesInBackground(query, apiKeyValue, startPageToken, currentCount, targetCount) {
    try {
        // 기존 데이터에서 video ID 목록 가져오기
        const existingData = await loadFromSupabase(query, true);
        const excludeVideoIds = existingData?.videos?.map(v => v.id).filter(Boolean) || [];
        let nextPageToken = startPageToken;
        let totalCollected = currentCount;
        
        // 50개씩 추가 수집 (100, 150, 200까지)
        while (totalCollected < targetCount && nextPageToken) {
            // 다음 50개 수집
            const result = await searchYouTubeAPI(query, apiKeyValue, 50, excludeVideoIds, true);
            
            if (!result || !result.videos || result.videos.length === 0) {
                console.log(`⏹️ 백그라운드 수집 완료: 더 이상 새 비디오 없음 (현재: ${totalCollected}개)`);
                break;
            }
            
            // 기존 비디오와 병합
            const existingVideoIds = new Set(excludeVideoIds);
            const newVideos = result.videos.filter(v => !existingVideoIds.has(v.id));
            
            if (newVideos.length === 0) {
                console.log(`⏹️ 백그라운드 수집 중단: 중복만 발견 (현재: ${totalCollected}개)`);
                break;
            }
            
            // 기존 데이터 로드
            const existingData = await loadFromSupabase(query, true);
            const existingVideos = existingData?.videos || [];
            const existingChannels = existingData?.channels || {};
            const existingItems = existingData?.items || [];
            
            // 새 비디오 추가
            const mergedVideos = [...existingVideos, ...newVideos];
            const mergedChannels = { ...existingChannels, ...result.channels };
            
            // items 생성
            const newItems = newVideos.map(video => {
                const channel = result.channels[video.snippet.channelId];
                const vpd = viewVelocityPerDay(video);
                const vclass = classifyVelocity(vpd);
                const cband = channelSizeBand(channel);
                const subs = Number(channel?.statistics?.subscriberCount ?? 0);
                
                return {
                    id: video.id,
                    vpd: vpd,
                    vclass: vclass,
                    cband: cband,
                    subs: subs,
                    raw: video
                };
            });
            
            const mergedItems = [...existingItems, ...newItems];
            
            // 점진적 저장 (50개씩)
            totalCollected = mergedVideos.length;
            console.log(`💾 백그라운드 저장: ${totalCollected}개 비디오 (추가: ${newVideos.length}개)`);
            
            await saveToSupabase(query, mergedVideos, mergedChannels, mergedItems, 'google', result.nextPageToken)
                .catch(err => console.warn('⚠️ 백그라운드 저장 실패:', err));
            
            // excludeVideoIds 업데이트
            excludeVideoIds.push(...newVideos.map(v => v.id));
            nextPageToken = result.nextPageToken;
            
            // 목표 개수 도달 또는 더 이상 페이지 없음
            if (totalCollected >= targetCount || !nextPageToken) {
                console.log(`✅ 백그라운드 수집 완료: ${totalCollected}개 비디오 저장됨`);
                break;
            }
            
            // 다음 배치 전 딜레이 (API 호출 제한)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.error('❌ 백그라운드 수집 오류:', error);
    }
}

// 캐시가 30개 미만일 때 추가로 가져오기 (중복 제거)
async function performIncrementalFetch(query, apiKeyValue, firebaseData, neededCount) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('증분 검색 타임아웃: 60초 내에 응답이 없습니다.')), 60000);
    });
    
    try {
        const meta = firebaseData.meta || {};
        const existingVideoIds = new Set((firebaseData.items || []).map(item => item.id || item.raw?.id).filter(Boolean));
        
        debugLog(`📈 증분 검색: 기존 ${existingVideoIds.size}개, 추가 필요 ${neededCount}개`);
        
        let nextPageToken = meta.nextPageToken;
        let newVideos = [];
        let newChannelsMap = {};
        let attempts = 0;
        const MAX_ATTEMPTS = 5; // 최대 5번 시도
        
        // 필요한 개수만큼 가져올 때까지 반복 (중복 제거)
        while (newVideos.length < neededCount && nextPageToken && attempts < MAX_ATTEMPTS) {
            attempts++;
            
            // 다음 페이지 가져오기
            const more = await Promise.race([
                fetchNext50WithToken(query, apiKeyValue, nextPageToken),
                timeoutPromise
            ]);
            
            // 중복 제거: 기존에 없는 비디오만 필터링
            const uniqueItems = more.items.filter(item => {
                const videoId = item.id?.videoId;
                return videoId && !existingVideoIds.has(videoId);
            });
            
            if (uniqueItems.length === 0) {
                debugLog(`⚠️ 중복만 발견, 다음 페이지로...`);
                nextPageToken = more.nextPageToken;
                continue;
            }
            
            // 필요한 개수만큼만 가져오기
            const toFetch = uniqueItems.slice(0, neededCount - newVideos.length);
            
            // 비디오 상세 정보 가져오기
            const { videoDetails, channelsMap } = await hydrateDetailsOnlyForNew(
                { items: toFetch, nextPageToken: more.nextPageToken },
                apiKeyValue
            );
            
            // 중복 제거된 비디오만 추가
            const uniqueNewVideos = videoDetails.filter(v => !existingVideoIds.has(v.id));
            newVideos.push(...uniqueNewVideos);
            
            // 비디오 ID를 Set에 추가 (다음 반복에서 중복 방지)
            uniqueNewVideos.forEach(v => existingVideoIds.add(v.id));
            
            // 채널 정보 병합
            Object.assign(newChannelsMap, channelsMap);
            
            nextPageToken = more.nextPageToken;
            
            debugLog(`✅ ${uniqueNewVideos.length}개 추가 (총 ${newVideos.length}/${neededCount}개)`);
            
            if (newVideos.length >= neededCount) break;
        }
        
        if (newVideos.length === 0) {
            debugLog(`⚠️ 추가 비디오 없음, 기존 캐시 사용`);
            restoreFromCache(firebaseData);
            renderPage();
            return;
        }
        
        // 기존 캐시와 병합
        const merged = mergeCacheWithMore(firebaseData, newVideos, newChannelsMap);
        
        // 압축된 데이터 복원
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
        
        // items 재계산
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
        
        // Supabase 저장
        // DISABLED: Only cron updates videos to Supabase
        // await saveToSupabase(query, restoredVideos, allChannelMap, allItems, 'google', nextPageToken);
        renderPage();
        
        debugLog(`✅ 증분 검색 완료: 총 ${allVideos.length}개 (추가 ${newVideos.length}개)`);
        
    } catch (error) {
        console.error('❌ 증분 검색 오류:', error);
        
        // 에러 발생 시 기존 캐시 사용
        restoreFromCache(firebaseData);
        renderPage();
        
        if (error.message && error.message.includes('타임아웃')) {
            console.warn('⏰ 증분 검색 타임아웃 발생');
        }
    }
}

async function performTopUpUpdate(query, apiKeyValue, firebaseData) {
    // 타임아웃 설정 (60초)
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('토핑 업데이트 타임아웃: 60초 내에 응답이 없습니다.')), 60000);
    });
    
    try {
        const meta = firebaseData.meta || {};
        debugLog('🔝 토핑: search.list 1회 + 신규 50개 상세 정보');
        
        // 1) 다음 50개 검색 (타임아웃과 함께)
        const more = await Promise.race([
            fetchNext50WithToken(query, apiKeyValue, meta.nextPageToken),
            timeoutPromise
        ]);
        
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

        // 6) Supabase 저장 (meta 업데이트)
        await saveToSupabase(query, restoredVideos, allChannelMap, allItems, 'google', more.nextPageToken);
        renderPage();
        
    } catch (error) {
        console.error('❌ 토핑 업데이트 오류:', error);
        
        // 타임아웃 에러인지 확인
        if (error.message && error.message.includes('타임아웃')) {
            console.warn('⏰ 토핑 업데이트 타임아웃 발생');
        }
        
        // UI 상태 복구
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">${t('search.error') || '업데이트 중 오류가 발생했습니다.'}</div>`;
        }
        
        // 에러를 다시 throw하여 상위에서 처리
        throw error;
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

export function renderPage(skipSort = false) {
    
    // 할당량 초과 시에는 제한을 적용하지 않음
    if (!isQuotaExceeded) {
        let limit = MAX_RESULTS_LIMIT;
        if (currentTotalCount > 0) {
            limit = Math.min(limit, currentTotalCount);
        }
        if (allVideos.length > limit) {
            allVideos = allVideos.slice(0, limit);
            allItems = allItems.slice(0, limit);
        }
    }
    
    
    // 표시 단위와 정렬 옵션 가져오기
    const velocityMetricSelect = document.getElementById('velocityMetricSelect');
    currentVelocityMetric = velocityMetricSelect?.value || 'day';
    const sortSelect = document.getElementById('sortVpdSelect');
    // 기본값: 높은 순 (desc), 'none'이면 'desc'로 처리
    let sortValue = sortSelect?.value || 'desc';
    if (sortValue === 'none') {
        sortValue = 'desc'; // 'none'이면 기본값인 'desc'로 설정
    }
    
    // skipSort가 true이면 정렬 건너뛰기 (이미 정렬된 경우)
    if (!skipSort && allItems.length > 0) {
        // 전체 allItems를 먼저 정렬 (모든 페이지의 데이터가 올바르게 정렬되도록)
        if (sortValue === 'asc') {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valA - valB;
            });
        } else {
            // 'desc' 또는 기본값: 높은 순
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valB - valA; // 높은 순
            });
        }
    }
    
    // 정렬된 allItems를 필터링하고 중복 제거
    const dedupedItems = getFilteredDedupedItems();
    
    // skipSort가 false일 때만 필터/중복 제거 후 다시 한 번 정렬
    if (!skipSort) {
        // 안전망: 필터/중복 제거 후에도 다시 한 번 정렬하여 페이지마다 일관된 순서를 보장
        const comparator = sortValue === 'asc'
            ? (a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valA - valB;
            }
            : (a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valB - valA; // 높은 순
            };
        dedupedItems.sort(comparator);
    }
    
    const pageItems = dedupedItems;
    
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
    
    // 카드 렌더링 (forEach 대신 for 루프 사용 - 약간 더 빠름)
    let cardsCreated = 0;
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const video = item.raw;
        const card = createVideoCard(video, item, i + 1);
        if (card) {
            fragment.appendChild(card);
            cardsCreated++;
            
        }
    }
    
    gridContainer.appendChild(fragment);
    resultsDiv.appendChild(gridContainer);
    
    // Update result count
    updateResultCount(dedupedItems.length);
    
    
    // 마지막 UI 업데이트 시간 갱신
    lastUIUpdateTime = Date.now();
    resetAutoRefreshTimer();
}

function createVideoCard(video, item, rank = null) {
    // Safety check: If video is undefined, return null
    if (!video || !video.snippet) {
        console.error('⚠️ Invalid video data:', video);
        return null;
    }
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
    
    // Thumbnail priority: maxres -> high -> default
    const videoIdForThumbnail = video.id || video?.raw?.id || item?.raw?.id;
    const thumbnail = video.snippet.thumbnails?.maxres?.url || 
                     video.snippet.thumbnails?.high?.url || 
                     video.snippet.thumbnails?.default?.url;
    
    // Fallback thumbnail URLs (sequential fallback on load failure)
    // If maxresdefault.jpg fails, try: sddefault.jpg -> hqdefault.jpg -> mqdefault.jpg
    // Final fallback: getBestThumbnail() will test all sizes automatically
    const fallbackThumbnails = [
        thumbnail, // First: original thumbnail
        video.snippet.thumbnails?.high?.url,
        video.snippet.thumbnails?.default?.url,
        `https://i.ytimg.com/vi/${videoIdForThumbnail}/sddefault.jpg`, // Standard definition fallback
        `https://i.ytimg.com/vi/${videoIdForThumbnail}/hqdefault.jpg`, // High quality fallback
        `https://i.ytimg.com/vi/${videoIdForThumbnail}/mqdefault.jpg`, // Medium quality fallback
        `https://img.youtube.com/vi/${videoIdForThumbnail}/hqdefault.jpg`, // Alternative domain
        `https://img.youtube.com/vi/${videoIdForThumbnail}/mqdefault.jpg`,
        `https://img.youtube.com/vi/${videoIdForThumbnail}/default.jpg`
    ].filter((url, index, self) => url && self.indexOf(url) === index); // Remove null/undefined and duplicates
    
    // 업로드 경과일수 계산
    const uploadedDays = ageDays(video.snippet.publishedAt);
    const daysText = uploadedDays < 1 ? '< 1d' : `${Math.floor(uploadedDays)}d`;
    
    const computedVpd = viewVelocityPerDay(video);
    item.vpd = computedVpd;
    const velocityValue = getVelocityValue(item);
    const videoId = video.id || video?.raw?.id || item?.raw?.id;
    
    // 구독자 수: item.subs > 채널 정보 순으로 확인
    const channelId = video.snippet?.channelId;
    const channel = allChannelMap?.[channelId];
    let subscriberCount = item.subs;
    
    // item.subs가 없거나 0이면 채널 정보에서 확인
    if (!subscriberCount || subscriberCount === 0) {
        subscriberCount = channel?.statistics?.subscriberCount 
            ? Number(channel.statistics.subscriberCount) 
            : (item.subs || 0);
    }
    
    const rankBadge = rank && rank <= 10
        ? `<div class="rank-badge rank-${rank <= 3 ? rank : 'default'}">TOP ${rank}</div>`
        : '';

    // 조회수와 좋아요 수를 숫자로 변환 (문자열일 수 있음)
    const viewCount = Number(video.statistics?.viewCount || video.raw?.statistics?.viewCount || 0);
    const likeCount = Number(video.statistics?.likeCount || video.raw?.statistics?.likeCount || 0);

    card.innerHTML = `
        <div class="thumbnail-container">
            ${rankBadge}
            <img src="${thumbnail}" alt="${video.snippet.title}" loading="lazy" data-fallback-index="0" data-fallbacks="${JSON.stringify(fallbackThumbnails)}">
            ${video.contentDetails?.duration ? `<div class="duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
            <div class="vpd-badge">${formatVelocityBadge(velocityValue)}</div>
        </div>
        <div class="video-info">
            <h3 class="video-title">${video.snippet.title}</h3>
            <div class="channel-info">
                <span class="channel-name">${video.snippet.channelTitle}</span>
            </div>
            <div class="stats">
                <span class="stat-item">👁 ${formatNumber(viewCount)}</span>
                <span class="stat-item">👍 ${formatNumber(likeCount)}</span>
                <span class="stat-item">👥 ${formatNumber(subscriberCount || 0)}</span>
                <span class="stat-item">📅 ${daysText}</span>
            </div>
        </div>
    `;

    
    // Image load failure fallback handling with auto-check
    const imgEl = card.querySelector('img');
    if (imgEl && fallbackThumbnails.length > 1) {
        imgEl.addEventListener('error', async function() {
            const currentIndex = parseInt(this.dataset.fallbackIndex || '0');
            const fallbacks = JSON.parse(this.dataset.fallbacks || '[]');
            
            if (currentIndex < fallbacks.length - 1) {
                // Try next fallback URL
                const nextIndex = currentIndex + 1;
                this.dataset.fallbackIndex = nextIndex.toString();
                this.src = fallbacks[nextIndex];
            } else {
                // All fallback URLs failed, try auto-check getBestThumbnail
                const videoId = video.id || video?.raw?.id || item?.raw?.id;
                if (videoId) {
                    const workingThumbnail = await getBestThumbnail(videoId);
                    if (workingThumbnail) {
                        this.src = workingThumbnail;
                        return; // Success, exit handler
                    }
                }
                
                // All attempts failed, hide image
                this.style.display = 'none';
            }
        }, { once: false }); // Allow multiple attempts
    }
    
    return card;
}


// 자동 새로고침 함수
function resetAutoRefreshTimer() {
    // 기존 타이머 정리
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    if (window.appTimers?.autoRefresh) {
        clearInterval(window.appTimers.autoRefresh);
        window.appTimers.autoRefresh = null;
    }
    
    // 새 타이머 시작
    autoRefreshTimer = setInterval(() => {
        const inactiveTime = Date.now() - lastUIUpdateTime;
        
        if (inactiveTime >= AUTO_REFRESH_INACTIVE_MS) {
            // 자동 새로고침은 중요한 로그이므로 유지
            // 마지막 검색어로 자동 재검색
            const lastQuery = currentSearchQuery || document.getElementById('searchInput')?.value?.trim();
            if (lastQuery) {
                // LocalStorage에 마지막 검색어 저장
                try {
                    localStorage.setItem('autoRefreshLastQuery', lastQuery);
                } catch (e) {
                    // LocalStorage 오류 무시
                }
            }
            location.reload();
        }
    }, 30 * 1000); // 30초마다 체크
    
    // 전역 타이머에도 저장 (중복 방지)
    window.appTimers.autoRefresh = autoRefreshTimer;
}

// 사용자 활동 감지 (타이머 리셋)
function detectUserActivity() {
    lastUIUpdateTime = Date.now();
}

function setCustomRangeVisibility(rangeId, shouldShow) {
    const element = document.getElementById(rangeId);
    if (element) {
        element.classList.toggle('custom-range--active', shouldShow);
    }
}

function refreshFilterChips(filterName) {
    document.querySelectorAll(`input[name="${filterName}"]`).forEach((radio) => {
        const label = radio.closest('label');
        if (label) {
            label.classList.toggle('chip-active', radio.checked);
        }
    });
}

// 페이지 로드 시 마지막 검색어 복원 및 자동 검색
function restoreLastSearchOnRefresh() {
    try {
        const autoSearch = localStorage.getItem('autoSearchOnLoad');
        const lastQuery = localStorage.getItem('autoRefreshLastQuery');
        
        if (lastQuery && document.getElementById('searchInput')) {
            document.getElementById('searchInput').value = lastQuery;
            
            // 자동 검색 플래그가 있으면 검색 실행
            if (autoSearch === 'true') {
                localStorage.removeItem('autoSearchOnLoad'); // 플래그 제거 (한 번만 실행)
                // 약간의 지연 후 검색 실행 (DOM이 완전히 준비된 후)
                setTimeout(() => {
                    search(true); // shouldReload = true로 자동 검색 실행
                }, 100);
            }
        }
    } catch (e) {
        // LocalStorage 오류 무시
        console.warn('⚠️ 검색어 복원 실패:', e);
    }
}


// ============================================
// NULL 데이터 자동 업데이트 (백그라운드)
// ============================================

// 백그라운드에서 NULL 데이터 업데이트 (검색 성능에 영향 없음)
// keyword가 있으면 해당 검색어의 비디오만 우선 업데이트
async function updateMissingDataInBackground(apiKeyValue, limit = 50, keyword = null) {
    // 이미 업데이트 중이면 중복 실행 방지
    if (isUpdatingMissingData) {
        return;
    }
    
    try {
        // 짧은 지연 후 실행 (검색 완료 후)
        setTimeout(async () => {
            if (isUpdatingMissingData) {
                return;
            }
            
            isUpdatingMissingData = true;
            try {
                const keywordFilter = keyword ? ` (검색어: "${keyword}")` : '';
                const result = await updateMissingData(apiKeyValue, limit, 2, keyword);
                if (result.updated > 0 || result.deleted > 0 || result.skipped > 0) {
                    // 업데이트된 경우 페이지 새로고침 없이 데이터만 갱신 (선택사항)
                }
            } catch (error) {
                // 백그라운드 작업이므로 에러는 조용히 처리
                console.warn('⚠️ 백그라운드 NULL 데이터 업데이트 실패:', error);
            } finally {
                isUpdatingMissingData = false;
            }
        }, 2000); // 2초 후 실행 (검색 완료 후)
    } catch (error) {
        // 에러 무시 (백그라운드 작업)
        isUpdatingMissingData = false;
    }
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
            if (!video.snippet.publishedAt) {
                return false; // Skip items without published date when date filter is active
            }
            const publishedDate = new Date(video.snippet.publishedAt);
            
            // Handle custom date range filter
            if (dateFilter === 'custom') {
                const minDateStr = document.getElementById('uploadDateMin')?.value;
                const maxDateStr = document.getElementById('uploadDateMax')?.value;
                
                if (minDateStr) {
                    const minDate = new Date(minDateStr);
                    minDate.setHours(0, 0, 0, 0);
                    if (publishedDate < minDate) return false;
                }
                
                if (maxDateStr) {
                    const maxDate = new Date(maxDateStr);
                    maxDate.setHours(23, 59, 59, 999);
                    if (publishedDate > maxDate) return false;
                }
            } else {
                // Handle preset day filters
                const days = parseInt(dateFilter);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                if (publishedDate < cutoffDate) return false;
            }
        }
        
        // Duration filter
        if (durationFilter !== 'all') {
            const seconds = parseDurationToSeconds(video.contentDetails?.duration);
            
            // Handle exclude-shorts filter (3 minutes or longer)
            if (durationFilter === 'exclude-shorts') {
                if (seconds < 180) return false; // 3 minutes = 180 seconds
            }
            // Handle custom range filter (in minutes)
            else if (durationFilter === 'custom') {
                const minMinutes = parseInt(document.getElementById('durationMin')?.value || 0);
                const maxMinutes = parseInt(document.getElementById('durationMax')?.value || Infinity);
                const minSeconds = minMinutes * 60;
                const maxSeconds = maxMinutes === Infinity ? Infinity : maxMinutes * 60;
                
                if (seconds < minSeconds || seconds > maxSeconds) return false;
            } else {
                // Handle preset range filters
                const [min, max] = durationFilter.split('-').map(Number);
                if (max) {
                    // Range filter (e.g., "60-600" for 1-10min, "0-180" for shorts)
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

export function updateResultCount(totalItems) {
    const totalCount = document.getElementById('totalCount');
    if (totalCount) totalCount.textContent = totalItems;
}

// ============================================
// 검색 모드 표시기
// ============================================

// ============================================
// 로컬 캐시 (localStorage)
// ============================================

const LOCAL_CACHE_PREFIX = 'youtube_searcher_cache_';
const LOCAL_CACHE_VERSION = '1.32';

// 로컬 캐시에서 데이터 로드
function loadFromLocalCache(query) {
    try {
        const keyword = query.trim().toLowerCase();
        const cacheKey = `${LOCAL_CACHE_PREFIX}${keyword}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (!cachedData) {
            return null;
        }
        
        const parsed = JSON.parse(cachedData);
        
        // 캐시 버전 확인
        if (parsed.cacheVersion !== LOCAL_CACHE_VERSION) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        // 만료 시간 확인
        // TTL 체크 제거: 로컬 캐시도 만료되지 않고 계속 유지됨
        // const age = Date.now() - parsed.timestamp;
        // if (age >= CACHE_TTL_MS) {
        //     localStorage.removeItem(cacheKey);
        //     return null;
        // }
        
        return parsed;
    } catch (error) {
        console.warn('⚠️ 로컬 캐시 로드 실패:', error);
        return null;
    }
}

// 캐시 데이터 정규화 (Supabase / 로컬 포맷 차이 해결)
function normalizeCacheData(cacheData) {
    if (!cacheData) return null;

    const normalizeVideo = (v = {}) => {
        const raw = v.raw || v;
        const snippet = raw.snippet || {};
        const stats = raw.statistics || {};
        const details = raw.contentDetails || {};

        return {
            id: v.id || raw.id || raw.video_id,
            title: v.title || raw.title || snippet.title || '',
            channelId: v.channelId || raw.channelId || raw.channel_id || snippet.channelId || '',
            channelTitle: v.channelTitle || raw.channelTitle || raw.channel_title || snippet.channelTitle || '',
            publishedAt: v.publishedAt || raw.publishedAt || raw.published_at || snippet.publishedAt || null,
            viewCount: v.viewCount ?? raw.viewCount ?? raw.view_count ?? stats.viewCount ?? 0,
            likeCount: v.likeCount ?? raw.likeCount ?? raw.like_count ?? stats.likeCount ?? 0,
            duration: v.duration || raw.duration || details.duration || 'PT0S'
        };
    };

    const normalizeItem = (item = {}) => {
        const raw = item.raw || {};
        return {
            id: item.id || raw.id || raw.video_id,
            vpd: item.vpd ?? raw.vpd ?? 0,
            vclass: item.vclass ?? raw.vclass ?? 'unknown',
            cband: item.cband ?? raw.cband ?? 'unknown',
            subs: item.subs ?? raw.subs ?? 0
        };
    };

    return {
        videos: (cacheData.videos || []).map(normalizeVideo),
        channels: cacheData.channels || {},
        items: (cacheData.items || []).map(normalizeItem),
        dataSource: cacheData.dataSource || cacheData.meta?.source || 'google',
        meta: {
            total: cacheData.meta?.total ?? (cacheData.videos?.length || 0),
            nextPageToken: cacheData.meta?.nextPageToken,
            source: cacheData.meta?.source || cacheData.dataSource || 'google'
        },
        cacheVersion: cacheData.cacheVersion || LOCAL_CACHE_VERSION,
        timestamp: cacheData.timestamp || Date.now()
    };
}

// 로컬 캐시에 데이터 저장
function saveToLocalCache(query, cacheData) {
    try {
        const normalized = normalizeCacheData(cacheData);
        if (!normalized || !normalized.videos?.length) {
            console.warn('⚠️ 로컬 캐시 저장 생략: 데이터 없음');
            return;
        }
        const keyword = query.trim().toLowerCase();
        const cacheKey = `${LOCAL_CACHE_PREFIX}${keyword}`;
        
        // localStorage 크기 제한 고려 (약 5-10MB)
        const dataString = JSON.stringify(normalized);
        if (dataString.length > 5 * 1024 * 1024) { // 5MB 초과 시 저장 안 함
            console.warn('⚠️ 로컬 캐시 크기 초과, 저장 생략');
            return;
        }
        
        localStorage.setItem(cacheKey, dataString);
    } catch (error) {
        // localStorage 용량 초과 등 에러 처리
        if (error.name === 'QuotaExceededError') {
            console.warn('⚠️ 로컬 캐시 용량 초과, 오래된 캐시 삭제 시도');
            // 오래된 캐시 삭제
            clearOldLocalCache();
            try {
                saveToLocalCache(query, cacheData);
            } catch (retryError) {
                console.warn('⚠️ 로컬 캐시 저장 재시도 실패');
            }
        } else {
            console.warn('⚠️ 로컬 캐시 저장 실패:', error);
        }
    }
}

// 오래된 로컬 캐시 정리
function clearOldLocalCache() {
    try {
        // TTL 체크 제거: 캐시는 만료되지 않고 계속 유지됨
        // 만료된 캐시 삭제 로직 제거됨
        // 캐시는 수동으로 삭제하거나 localStorage 용량 초과 시에만 정리됨
        
        // 여전히 용량 초과면 가장 오래된 것부터 삭제
        if (cacheKeys.length > 10) {
            const cacheWithTime = cacheKeys.map(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: data.timestamp };
                } catch {
                    return { key, timestamp: 0 };
                }
            }).sort((a, b) => a.timestamp - b.timestamp);
            
            // 가장 오래된 5개 삭제
            cacheWithTime.slice(0, 5).forEach(({ key }) => {
                localStorage.removeItem(key);
            });
        }
    } catch (error) {
        console.warn('⚠️ 로컬 캐시 정리 실패:', error);
    }
}

// ============================================
// 캐시 복원
// ============================================

function restoreFromCache(firebaseData) {
    // loadFromSupabase가 반환하는 items 구조를 직접 사용 (raw와 subs 포함)
    if (firebaseData.items && firebaseData.items.length > 0 && firebaseData.items[0].raw) {
        // Supabase에서 로드한 데이터 (items에 raw 필드 포함)
        const cacheVideoCount = firebaseData.items.length;
        console.log(`📦 캐시 복원: ${cacheVideoCount}개 비디오 (Supabase에서 로드)`);
        allVideos = firebaseData.items.map(item => item.raw).filter(Boolean);
        allChannelMap = firebaseData.channels || {};
        allItems = firebaseData.items.map(item => {
            const video = item.raw;
            if (!video) return null;
            const channel = allChannelMap[video.snippet?.channelId];
            const computedVpd = viewVelocityPerDay(video);
            
            // 구독자 수: item.subs가 있으면 우선 사용 (Supabase에서 로드한 값)
            const subs = item.subs !== undefined && item.subs !== null ? Number(item.subs) : Number(channel?.statistics?.subscriberCount ?? 0);
            
            return {
                raw: video,
                vpd: item.vpd ?? computedVpd,
                vclass: item.vclass || classifyVelocity(computedVpd),
                cband: item.cband || channelSizeBand(channel),
                subs: subs // 구독자 수는 items에서 가져옴
            };
        }).filter(Boolean);
        
        // 캐시 복원 후 정렬 적용 (기본값: 높은 순)
        const sortSelect = document.getElementById('sortVpdSelect');
        const velocityMetricSelect = document.getElementById('velocityMetricSelect');
        let sortValue = sortSelect?.value || 'desc';
        if (sortValue === 'none') {
            sortValue = 'desc';
        }
        currentVelocityMetric = velocityMetricSelect?.value || 'day';
        
        if (sortValue === 'asc') {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valA - valB;
            });
        } else {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valB - valA; // 높은 순
            });
        }
    } else {
        // 기존 로컬 캐시 형식 (videos 배열 사용)
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
        const restoredItems = (firebaseData.items || []).map(item => {
            const video = videoById.get(item.id);
            if (!video) return null;
            const channel = allChannelMap[video.snippet.channelId];
            const computedVpd = viewVelocityPerDay(video);
            return {
                raw: video,
                vpd: item.vpd ?? computedVpd,
                vclass: item.vclass || classifyVelocity(computedVpd),
                cband: item.cband || channelSizeBand(channel),
                subs: item.subs ?? Number(channel?.statistics?.subscriberCount ?? 0)
            };
        }).filter(Boolean);

        if (restoredItems.length > 0) {
            allItems = restoredItems;
        } else {
            allItems = restoredVideos.map(video => {
                const channel = allChannelMap[video.snippet.channelId];
                const vpd = viewVelocityPerDay(video);
                return {
                    raw: video,
                    vpd,
                    vclass: classifyVelocity(vpd),
                    cband: channelSizeBand(channel),
                    subs: Number(channel?.statistics?.subscriberCount ?? 0)
                };
            });
        }
        console.log(`📦 로컬 캐시 복원: ${allVideos.length}개 비디오, ${allItems.length}개 items`);
        
        // 캐시 복원 후 정렬 적용 (기본값: 높은 순)
        const sortSelect = document.getElementById('sortVpdSelect');
        const velocityMetricSelect = document.getElementById('velocityMetricSelect');
        let sortValue = sortSelect?.value || 'desc';
        if (sortValue === 'none') {
            sortValue = 'desc';
        }
        currentVelocityMetric = velocityMetricSelect?.value || 'day';
        
        if (sortValue === 'asc') {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valA - valB;
            });
        } else {
            allItems.sort((a, b) => {
                const valA = getVelocityValue(a, currentVelocityMetric);
                const valB = getVelocityValue(b, currentVelocityMetric);
                return valB - valA; // 높은 순
            });
        }
    }
    
}

// ============================================
// 이벤트 리스너 설정
// ============================================

// 이벤트 리스너 중복 등록 방지
let eventListenersSetup = false;

export function setupEventListeners() {
    // 이미 설정되었으면 중복 방지
    if (eventListenersSetup) {
        return;
    }
    
    // 사용자 활동 감지 (클릭, 키보드 입력, 스크롤)
    document.addEventListener('click', detectUserActivity);
    document.addEventListener('keydown', detectUserActivity);
    document.addEventListener('scroll', detectUserActivity, { passive: true });
    document.addEventListener('mousemove', detectUserActivity, { passive: true });
    
    // Search button
    document.getElementById('searchBtn')?.addEventListener('click', search);
    
    // Enter key
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search();
    });
    
    // Keyword tag clicks
    document.querySelectorAll('.keyword-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const keyword = tag.getAttribute('data-keyword');
            if (keyword) {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = keyword;
                    search();
                }
            }
        });
    });
    
    // Mobile filter toggle
    const mobileFilterToggle = document.getElementById('mobileFilterToggle');
    const filterSection = document.getElementById('filterSection');
    if (mobileFilterToggle && filterSection) {
        mobileFilterToggle.addEventListener('click', () => {
            filterSection.classList.toggle('mobile-filter-open');
            const isOpen = filterSection.classList.contains('mobile-filter-open');
            const filterText = mobileFilterToggle.querySelector('.filter-text');
            if (filterText) {
                filterText.textContent = isOpen ? '필터 닫기' : '필터';
            }
        });
    }
    
    // Filter changes (radio and checkbox)
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            if (input.type === 'radio') {
                refreshFilterChips(input.name);
            }

            if (input.name === 'viewCountFilter') {
                setCustomRangeVisibility('viewCountCustom', input.value === 'custom');
            }

            if (input.name === 'subCountFilter') {
                setCustomRangeVisibility('subCountCustom', input.value === 'custom');
            }

            if (input.name === 'durationFilter') {
                setCustomRangeVisibility('durationCustom', input.value === 'custom');
            }

            if (input.name === 'uploadDateFilter') {
                setCustomRangeVisibility('uploadDateCustom', input.value === 'custom');
            }

            renderPage();
        });
    });

    ['viewCountFilter', 'subCountFilter', 'durationFilter'].forEach(name => {
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        if (selected) {
            refreshFilterChips(name);
            if (name === 'viewCountFilter') {
                setCustomRangeVisibility('viewCountCustom', selected.value === 'custom');
            }
            if (name === 'subCountFilter') {
                setCustomRangeVisibility('subCountCustom', selected.value === 'custom');
            }
            if (name === 'durationFilter') {
                setCustomRangeVisibility('durationCustom', selected.value === 'custom');
            }
        }
    });
    
    // Initialize upload date filter custom range visibility
    const uploadDateFilterSelected = document.querySelector('input[name="uploadDateFilter"]:checked');
    if (uploadDateFilterSelected) {
        setCustomRangeVisibility('uploadDateCustom', uploadDateFilterSelected.value === 'custom');
    }
    
    // Custom view count range input changes
    ['viewCountMin', 'viewCountMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                const viewFilter = document.querySelector('input[name="viewCountFilter"]:checked')?.value;
                if (viewFilter === 'custom') {
                    renderPage();
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
                    renderPage();
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
                    renderPage();
                }
            });
        }
    });
    
    // Sort controls
    document.getElementById('sortVpdSelect')?.addEventListener('change', () => {
        renderPage();
    });
    document.getElementById('velocityMetricSelect')?.addEventListener('change', () => {
        renderPage();
    });
    
    // 최대 결과 수 선택 드롭다운 이벤트 리스너
    const maxResultsSelect = document.getElementById('maxResultsSelect');
    if (maxResultsSelect) {
        // 저장된 값이 없으면 기본값 max 사용 (localStorage 초기화)
        const stored = localStorage.getItem(MAX_RESULTS_STORAGE_KEY);
        if (!stored) {
            setMaxResults('max'); // 기본값 max 저장
        }
        const savedMaxResults = getMaxResults();
        maxResultsSelect.value = savedMaxResults === 'max' ? 'max' : savedMaxResults.toString();
        
        maxResultsSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'max') {
                setMaxResults('max');
            } else {
                const newMaxResults = parseInt(value, 10);
                setMaxResults(newMaxResults);
            }
            // 변경 시 현재 검색어로 다시 검색
            const currentQuery = document.getElementById('searchInput')?.value?.trim();
            if (currentQuery) {
                search(true); // 강제 재검색
            }
        });
    }
    
    eventListenersSetup = true;
    
    // 마지막 검색어 복원
    restoreLastSearchOnRefresh();
    
    // 자동 새로고침 타이머 시작
    resetAutoRefreshTimer();
}

// ============================================
// 초기화
// ============================================

export function initializeUI() {
    setupEventListeners();
}
