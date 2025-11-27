# 🧨 API Quota 최적화: 중복 호출 방지

## ⚠️ 중요한 사실

**YouTube API Quota는 API 호출을 할 때마다 무조건 소모됩니다.**

- ✅ API 호출을 **건너뛸 때만** quota를 절약할 수 있음
- ❌ API를 호출한 순간 quota는 무조건 소모됨 (결과가 중복이든 아니든)
- ❌ 작은 수를 호출했더니 모두 중복 → **데이터 축적 없음, API만 소모**

---

## 🔍 현재 시스템의 문제점

### Search Keyword Updater의 동작

**현재 설정**:
- 캐시 TTL: 24시간
- 실행 주기: 매일 오전 3시
- 검색어: 50개

**문제 시나리오**:
```
1. 매일 오전 3시에 실행
2. 캐시가 24시간 이상 지났으면 API 호출
3. 50개 검색어 × (search.list + videos.list) = 5,050 units 소모
4. 결과: 모든 영상이 이미 데이터베이스에 있음 (중복)
5. 결과: 데이터 축적 없음, API quota만 소모됨
```

**실제 비용**:
- 매일 5,050 units 소모
- 실제로는 새 영상이 거의 없을 수 있음
- **낭비**: 중복 결과에 대한 quota 소모

---

## ✅ 해결 방안

### 방안 1: 캐시 TTL 연장 (가장 효과적) ⭐

**현재**: 24시간 TTL
**권장**: 48시간 또는 72시간 TTL

**효과**:
- API 호출 빈도 감소
- Quota 절약
- 검색어 결과는 하루에 크게 변하지 않으므로 안전

**구현**:
```typescript
// supabase/functions/search-keyword-updater/index.ts
const CACHE_TTL_HOURS = 72; // 24 → 72로 변경
```

**비용 절감**:
- 현재: 매일 5,050 units
- 72시간 TTL: 3일에 1회 = 일일 평균 1,683 units
- **절감**: 67% 절약

### 방안 2: 검색어별 개별 캐시 관리

**개념**: 각 검색어마다 마지막 업데이트 시간을 추적

**장점**:
- 활발한 검색어는 자주 업데이트
- 비활발한 검색어는 덜 자주 업데이트
- Quota 효율적 사용

**구현 예시**:
```typescript
// 각 검색어의 마지막 업데이트 시간 확인
const { data: cacheData } = await supabase
  .from("search_cache")
  .select("updated_at")
  .eq("keyword", keyword)
  .maybeSingle();

const cacheAge = Date.now() - new Date(cacheData.updated_at).getTime();
const cacheAgeHours = cacheAge / (1000 * 60 * 60);

// 검색어별 다른 TTL 적용
const keywordTTL = getKeywordTTL(keyword); // 활발한 검색어는 짧게, 비활발한 검색어는 길게
if (cacheAgeHours < keywordTTL) {
  continue; // 스킵
}
```

### 방안 3: 신규 영상 비율 기반 스킵

**개념**: 이전 실행에서 신규 영상이 거의 없었으면 다음 실행 스킵

**구현 예시**:
```typescript
// 이전 실행 결과 확인
const lastRunResult = await getLastRunResult(keyword);
if (lastRunResult && lastRunResult.newVideosRatio < 0.1) {
  // 신규 영상이 10% 미만이면 스킵
  console.log(`⏭️ Skipping "${keyword}" - low new video ratio`);
  continue;
}
```

### 방안 4: 수동 트리거 방식

**개념**: 자동 실행을 줄이고 필요할 때만 수동 실행

**장점**:
- 완전한 제어
- Quota 절약 극대화

**단점**:
- 수동 관리 필요
- 자동화 장점 상실

---

## 📊 최적화 시나리오 비교

### 현재 설정 (24시간 TTL)

| 항목 | 값 |
|------|-----|
| 실행 주기 | 매일 오전 3시 |
| 일일 API 사용량 | 5,050 units |
| 월간 API 사용량 | 151,500 units |
| 중복 호출 가능성 | 높음 (매일 실행) |

### 최적화 후 (72시간 TTL)

| 항목 | 값 |
|------|-----|
| 실행 주기 | 3일에 1회 (평균) |
| 일일 API 사용량 | 1,683 units (평균) |
| 월간 API 사용량 | 50,500 units |
| 중복 호출 가능성 | 낮음 (3일에 1회) |
| **절감률** | **67%** |

### 최적화 후 (검색어별 개별 TTL)

| 항목 | 값 |
|------|-----|
| 실행 주기 | 검색어별 다름 |
| 일일 API 사용량 | 1,000~2,000 units (예상) |
| 월간 API 사용량 | 30,000~60,000 units |
| 중복 호출 가능성 | 매우 낮음 |
| **절감률** | **60~80%** |

---

## 🎯 권장 최적화 전략

### 단계 1: 캐시 TTL 연장 (즉시 적용 가능) ⭐

**변경 사항**:
```typescript
const CACHE_TTL_HOURS = 72; // 24 → 72
```

**효과**:
- 즉시 67% quota 절약
- 구현 간단
- 리스크 낮음

### 단계 2: 검색어별 개별 TTL (선택사항)

**활발한 검색어** (예: "인생사연", "영어회화"):
- TTL: 24시간
- 자주 업데이트

**비활발한 검색어** (예: "노년이야기", "요양원사연"):
- TTL: 168시간 (7일)
- 덜 자주 업데이트

### 단계 3: 신규 영상 비율 모니터링

**추가 기능**:
- 각 실행마다 신규 영상 비율 기록
- 비율이 낮으면 다음 실행 스킵
- 비율이 높으면 정상 실행

---

## 📝 구현 예시

### 캐시 TTL 연장

```typescript
// supabase/functions/search-keyword-updater/index.ts
const CACHE_TTL_HOURS = 72; // 24 → 72로 변경

// 캐시 확인 로직 (기존과 동일)
const cacheAge = Date.now() - new Date(cacheData.updated_at).getTime();
const cacheAgeHours = cacheAge / (1000 * 60 * 60);

if (cacheAgeHours < CACHE_TTL_HOURS) {
  console.log(`⏭️ Skipping "${keyword}" - cache is still fresh (${cacheAgeHours.toFixed(1)}h old)`);
  continue;
}
```

### 검색어별 개별 TTL

```typescript
// 검색어별 TTL 설정
const KEYWORD_TTL_MAP: Record<string, number> = {
  '인생사연': 24,      // 활발한 검색어: 24시간
  '영어회화': 24,
  '감동사연': 48,      // 보통: 48시간
  '노년이야기': 168,   // 비활발: 7일
  '요양원사연': 168,
};

function getKeywordTTL(keyword: string): number {
  return KEYWORD_TTL_MAP[keyword.toLowerCase()] || 72; // 기본값: 72시간
}

// 사용
const keywordTTL = getKeywordTTL(keyword);
if (cacheAgeHours < keywordTTL) {
  continue;
}
```

---

## ⚠️ 주의사항

### 캐시 TTL을 너무 길게 하면

**문제점**:
- 최신 영상을 놓칠 수 있음
- 검색 결과가 오래됨

**권장**:
- 최대 7일 (168시간) 이내
- 활발한 검색어는 24~48시간
- 비활발한 검색어는 72~168시간

### 검색어별 TTL 관리

**복잡도**:
- 검색어가 많아지면 관리 복잡
- 자동화 필요할 수 있음

**대안**:
- 모든 검색어에 동일한 TTL 적용 (72시간)
- 간단하고 효과적

---

## 📊 최종 권장사항

### 즉시 적용 (권장) ⭐

1. **캐시 TTL을 72시간으로 연장**
   - 구현 간단
   - 즉시 67% quota 절약
   - 리스크 낮음

2. **실행 주기 조정**
   - 현재: 매일 오전 3시
   - 권장: 3일에 1회 또는 캐시 기반 (72시간 TTL)

### 장기 개선 (선택사항)

1. **검색어별 개별 TTL**
2. **신규 영상 비율 기반 스킵**
3. **수동 트리거 옵션 추가**

---

## 🎯 결론

**핵심 원칙**:
- ❌ API 호출을 하면 quota는 무조건 소모됨
- ✅ API 호출을 건너뛸 때만 quota를 절약할 수 있음
- ✅ 캐시 TTL 연장이 가장 효과적인 방법

**즉시 적용 가능한 최적화**:
- 캐시 TTL: 24시간 → **72시간**
- 일일 quota 절감: **67%**
- 월간 quota 절감: **101,000 units**

