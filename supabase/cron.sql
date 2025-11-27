-- ============================================
-- Supabase pg_cron 설정
-- 서버 자동 VPH 업데이트 작업
-- 
-- ⚠️ SECURITY: 이 파일을 실행하기 전에 Service Role Key를 config 테이블에 저장하세요:
-- INSERT INTO config (key, value) VALUES ('serviceRoleKey', '"YOUR_SERVICE_ROLE_KEY_HERE"'::jsonb)
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- 
-- 이 파일을 Supabase SQL Editor에서 실행하세요
-- ============================================

-- pg_cron extension 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net extension 활성화 (Supabase에서 HTTP 요청을 위해 필요)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 기존 Cron 작업 삭제
-- ============================================
-- 기존 작업 삭제 (중복 방지)
SELECT cron.unschedule('update-trending-videos') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'update-trending-videos'
);

SELECT cron.unschedule('cleanup-daily-load-tracking') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-daily-load-tracking'
);

SELECT cron.unschedule('hourly-view-tracker') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'hourly-view-tracker'
);

SELECT cron.unschedule('daily-video-accumulator') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-video-accumulator'
);

SELECT cron.unschedule('hourly-vph-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'hourly-vph-updater'
);

SELECT cron.unschedule('daily-statistics-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-statistics-updater'
);

-- ============================================
-- VPH 자동 업데이트 Cron 작업 (1시간마다)
-- ============================================
-- hourly-vph-updater Edge Function을 1시간마다 실행
-- 
-- ⚠️ SECURITY: Service Role Key는 config 테이블에서 읽어옵니다
-- Service Role Key를 config 테이블에 저장하세요:
-- INSERT INTO config (key, value) VALUES ('serviceRoleKey', '"YOUR_SERVICE_ROLE_KEY_HERE"'::jsonb)
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 기존 작업이 있으면 삭제
SELECT cron.unschedule('hourly-vph-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'hourly-vph-updater'
);

-- 새 Cron 작업 등록 (1시간마다 실행)
-- Service Role Key는 config 테이블에서 동적으로 읽어옵니다
SELECT cron.schedule(
    'hourly-vph-updater',
    '0 * * * *', -- 매 시간 정각에 실행 (예: 00:00, 01:00, 02:00...)
    $$
    SELECT
        net.http_post(
            url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/hourly-vph-updater',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE((SELECT value::text FROM config WHERE key = 'serviceRoleKey'), 'YOUR_SERVICE_ROLE_KEY_HERE')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ============================================
-- 일일 통계 업데이트 Cron 작업 (매일 자정)
-- ============================================
-- daily-statistics-updater Edge Function을 매일 자정에 실행
-- 좋아요(like_count)와 구독자(subscriber_count) 데이터 업데이트
-- 
-- ⚠️ SECURITY: Service Role Key는 config 테이블에서 읽어옵니다

-- 기존 작업이 있으면 삭제
SELECT cron.unschedule('daily-statistics-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-statistics-updater'
);

-- 새 Cron 작업 등록 (매일 자정에 실행)
-- Service Role Key는 config 테이블에서 동적으로 읽어옵니다
SELECT cron.schedule(
    'daily-statistics-updater',
    '0 0 * * *', -- 매일 자정에 실행 (00:00)
    $$
    SELECT
        net.http_post(
            url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/daily-statistics-updater',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE((SELECT value::text FROM config WHERE key = 'serviceRoleKey'), 'YOUR_SERVICE_ROLE_KEY_HERE')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ============================================
-- 검색어별 영상 업데이트 Cron 작업 (매일 오전 3시)
-- ============================================
-- search-keyword-updater Edge Function을 매일 오전 3시에 실행
-- This is the most important cron function
-- Updates videos for configured search keywords
-- Only updates if cache is older than 24 hours
-- 
-- ⚠️ SECURITY: Service Role Key는 config 테이블에서 읽어옵니다

-- 기존 작업이 있으면 삭제
SELECT cron.unschedule('search-keyword-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'search-keyword-updater'
);

-- 새 Cron 작업 등록 (매일 오전 3시 실행)
-- Service Role Key는 config 테이블에서 동적으로 읽어옵니다
SELECT cron.schedule(
    'search-keyword-updater',
    '0 3 * * *', -- Every day at 3:00 AM
    $$
    SELECT
        net.http_post(
            url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/search-keyword-updater',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE((SELECT value::text FROM config WHERE key = 'serviceRoleKey'), 'YOUR_SERVICE_ROLE_KEY_HERE')
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- ============================================
-- Cron 작업 확인
-- ============================================
-- 실행 중인 작업 확인:
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
ORDER BY jobname;

