-- ============================================
-- Check Recent Update Stats for Specific Keywords
-- 특정 키워드의 최근 업데이트 통계 확인
-- ============================================

-- 1. Search Cache에서 키워드별 통계
SELECT 
    keyword,
    total_count as cached_video_count,
    updated_at as last_cache_update,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 as age_hours,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 
        THEN 'Expired'
        ELSE 'Fresh'
    END as cache_status
FROM search_cache
WHERE keyword IN ('영어회화', '인생사연')
ORDER BY keyword;

-- 2. Videos 테이블에서 키워드별 실제 비디오 수
SELECT 
    keyword,
    COUNT(*) as total_videos,
    COUNT(DISTINCT video_id) as unique_videos,
    MAX(created_at) as last_created,
    MAX(updated_at) as last_updated
FROM videos
WHERE keyword @> ARRAY['영어회화'] OR keyword @> ARRAY['인생사연']
GROUP BY keyword
ORDER BY keyword;

-- 3. 키워드별 최근 추가된 비디오 수 (최근 24시간)
SELECT 
    CASE 
        WHEN keyword @> ARRAY['영어회화'] THEN '영어회화'
        WHEN keyword @> ARRAY['인생사연'] THEN '인생사연'
    END as keyword,
    COUNT(*) as videos_added_last_24h,
    MIN(created_at) as oldest_in_range,
    MAX(created_at) as newest_in_range
FROM videos
WHERE (keyword @> ARRAY['영어회화'] OR keyword @> ARRAY['인생사연'])
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 
    CASE 
        WHEN keyword @> ARRAY['영어회화'] THEN '영어회화'
        WHEN keyword @> ARRAY['인생사연'] THEN '인생사연'
    END
ORDER BY keyword;

-- 4. 키워드별 최근 업데이트된 비디오 수 (최근 24시간)
SELECT 
    CASE 
        WHEN keyword @> ARRAY['영어회화'] THEN '영어회화'
        WHEN keyword @> ARRAY['인생사연'] THEN '인생사연'
    END as keyword,
    COUNT(*) as videos_updated_last_24h,
    MIN(updated_at) as oldest_update,
    MAX(updated_at) as newest_update
FROM videos
WHERE (keyword @> ARRAY['영어회화'] OR keyword @> ARRAY['인생사연'])
  AND updated_at > NOW() - INTERVAL '24 hours'
  AND updated_at != created_at  -- 실제 업데이트만 (생성과 다른 경우)
GROUP BY 
    CASE 
        WHEN keyword @> ARRAY['영어회화'] THEN '영어회화'
        WHEN keyword @> ARRAY['인생사연'] THEN '인생사연'
    END
ORDER BY keyword;

-- 5. 종합 통계 (한 번에 보기)
SELECT 
    '영어회화' as keyword,
    (SELECT total_count FROM search_cache WHERE keyword = '영어회화') as cached_count,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['영어회화']) as total_videos,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['영어회화'] AND created_at > NOW() - INTERVAL '24 hours') as added_24h,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['영어회화'] AND updated_at > NOW() - INTERVAL '24 hours' AND updated_at != created_at) as updated_24h,
    (SELECT MAX(updated_at) FROM videos WHERE keyword @> ARRAY['영어회화']) as last_video_update,
    (SELECT updated_at FROM search_cache WHERE keyword = '영어회화') as last_cache_update

UNION ALL

SELECT 
    '인생사연' as keyword,
    (SELECT total_count FROM search_cache WHERE keyword = '인생사연') as cached_count,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['인생사연']) as total_videos,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['인생사연'] AND created_at > NOW() - INTERVAL '24 hours') as added_24h,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['인생사연'] AND updated_at > NOW() - INTERVAL '24 hours' AND updated_at != created_at) as updated_24h,
    (SELECT MAX(updated_at) FROM videos WHERE keyword @> ARRAY['인생사연']) as last_video_update,
    (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') as last_cache_update;

