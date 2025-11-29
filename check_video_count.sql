-- 실제 저장된 비디오 개수 확인 쿼리
-- '인생사연' 키워드로 저장된 실제 비디오 개수 확인

-- 1. search_cache의 total_count 확인
SELECT 
    keyword,
    total_count,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours
FROM search_cache
WHERE keyword = '인생사연';

-- 2. videos 테이블에 실제로 저장된 비디오 개수 확인
SELECT 
    COUNT(*) AS actual_video_count
FROM videos
WHERE keyword @> ARRAY['인생사연'];

-- 3. 두 값을 비교
SELECT 
    (SELECT total_count FROM search_cache WHERE keyword = '인생사연') AS total_count,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['인생사연']) AS actual_count,
    (SELECT total_count FROM search_cache WHERE keyword = '인생사연') - 
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY['인생사연']) AS difference;

-- 4. 키워드별 상세 비교 (모든 키워드)
SELECT 
    sc.keyword,
    sc.total_count AS cache_total_count,
    COUNT(v.video_id) AS actual_video_count,
    sc.total_count - COUNT(v.video_id) AS difference,
    sc.updated_at
FROM search_cache sc
LEFT JOIN videos v ON v.keyword @> ARRAY[sc.keyword]
GROUP BY sc.keyword, sc.total_count, sc.updated_at
ORDER BY difference DESC;

-- 5. total_count를 실제 저장 개수로 업데이트 (불일치 수정)
-- '인생사연' 키워드의 total_count를 168로 업데이트
UPDATE search_cache
SET total_count = (
    SELECT COUNT(*) 
    FROM videos 
    WHERE keyword @> ARRAY['인생사연']
)
WHERE keyword = '인생사연'
AND total_count != (
    SELECT COUNT(*) 
    FROM videos 
    WHERE keyword @> ARRAY['인생사연']
);

-- 6. 모든 키워드의 total_count를 실제 저장 개수로 일괄 업데이트
UPDATE search_cache sc
SET total_count = (
    SELECT COUNT(*) 
    FROM videos v 
    WHERE v.keyword @> ARRAY[sc.keyword]
)
WHERE sc.total_count != (
    SELECT COUNT(*) 
    FROM videos v 
    WHERE v.keyword @> ARRAY[sc.keyword]
);

-- 7. 업데이트 후 확인
SELECT 
    keyword,
    total_count,
    (SELECT COUNT(*) FROM videos WHERE keyword @> ARRAY[search_cache.keyword]) AS actual_count,
    updated_at
FROM search_cache
WHERE keyword = '인생사연';

-- 8. 나머지 32개 비디오가 어디 갔는지 확인
-- 8-1. 삭제된 비디오 확인 (video_id로 추적)
-- 최근에 저장된 비디오 중 키워드에 '인생사연'이 없는 것들
SELECT 
    video_id,
    title,
    keyword,
    created_at,
    updated_at
FROM videos
WHERE created_at >= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연')
AND created_at <= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') + INTERVAL '1 hour'
AND NOT (keyword @> ARRAY['인생사연'])
ORDER BY created_at DESC
LIMIT 50;

-- 8-2. 쇼츠(Shorts) 비디오 확인 (duration이 짧은 비디오)
-- duration은 ISO 8601 형식(예: 'PT1M30S')으로 저장되므로 INTERVAL로 캐스팅 필요
SELECT 
    COUNT(*) AS shorts_count,
    COUNT(*) FILTER (WHERE duration IS NOT NULL AND duration::interval < INTERVAL '1 minute') AS under_1min,
    COUNT(*) FILTER (WHERE duration IS NOT NULL AND duration::interval >= INTERVAL '1 minute' AND duration::interval < INTERVAL '2 minutes') AS duration_1_to_2min
FROM videos
WHERE keyword @> ARRAY['인생사연'];

-- 8-3. duration별 분포 확인
-- duration은 ISO 8601 형식(예: 'PT1M30S')으로 저장되므로 INTERVAL로 캐스팅 필요
SELECT 
    CASE 
        WHEN duration IS NULL THEN 'NULL'
        WHEN duration::interval < INTERVAL '1 minute' THEN 'Shorts (<1min)'
        WHEN duration::interval < INTERVAL '2 minutes' THEN 'Short (<2min)'
        WHEN duration::interval < INTERVAL '10 minutes' THEN 'Medium (2-10min)'
        WHEN duration::interval < INTERVAL '30 minutes' THEN 'Long (10-30min)'
        ELSE 'Very Long (>30min)'
    END AS duration_category,
    COUNT(*) AS count
FROM videos
WHERE keyword @> ARRAY['인생사연']
GROUP BY duration_category
ORDER BY count DESC;

-- 8-4. 최근 저장된 비디오 중 키워드가 변경된 것들 확인
-- (다른 키워드로 이동했을 가능성)
SELECT 
    video_id,
    title,
    keyword,
    created_at,
    updated_at
FROM videos
WHERE video_id IN (
    -- 최근에 '인생사연' 키워드로 저장되었을 가능성이 있는 비디오들
    SELECT video_id 
    FROM videos 
    WHERE updated_at >= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') - INTERVAL '1 day'
    AND updated_at <= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') + INTERVAL '1 hour'
)
AND NOT (keyword @> ARRAY['인생사연'])
ORDER BY updated_at DESC
LIMIT 50;

-- 8-5. 전체 비디오 중 '인생사연' 키워드가 있었지만 지금은 없는 것들
-- (키워드 배열에서 제거된 비디오)
SELECT 
    COUNT(*) AS removed_keyword_count
FROM videos
WHERE updated_at >= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') - INTERVAL '1 day'
AND updated_at <= (SELECT updated_at FROM search_cache WHERE keyword = '인생사연') + INTERVAL '1 hour'
AND NOT (keyword @> ARRAY['인생사연']);

