// ============================================
// SUPABASE-CONFIG.JS - Supabase 클라이언트 설정
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your Supabase project URL
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase anon key

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

