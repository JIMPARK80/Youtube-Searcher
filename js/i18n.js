// ============================================
// I18N.JS - 다국어 지원 시스템
// Internationalization System
// ============================================

// 번역 데이터
const translations = {
    ko: {
        // 헤더
        'app.title': 'Jim\'s YouTube 채널 v.02 supa-cache',
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
        'search.searching': '검색 중...',
        'search.loading': '⏳ 검색 중...',
        'search.noResults': '❌ 검색 결과가 없습니다.',
        'search.error': '❌ 검색 중 오류가 발생했습니다.',
        'search.loginRequired': '검색하려면 로그인이 필요합니다.',
        'search.enterQuery': '검색어를 입력해주세요!',
        'search.apiKeyRequired': 'API 키를 입력해주세요! 서버에 API 키가 저장되어 있지 않습니다.',
        'sort.vpd': '조회수/Day 정렬',
        'sort.vpd.none': '기본',
        'sort.vpd.asc': '낮은 순',
        'sort.vpd.desc': '높은 순',
        'sort.velocityMetric': '표시 단위',
        'sort.velocityMetric.recentVph': '최근 VPH',
        'sort.velocityMetric.day': '일간(VPD)',
        'sort.velocityMetric.hour': '시간당(VPH)',
        'velocity.recent': '최근 VPH',
        'velocity.daily': '일간 속도',
        'velocity.unavailable': '데이터 없음',
        'velocity.loading': '계산 중...',
        
        // 필터
        'filter.viewCount': '조회수 필터',
        'filter.viewCount.grade5': '5등급',
        'filter.viewCount.grade4': '4등급',
        'filter.viewCount.grade3': '3등급',
        'filter.viewCount.grade2': '2등급',
        'filter.viewCount.grade1': '1등급',
        'filter.viewCount.minPlaceholder': '최소',
        'filter.viewCount.maxPlaceholder': '최대',
        'filter.subCount': '구독자 필터',
        'filter.subCount.rookie': '신입',
        'filter.subCount.beginner': '초보',
        'filter.subCount.silver': '실버버튼',
        'filter.subCount.gold': '골드버튼',
        'filter.subCount.diamond': '다이아버튼',
        'filter.subCount.minPlaceholder': '최소',
        'filter.subCount.maxPlaceholder': '최대',
        'filter.uploadDate': '업로드일자 필터',
        'filter.duration': '영상길이 필터',
        'filter.all': '전체',
        'filter.custom': '사용자정의',
        'filter.date.day1': '최근 1일',
        'filter.date.day3': '최근 3일',
        'filter.date.day7': '최근 7일',
        'filter.date.month1': '1개월 이내',
        'filter.date.month3': '3개월 이내',
        'filter.date.month6': '6개월 이내',
        'filter.date.year1': '1년 이내',
        'filter.duration.shorts': '쇼츠구간',
        'filter.duration.short': '짧은영상',
        'filter.duration.medium': '중간영상',
        'filter.duration.long': '긴영상',
        'filter.duration.verylong': '아주긴영상',
        'filter.duration.minPlaceholder': '최소 (분)',
        'filter.duration.maxPlaceholder': '최대 (분)',
        'filter.duration.unit': '(분 단위)',
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
        'app.title': 'Jim\'s YouTube Channel v.02 supa-cache',
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
        'search.searching': 'Searching...',
        'search.loading': '⏳ Searching...',
        'search.noResults': '❌ No search results found.',
        'search.error': '❌ An error occurred during search.',
        'search.loginRequired': 'Login is required to search.',
        'search.enterQuery': 'Please enter a search term!',
        'search.apiKeyRequired': 'Please enter an API key! No API key is stored on the server.',
        'sort.vpd': 'Views/Day Sort',
        'sort.vpd.none': 'Default',
        'sort.vpd.asc': 'Lowest First',
        'sort.vpd.desc': 'Highest First',
        'sort.velocityMetric': 'Velocity Unit',
        'sort.velocityMetric.recentVph': 'Recent VPH',
        'sort.velocityMetric.day': 'Per Day (VPD)',
        'sort.velocityMetric.hour': 'Per Hour (VPH)',
        'velocity.recent': 'Recent VPH',
        'velocity.daily': 'Daily Velocity',
        'velocity.unavailable': 'Not available',
        'velocity.loading': 'Calculating...',
        
        // Filters
        'filter.viewCount': 'View Count Filter',
        'filter.viewCount.grade5': 'Grade 5',
        'filter.viewCount.grade4': 'Grade 4',
        'filter.viewCount.grade3': 'Grade 3',
        'filter.viewCount.grade2': 'Grade 2',
        'filter.viewCount.grade1': 'Grade 1',
        'filter.viewCount.minPlaceholder': 'Min',
        'filter.viewCount.maxPlaceholder': 'Max',
        'filter.subCount': 'Subscriber Filter',
        'filter.subCount.rookie': 'Rookie',
        'filter.subCount.beginner': 'Beginner',
        'filter.subCount.silver': 'Silver Button',
        'filter.subCount.gold': 'Gold Button',
        'filter.subCount.diamond': 'Diamond Button',
        'filter.subCount.minPlaceholder': 'Min',
        'filter.subCount.maxPlaceholder': 'Max',
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
        'filter.duration.shorts': 'Shorts',
        'filter.duration.short': 'Short Videos',
        'filter.duration.medium': 'Medium Videos',
        'filter.duration.long': 'Long Videos',
        'filter.duration.verylong': 'Very Long Videos',
        'filter.duration.minPlaceholder': 'Min (min)',
        'filter.duration.maxPlaceholder': 'Max (min)',
        'filter.duration.unit': '(in minutes)',
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
    
    // data-i18n-placeholder 속성을 가진 요소의 placeholder 업데이트
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = t(key);
        if (element.placeholder !== undefined) {
            element.placeholder = translation;
        }
    });
    
    // data-i18n-title 속성을 가진 요소의 title 업데이트
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key);
    });
    
    // 페이지 title 업데이트
    document.title = t('app.title');
    
    // HTML lang 속성 업데이트
    document.documentElement.lang = currentLanguage;
    
    // 언어 토글 버튼 업데이트
    updateLanguageToggleButton();
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

