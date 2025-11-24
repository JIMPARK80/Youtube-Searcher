// ============================================
// SUPABASE-CONFIG.JS - Supabase 클라이언트 설정
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const supabaseUrl = 'https://hteazdwvhjaexjxwiwwl.supabase.co';
const supabaseAnonKey = 'sb_publishable_Wbc0s5ih6StHz0dXBkgTQg_FZic39Wi';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Make available globally
window.supabase = supabase;

console.log('✅ Supabase initialized successfully');

// Helper function to sanitize document IDs (for compatibility)
function toDocId(s) {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/[\/.#\[\]]/g, '_')
        .slice(0, 500);
}

window.toDocId = toDocId;

