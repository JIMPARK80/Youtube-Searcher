-- ============================================
-- view_tracking_config 확인 쿼리
-- ============================================

-- 1. view_tracking_config 데이터 확인
SELECT 
    id,
    video_ids,
    array_length(video_ids, 1) AS video_count,
    retention_hours,
    max_entries,
    updated_at
FROM view_tracking_config
LIMIT 1;

-- 2. video_ids가 비어있는지 확인
SELECT 
    CASE 
        WHEN video_ids IS NULL THEN 'NULL'
        WHEN array_length(video_ids, 1) IS NULL THEN '빈 배열'
        WHEN array_length(video_ids, 1) = 0 THEN '0개'
        ELSE array_length(video_ids, 1)::text || '개'
    END AS status,
    video_ids
FROM view_tracking_config
LIMIT 1;


