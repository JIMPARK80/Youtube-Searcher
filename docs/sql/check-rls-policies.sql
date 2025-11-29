-- ============================================
-- RLS 정책 확인 및 수정
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================

-- 1. videos 테이블 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'videos';

-- 2. videos 테이블의 모든 RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'videos';

-- 3. RLS 정책 재설정 (모든 사용자가 읽을 수 있도록)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can read videos" ON videos;
DROP POLICY IF EXISTS "Public can read videos" ON videos;
DROP POLICY IF EXISTS "videos_select_policy" ON videos;

-- 새 정책 생성 (모든 사용자가 읽을 수 있도록)
CREATE POLICY "Anyone can read videos" ON videos 
    FOR SELECT 
    USING (true);

-- 4. 테스트: anon role로 데이터 조회 가능한지 확인
-- (이 쿼리는 postgres role로 실행되므로 실제 anon role 테스트는 클라이언트에서 해야 함)
SELECT COUNT(*) as total_videos FROM videos;
SELECT COUNT(*) as videos_with_keyword FROM videos WHERE keyword @> ARRAY['영어회화'];

-- 5. search_cache 테이블도 확인
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'search_cache';

SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'search_cache';

