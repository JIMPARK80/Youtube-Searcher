// ============================================
// UI.JS - UI 관련 함수 모음
// 검색, 필터링, 페이지네이션, 렌더링
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
    getRecentVelocityForVideo,
    trackVideoIdsForViewHistory,
    updateMissingData,
    CACHE_TTL_MS
} from './supabase-api.js';
import { t } from './i18n.js';

// Global variables for pagination
export let allVideos = [];
export let allItems = [];
export const pageSize = 8;
export let currentPage = 1;
export let allChannelMap = {};
export let currentSearchQuery = '';

// 백그라운드 업데이트 중복 실행 방지
let isUpdatingMissingData = false;
let currentVelocityMetric = 'recent-vph'; // 기본값: 최근 VPH

// 자동 새로고침 관리
let lastUIUpdateTime = Date.now();
let autoRefreshTimer = null;
const AUTO_REFRESH_INACTIVE_MS = 5 * 60 * 1000; // 5분 동안 UI 업데이트 없으면 새로고침

// 디버그 모드 (개발 시에만 로그 출력)
const DEBUG_MODE = false; // 프로덕션에서는 false로 설정
const debugLog = (...args) => {
    if (DEBUG_MODE) {
        console.log(...args);
    }
};

// 콘솔 로그 정리 (선택적: 30초마다 또는 비활성 시)
let consoleClearTimer = null;
const CONSOLE_CLEAR_INTERVAL_MS = 30 * 1000; // 30초
const ENABLE_CONSOLE_CLEANUP = false; // true로 설정하면 30초마다 콘솔 정리

function initConsoleCleanup() {
    if (!ENABLE_CONSOLE_CLEANUP) {
        return; // 비활성화된 경우 아무것도 하지 않음
    }
    
    if (consoleClearTimer) {
        clearInterval(consoleClearTimer);
    }
    
    consoleClearTimer = setInterval(() => {
        // 개발 모드가 아니고, 사용자가 비활성 상태일 때만 콘솔 정리
        if (!DEBUG_MODE) {
            const inactiveTime = Date.now() - lastUIUpdateTime;
            // 30초 이상 비활성 상태일 때만 정리 (사용자가 작업 중이 아닐 때)
            if (inactiveTime > 30 * 1000) {
                console.clear();
                console.log('🧹 콘솔 로그 정리 완료 (30초 비활성 후)');
            }
        }
    }, CONSOLE_CLEAR_INTERVAL_MS);
}
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
    // 최근 VPH: 서버에서 가져온 실제 VPH 데이터 사용
    if (metric === 'recent-vph') {
        // item.vph가 명시적으로 설정되어 있으면 (null/undefined가 아니면) 그 값을 사용
        // 0도 유효한 값이므로 0을 반환해야 함
        if (item?.vph !== null && item?.vph !== undefined) {
            return Number(item.vph);
        }
        // VPH 데이터가 없으면 (null/undefined) 일간 속도를 시간당으로 변환하여 폴백
        if (item?.vpd) {
            return Number(item.vpd) / 24;
        }
        return 0;
    }
    
    const base = Number(item?.vpd || 0);
    if (metric === 'hour') {
        return base / 24;
    }
    return base;
}

function formatVelocityBadge(value, metric = currentVelocityMetric) {
    let unit = '/day';
    if (metric === 'hour' || metric === 'recent-vph') {
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
// 검색 함수
// ============================================

// 검색 중 상태 추적 (중복 검색 방지)
let isSearching = false;
let searchTimeoutTimer = null; // 프리징 방지용 타이머

export async function search(shouldReload = false) {
    // 중복 검색 방지 (자동 검색 제외)
    if (isSearching && !shouldReload) {
        debugLog('ℹ️ 검색이 이미 진행 중입니다. 대기 중...');
        return;
    }
    
    // 새로운 검색 시작 시 VPH 계산 추적 초기화
    vphCalculatedVideos.clear();
    
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    try {
        isSearching = true;
        
        // 검색 버튼 비활성화
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.textContent = t('search.searching') || '검색 중...';
        }
        if (searchInput) {
            searchInput.disabled = true;
        }
        
        const query = document.getElementById('searchInput')?.value?.trim();
        
        // 프리징 방지: 3초 후 자동 새로고침 및 자동 검색
        if (searchTimeoutTimer) {
            clearTimeout(searchTimeoutTimer);
        }
        searchTimeoutTimer = setTimeout(() => {
            // 3초 후에도 검색이 완료되지 않았으면 자동 새로고침
            if (isSearching && query) {
                console.log('🔄 검색 타임아웃 (3초) → 자동 새로고침 및 재검색');
                // 검색어 저장
                localStorage.setItem('autoRefreshLastQuery', query);
                localStorage.setItem('autoSearchOnLoad', 'true');
                // 새로고침
                location.reload();
            }
        }, 3000); // 3초
        
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
    
    // Reset pagination
    currentPage = 1;
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    // ============================================
    // 캐시 로직: 스마트 캐시 전략 (API 요청 최소화)
    // 1순위: 로컬 캐시 (localStorage)
    // 2순위: Supabase 캐시
    // ============================================
    
    // 1️⃣ 로컬 캐시 먼저 확인 (브라우저 localStorage)
    debugLog(`💾 로컬 캐시 확인 중: "${query}"`);
    let cacheData = loadFromLocalCache(query);
    
    if (cacheData) {
        const localCount = cacheData.videos?.length || 0;
        const localAge = Date.now() - (cacheData.timestamp || 0);
        if (localCount > 0 && localAge < CACHE_TTL_MS) {
        debugLog(`✅ 로컬 캐시 사용 (${localCount}개, ${(localAge / (1000 * 60 * 60)).toFixed(1)}시간 전)`);
            // 타이머 클리어 (검색 완료)
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            
            restoreFromCache(cacheData);
            
            // 로컬 캐시 사용 시에도 Supabase에서 구독자 수만 가져와서 병합
            try {
                const supabaseData = await loadFromSupabase(query);
                if (supabaseData && supabaseData.items) {
                    // Supabase의 구독자 수로 업데이트
                    const subscriberMap = new Map();
                    supabaseData.items.forEach(item => {
                        if (item.subs !== undefined && item.subs !== null && item.subs > 0) {
                            subscriberMap.set(item.id, item.subs);
                        }
                    });
                    
                    // allItems의 구독자 수 업데이트
                    allItems = allItems.map(item => {
                        const videoId = item.raw?.id || item.id;
                        if (subscriberMap.has(videoId)) {
                            return {
                                ...item,
                                subs: subscriberMap.get(videoId)
                            };
                        }
                        return item;
                    });
                    
                    console.log(`✅ Supabase 구독자 수 병합 완료: ${subscriberMap.size}개 업데이트`);
                }
            } catch (err) {
                console.warn('⚠️ Supabase 구독자 수 병합 실패:', err);
            }
            
            renderPage(1);
            lastUIUpdateTime = Date.now(); // UI 업데이트 시간 갱신
        const nextToken = cacheData.meta?.nextPageToken || null;
        saveToSupabase(query, allVideos, allChannelMap, allItems, cacheData.dataSource || 'local-cache', nextToken)
            .catch(err => console.warn('⚠️ 로컬 캐시 기반 Supabase 저장 실패:', err));
        
        // 로컬 캐시 timestamp 업데이트 (Supabase 저장 후)
        const updatedCacheData = {
            ...cacheData,
            timestamp: Date.now() // timestamp 갱신
        };
        saveToLocalCache(query, updatedCacheData);
        debugLog(`💾 로컬 캐시 timestamp 업데이트 완료`);
        
        // 백그라운드에서 NULL 데이터 자동 업데이트 (로컬 캐시 사용 시에도, 현재 검색어 우선)
        if (apiKeyValue) {
            updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
                console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
            });
        }
        
            return; // 로컬 캐시 사용, 즉시 반환
        }
        debugLog('⚠️ 로컬 캐시가 비어있거나 만료됨 → Supabase 확인');
    }
    
    // 2️⃣ 로컬 캐시 없음 → Supabase 캐시 확인
    debugLog(`🔍 Supabase 캐시 확인 중: "${query}"`);
    cacheData = await loadFromSupabase(query);
    
    if (cacheData) {
        debugLog(`✅ Supabase 캐시 발견! API 호출 생략`);
        
        // Supabase 캐시를 로컬 캐시에도 저장 (다음번 빠른 접근)
        saveToLocalCache(query, cacheData);
        const age = Date.now() - cacheData.timestamp;
        const isExpired = age >= CACHE_TTL_MS;
        const count = cacheData.videos?.length || 0;
        const meta = cacheData.meta || {};
        const cacheSource = cacheData.dataSource || meta.source || 'unknown';
        const savedAt = new Date(cacheData.timestamp);
        const savedAtLabel = savedAt.toLocaleString();
        
        debugLog(`📂 로컬 검색어 캐시 확인: "${query}" (총 ${count}개, 소스=${cacheSource})`);
        debugLog(`⏳ 72시간 경과 여부: ${isExpired ? '만료' : '유효'} (저장 시각: ${savedAtLabel})`);
        
        // Google 데이터가 아닌 캐시는 최신 Google 데이터로 갱신
        if (cacheSource !== 'google') {
            debugLog('🔄 Google 외 캐시 감지 → 전체 갱신');
            await performFullGoogleSearch(query, apiKeyValue);
            return;
        }
        
        // 신선한 Google 캐시 사용 (데이터가 있을 때만)
        if (!isExpired && count > 0) {
            debugLog(`✅ 로컬 캐시 사용 (기준 시각: ${savedAtLabel}) - ${count}개 항목`);
            // 타이머 클리어 (검색 완료)
            if (searchTimeoutTimer) {
                clearTimeout(searchTimeoutTimer);
                searchTimeoutTimer = null;
            }
            
            restoreFromCache(cacheData);
            renderPage(1);
            lastUIUpdateTime = Date.now(); // UI 업데이트 시간 갱신
            const nextToken = meta.nextPageToken || null;
            saveToSupabase(query, allVideos, allChannelMap, allItems, cacheData.dataSource || 'supa-cache', nextToken)
                .catch(err => console.warn('⚠️ Supabase 캐시 기반 저장 실패:', err));
            
            // 백그라운드에서 NULL 데이터 자동 업데이트 (캐시 사용 시에도, 현재 검색어 우선)
            updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
                console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
            });
            
            return;
        }
        
        if (count === 0) {
            debugLog('⚠️ Supabase 캐시에 데이터가 0개 → API 재호출');
        }
        
        // 72시간 경과 + pagination 토큰 존재 → 토핑
        if (count === 50 && meta.nextPageToken) {
            debugLog('🔝 토핑 모드: 추가 50개만 fetch');
            await performTopUpUpdate(query, apiKeyValue, cacheData);
            return;
        }
        
        debugLog('⏰ 로컬 캐시 만료 → Supabase 서버 재호출');
        await performFullGoogleSearch(query, apiKeyValue);
        return;
    }

    // 캐시 없음 → 전체 검색 (API 호출 필요)
    debugLog(`❌ Supabase 캐시 없음 → YouTube API 호출 필요`);
    await performFullGoogleSearch(query, apiKeyValue);
    } catch (error) {
        console.error('❌ 검색 중 오류 발생:', error);
        
        // UI 상태 복구
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">${t('search.error') || '검색 중 오류가 발생했습니다.'}</div>`;
        }
        
        // 사용자에게 알림 (에러 메시지가 너무 길면 간단하게)
        const errorMessage = error.message || '알 수 없는 오류';
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

async function performFullGoogleSearch(query, apiKeyValue) {
    // 타임아웃 설정 (60초)
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('검색 타임아웃: 60초 내에 응답이 없습니다.')), 60000);
    });
    
    try {
        debugLog('🌐 Google API 전체 검색 (최대 300개)');
        
        // 타임아웃과 함께 실행
        const result = await Promise.race([
            searchYouTubeAPI(query, apiKeyValue),
            timeoutPromise
        ]);
        debugLog(`🎯 fetch 완료: ${result.videos.length}개`);
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

        // Save to Supabase with nextPageToken
        await saveToSupabase(query, allVideos, allChannelMap, allItems, 'google', result.nextPageToken);
        
        // Track video IDs for view history (VPH 추적 시작)
        trackVideoIdsForViewHistory(allVideos)
            .catch(err => console.warn('⚠️ Video ID 추적 실패:', err));
        
        // 백그라운드에서 NULL 데이터 자동 업데이트 (검색 성능에 영향 없음, 현재 검색어 우선)
        updateMissingDataInBackground(apiKeyValue, 50, query).catch(err => {
            console.warn('⚠️ NULL 데이터 자동 업데이트 실패:', err);
        });
        
        // 로컬 캐시에도 저장
        const cacheData = {
            videos: allVideos.map(v => ({
                id: v.id,
                title: v.snippet?.title,
                channelId: v.snippet?.channelId,
                channelTitle: v.snippet?.channelTitle,
                publishedAt: v.snippet?.publishedAt,
                viewCount: v.statistics?.viewCount || '0',
                likeCount: v.statistics?.likeCount || '0',
                duration: v.contentDetails?.duration || 'PT0S'
            })),
            channels: allChannelMap,
            items: allItems.map(item => ({
                id: item.raw?.id || item.id,
                vpd: item.vpd,
                vclass: item.vclass,
                cband: item.cband,
                subs: item.subs
            })),
            dataSource: 'google',
            meta: {
                total: allVideos.length,
                nextPageToken: result.nextPageToken,
                source: 'google'
            }
        };
        saveToLocalCache(query, cacheData);
        
        renderPage(1);
        lastUIUpdateTime = Date.now(); // UI 업데이트 시간 갱신

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
        renderPage(1);
        
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

export function renderPage(page) {
    currentPage = page;
    
    // VPH 계산 큐 초기화 (이전 페이지의 큐 정리)
    // 주의: 계산된 비디오 추적은 유지 (같은 검색 결과에서 페이지 이동 시 재계산 방지)
    // 새로운 검색 시에는 search 함수에서 초기화됨
    vphCalculationQueue = [];
    vphCalculationRunning = 0;
    
    // Apply filters and dedupe results
    const dedupedItems = getFilteredDedupedItems();
    const velocityMetricSelect = document.getElementById('velocityMetricSelect');
    currentVelocityMetric = velocityMetricSelect?.value || 'recent-vph';
    
    // Sort by views per day if requested
    const sortSelect = document.getElementById('sortVpdSelect');
    const sortValue = sortSelect?.value || 'desc'; // 기본값: 높은 순
    if (sortValue === 'asc') {
        dedupedItems.sort((a, b) => {
            const valA = getVelocityValue(a);
            const valB = getVelocityValue(b);
            return valA - valB;
        });
    } else if (sortValue === 'desc') {
        dedupedItems.sort((a, b) => {
            const valA = getVelocityValue(a);
            const valB = getVelocityValue(b);
            return valB - valA; // 높은 순
        });
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
    
    // 카드 렌더링 (forEach 대신 for 루프 사용 - 약간 더 빠름)
    for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const video = item.raw;
        const card = createVideoCard(video, item);
        if (card) {
            fragment.appendChild(card);
            
            // 표시 단위가 "최근 VPH"이고 VPH 데이터가 이미 있는 경우 배지 업데이트
            if (currentVelocityMetric === 'recent-vph' && item.vph) {
                const badgeEl = card.querySelector('.vpd-badge');
                if (badgeEl) {
                    const velocityValue = getVelocityValue(item);
                    badgeEl.textContent = formatVelocityBadge(velocityValue);
                }
            }
        }
    }
    
    gridContainer.appendChild(fragment);
    resultsDiv.appendChild(gridContainer);
    
    // Update pagination
    updatePaginationControls(dedupedItems.length);
    
    // 마지막 UI 업데이트 시간 갱신
    lastUIUpdateTime = Date.now();
    resetAutoRefreshTimer();
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
    
    const computedVpd = viewVelocityPerDay(video);
    item.vpd = computedVpd;
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
                <div class="velocity-row recent">
                    <span class="label" data-i18n="velocity.recent">${t('velocity.recent')}</span>
                    <span class="value recent-vph">${t('velocity.loading')}</span>
                </div>
                <div class="velocity-row">
                    <span class="label" data-i18n="velocity.daily">${t('velocity.daily')}</span>
                    <span class="value daily-vpd">${formatNumber(computedVpd || 0)}/day</span>
                </div>
            </div>
        </div>
    `;

    hydrateVelocityPanel(
        videoId,
        card.querySelector('.velocity-panel'),
        computedVpd,
        video.snippet.title,
        item
    );
    
    return card;
}

// VPH 계산 큐 관리 (동시 실행 제한)
let vphCalculationQueue = [];
let vphCalculationRunning = 0;
const MAX_CONCURRENT_VPH_CALCULATIONS = 3; // 동시 최대 3개만 실행
const vphCalculatedVideos = new Set(); // 이미 계산된 비디오 ID 추적

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
            console.log(`🔄 ${Math.floor(inactiveTime / 1000 / 60)}분 동안 UI 업데이트 없음 → 자동 새로고침`);
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

function processVphQueue() {
    if (vphCalculationRunning >= MAX_CONCURRENT_VPH_CALCULATIONS || vphCalculationQueue.length === 0) {
        return;
    }
    
    const { videoId, panelEl, baseVpd, label, item } = vphCalculationQueue.shift();
    vphCalculationRunning++;
    
    executeVphCalculation(videoId, panelEl, baseVpd, label, item)
        .finally(() => {
            vphCalculationRunning--;
            // 다음 항목 처리
            setTimeout(() => processVphQueue(), 100); // 100ms 딜레이
        });
}

async function executeVphCalculation(videoId, panelEl, baseVpd = 0, label = '', item = null) {
    if (!panelEl) {
        console.warn(`⚠️ executeVphCalculation: panelEl이 없습니다 (videoId="${videoId}")`);
        return;
    }
    const recentEl = panelEl.querySelector('.recent-vph');
    const dailyEl = panelEl.querySelector('.daily-vpd');
    const badgeEl = panelEl.closest('.video-card')?.querySelector('.vpd-badge');
    
    if (!recentEl) {
        console.warn(`⚠️ executeVphCalculation: .recent-vph 요소를 찾을 수 없습니다 (videoId="${videoId}")`);
    }
    
    if (dailyEl) {
        dailyEl.textContent = `${formatNumber(baseVpd || 0)}/day`;
    }
    if (!videoId) {
        if (recentEl) recentEl.textContent = t('velocity.unavailable');
        console.warn('⚠️ VPH 계산: videoId가 없습니다', { label });
        return;
    }
    
    // 타임아웃 설정 (5초로 단축)
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('VPH 계산 타임아웃')), 5000);
    });
    
    try {
        const stats = await Promise.race([
            getRecentVelocityForVideo(videoId),
            timeoutPromise
        ]);
        
        if (!stats) {
            if (recentEl) recentEl.textContent = t('velocity.unavailable');
            return;
        }
        
        // 스냅샷이 부족한 경우 (2개 미만)
        if (stats.insufficient) {
            if (recentEl) {
                recentEl.textContent = stats.message || t('velocity.unavailable');
                recentEl.style.opacity = '0.6'; // 반투명으로 표시
            }
            return;
        }
        
        if (recentEl) {
            // stats.vph가 명시적으로 설정되어 있으면 그 값을 사용 (0도 유효한 값)
            const vphValue = (stats.vph !== null && stats.vph !== undefined) ? stats.vph : 0;
            recentEl.textContent = `${formatNumber(vphValue)}/hr`;
            
            // item 객체에 VPH 데이터 저장 (표시 단위 "최근 VPH" 사용 시)
            // 0도 유효한 값이므로 명시적으로 저장 (null/undefined와 구분)
            if (item) {
                item.vph = vphValue;
                
                // 배지 업데이트 (표시 단위가 "최근 VPH"인 경우)
                if (badgeEl && currentVelocityMetric === 'recent-vph') {
                    const velocityValue = getVelocityValue(item);
                    badgeEl.textContent = formatVelocityBadge(velocityValue);
                }
            }
            
            // 계산 완료 표시 (재계산 방지)
            vphCalculatedVideos.add(videoId);
            
            // VPH 계산 완료 후 항상 재정렬 (표시 단위와 정렬 옵션에 따라)
            // 재정렬 디바운싱: 마지막 재정렬 요청 후 1초 후에 실행
            if (window.vphResortTimer) {
                clearTimeout(window.vphResortTimer);
            }
            
            window.vphResortTimer = setTimeout(() => {
                // 충분한 항목이 계산되었으면 재정렬 (최소 8개 이상 또는 전체의 50% 이상)
                const minCalculated = Math.min(8, Math.ceil(allItems.length * 0.5));
                if (vphCalculatedVideos.size >= minCalculated) {
                    // 현재 정렬 옵션과 표시 단위 가져오기
                    const sortSelect = document.getElementById('sortVpdSelect');
                    const sortValue = sortSelect?.value || 'desc';
                    const velocityMetricSelect = document.getElementById('velocityMetricSelect');
                    const currentMetric = velocityMetricSelect?.value || 'recent-vph';
                    
                    // allItems를 직접 정렬 (현재 표시 단위와 정렬 옵션에 따라)
                    allItems.sort((a, b) => {
                        const valA = getVelocityValue(a, currentMetric);
                        const valB = getVelocityValue(b, currentMetric);
                        if (sortValue === 'asc') {
                            return valA - valB; // 낮은 순
                        } else {
                            return valB - valA; // 높은 순
                        }
                    });
                    
                    // 첫 페이지로 이동하여 재렌더링
                    currentPage = 1;
                    renderPage(1);
                }
            }, 1000); // 1초 딜레이로 여러 계산 완료를 기다림
        }
        
    } catch (error) {
        // 타임아웃 또는 기타 에러 처리
        if (error.message === 'VPH 계산 타임아웃') {
            console.warn(`⚠️ VPH 계산 타임아웃 (${videoId}): 5초 초과`);
        } else {
            console.warn('⚠️ 최근 VPH 로드 실패:', error);
        }
        if (recentEl) recentEl.textContent = t('velocity.unavailable');
        // 앱이 멈추지 않도록 에러를 무시
    }
}

function hydrateVelocityPanel(videoId, panelEl, baseVpd = 0, label = '', item = null) {
    // 표시 단위와 관계없이 항상 VPH 데이터를 계산하고 표시
    // 이미 계산된 비디오는 재계산하지 않음
    if (!videoId || vphCalculatedVideos.has(videoId)) {
        // 이미 계산된 경우 저장된 값 사용
        if (item && item.vph !== undefined && item.vph !== null) {
            const recentEl = panelEl?.querySelector('.recent-vph');
            if (recentEl) {
                recentEl.textContent = `${formatNumber(item.vph)}/hr`;
            }
        } else {
            // 계산된 값이 없으면 "데이터 없음" 표시하지 않고 계산 시작
            // (아래에서 큐에 추가됨)
        }
        return;
    }
    
    // 큐에 추가 (동시 실행 제한)
    vphCalculationQueue.push({ videoId, panelEl, baseVpd, label, item });
    
    // 큐 처리 시작
    processVphQueue();
}

// ============================================
// NULL 데이터 자동 업데이트 (백그라운드)
// ============================================

// 백그라운드에서 NULL 데이터 업데이트 (검색 성능에 영향 없음)
// keyword가 있으면 해당 검색어의 비디오만 우선 업데이트
async function updateMissingDataInBackground(apiKeyValue, limit = 50, keyword = null) {
    // 이미 업데이트 중이면 중복 실행 방지
    if (isUpdatingMissingData) {
        console.log('⏸️ 백그라운드 업데이트가 이미 실행 중입니다. 중복 실행 방지.');
        return;
    }
    
    try {
        // 짧은 지연 후 실행 (검색 완료 후)
        setTimeout(async () => {
            if (isUpdatingMissingData) {
                console.log('⏸️ 백그라운드 업데이트가 이미 실행 중입니다. 중복 실행 방지.');
                return;
            }
            
            isUpdatingMissingData = true;
            try {
                const keywordFilter = keyword ? ` (검색어: "${keyword}")` : '';
                console.log(`🔄 백그라운드: NULL 데이터 자동 업데이트 시작${keywordFilter}...`);
                const result = await updateMissingData(apiKeyValue, limit, 2, keyword);
                if (result.updated > 0 || result.deleted > 0 || result.skipped > 0) {
                    console.log(`✅ 백그라운드 업데이트 완료: 업데이트 ${result.updated}개, 삭제 ${result.deleted || 0}개`);
                    // 업데이트된 경우 페이지 새로고침 없이 데이터만 갱신 (선택사항)
                    // renderPage(currentPage); // 필요시 주석 해제
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
            console.log(`💾 로컬 캐시 없음: "${keyword}"`);
            return null;
        }
        
        const parsed = JSON.parse(cachedData);
        
        // 캐시 버전 확인
        if (parsed.cacheVersion !== LOCAL_CACHE_VERSION) {
            console.log(`🔄 로컬 캐시 버전 불일치 (${parsed.cacheVersion} → ${LOCAL_CACHE_VERSION})`);
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        // 만료 시간 확인
        const age = Date.now() - parsed.timestamp;
        if (age >= CACHE_TTL_MS) {
            console.log(`⏰ 로컬 캐시 만료 (${(age / (1000 * 60 * 60)).toFixed(1)}시간 경과)`);
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        console.log(`✅ 로컬 캐시 발견: ${parsed.videos?.length || 0}개 항목, ${(age / (1000 * 60 * 60)).toFixed(1)}시간 전`);
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
        console.log(`💾 로컬 캐시 저장 완료: "${keyword}"`);
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
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith(LOCAL_CACHE_PREFIX));
        const now = Date.now();
        
        // 만료된 캐시 삭제
        cacheKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (now - data.timestamp >= CACHE_TTL_MS) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                // 파싱 실패 시 삭제
                localStorage.removeItem(key);
            }
        });
        
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
        allVideos = firebaseData.items.map(item => item.raw).filter(Boolean);
        allChannelMap = firebaseData.channels || {};
        allItems = firebaseData.items.map(item => {
            const video = item.raw;
            if (!video) return null;
            const channel = allChannelMap[video.snippet?.channelId];
            const computedVpd = viewVelocityPerDay(video);
            
            // 구독자 수: item.subs가 있으면 우선 사용 (Supabase에서 로드한 값)
            const subs = item.subs !== undefined && item.subs !== null ? Number(item.subs) : Number(channel?.statistics?.subscriberCount ?? 0);
            
            // 디버그: 첫 번째 항목만 로그
            if (item.id === firebaseData.items[0]?.id) {
                console.log(`🔍 캐시 복원: video_id=${item.id}, item.subs=${item.subs}, channel.subs=${channel?.statistics?.subscriberCount}, 최종값=${subs}`);
            }
            
            return {
                raw: video,
                vpd: item.vpd ?? computedVpd,
                vclass: item.vclass || classifyVelocity(computedVpd),
                cband: item.cband || channelSizeBand(channel),
                subs: subs // 구독자 수는 items에서 가져옴
            };
        }).filter(Boolean);
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
    }
    
    console.log(`✅ 캐시 복원 완료: ${allItems.length}개 항목`);
    trackVideoIdsForViewHistory(allVideos);
}

// ============================================
// 이벤트 리스너 설정
// ============================================

// 이벤트 리스너 중복 등록 방지
let eventListenersSetup = false;

export function setupEventListeners() {
    // 이미 설정되었으면 중복 방지
    if (eventListenersSetup) {
        console.log('ℹ️ 이벤트 리스너가 이미 설정되어 있습니다.');
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
    
    eventListenersSetup = true;
    console.log('✅ 이벤트 리스너 설정 완료');
    
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
    console.log('✅ UI 초기화 완료');
    
    // 콘솔 로그 정리 초기화
    initConsoleCleanup();
}
