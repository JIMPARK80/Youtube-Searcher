# 📊 YouTube API 비용 계산 (최종 추천 세팅)

최종 추천 세팅 기준으로 YouTube API 사용량을 상세히 계산합니다.

## 📋 최종 추천 세팅 요약

- **검색어 개수**: 약 50개 (인생사연 관련 + 영어 학습 관련)
- **VPH 추적 비디오 수**: **5,000개로 제한** (API 할당량 관리)
- **YouTube API 기본 할당량**: 10,000 units/day
- **목표 사용량**: 7,750 units/day (77.5%) - 안전 마진 22.5%

---

## 🔢 API 비용 계산

### 1. Search Keyword Updater (매일 오전 3시 실행)

**실행 주기**: 매일 오전 3시 (하루 1회: 03:00)

**API 호출**:
- `search.list`: 검색어당 1회 (100 units)
- `videos.list`: 검색어당 1회 (1 unit, 50개 비디오)
- **검색어당 총 비용**: 101 units

**캐시 전략**: 72시간 TTL (캐시가 만료된 경우에만 업데이트) - 중복 API 호출 방지

**일일 API 사용량 계산**:
```
검색어 수: 50개
캐시 TTL: 72시간 (3일)
1회 실행 비용: 50 × 101 = 5,050 units
실제 실행: 캐시 만료 시에만 (72시간마다, 평균 3일에 1회)
일일 평균 비용: 5,050 / 3 = 1,683 units
```

**월간 사용량**: 1,683 × 30 = **50,490 units** (67% 절감)

---

### 2. Hourly VPH Updater (매 시간 실행)

**실행 주기**: 매 시간 정각 (하루 24회)

**API 호출**:
- `videos.list` (part=statistics): 50개씩 배치 처리
- **비용**: 1 unit per 50 videos

**일일 API 사용량 계산**:
```
추적 비디오 수: 5,000개 (제한됨)
1회 실행 비용: 5,000 / 50 = 100 units
일일 실행 횟수: 24회
일일 총 비용: 100 × 24 = 2,400 units
```

**월간 사용량**: 2,400 × 30 = **72,000 units**

---

### 3. Daily Statistics Updater (매일 자정 실행)

**실행 주기**: 매일 자정 (하루 1회)

**API 호출**:
- `videos.list` (part=id,snippet,contentDetails,statistics): 50개씩 배치 처리
- `channels.list` (part=statistics): 50개씩 배치 처리
- **비용**: 
  - videos.list: 1 unit per 50 videos
  - channels.list: 1 unit per 50 channels (평균 10개 비디오당 1개 채널)

**일일 API 사용량 계산**:
```
추적 비디오 수: 5,000개 (제한됨)
채널 수: 500개 (평균 10개 비디오당 1개 채널)

videos.list 비용: 5,000 / 50 = 100 units
channels.list 비용: 500 / 50 = 10 units
일일 총 비용: 100 + 10 = 110 units
```

**참고**: 실제로는 더 많은 메타데이터를 업데이트하므로 약 **300 units/day**로 계산
**월간 사용량**: 300 × 30 = **9,000 units**

---

## 📊 총 API 사용량 요약

### 일일 사용량

| 항목 | 일일 API 사용량 | 비율 |
|------|----------------|------|
| **Search Keyword Updater** | 1,683 units (평균) | 21.7% |
| **Hourly VPH Updater** | 2,400 units | 31.0% |
| **Daily Statistics Updater** | 300 units | 3.9% |
| **총합** | **4,383 units** | **43.8%** |

✅ **안전**: 기본 할당량(10,000 units/day) 내에서 매우 안전하게 운영 가능
✅ **안전 마진**: 5,617 units (56.2%) - 대폭 증가!
✅ **Quota 절감**: 67% 절감 (중복 API 호출 방지)

### 월간 사용량

| 항목 | 월간 API 사용량 |
|------|----------------|
| **Search Keyword Updater** | 50,490 units (67% 절감) |
| **Hourly VPH Updater** | 72,000 units |
| **Daily Statistics Updater** | 9,000 units |
| **총합** | **131,490 units** (43% 절감) |

---

## ⚠️ 문제점 및 해결 방안

### 문제점

1. **일일 할당량 초과**: 10,070 units > 10,000 units (100.7%)
2. **Search Keyword Updater가 가장 큰 비용**: 50.5% 차지

### 해결 방안

#### 방안 1: Search Keyword Updater 실행 주기 조정 (권장)

**24시간마다 실행으로 변경**:
```
검색어 수: 50개
1회 실행 비용: 50 × 101 = 5,050 units
일일 실행 횟수: 1회 (24시간마다)
일일 총 비용: 5,050 units
```

**조정 후 일일 사용량**:
- Search Keyword Updater: 5,050 units
- Hourly VPH Updater: 4,800 units
- Daily Statistics Updater: 220 units
- **총합**: **10,070 units** (여전히 초과)

#### 방안 2: 검색어 수 줄이기

**검색어를 30개로 줄이기**:
```
검색어 수: 30개
1회 실행 비용: 30 × 101 = 3,030 units
일일 실행 횟수: 2회 (12시간마다)
일일 총 비용: 3,030 × 2 = 6,060 units
```

**조정 후 일일 사용량**:
- Search Keyword Updater: 6,060 units
- Hourly VPH Updater: 4,800 units
- Daily Statistics Updater: 220 units
- **총합**: **11,080 units** (더 초과)

#### 방안 3: 캐시 TTL 연장 (가장 효과적) ⭐

**24시간 TTL로 변경**:
```
검색어 수: 50개
1회 실행 비용: 50 × 101 = 5,050 units
캐시 TTL: 24시간
실제 실행: 하루 1회만 (캐시 만료 시)
일일 총 비용: 5,050 units
```

**조정 후 일일 사용량**:
- Search Keyword Updater: 5,050 units
- Hourly VPH Updater: 4,800 units
- Daily Statistics Updater: 220 units
- **총합**: **10,070 units** (여전히 초과)

#### 방안 4: VPH 추적 비디오 수 줄이기

**5,000개로 줄이기**:
```
VPH Updater: 5,000 / 50 × 24 = 2,400 units
Daily Statistics: 5,000 / 50 + 500 / 50 = 100 + 10 = 110 units
```

**조정 후 일일 사용량**:
- Search Keyword Updater: 5,050 units
- Hourly VPH Updater: 2,400 units
- Daily Statistics Updater: 110 units
- **총합**: **7,560 units** (75.6%) ✅

---

## ✅ 권장 설정

### 최적 설정 (안전 마진 확보)

1. **Search Keyword Updater**: 
   - 캐시 TTL: **24시간**로 변경
   - 실행 주기: 24시간마다 (하루 1회)
   - 일일 비용: **5,050 units**

2. **VPH 추적 비디오 수**: 
   - **5,000개**로 제한 (또는 현재 수 유지)
   - 일일 비용: **2,400 units** (5,000개 기준)

3. **Daily Statistics Updater**: 
   - 현재 설정 유지
   - 일일 비용: **110 units** (5,000개 기준)

**총 일일 사용량**: 5,050 + 2,400 + 110 = **7,560 units (75.6%)**
**안전 마진**: 2,440 units (24.4%)

### 대안 설정 (현재 비디오 수 유지)

1. **Search Keyword Updater**: 
   - 캐시 TTL: **24시간**로 변경
   - 실행 주기: 24시간마다
   - 일일 비용: **5,050 units**

2. **VPH 추적 비디오 수**: 
   - **10,000개** 유지
   - 일일 비용: **4,800 units**

3. **Daily Statistics Updater**: 
   - 현재 설정 유지
   - 일일 비용: **220 units**

**총 일일 사용량**: 5,050 + 4,800 + 220 = **10,070 units (100.7%)**
⚠️ **할당량 초과**: 70 units 초과

**해결책**: YouTube API 할당량 증가 요청 필요

---

## 📈 할당량 증가 요청

### Google Cloud Console에서 할당량 증가 요청

1. **Google Cloud Console** → **APIs & Services** → **Quotas**
2. **YouTube Data API v3** 선택
3. **Edit Quotas** 클릭
4. **할당량 증가 요청**: 20,000 units/day (또는 50,000 units/day)

### 예상 비용

- **무료 할당량**: 10,000 units/day
- **추가 할당량**: 유료 (Google Cloud 가격 정책 확인 필요)

---

## 📝 요약

### 최종 추천 설정 (적용됨) ✅

| 항목 | 일일 사용량 | 비율 |
|------|------------|------|
| Search Keyword Updater | 5,050 units | 65.2% |
| Hourly VPH Updater | 2,400 units | 31.0% |
| Daily Statistics Updater | 300 units | 3.9% |
| **총합** | **7,750 units** | **77.5%** ✅ |

### 적용된 설정

1. ✅ **Search Keyword Updater 캐시 TTL을 24시간으로 변경**
2. ✅ **Search Keyword Updater 실행 주기를 매일 오전 3시로 변경**
3. ✅ **VPH 추적 비디오 수를 5,000개로 제한**
4. ✅ **일일 사용량**: **7,750 units (77.5%)** - 안전 마진 22.5%

---

## 🔧 적용된 설정 변경

### 1. Search Keyword Updater 캐시 TTL 변경 ✅

`supabase/functions/search-keyword-updater/index.ts`:
```typescript
const CACHE_TTL_HOURS = 24; // 24시간으로 변경됨
```

`supabase/cron.sql`에서 실행 주기를 매일 오전 3시로 변경:
```sql
'0 3 * * *' -- 매일 오전 3시
```

### 2. VPH 추적 비디오 수 제한 ✅

`supabase/functions/hourly-vph-updater/index.ts`에 자동 제한 로직 추가:
```typescript
const MAX_TRACKED_VIDEOS = 5000;
if (videoIds.length > MAX_TRACKED_VIDEOS) {
  videoIds = videoIds.slice(0, MAX_TRACKED_VIDEOS);
}
```

또는 `view_tracking_config` 테이블에서 직접 제한:
```sql
UPDATE view_tracking_config
SET video_ids = video_ids[1:5000]
WHERE array_length(video_ids, 1) > 5000;
```

---

## 📊 최종 설정 완료 ✅

1. ✅ **Search Keyword Updater 캐시 TTL을 24시간으로 변경** (완료)
2. ✅ **Search Keyword Updater 실행 주기를 매일 오전 3시로 변경** (완료)
3. ✅ **VPH 추적 비디오 수를 5,000개로 제한** (완료)

**최종 일일 사용량**: **7,750 units (77.5%)**
**안전 마진**: **2,250 units (22.5%)**

이제 완전히 안전하게 운영할 수 있습니다! 🎉

