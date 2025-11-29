-- ============================================
-- Fix Keyword Encoding Issue
-- "????" 키워드 처리 옵션
-- ============================================

-- 옵션 1: "????" 키워드를 "인생사연"으로 수정 (기존 데이터 유지)
-- UPDATE videos
-- SET keyword = array_replace(keyword, '????', '인생사연')
-- WHERE '????' = ANY(keyword);

-- 옵션 2: "????" 키워드를 가진 영상 삭제 (데이터 삭제)
-- 주의: 이 작업은 되돌릴 수 없습니다!
-- 안전 확인: '인생사연' 키워드는 절대 삭제되지 않습니다! (WHERE 조건에 '????'만 있음)
DELETE FROM videos
WHERE '????' = ANY(keyword)
  AND NOT ('인생사연' = ANY(keyword));  -- 추가 안전 장치: '인생사연'이 포함된 경우 제외

-- 2. search_cache 테이블에서 "????" 키워드 삭제
-- 안전 확인: keyword = '????' 조건만 있으므로 '인생사연'은 절대 삭제되지 않음
DELETE FROM search_cache
WHERE keyword = '????'
  AND keyword != '인생사연';  -- 추가 안전 장치

-- 3. keyword_performance 테이블에서 "????" 키워드 삭제
-- 안전 확인: keyword = '????' 조건만 있으므로 '인생사연'은 절대 삭제되지 않음
DELETE FROM keyword_performance
WHERE keyword = '????'
  AND keyword != '인생사연';  -- 추가 안전 장치

-- 4. 삭제 전 확인: "????" 키워드를 가진 데이터 확인
SELECT 
    'videos (삭제 예정)' as table_name,
    COUNT(*) as count_to_delete
FROM videos
WHERE '????' = ANY(keyword)

UNION ALL

SELECT 
    'search_cache (삭제 예정)' as table_name,
    COUNT(*) as count_to_delete
FROM search_cache
WHERE keyword = '????'

UNION ALL

SELECT 
    'keyword_performance (삭제 예정)' as table_name,
    COUNT(*) as count_to_delete
FROM keyword_performance
WHERE keyword = '????';

-- 5. 삭제 후 확인: "????" 키워드가 남아있는지 확인
SELECT 
    'videos' as table_name,
    COUNT(*) as remaining_count
FROM videos
WHERE '????' = ANY(keyword)

UNION ALL

SELECT 
    'search_cache' as table_name,
    COUNT(*) as remaining_count
FROM search_cache
WHERE keyword = '????'

UNION ALL

SELECT 
    'keyword_performance' as table_name,
    COUNT(*) as remaining_count
FROM keyword_performance
WHERE keyword = '????';

-- 6. "인생사연" 키워드를 가진 정상 데이터 확인
SELECT 
    'videos (인생사연)' as table_name,
    COUNT(*) as count
FROM videos
WHERE '인생사연' = ANY(keyword)

UNION ALL

SELECT 
    'search_cache (인생사연)' as table_name,
    COUNT(*) as count
FROM search_cache
WHERE keyword = '인생사연'

UNION ALL

SELECT 
    'keyword_performance (인생사연)' as table_name,
    COUNT(*) as count
FROM keyword_performance
WHERE keyword = '인생사연';

