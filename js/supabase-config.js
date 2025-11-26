// ============================================
// SUPABASE-CONFIG.JS - Supabase 클라이언트 설정
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const supabaseUrl = 'https://hteazdwvhjaexjxwiwwl.supabase.co';
const supabaseAnonKey = 'sb_publishable_Wbc0s5ih6StHz0dXBkgTQg_FZic39Wi';

// Initialize Supabase client with error handling
let supabase;
try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Make available globally
    window.supabase = supabase;
    
    console.log('✅ Supabase initialized successfully');
} catch (error) {
    console.error('❌ Supabase 초기화 실패:', error);
    // 에러가 발생해도 앱이 계속 작동하도록 빈 객체라도 export
    supabase = null;
    window.supabase = null;
    console.warn('⚠️ Supabase가 초기화되지 않았습니다. 일부 기능이 제한될 수 있습니다.');
}

export { supabase };

// Helper function to sanitize document IDs (for compatibility)
function toDocId(s) {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/[\/.#\[\]]/g, '_')
        .slice(0, 500);
}

window.toDocId = toDocId;

