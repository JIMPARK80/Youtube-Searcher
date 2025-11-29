-- ============================================
-- RLS 정책 확인 (실행 후 결과 확인)
-- ============================================

-- videos 테이블의 모든 RLS 정책 확인
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'videos'
ORDER BY cmd;

-- search_cache 테이블의 모든 RLS 정책 확인
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'search_cache'
ORDER BY cmd;

-- 예상 결과:
-- videos 테이블: 4개 정책 (SELECT, INSERT, UPDATE, DELETE)
-- search_cache 테이블: 3개 정책 (SELECT, INSERT, UPDATE)

