// ============================================
// MAIN.JS - 애플리케이션 통합 초기화
// ============================================

import { initializeApiKeys } from './api.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';

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
        // Wait for Firebase to be fully loaded
        await waitForFirebase();
        
        // Initialize API keys
        console.log('🔑 API 키 초기화 중...');
        await initializeApiKeys();
        
        // Initialize authentication system
        console.log('🔐 인증 시스템 초기화 중...');
        initializeAuth();
        
        // Initialize UI
        console.log('🎨 UI 초기화 중...');
        initializeUI();
        
        console.log('✅ 애플리케이션 초기화 완료!');
        
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
    }
}

// ============================================
// Firebase 로딩 대기
// ============================================

function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = setInterval(() => {
            if (window.firebaseDb && window.firebaseAuth) {
                clearInterval(checkFirebase);
                console.log('✅ Firebase 준비 완료');
                resolve();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkFirebase);
            console.warn('⚠️ Firebase 로딩 타임아웃');
            resolve();
        }, 10000);
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
