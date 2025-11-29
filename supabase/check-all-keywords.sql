-- ============================================
-- Check All Keywords Status
-- 모든 키워드 상태 확인
-- ============================================

-- 1. 모든 키워드의 캐시 상태 및 통계
SELECT 
    sc.keyword,
    sc.total_count as cached_count,
    sc.updated_at as last_cache_update,
    ROUND(EXTRACT(EPOCH FROM (NOW() - sc.updated_at)) / 3600, 2) as age_hours,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - sc.updated_at)) / 3600 >= 72 
        THEN 'Expired - Will Update'
        ELSE 'Fresh - Will Skip'
    END as cache_status,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY[sc.keyword]) as actual_video_count,
    (SELECT MAX(updated_at) FROM videos WHERE keyword @> ARRAY[sc.keyword]) as last_video_update
FROM search_cache sc
ORDER BY sc.updated_at DESC;

-- 2. 키워드별 요약 통계 (간단 버전)
SELECT 
    keyword,
    total_count as cached_count,
    ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600, 1) as age_hours,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 
        THEN 'Expired'
        ELSE 'Fresh'
    END as status
FROM search_cache
ORDER BY updated_at DESC;

-- 3. 상태별 그룹화 통계
SELECT 
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 
        THEN 'Expired - Will Update'
        ELSE 'Fresh - Will Skip'
    END as status,
    COUNT(*) as keyword_count,
    SUM(total_count) as total_cached_videos,
    MIN(updated_at) as oldest_update,
    MAX(updated_at) as newest_update,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600), 1) as avg_age_hours
FROM search_cache
GROUP BY 
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 
        THEN 'Expired - Will Update'
        ELSE 'Fresh - Will Skip'
    END
ORDER BY status;

-- 4. 곧 만료될 키워드 (72시간에 가까운 키워드)
SELECT 
    keyword,
    total_count as cached_count,
    updated_at as last_update,
    ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600, 1) as age_hours,
    ROUND(72 - EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600, 1) as hours_until_expiry
FROM search_cache
WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 BETWEEN 60 AND 72
ORDER BY age_hours DESC;

