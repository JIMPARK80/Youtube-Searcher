# 🌐 Translation Feature Guide / 번역 기능 가이드

## Overview / 개요

This application now supports **Korean (한국어)** and **English** with easy language switching.

이 애플리케이션은 이제 **한국어**와 **영어**를 지원하며 쉽게 언어를 전환할 수 있습니다.

## Features / 기능

### 1. Language Toggle Button / 언어 전환 버튼
- Located in the top-left corner / 왼쪽 상단에 위치
- Click to switch between Korean (🇰🇷) and English (🇺🇸) / 클릭하여 한국어와 영어 전환
- Shows current language / 현재 언어 표시

### 2. Default Language / 기본 언어
- **Korean (한국어)** is set as the default language / 한국어가 기본 언어로 설정됨
- Language preference is saved in browser's localStorage / 언어 설정은 브라우저의 localStorage에 저장됨

### 3. Translated Elements / 번역된 요소

All UI elements are translated including:
모든 UI 요소가 번역됩니다:

- **Authentication / 인증**
  - Login / 로그인
  - Sign up / 회원가입
  - Logout / 로그아웃
  - Profile editing / 프로필 수정
  - Error messages / 오류 메시지

- **Search / 검색**
  - Search bar / 검색창
  - Search button / 검색 버튼
  - Loading messages / 로딩 메시지
  - Error messages / 오류 메시지

- **Filters / 필터**
  - View count filter / 조회수 필터
  - Subscriber filter / 구독자 필터
  - Upload date filter / 업로드일자 필터
  - Duration filter / 영상길이 필터

- **Results / 결과**
  - Result summary / 검색 결과 요약
  - Pagination / 페이지네이션

## Technical Implementation / 기술 구현

### Files Added / 추가된 파일
- **`js/i18n.js`**: Translation system / 번역 시스템
  - Translation data for Korean and English / 한국어와 영어 번역 데이터
  - Language switching functionality / 언어 전환 기능
  - Automatic UI update on language change / 언어 변경 시 자동 UI 업데이트

### Files Modified / 수정된 파일
- **`js/main.js`**: Added i18n initialization / i18n 초기화 추가
- **`js/ui.js`**: Updated to use translation functions / 번역 함수 사용하도록 업데이트
- **`js/auth.js`**: Updated alert messages with translations / 알림 메시지를 번역으로 업데이트
- **`index.html`**: Added `data-i18n` attributes to translatable elements / 번역 가능한 요소에 `data-i18n` 속성 추가
- **`css/styles.css`**: Added language toggle button styles / 언어 전환 버튼 스타일 추가

## How to Add New Translations / 새 번역 추가 방법

### 1. Add translation key in `js/i18n.js` / `js/i18n.js`에 번역 키 추가

```javascript
const translations = {
    ko: {
        'your.key': '한국어 텍스트',
        // ...
    },
    en: {
        'your.key': 'English text',
        // ...
    }
};
```

### 2. Use in HTML / HTML에서 사용

```html
<!-- For text content -->
<button data-i18n="your.key">한국어 텍스트</button>

<!-- For placeholder -->
<input placeholder="..." data-i18n="your.key" />

<!-- For title attribute -->
<span title="..." data-i18n-title="your.key"></span>
```

### 3. Use in JavaScript / JavaScript에서 사용

```javascript
import { t } from './i18n.js';

// Use translation
alert(t('your.key'));
```

## Supported Languages / 지원 언어

- 🇰🇷 **Korean (한국어)** - Default / 기본
- 🇺🇸 **English** - Available / 사용 가능

## Browser Support / 브라우저 지원

Works on all modern browsers that support:
다음을 지원하는 모든 최신 브라우저에서 작동:

- ES6 Modules
- localStorage
- data attributes

---

## Usage Example / 사용 예시

1. **Open the application / 애플리케이션 열기**
   - The interface will appear in Korean (default) / 인터페이스가 한국어로 표시됨 (기본)

2. **Switch to English / 영어로 전환**
   - Click the language toggle button (🇰🇷 한국어) in the top-left / 왼쪽 상단의 언어 전환 버튼 클릭
   - The button will change to (🇺🇸 English) / 버튼이 (🇺🇸 English)로 변경됨
   - All text will update immediately / 모든 텍스트가 즉시 업데이트됨

3. **Language Persistence / 언어 유지**
   - Your language choice is saved / 언어 선택이 저장됨
   - Next time you open the app, it will remember your preference / 다음에 앱을 열면 설정이 유지됨

---

**Developed with ❤️ by Jim**

