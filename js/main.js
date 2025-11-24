// ============================================
// MAIN.JS - 애플리케이션 통합 초기화
// ============================================

import { initializeApiKeys } from './api.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';
import { initializeI18n } from './i18n.js';
import { initializeViewTrackingFallback } from './view-history.js';

// ============================================
// 전역 변수 초기화
// ============================================

window.isDefaultSearch = false;
window.currentUser = null;

// ============================================
// 애플리케이션 초기화
// ============================================

async function initializeApp() {
    console.log('🚀 애플리케이션 초기화 시작...');
    
    try {
        // Ignore external extension errors (e.g., MetaMask) to prevent noisy logs
        window.addEventListener('error', (event) => {
            const source = event?.filename || '';
            const message = event?.message || '';
            if (source.includes('inpage.js') || message.includes('MetaMask')) {
                console.warn('⚠️ 외부 확장 프로그램(MetaMask) 오류 무시:', message || source);
                event.preventDefault();
            }
        });

        window.addEventListener('unhandledrejection', (event) => {
            const message = event.reason?.message || '';
            if (message.includes('MetaMask')) {
                console.warn('⚠️ 외부 확장 프로그램(MetaMask) 오류 무시:', message);
                event.preventDefault();
            }
        });

        // Wait for Firebase to be fully loaded
        await waitForFirebase();
        
        // Initialize i18n (다국어 시스템)
        console.log('🌐 다국어 시스템 초기화 중...');
        initializeI18n();
        
        // Initialize API keys
        console.log('🔑 API 키 초기화 중...');
        await initializeApiKeys();
        
        // Initialize authentication system
        console.log('🔐 인증 시스템 초기화 중...');
        initializeAuth();
        
        // Initialize UI
        console.log('🎨 UI 초기화 중...');
        initializeUI();

        // Optional browser-based view tracking fallback
        initializeViewTrackingFallback();
        
        console.log('✅ 애플리케이션 초기화 완료!');
        
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
    }
}

// ============================================
// Firebase 로딩 대기
// ============================================

function waitForFirebase(timeout = 10000) {
    const isFirebaseReady = () => Boolean(window.firebaseDb && window.firebaseAuth);

    if (isFirebaseReady()) {
        console.log('✅ Firebase 준비 완료');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let settled = false;

        const finish = (didTimeout = false) => {
            if (settled) return;
            settled = true;

            window.removeEventListener('firebase-ready', onReady);
            clearTimeout(timeoutId);

            if (didTimeout) {
                console.warn('⚠️ Firebase 로딩 타임아웃');
            } else {
                console.log('✅ Firebase 준비 완료');
            }

            resolve();
        };

        const onReady = () => finish(false);

        window.addEventListener('firebase-ready', onReady, { once: true });

        // If firebaseReadyPromise exists, use it
        if (window.firebaseReadyPromise instanceof Promise) {
            window.firebaseReadyPromise.then(() => finish(false)).catch(() => finish(true));
        } else {
            // Create a promise bridge so firebase-config can resolve it
            window.firebaseReadyPromise = new Promise((promiseResolve) => {
                window.__resolveFirebaseReady = promiseResolve;
            });
            window.firebaseReadyPromise.then(() => finish(false)).catch(() => finish(true));
        }

        const timeoutId = setTimeout(() => finish(true), timeout);
    });
}

// ============================================
// DOM 로드 완료 후 초기화
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
