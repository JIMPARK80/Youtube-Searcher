# 🎯 Smart Keyword Filtering - 추가 작업 가이드

Smart Keyword Filtering 기능을 활성화하기 위해 Supabase에서 해야 할 작업입니다.

---

## ✅ 1. 키워드 성능 테이블 생성 (필수)

**목적**: 키워드별 효율성을 추적하기 위한 테이블 생성

**방법**:
1. **Supabase Dashboard** → **SQL Editor** 클릭
2. **New query** 클릭
3. 아래 SQL 실행:

```sql
-- ============================================
-- Keyword Performance Table (Smart Filtering)
-- ============================================
CREATE TABLE IF NOT EXISTS keyword_performance (
    keyword TEXT PRIMARY KEY,
    total_runs INTEGER DEFAULT 0,
    total_videos_found INTEGER DEFAULT 0,
    total_videos_added INTEGER DEFAULT 0,
    total_videos_updated INTEGER DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    last_new_video_ratio NUMERIC(5, 4) DEFAULT 0,
    average_new_video_ratio NUMERIC(5, 4) DEFAULT 0,
    efficiency_score NUMERIC(5, 4) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    skip_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_performance_efficiency ON keyword_performance(efficiency_score DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_performance_active ON keyword_performance(is_active, skip_until);
CREATE INDEX IF NOT EXISTS idx_keyword_performance_last_run ON keyword_performance(last_run_at DESC);
```

4. **Run** 버튼 클릭
5. 성공 메시지 확인

**확인 방법**:
```sql
SELECT * FROM keyword_performance LIMIT 5;
```

---

## ✅ 2. RLS (Row Level Security) 정책 설정 (선택사항)

**목적**: 테이블 접근 권한 설정 (필요시)

**방법**:
```sql
-- RLS 활성화
ALTER TABLE keyword_performance ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 사용자)
CREATE POLICY "Anyone can read keyword performance" 
ON keyword_performance FOR SELECT 
USING (true);

-- 쓰기 권한 (서비스 역할만)
CREATE POLICY "Service role can manage keyword performance" 
ON keyword_performance FOR ALL 
USING (auth.role() = 'service_role');
```

---

## ✅ 3. 초기 실행 및 모니터링

### 3.1 첫 실행

**자동 실행**: 매일 오전 3시에 자동 실행됨 (cron 설정 완료)

**수동 실행** (테스트용):
1. **Supabase Dashboard** → **Edge Functions**
2. `search-keyword-updater` 선택
3. **Invoke function** 클릭
4. 결과 확인

### 3.2 효율성 평가 시작

**최소 실행 횟수**: 3회
- 1~2회 실행: 통계 수집 중 (모든 키워드 처리)
- 3회 실행 후: 효율성 평가 시작
- 효율성 점수 < 10%인 키워드는 자동으로 7일간 스킵

### 3.3 키워드 효율성 확인

**모든 키워드 효율성 확인**:
```sql
SELECT 
    keyword,
    total_runs,
    ROUND(efficiency_score * 100, 1) as efficiency_percent,
    total_videos_added,
    total_videos_found,
    is_active,
    skip_until,
    last_run_at
FROM keyword_performance
ORDER BY efficiency_score DESC;
```

**저효율 키워드 확인**:
```sql
SELECT 
    keyword,
    ROUND(efficiency_score * 100, 1) as efficiency_percent,
    total_runs,
    is_active,
    skip_until
FROM keyword_performance
WHERE efficiency_score < 0.1
   OR is_active = false
ORDER BY efficiency_score ASC;
```

**고효율 키워드 확인**:
```sql
SELECT 
    keyword,
    ROUND(efficiency_score * 100, 1) as efficiency_percent,
    total_runs,
    total_videos_added,
    is_active
FROM keyword_performance
WHERE efficiency_score >= 0.1
  AND is_active = true
ORDER BY efficiency_score DESC;
```

---

## 🔧 4. 수동 관리 (필요시)

### 4.1 특정 키워드 수동 재활성화

**사용 시나리오**: 효율성이 낮아 자동으로 비활성화되었지만, 수동으로 다시 활성화하고 싶을 때

```sql
UPDATE keyword_performance
SET 
    is_active = true,
    skip_until = null,
    updated_at = NOW()
WHERE keyword = '키워드명';
```

### 4.2 특정 키워드 수동 비활성화

**사용 시나리오**: 특정 키워드를 일시적으로 비활성화하고 싶을 때

```sql
UPDATE keyword_performance
SET 
    is_active = false,
    skip_until = NOW() + INTERVAL '30 days',
    updated_at = NOW()
WHERE keyword = '키워드명';
```

### 4.3 모든 키워드 재활성화

**사용 시나리오**: 효율성 기준을 변경했거나, 모든 키워드를 다시 평가하고 싶을 때

```sql
UPDATE keyword_performance
SET 
    is_active = true,
    skip_until = null,
    updated_at = NOW();
```

---

## 📊 5. 효율성 기준 조정 (고급)

**현재 설정**:
- 최소 효율성 점수: 10% (MIN_EFFICIENCY_SCORE = 0.1)
- 스킵 기간: 7일 (LOW_EFFICIENCY_SKIP_HOURS = 168)
- 평가 최소 실행 횟수: 3회 (MIN_RUNS_FOR_EVALUATION = 3)

**조정 방법**:
`supabase/functions/search-keyword-updater/index.ts` 파일 수정:

```typescript
// 더 엄격한 필터링 (더 많은 키워드 스킵)
const MIN_EFFICIENCY_SCORE = 0.15; // 15% 이상만 처리
const LOW_EFFICIENCY_SKIP_HOURS = 336; // 14일간 스킵

// 더 관대한 필터링 (더 적은 키워드 스킵)
const MIN_EFFICIENCY_SCORE = 0.05; // 5% 이상만 처리
const LOW_EFFICIENCY_SKIP_HOURS = 72; // 3일간 스킵
```

수정 후 재배포:
```powershell
supabase functions deploy search-keyword-updater
```

---

## 📈 6. 모니터링 대시보드 쿼리

### 일일 효율성 리포트

```sql
SELECT 
    DATE(last_run_at) as date,
    COUNT(*) as total_keywords,
    COUNT(*) FILTER (WHERE is_active = true) as active_keywords,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_keywords,
    ROUND(AVG(efficiency_score) * 100, 1) as avg_efficiency_percent,
    SUM(total_videos_added) as total_videos_added_today
FROM keyword_performance
WHERE last_run_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(last_run_at)
ORDER BY date DESC;
```

### 키워드별 상세 통계

```sql
SELECT 
    keyword,
    total_runs,
    ROUND(efficiency_score * 100, 1) as efficiency_percent,
    total_videos_added,
    total_videos_found,
    ROUND(total_videos_added::numeric / NULLIF(total_videos_found, 0) * 100, 1) as overall_ratio,
    is_active,
    CASE 
        WHEN skip_until IS NOT NULL AND skip_until > NOW() 
        THEN ROUND(EXTRACT(EPOCH FROM (skip_until - NOW())) / 3600, 1) || ' hours'
        ELSE 'Active'
    END as status,
    last_run_at
FROM keyword_performance
ORDER BY efficiency_score DESC;
```

---

## 🎯 작업 우선순위

### 필수 작업 (즉시)

1. ✅ **키워드 성능 테이블 생성** (위의 SQL 실행)
2. ✅ **첫 실행 대기** (매일 오전 3시 자동 실행 또는 수동 실행)

### 선택 작업 (권장)

3. ✅ **효율성 모니터링** (3회 실행 후 확인)
4. ✅ **저효율 키워드 확인** (자동 스킵 여부 확인)

### 고급 작업 (필요시)

5. ✅ **효율성 기준 조정** (더 엄격하거나 관대하게)
6. ✅ **수동 키워드 관리** (특정 키워드 활성/비활성화)

---

## 📝 체크리스트

- [ ] `keyword_performance` 테이블 생성 완료
- [ ] 첫 실행 완료 (자동 또는 수동)
- [ ] 3회 실행 후 효율성 평가 시작 확인
- [ ] 저효율 키워드 자동 스킵 확인
- [ ] 효율성 리포트 확인

---

## 🚀 예상 결과

### 3회 실행 후

**고효율 키워드 (15개)**:
- 효율성: 20~50%
- 상태: 활성 (정상 처리)
- 일일 비용: 15 × 101 = 1,515 units

**저효율 키워드 (35개)**:
- 효율성: 0~10%
- 상태: 비활성 (7일간 스킵)
- 일일 비용: 0 units

**총 일일 비용**: 1,515 units (기존 5,050 units 대비 **70% 절감**)

---

## ⚠️ 주의사항

1. **초기 3회 실행**: 모든 키워드가 처리되므로 정상 동작
2. **효율성 평가**: 3회 실행 후부터 효율성 기반 스킵 시작
3. **자동 재활성화**: 효율성이 개선되면 자동으로 재활성화됨
4. **수동 관리**: 필요시 SQL로 수동 관리 가능

---

**가장 중요한 작업**: `keyword_performance` 테이블 생성만 하면 자동으로 작동합니다! 🎉

