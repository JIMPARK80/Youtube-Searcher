// utils.js - 유틸리티 함수들

/**
 * ISO 8601 duration을 사람이 읽기 쉬운 형식으로 변환
 * @param {string} duration - ISO 8601 형식의 duration (예: PT1H2M30S)
 * @returns {string} 변환된 duration (예: 1:02:30)
 */
export function parseDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 날짜를 "X일 전" 형식으로 변환
 * @param {string} publishedAt - ISO 날짜 문자열
 * @returns {string} 상대적 시간 (예: 3일 전)
 */
export function formatRelativeTime(publishedAt) {
    const now = new Date();
    const published = new Date(publishedAt);
    const diffMs = now - published;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
}

/**
 * 숫자를 K, M 단위로 포맷팅
 * @param {number} num - 변환할 숫자
 * @returns {string} 포맷팅된 문자열 (예: 1.2K, 3.4M)
 */
export function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * VPD(Views Per Day) 계산
 * @param {number} viewCount - 조회수
 * @param {string} publishedAt - 게시 날짜
 * @returns {number} 일일 평균 조회수
 */
export function calculateVPD(viewCount, publishedAt) {
    const ageDays = Math.max(1, Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)));
    return Math.floor(viewCount / ageDays);
}

/**
 * VPD 등급 분류
 * @param {number} vpd - Views Per Day
 * @returns {string} 등급 (🔈 뜨거움, 🔊 인기, 🔌 보통, 🔉 소수)
 */
export function getVPDClass(vpd) {
    if (vpd >= 10000) return '🔈 뜨거움';
    if (vpd >= 1000) return '🔊 인기';
    if (vpd >= 100) return '🔌 보통';
    return '🔉 소수';
}

/**
 * 채널 규모 분류
 * @param {number} subscriberCount - 구독자 수
 * @returns {string} 규모 (🔴 대형, 🟡 중형, 🟢 소형)
 */
export function getChannelBand(subscriberCount) {
    if (subscriberCount >= 1000000) return '🔴 대형';
    if (subscriberCount >= 100000) return '🟡 중형';
    return '🟢 소형';
}

/**
 * 비밀번호 보기/숨기기 토글
 * @param {string} inputId - 입력 필드 ID
 * @param {string} toggleId - 토글 버튼 ID
 */
export function togglePassword(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '숨기기';
    } else {
        input.type = 'password';
        toggle.textContent = '보기';
    }
}

/**
 * 로딩 표시
 * @param {HTMLElement} element - 로딩을 표시할 요소
 * @param {string} message - 표시할 메시지
 */
export function showLoading(element, message = '⏳ 검색 중...') {
    element.innerHTML = `<div class="loading">${message}</div>`;
}

/**
 * 에러 표시
 * @param {HTMLElement} element - 에러를 표시할 요소
 * @param {string} message - 에러 메시지
 */
export function showError(element, message) {
    element.innerHTML = `<div class="error">❌ ${message}</div>`;
}

/**
 * 디바운스 함수 (연속 호출 방지)
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 로컬 스토리지에 데이터 저장
 * @param {string} key - 저장할 키
 * @param {any} value - 저장할 값
 */
export function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('로컬 스토리지 저장 실패:', error);
    }
}

/**
 * 로컬 스토리지에서 데이터 로드
 * @param {string} key - 로드할 키
 * @returns {any} 로드된 값 또는 null
 */
export function loadFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('로컬 스토리지 로드 실패:', error);
        return null;
    }
}
