# 🧠 🔥 Smart Keyword Filtering - 지능형 키워드 필터링 시스템

가장 강력한 다음 단계 업그레이드: 효율이 낮은 키워드에 API 낭비를 막고, 인기 높은 키워드만 집중 추적하는 지능형 시스템.

## 🎯 왜 필요한가?

### 문제 상황

**50개 키워드 중**:
- **상위 10~15개**: 매일 새 영상 쏟아짐 (고효율)
- **나머지 35~40개**: 중복률 80~100% (저효율)

**현재 문제**:
- 72시간 TTL이 있어도 롱테일 키워드는 거의 변화 없음
- 72시간마다 search 100 units 낭비
- 전체 search 비용의 30~50%가 롱테일 키워드에서 날아감

### 해결책

**Smart Keyword Filtering**:
- 키워드별 효율성 자동 추적
- 효율이 낮은 키워드 자동 스킵
- 효율이 높은 키워드만 집중 추적

---

## 🔧 구현 방식

### 1. 키워드별 성능 추적 테이블

**테이블**: `keyword_performance`

**추적 데이터**:
- `total_runs`: 총 실행 횟수
- `total_videos_found`: 총 발견된 영상 수
- `total_videos_added`: 총 추가된 영상 수
- `total_videos_updated`: 총 업데이트된 영상 수
- `last_new_video_ratio`: 마지막 실행의 신규 영상 비율
- `average_new_video_ratio`: 평균 신규 영상 비율
- `efficiency_score`: 효율성 점수 (0.0 ~ 1.0)
- `is_active`: 활성 상태
- `skip_until`: 스킵 종료 시간

### 2. 효율성 점수 계산

**계산 방식**:
```
신규 영상 비율 = 추가된 영상 수 / 발견된 영상 수
평균 신규 영상 비율 = (이전 평균 × (실행 횟수 - 1) + 현재 비율) / 실행 횟수
효율성 점수 = 평균 신규 영상 비율
```

**예시**:
- 키워드 A: 50개 발견, 10개 추가 → 비율 20% (고효율)
- 키워드 B: 50개 발견, 1개 추가 → 비율 2% (저효율)

### 3. 자동 스킵 로직

**스킵 조건**:
1. 최소 실행 횟수: 3회 이상 (평가 가능)
2. 효율성 점수: 10% 미만 (MIN_EFFICIENCY_SCORE = 0.1)
3. 스킵 기간: 7일 (LOW_EFFICIENCY_SKIP_HOURS = 168)

**스킵 프로세스**:
```
1. 키워드 실행
2. 통계 업데이트
3. 효율성 점수 계산
4. 효율성 점수 < 10%?
   ├─ Yes → skip_until 설정 (7일 후), is_active = false
   └─ No → 정상 처리
```

### 4. 자동 재활성화

**재활성화 조건**:
- 효율성 점수가 10% 이상으로 개선되면 자동 재활성화
- `is_active = true`, `skip_until = null`

---

## 📊 예상 효과

### 시나리오: 50개 키워드

**고효율 키워드 (15개)**:
- 효율성: 20~50%
- 처리: 정상 처리
- 일일 비용: 15 × 101 = 1,515 units

**저효율 키워드 (35개)**:
- 효율성: 0~10%
- 처리: 자동 스킵 (7일간)
- 일일 비용: 0 units (스킵됨)

**총 일일 비용**:
- 변경 전: 50 × 101 = 5,050 units
- 변경 후: 15 × 101 = 1,515 units
- **절감**: 3,535 units (70% 절감)

### 월간 효과

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|--------|--------|------|
| **일일 비용** | 5,050 units | 1,515 units | 70% |
| **월간 비용** | 151,500 units | 45,450 units | 106,050 units |

---

## 🎛️ 설정 가능한 파라미터

### 현재 설정

```typescript
const MIN_EFFICIENCY_SCORE = 0.1; // 최소 효율성 점수 (10%)
const LOW_EFFICIENCY_SKIP_HOURS = 168; // 스킵 기간 (7일)
const MIN_RUNS_FOR_EVALUATION = 3; // 평가 최소 실행 횟수
```

### 조정 방법

**더 엄격한 필터링** (더 많은 키워드 스킵):
```typescript
const MIN_EFFICIENCY_SCORE = 0.15; // 15% 이상만 처리
const LOW_EFFICIENCY_SKIP_HOURS = 336; // 14일간 스킵
```

**더 관대한 필터링** (더 적은 키워드 스킵):
```typescript
const MIN_EFFICIENCY_SCORE = 0.05; // 5% 이상만 처리
const LOW_EFFICIENCY_SKIP_HOURS = 72; // 3일간 스킵
```

---

## 📈 모니터링 및 관리

### 키워드 효율성 확인

```sql
-- 모든 키워드의 효율성 확인
SELECT 
    keyword,
    total_runs,
    efficiency_score * 100 as efficiency_percent,
    total_videos_added,
    total_videos_found,
    is_active,
    skip_until,
    last_run_at
FROM keyword_performance
ORDER BY efficiency_score DESC;
```

### 저효율 키워드 확인

```sql
-- 저효율 키워드 목록
SELECT 
    keyword,
    efficiency_score * 100 as efficiency_percent,
    total_runs,
    is_active,
    skip_until
FROM keyword_performance
WHERE efficiency_score < 0.1
   OR is_active = false
ORDER BY efficiency_score ASC;
```

### 수동 재활성화

```sql
-- 특정 키워드 수동 재활성화
UPDATE keyword_performance
SET 
    is_active = true,
    skip_until = null,
    updated_at = NOW()
WHERE keyword = '키워드명';
```

### 수동 비활성화

```sql
-- 특정 키워드 수동 비활성화
UPDATE keyword_performance
SET 
    is_active = false,
    skip_until = NOW() + INTERVAL '30 days',
    updated_at = NOW()
WHERE keyword = '키워드명';
```

---

## 🔄 동작 흐름

### 첫 실행 (초기 구축)

```
1. 모든 키워드 처리 (효율성 평가 불가)
2. 통계 기록 시작
3. 모든 키워드 활성 상태
```

### 3회 실행 후 (평가 시작)

```
1. 각 키워드의 효율성 점수 계산
2. 효율성 점수 < 10%?
   ├─ Yes → 7일간 스킵, is_active = false
   └─ No → 정상 처리 계속
```

### 정상 운영

```
매일 오전 3시 실행:
1. 캐시 확인 (72시간 TTL)
2. 효율성 확인 (저효율 키워드 스킵)
3. 활성 키워드만 API 호출
4. 통계 업데이트
5. 효율성 재평가
```

---

## 📊 최종 효과 요약

### API Quota 절감

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|--------|--------|------|
| **Search Keyword Updater** | 5,050 units/day | 1,515 units/day | **70%** |
| **총 일일 사용량** | 7,750 units | **4,383 units** | **43%** |
| **안전 마진** | 22.5% | **56.2%** | **+33.7%p** |

### 데이터 품질

- ✅ 고효율 키워드만 집중 추적
- ✅ 신규 영상 발견률 향상
- ✅ 불필요한 중복 처리 제거

---

## 🎯 권장 사항

1. **초기 실행**: 모든 키워드 활성화하여 최소 3회 실행
2. **모니터링**: 주기적으로 효율성 점수 확인
3. **조정**: 필요시 MIN_EFFICIENCY_SCORE 조정
4. **수동 관리**: 특정 키워드는 수동으로 활성/비활성화 가능

---

## 🚀 다음 단계

1. **키워드 성능 테이블 생성**: `supabase/schema.sql` 실행
2. **Edge Function 배포**: `search-keyword-updater` 재배포
3. **모니터링 시작**: 효율성 점수 추적 시작

이제 시스템이 자동으로 효율적인 키워드만 추적합니다! 🎉

