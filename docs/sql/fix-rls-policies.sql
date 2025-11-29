-- ============================================
-- RLS 정책 수정 (즉시 실행)
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================

-- 1. videos 테이블 RLS 정책 확인
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'videos';

-- 2. videos 테이블 RLS 정책 재설정
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- 기존 정책 모두 삭제 (모든 가능한 정책 이름 확인 후 삭제)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- videos 테이블의 모든 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'videos') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON videos', r.policyname);
    END LOOP;
END $$;

-- 새 정책 생성 (모든 사용자가 읽을 수 있도록)
-- IF NOT EXISTS는 지원하지 않으므로, 위에서 모두 삭제했으므로 안전하게 생성 가능
CREATE POLICY "Anyone can read videos" ON videos 
    FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can insert videos" ON videos 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Anyone can update videos" ON videos 
    FOR UPDATE 
    USING (true);

CREATE POLICY "Anyone can delete videos" ON videos 
    FOR DELETE 
    USING (true);

-- 3. search_cache 테이블도 확인 및 수정
SELECT 
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'search_cache';

ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- search_cache 테이블의 모든 정책 삭제
DO $$
DECLARE
    r RECORD;
BEGIN
    -- search_cache 테이블의 모든 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'search_cache') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON search_cache', r.policyname);
    END LOOP;
END $$;

-- 새 정책 생성
CREATE POLICY "Anyone can read search cache" ON search_cache 
    FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can insert search cache" ON search_cache 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Anyone can update search cache" ON search_cache 
    FOR UPDATE 
    USING (true);

-- 4. 확인: 정책이 제대로 생성되었는지 확인
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('videos', 'search_cache')
ORDER BY tablename, cmd;

-- 5. 테스트: 데이터 개수 확인 (postgres role로 실행되므로 참고용)
SELECT 
    'videos' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE keyword @> ARRAY['영어회화']) as with_keyword_영어회화
FROM videos
UNION ALL
SELECT 
    'search_cache' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE keyword = '영어회화') as with_keyword_영어회화
FROM search_cache;

