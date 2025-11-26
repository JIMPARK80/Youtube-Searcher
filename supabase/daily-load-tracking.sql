-- ============================================
-- Daily Load Tracking Table
-- 키워드별 일일 추가 로드 추적
-- ============================================

CREATE TABLE IF NOT EXISTS daily_load_tracking (
    key TEXT PRIMARY KEY, -- 형식: daily_load_{keyword}_{date}
    keyword TEXT NOT NULL,
    date DATE NOT NULL,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_daily_load_tracking_keyword_date 
ON daily_load_tracking(keyword, date);

-- 자동으로 updated_at 업데이트
CREATE OR REPLACE FUNCTION update_daily_load_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_daily_load_tracking_updated_at ON daily_load_tracking;
CREATE TRIGGER trigger_update_daily_load_tracking_updated_at
BEFORE UPDATE ON daily_load_tracking
FOR EACH ROW
EXECUTE FUNCTION update_daily_load_tracking_updated_at();

-- 오래된 데이터 정리 (30일 이상 된 데이터 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_daily_load_tracking()
RETURNS void AS $$
BEGIN
    DELETE FROM daily_load_tracking
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

