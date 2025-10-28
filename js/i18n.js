// ============================================
// I18N.JS - 다국어 지원 시스템
// Internationalization System
// ============================================

// 번역 데이터
const translations = {
    ko: {
        // 헤더
        'app.title': 'Jim\'s YouTube 채널',
        'app.subtitle': '검색어를 입력하고 다양한 정보를 확인하세요!',
        
        // 인증
        'auth.login': '로그인',
        'auth.signup': '가입하기',
        'auth.logout': '로그아웃',
        'auth.email': '이메일',
        'auth.password': '비밀번호',
        'auth.passwordConfirm': '비밀번호 확인',
        'auth.username': '아이디',
        'auth.emailPlaceholder': '이메일을 입력하세요',
        'auth.passwordPlaceholder': '비밀번호를 입력하세요',
        'auth.passwordConfirmPlaceholder': '비밀번호를 다시 입력하세요',
        'auth.usernamePlaceholder': '아이디를 입력하세요',
        'auth.show': '보기',
        'auth.hide': '숨기기',
        'auth.submit': '확인',
        'auth.cancel': '취소',
        'auth.profile': '프로필 수정',
        'auth.profileEdit': '수정하기',
        'auth.profileEditTitle': '프로필 수정',
        'auth.profileClickToEdit': '클릭하여 프로필 수정',
        'auth.loginSuccess': '로그인 성공!',
        'auth.loginFailed': '로그인 실패: ',
        'auth.signupSuccess': '회원가입 성공! 로그인되었습니다.',
        'auth.signupFailed': '회원가입 실패: ',
        'auth.logoutSuccess': '로그아웃되었습니다.',
        'auth.profileUpdateSuccess': '프로필이 수정되었습니다!',
        'auth.profileUpdateFailed': '프로필 수정 실패: ',
        'auth.enterEmailPassword': '이메일과 비밀번호를 입력해주세요.',
        'auth.enterAllFields': '모든 필드를 입력해주세요.',
        'auth.passwordMismatch': '비밀번호가 일치하지 않습니다.',
        'auth.passwordMinLength': '비밀번호는 최소 6자 이상이어야 합니다.',
        'auth.enterUsername': '아이디를 입력해주세요.',
        'auth.loginRequired': '로그인이 필요합니다.',
        'auth.error.userNotFound': '사용자를 찾을 수 없습니다.',
        'auth.error.wrongPassword': '비밀번호가 올바르지 않습니다.',
        'auth.error.invalidEmail': '이메일 형식이 올바르지 않습니다.',
        'auth.error.tooManyRequests': '너무 많은 시도가 있었습니다. 나중에 다시 시도해주세요.',
        'auth.error.emailInUse': '이미 사용 중인 이메일입니다.',
        'auth.error.weakPassword': '비밀번호가 너무 약합니다. 6자 이상 입력하세요.',
        
        // 검색
        'search.placeholder': '검색어를 입력하세요...',
        'search.button': '검색',
        'search.mode': '현재 검색 모드',
        'search.modeGoogle': '🟢 Google API',
        'search.modeSerpAPI': '🟡 SerpAPI',
        'search.loading': '⏳ 검색 중...',
        'search.noResults': '❌ 검색 결과가 없습니다.',
        'search.error': '❌ 검색 중 오류가 발생했습니다.',
        'search.loginRequired': '검색하려면 로그인이 필요합니다.',
        'search.enterQuery': '검색어를 입력해주세요!',
        'search.apiKeyRequired': 'API 키를 입력해주세요! 서버에 API 키가 저장되어 있지 않습니다.',
        
        // 필터
        'filter.viewCount': '조회수 필터',
        'filter.subCount': '구독자 필터',
        'filter.uploadDate': '업로드일자 필터',
        'filter.duration': '영상길이 필터',
        'filter.all': '전체',
        'filter.custom': '사용자 정의',
        'filter.date.day1': '최근 1일',
        'filter.date.day3': '최근 3일',
        'filter.date.day7': '최근 7일',
        'filter.date.month1': '1개월 이내',
        'filter.date.month3': '3개월 이내',
        'filter.date.month6': '6개월 이내',
        'filter.date.year1': '1년 이내',
        'filter.duration.shorts': '쇼츠 (<60초)',
        'filter.duration.short': '단편 (1-10분)',
        'filter.duration.medium': '중편 (10-30분)',
        'filter.duration.long': '장편 (30분+)',
        'filter.duration.hint': '(모두 선택 = 전체)',
        
        // 결과
        'result.summary': '검색 결과',
        'result.count': '개',
        'result.page': 'page',
        
        // 페이지네이션
        'pagination.prev': '이전',
        'pagination.next': '다음',
        
        // 언어
        'language.korean': '한국어',
        'language.english': 'English',
        'language.toggle': '언어 전환',
    },
    en: {
        // Header
        'app.title': 'Jim\'s YouTube Channel',
        'app.subtitle': 'Enter a search term and explore various information!',
        
        // Auth
        'auth.login': 'Login',
        'auth.signup': 'Sign Up',
        'auth.logout': 'Logout',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.passwordConfirm': 'Confirm Password',
        'auth.username': 'Username',
        'auth.emailPlaceholder': 'Enter your email',
        'auth.passwordPlaceholder': 'Enter your password',
        'auth.passwordConfirmPlaceholder': 'Re-enter your password',
        'auth.usernamePlaceholder': 'Enter your username',
        'auth.show': 'Show',
        'auth.hide': 'Hide',
        'auth.submit': 'Submit',
        'auth.cancel': 'Cancel',
        'auth.profile': 'Edit Profile',
        'auth.profileEdit': 'Update',
        'auth.profileEditTitle': 'Edit Profile',
        'auth.profileClickToEdit': 'Click to edit profile',
        'auth.loginSuccess': 'Login successful!',
        'auth.loginFailed': 'Login failed: ',
        'auth.signupSuccess': 'Sign up successful! You are now logged in.',
        'auth.signupFailed': 'Sign up failed: ',
        'auth.logoutSuccess': 'You have been logged out.',
        'auth.profileUpdateSuccess': 'Profile updated successfully!',
        'auth.profileUpdateFailed': 'Profile update failed: ',
        'auth.enterEmailPassword': 'Please enter your email and password.',
        'auth.enterAllFields': 'Please fill in all fields.',
        'auth.passwordMismatch': 'Passwords do not match.',
        'auth.passwordMinLength': 'Password must be at least 6 characters long.',
        'auth.enterUsername': 'Please enter a username.',
        'auth.loginRequired': 'Login is required.',
        'auth.error.userNotFound': 'User not found.',
        'auth.error.wrongPassword': 'Incorrect password.',
        'auth.error.invalidEmail': 'Invalid email format.',
        'auth.error.tooManyRequests': 'Too many attempts. Please try again later.',
        'auth.error.emailInUse': 'Email is already in use.',
        'auth.error.weakPassword': 'Password is too weak. Please enter at least 6 characters.',
        
        // Search
        'search.placeholder': 'Enter search term...',
        'search.button': 'Search',
        'search.mode': 'Current Search Mode',
        'search.modeGoogle': '🟢 Google API',
        'search.modeSerpAPI': '🟡 SerpAPI',
        'search.loading': '⏳ Searching...',
        'search.noResults': '❌ No search results found.',
        'search.error': '❌ An error occurred during search.',
        'search.loginRequired': 'Login is required to search.',
        'search.enterQuery': 'Please enter a search term!',
        'search.apiKeyRequired': 'Please enter an API key! No API key is stored on the server.',
        
        // Filters
        'filter.viewCount': 'View Count Filter',
        'filter.subCount': 'Subscriber Filter',
        'filter.uploadDate': 'Upload Date Filter',
        'filter.duration': 'Video Duration Filter',
        'filter.all': 'All',
        'filter.custom': 'Custom',
        'filter.date.day1': 'Last 1 day',
        'filter.date.day3': 'Last 3 days',
        'filter.date.day7': 'Last 7 days',
        'filter.date.month1': 'Within 1 month',
        'filter.date.month3': 'Within 3 months',
        'filter.date.month6': 'Within 6 months',
        'filter.date.year1': 'Within 1 year',
        'filter.duration.shorts': 'Shorts (<60s)',
        'filter.duration.short': 'Short (1-10min)',
        'filter.duration.medium': 'Medium (10-30min)',
        'filter.duration.long': 'Long (30min+)',
        'filter.duration.hint': '(All selected = All)',
        
        // Results
        'result.summary': 'Search Results',
        'result.count': 'items',
        'result.page': 'page',
        
        // Pagination
        'pagination.prev': 'Previous',
        'pagination.next': 'Next',
        
        // Language
        'language.korean': '한국어',
        'language.english': 'English',
        'language.toggle': 'Language',
    }
};

// 현재 언어 (기본값: 한국어)
let currentLanguage = localStorage.getItem('appLanguage') || 'ko';

// 번역 함수
export function t(key) {
    return translations[currentLanguage][key] || key;
}

// 현재 언어 가져오기
export function getCurrentLanguage() {
    return currentLanguage;
}

// 언어 설정
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('appLanguage', lang);
        updatePageTexts();
    }
}

// 언어 토글
export function toggleLanguage() {
    const newLang = currentLanguage === 'ko' ? 'en' : 'ko';
    setLanguage(newLang);
}

// 페이지의 모든 텍스트 업데이트
function updatePageTexts() {
    // data-i18n 속성을 가진 모든 요소 업데이트
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        // 요소 타입에 따라 다르게 처리
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder !== undefined) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
        }
    });
    
    // data-i18n-title 속성을 가진 요소의 title 업데이트
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key);
    });
    
    // 검색 모드 표시기 업데이트
    updateSearchModeText();
    
    // 페이지 title 업데이트
    document.title = t('app.title');
    
    // HTML lang 속성 업데이트
    document.documentElement.lang = currentLanguage;
    
    // 언어 토글 버튼 업데이트
    updateLanguageToggleButton();
}

// 검색 모드 텍스트 업데이트
function updateSearchModeText() {
    const indicator = document.getElementById('searchModeIndicator');
    if (indicator) {
        const modeText = indicator.querySelector('.mode-text');
        if (modeText) {
            const currentMode = modeText.textContent.includes('Google') ? 'google' : 'serpapi';
            const modeKey = currentMode === 'google' ? 'search.modeGoogle' : 'search.modeSerpAPI';
            modeText.textContent = `${t('search.mode')}: ${t(modeKey)}`;
        }
    }
}

// 언어 토글 버튼 업데이트
function updateLanguageToggleButton() {
    const langBtn = document.getElementById('languageToggle');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English';
    }
}

// 초기화
export function initializeI18n() {
    // 언어 토글 버튼 추가
    createLanguageToggleButton();
    
    // 초기 텍스트 업데이트
    updatePageTexts();
    
    console.log(`✅ 다국어 시스템 초기화 완료 (현재 언어: ${currentLanguage})`);
}

// 언어 토글 버튼 초기화
function createLanguageToggleButton() {
    const langBtn = document.getElementById('languageToggle');
    if (!langBtn) {
        console.warn('⚠️ 언어 전환 버튼을 찾을 수 없습니다.');
        return;
    }
    
    // 이벤트 리스너 연결
    langBtn.onclick = toggleLanguage;
    langBtn.title = t('language.toggle');
    
    // 현재 언어에 맞게 텍스트 업데이트
    updateLanguageToggleButton();
}

