-- ============================================
-- Supabase Schema Fix - 누락된 컬럼 추가
-- ============================================

-- 1. search_cache 테이블에 cache_version 컬럼 추가
ALTER TABLE search_cache 
ADD COLUMN IF NOT EXISTS cache_version TEXT DEFAULT '1.32';

-- 2. videos 테이블에 누락된 컬럼들 확인 및 추가
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS channel_id TEXT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS channel_title TEXT;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS keyword TEXT;

-- 3. view_tracking_config 테이블 재생성 (구조가 잘못된 경우)
-- 먼저 기존 정책 삭제
DROP POLICY IF EXISTS "View tracking config is readable by everyone" ON view_tracking_config;
DROP POLICY IF EXISTS "Authenticated users can update view tracking" ON view_tracking_config;

-- 테이블이 잘못된 구조로 되어 있다면 삭제 후 재생성
DROP TABLE IF EXISTS view_tracking_config CASCADE;

CREATE TABLE view_tracking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_ids TEXT[] DEFAULT '{}',
    retention_hours INTEGER DEFAULT 240,
    max_entries INTEGER DEFAULT 240,
    trending_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single row constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tracking_config_single ON view_tracking_config((1));

-- RLS 활성화
ALTER TABLE view_tracking_config ENABLE ROW LEVEL SECURITY;

-- 정책 재생성
CREATE POLICY "View tracking config is readable by everyone" ON view_tracking_config
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update view tracking" ON view_tracking_config
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert view tracking config" ON view_tracking_config
    FOR INSERT WITH CHECK (true);

-- Trigger 재생성
-- 먼저 함수가 존재하는지 확인하고 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS update_view_tracking_config_updated_at ON view_tracking_config;
CREATE TRIGGER update_view_tracking_config_updated_at BEFORE UPDATE ON view_tracking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. videos 테이블에 DELETE 정책 추가 (필요한 경우)
DROP POLICY IF EXISTS "Anyone can delete videos" ON videos;
CREATE POLICY "Anyone can delete videos" ON videos
    FOR DELETE USING (true);

-- 5. view_history 테이블에 INSERT 정책 추가 (브라우저 폴백용)
DROP POLICY IF EXISTS "Anyone can insert view history" ON view_history;
CREATE POLICY "Anyone can insert view history" ON view_history
    FOR INSERT WITH CHECK (true);

-- 6. users 테이블 생성 및 정책 설정
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT NOT NULL UNIQUE, -- Supabase Auth user.id
    last_search_keyword TEXT,
    last_search_time BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Users: Users can only access their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = uid);

-- Trigger 추가
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

