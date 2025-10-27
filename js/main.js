// main.js - 메인 로직 및 초기화

import { initializeFirebase, saveToFirebase, loadFromFirebase, setupNewsDataListener } from './firebase.js';
import { restoreUser, logout } from './auth.js';
import { setupAllModals } from './modal.js';
import { searchYouTube } from './youtube-api.js';
import { renderVideoCards, renderPagination, updateDataSourceIndicator, showLoadingSpinner, showErrorMessage, scrollToTop } from './ui-renderer.js';
import { getFilterState, applyAllFilters, setupFilterListeners, resetFilters } from './filter.js';
import { PAGINATION_CONFIG } from './config.js';

// 전역 상태 관리
let allVideos = [];
let allChannelMap = {};
let allItems = [];
let currentPage = 1;
let currentDataSource = 'google';
let isSearching = false;

/**
 * 애플리케이션 초기화
 */
async function initializeApp() {
    console.log('🚀 애플리케이션 초기화 시작');

    // Firebase 초기화
    initializeFirebase();

    // 사용자 정보 복원
    restoreUser();

    // 모달 설정
    setupAllModals();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 필터 리스너 설정
    setupFilterListeners(handleFilterChange);

    // 기본 검색 수행 (news)
    await performDefaultSearch();

    console.log('✅ 애플리케이션 초기화 완료');
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 검색 버튼
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }

    // 검색 입력 (Enter 키)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }

    // 로그아웃 버튼
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    console.log('✅ 이벤트 리스너 설정 완료');
}

/**
 * 검색 처리
 */
async function handleSearch() {
    if (isSearching) {
        console.log('⏸️ 검색 진행 중...');
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const query = searchInput?.value.trim() || 'news';

    if (!query) {
        alert('검색어를 입력해주세요.');
        return;
    }

    isSearching = true;
    const resultsDiv = document.getElementById('results');
    showLoadingSpinner(resultsDiv);

    // 상태 초기화
    currentPage = 1;
    allVideos = [];
    allItems = [];
    allChannelMap = {};

    try {
        console.log(`🔍 검색 시작: ${query}`);

        // 1. Firebase 캐시 확인
        const cachedData = await loadFromFirebase(query);
        
        if (cachedData && cachedData.videos && cachedData.videos.length > 0) {
            console.log('✅ Firebase 캐시에서 데이터 로드');
            allVideos = cachedData.videos;
            allItems = cachedData.items || [];
            allChannelMap = cachedData.channels || {};
            currentDataSource = cachedData.dataSource || 'google';
            
            updateDataSourceIndicator(currentDataSource);
            renderPage(1);
        } else {
            // 2. API 검색
            console.log('🌐 API 검색 수행');
            const result = await searchYouTube(query);
            
            allVideos = result.videos;
            allChannelMap = result.channels;
            allItems = result.items;
            currentDataSource = result.dataSource;

            // Firebase에 저장
            await saveToFirebase(query, allVideos, allChannelMap, allItems, currentDataSource);
            
            updateDataSourceIndicator(currentDataSource);
            renderPage(1);
        }
    } catch (error) {
        console.error('❌ 검색 오류:', error);
        
        // 에러 타입별 처리
        let errorType = 'general';
        let errorMessage = '검색 중 오류가 발생했습니다.';
        
        if (error.message.includes('API') || error.message.includes('키')) {
            errorType = 'api';
            errorMessage = 'YouTube API 키를 확인할 수 없습니다.';
        } else if (error.message.includes('네트워크') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorType = 'network';
            errorMessage = '인터넷 연결을 확인할 수 없습니다.';
        } else if (error.message.includes('Firebase') || error.message.includes('firestore')) {
            errorType = 'firebase';
            errorMessage = '데이터베이스 연결에 실패했습니다.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showErrorMessage(resultsDiv, errorMessage, errorType);
    } finally {
        isSearching = false;
    }
}

/**
 * 기본 검색 수행 (news)
 */
async function performDefaultSearch() {
    console.log('📰 기본 검색 수행: news');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = 'news';
    }

    // 실시간 리스너 설정
    try {
        setupNewsDataListener();
    } catch (error) {
        console.warn('⚠️ 실시간 리스너 설정 실패:', error);
    }

    // 검색 수행
    try {
        await handleSearch();
    } catch (error) {
        console.error('❌ 기본 검색 실패:', error);
        const resultsDiv = document.getElementById('results');
        
        // 에러 타입별 처리
        if (error.message.includes('API') || error.message.includes('키')) {
            showErrorMessage(resultsDiv, error.message, 'api');
        } else if (error.message.includes('네트워크') || error.message.includes('fetch')) {
            showErrorMessage(resultsDiv, error.message, 'network');
        } else if (error.message.includes('Firebase') || error.message.includes('firestore')) {
            showErrorMessage(resultsDiv, error.message, 'firebase');
        } else {
            showErrorMessage(resultsDiv, error.message, 'general');
        }
    }
}

/**
 * 페이지 렌더링
 * @param {number} page - 페이지 번호
 */
function renderPage(page) {
    currentPage = page;

    // 필터 적용
    const filters = getFilterState();
    const filtered = applyAllFilters(allVideos, allChannelMap, allItems, filters);

    const resultsDiv = document.getElementById('results');
    
    if (filtered.videos.length === 0) {
        resultsDiv.innerHTML = '<div class="empty-result">필터 조건에 맞는 결과가 없습니다.</div>';
        return;
    }

    // 비디오 카드 렌더링
    const cardsHtml = renderVideoCards(filtered.videos, allChannelMap, filtered.items, page);
    
    // 페이지네이션 렌더링
    const paginationHtml = renderPagination(page, filtered.videos.length, renderPage);

    // 통계 정보
    const statsHtml = `
        <div class="search-stats">
            <span>전체 결과: ${allVideos.length}개</span>
            ${filtered.videos.length < allVideos.length ? `<span>필터링됨: ${filtered.videos.length}개</span>` : ''}
        </div>
    `;

    resultsDiv.innerHTML = statsHtml + cardsHtml + paginationHtml;

    // 스크롤 최상단 이동
    scrollToTop();
}

/**
 * 필터 변경 처리
 */
function handleFilterChange() {
    console.log('🔄 필터 변경됨');
    renderPage(1);
}

/**
 * 페이지 로드 시 초기화
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 전역 함수 export (HTML에서 직접 호출 가능하도록)
window.renderPage = renderPage;
window.handleSearch = handleSearch;
window.resetFilters = resetFilters;
