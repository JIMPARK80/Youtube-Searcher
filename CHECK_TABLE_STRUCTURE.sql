-- ============================================
-- daily_load_tracking 테이블 구조 확인
-- ============================================

-- 테이블이 존재하는지 확인
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_load_tracking'
);

-- 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'daily_load_tracking'
ORDER BY ordinal_position;

-- 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'daily_load_tracking';

-- 데이터 확인 (최근 10개)
SELECT * FROM daily_load_tracking
ORDER BY updated_at DESC
LIMIT 10;

