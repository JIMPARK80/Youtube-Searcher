-- 비디오 캐시 시간(TTL) 확인 쿼리
-- 캐시 만료 시간과 현재 상태 확인

-- 1. 캐시 TTL 설정 확인 (코드에서 72시간으로 설정됨)
-- CACHE_TTL_MS = 72 * 60 * 60 * 1000 = 259,200,000 밀리초
-- CACHE_TTL_HOURS = 72시간

-- 2. search_cache의 캐시 상태 확인 (만료 여부 포함)
SELECT 
    keyword,
    total_count,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 THEN '만료됨 (Expired)'
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 60 THEN '곧 만료 (Expiring Soon)'
        ELSE '유효함 (Valid)'
    END AS cache_status,
    (72 - EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS remaining_hours
FROM search_cache
ORDER BY updated_at DESC;

-- 3. 특정 키워드('인생사연')의 캐시 상태 상세 확인
SELECT 
    keyword,
    total_count,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72 THEN '만료됨 (Expired)'
        WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 60 THEN '곧 만료 (Expiring Soon)'
        ELSE '유효함 (Valid)'
    END AS cache_status,
    (72 - EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS remaining_hours,
    cache_version,
    data_source
FROM search_cache
WHERE keyword = '인생사연';

-- 4. 만료된 캐시 확인 (72시간 이상 경과)
SELECT 
    keyword,
    total_count,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours,
    '만료됨 - 다음 검색 시 API 호출 예상' AS status
FROM search_cache
WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72
ORDER BY age_hours DESC;

-- 5. 곧 만료될 캐시 확인 (60시간 이상, 72시간 미만)
SELECT 
    keyword,
    total_count,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours,
    (72 - EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS remaining_hours,
    '곧 만료됨' AS status
FROM search_cache
WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 60
AND EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 < 72
ORDER BY age_hours DESC;

-- 6. 캐시 통계 요약
SELECT 
    COUNT(*) AS total_keywords,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 < 72) AS valid_cache_count,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 72) AS expired_cache_count,
    COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 >= 60 AND EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 < 72) AS expiring_soon_count,
    AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS avg_age_hours,
    MAX(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600) AS max_age_hours
FROM search_cache;

