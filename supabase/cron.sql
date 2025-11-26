-- ============================================
-- Supabase pg_cron 설정
-- 서버 자동 VPH 업데이트 작업
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

-- ============================================
-- VPH 자동 업데이트 Cron 작업 (1시간마다)
-- ============================================
-- hourly-vph-updater Edge Function을 1시간마다 실행
-- 
-- 주의: 아래 'YOUR_SERVICE_ROLE_KEY_HERE'를 실제 Service Role Key로 교체하세요
-- Service Role Key 찾는 방법:
-- Supabase Dashboard → Settings → API → service_role key 복사
-- 
-- 예시: 'sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ' (실제 키로 교체 필요)

-- 기존 작업이 있으면 삭제
SELECT cron.unschedule('hourly-vph-updater') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'hourly-vph-updater'
);

-- 새 Cron 작업 등록 (1시간마다 실행)
SELECT cron.schedule(
    'hourly-vph-updater',
    '0 * * * *', -- 매 시간 정각에 실행 (예: 00:00, 01:00, 02:00...)
    $$
    SELECT
        net.http_post(
            url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/hourly-vph-updater',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ'
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
WHERE jobname = 'hourly-vph-updater';

