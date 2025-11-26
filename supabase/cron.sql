-- ============================================
-- Supabase pg_cron 설정
-- 서버 자동 업데이트 작업 제거됨 (수동 실행으로 변경)
-- ============================================

-- pg_cron extension 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net extension 활성화 (Supabase에서 HTTP 요청을 위해 필요)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 기존 Cron 작업 삭제 (모든 자동 업데이트 작업 제거)
-- ============================================
-- 모든 자동 업데이트 관련 Cron 작업 삭제
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

-- ============================================
-- Cron 작업 확인
-- ============================================
-- 실행 중인 작업 확인:
-- SELECT * FROM cron.job;

