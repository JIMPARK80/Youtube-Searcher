// ============================================
// MAIN.JS - 애플리케이션 통합 초기화
// ============================================

import { initializeApiKeys } from './api.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';
import { initializeI18n } from './i18n.js';
import { supabase } from './supabase-config.js';

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

        // Supabase is already initialized in supabase-config.js
        console.log('✅ Supabase 준비 완료');
        
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
        
        console.log('✅ 애플리케이션 초기화 완료!');
        
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
    }
}

// ============================================
// DOM 로드 완료 후 초기화
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
