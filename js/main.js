// ============================================
// MAIN.JS - 애플리케이션 통합 초기화
// ============================================

import { initializeApiKeys } from './api.js';
import { initializeUI } from './ui.js';
import { initializeAuth } from './auth.js';
import { initializeI18n } from './i18n.js';
import { supabase } from './supabase-config.js';
import { initializeViewTrackingFallback } from './view-history.js';

// ============================================
// 전역 변수 초기화
// ============================================

window.isDefaultSearch = false;
window.currentUser = null;

// 타이머 추적 (메모리 누수 방지)
window.appTimers = {
    autoRefresh: null
};

// ============================================
// 애플리케이션 초기화
// ============================================

async function initializeApp() {
    console.log('🚀 애플리케이션 초기화 시작...');
    
    try {
        // Ignore external extension errors (e.g., MetaMask) to prevent noisy logs
        // 전역 에러 핸들러 (중복 등록 방지)
        if (!window.__errorHandlerAttached) {
            window.addEventListener('error', (event) => {
                const source = event?.filename || '';
                const message = event?.message || '';
                if (source.includes('inpage.js') || message.includes('MetaMask')) {
                    console.warn('⚠️ 외부 확장 프로그램(MetaMask) 오류 무시:', message || source);
                    event.preventDefault();
                } else {
                    // 앱 내부 에러는 로그만 남기고 앱이 멈추지 않도록
                    console.error('⚠️ 앱 에러 발생:', {
                        message: event.message,
                        source: event.filename,
                        line: event.lineno,
                        col: event.colno,
                        error: event.error
                    });
                }
            });

            window.addEventListener('unhandledrejection', (event) => {
                const message = event.reason?.message || '';
                if (message.includes('MetaMask')) {
                    console.warn('⚠️ 외부 확장 프로그램(MetaMask) 오류 무시:', message);
                    event.preventDefault();
                } else {
                    // Promise rejection은 로그만 남기고 앱이 멈추지 않도록
                    console.error('⚠️ Promise rejection:', {
                        reason: event.reason,
                        message: message
                    });
                }
            });
            
            window.__errorHandlerAttached = true;
        }

        // Supabase is already initialized in supabase-config.js
        console.log('✅ Supabase 준비 완료');
        
        // Supabase 연결 테스트
        try {
            const { data, error } = await supabase.from('config').select('key').limit(1);
            if (error) {
                console.warn('⚠️ Supabase 연결 테스트 실패:', error.message);
            } else {
                console.log('✅ Supabase 연결 정상');
            }
        } catch (error) {
            console.warn('⚠️ Supabase 연결 테스트 중 오류:', error);
        }
        
        // Initialize i18n (다국어 시스템) - 독립적으로 실행 (실패해도 계속 진행)
        // i18n은 다른 모듈에서 사용되므로 먼저 초기화
        try {
            console.log('🌐 다국어 시스템 초기화 중...');
            initializeI18n();
            console.log('✅ 다국어 시스템 초기화 완료');
        } catch (error) {
            console.error('❌ 다국어 시스템 초기화 실패 (계속 진행):', error);
            // i18n 실패해도 기본 기능은 작동하도록 계속 진행
        }
        
        // Initialize API keys - 독립적으로 실행 (실패해도 계속 진행)
        try {
            console.log('🔑 API 키 초기화 중...');
            await Promise.race([
                initializeApiKeys(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('API 키 초기화 타임아웃 (5초)')), 5000))
            ]);
        } catch (error) {
            console.error('❌ API 키 초기화 실패 (계속 진행):', error);
            console.warn('⚠️ API 키 없이도 검색은 가능하지만, Supabase config 테이블에 API 키를 설정해주세요.');
        }
        
        // Initialize view tracking fallback - 독립적으로 실행 (실패해도 계속 진행)
        try {
            console.log('📊 View tracking 초기화 중...');
            await Promise.race([
                initializeViewTrackingFallback(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('View tracking 초기화 타임아웃 (10초)')), 10000))
            ]);
        } catch (error) {
            console.error('❌ View tracking 초기화 실패 (계속 진행):', error);
            console.warn('⚠️ View tracking이 비활성화되었습니다. 앱은 정상 작동합니다.');
        }
        
        // Initialize authentication system - 독립적으로 실행 (실패해도 계속 진행)
        try {
            console.log('🔐 인증 시스템 초기화 중...');
            initializeAuth();
            console.log('✅ 인증 시스템 초기화 완료');
        } catch (error) {
            console.error('❌ 인증 시스템 초기화 실패 (계속 진행):', error);
            // 인증 실패해도 검색 기능은 작동하도록 계속 진행
        }
        
        // Initialize UI - 독립적으로 실행 (실패해도 계속 진행)
        // UI는 가장 마지막에 초기화 (다른 모듈들이 준비된 후)
        try {
            console.log('🎨 UI 초기화 중...');
            initializeUI();
            console.log('✅ UI 초기화 완료');
        } catch (error) {
            console.error('❌ UI 초기화 실패:', error);
            console.error('❌ UI 초기화 실패 상세:', error.stack);
            // UI 초기화 실패는 치명적이므로 사용자에게 알림
            alert('⚠️ UI 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        }
        
        console.log('✅ 애플리케이션 초기화 완료!');
        
    } catch (error) {
        console.error('❌ 초기화 중 치명적 오류 발생:', error);
        console.warn('⚠️ 앱이 부분적으로 작동할 수 있습니다. 페이지를 새로고침해주세요.');
    }
}

// 페이지 언로드 시 모든 타이머 정리
window.addEventListener('beforeunload', () => {
    if (window.appTimers) {
        if (window.appTimers.autoRefresh) {
            clearInterval(window.appTimers.autoRefresh);
        }
    }
});

// ============================================
// DOM 로드 완료 후 초기화
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
