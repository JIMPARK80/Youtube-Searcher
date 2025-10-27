// config.js - 전역 설정 및 상수

// Firebase 설정
export const firebaseConfig = {
    apiKey: "AIzaSyBa0Uc_eeqJuqADWUgCz-fLlNNBZcgMoP4",
    authDomain: "youtube-searcher-3bd73.firebaseapp.com",
    projectId: "youtube-searcher-3bd73",
    storageBucket: "youtube-searcher-3bd73.firebasestorage.app",
    messagingSenderId: "889896857994",
    appId: "1:889896857994:web:ea6e5c3effd7d87a7ae5b5"
};

// API 엔드포인트 설정
export const API_ENDPOINTS = {
    getKeys: 'https://youtube-searcher-gray.vercel.app/api/get-keys',
    saveAuth: 'https://youtube-searcher-gray.vercel.app/api/save-auth',
    getUsers: 'https://youtube-searcher-gray.vercel.app/api/get-users',
    updateUserProfile: 'https://youtube-searcher-gray.vercel.app/api/update-user-profile'
};

// 페이지네이션 설정
export const PAGINATION_CONFIG = {
    itemsPerPage: 50
};

// 캐시 설정 (24시간)
export const CACHE_DURATION = 24 * 60 * 60 * 1000;

// 정렬 옵션
export const SORT_OPTIONS = {
    VPD_DESC: 'vpd_desc',
    VPD_ASC: 'vpd_asc',
    VIEW_DESC: 'view_desc',
    VIEW_ASC: 'view_asc',
    DATE_DESC: 'date_desc',
    DATE_ASC: 'date_asc'
};

// 데이터 소스
export const DATA_SOURCES = {
    GOOGLE: 'google',
    SERPAPI: 'serpapi'
};

// 조회수 필터 옵션
export const VIEW_COUNT_FILTERS = {
    ALL: 'all',
    K1: '1000',
    K10: '10000',
    K100: '100000',
    M1: '1000000',
    M10: '10000000'
};

// 구독자 필터 범위
export const SUB_COUNT_RANGES = {
    ALL: 'all',
    MICRO: '0-1000',
    SMALL: '1000-10000',
    MEDIUM: '10000-100000',
    LARGE: '100000-1000000',
    MEGA: '1000000-999999999'
};
