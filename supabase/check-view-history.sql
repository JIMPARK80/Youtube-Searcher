-- ============================================
-- View History 데이터 확인 쿼리
-- ============================================

-- 1. 최근 수집된 데이터 확인
SELECT 
    video_id,
    view_count,
    fetched_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - fetched_at)) / 60, 1) AS minutes_ago
FROM view_history
ORDER BY fetched_at DESC
LIMIT 20;

-- 2. 최근 30분 내 분(minute)별 데이터 개수 확인
SELECT 
    DATE_TRUNC('minute', fetched_at) AS minute,
    COUNT(*) AS count,
    COUNT(DISTINCT video_id) AS unique_videos,
    MIN(fetched_at) AS first_fetch,
    MAX(fetched_at) AS last_fetch
FROM view_history
WHERE fetched_at > NOW() - INTERVAL '30 minutes'
GROUP BY DATE_TRUNC('minute', fetched_at)
ORDER BY minute DESC;

-- 3. video_id별 최근 스냅샷 확인
SELECT 
    video_id,
    COUNT(*) AS snapshot_count,
    MAX(fetched_at) AS last_fetched,
    MIN(fetched_at) AS first_fetched
FROM view_history
GROUP BY video_id
ORDER BY last_fetched DESC
LIMIT 20;

