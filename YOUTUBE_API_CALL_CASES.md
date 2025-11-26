# YouTube API 호출 케이스 정리

## 1. 전체 검색 (`performFullGoogleSearch`)

### 호출되는 경우:
1. **캐시가 전혀 없는 경우**
   - 로컬 캐시 없음
   - Supabase 캐시 없음
   - → `await performFullGoogleSearch(query, apiKeyValue)`

2. **Supabase 캐시가 만료된 경우 (72시간 경과)**
   - 캐시는 있지만 만료됨
   - `total_count < targetCount` (요청한 개수보다 부족)
   - `nextPageToken`이 없거나 토핑 모드가 아닌 경우
   - → `await performFullGoogleSearch(query, apiKeyValue)`

3. **Google 외 캐시 소스인 경우**
   - `cacheSource !== 'google'` (예: 'supa-cache', 'local-cache')
   - → `await performFullGoogleSearch(query, apiKeyValue)` (갱신)

## 2. 추가 비디오 가져오기 (`fetchAdditionalVideos`)

### 호출되는 경우:
1. **로컬 캐시가 부족한 경우**
   - `localCount < targetCount`
   - Supabase에도 부족한 경우
   - → `await fetchAdditionalVideos(query, apiKeyValue, neededCount, existingVideoIds)`

2. **Supabase 캐시가 부족한 경우**
   - `count < targetCount` (신선한 캐시)
   - `count < targetCount` (만료된 캐시)
   - → `await fetchAdditionalVideos(query, apiKeyValue, neededCount, existingVideoIds)`

## 3. 토핑 업데이트 (`performTopUpUpdate`)

### 호출되는 경우:
- Supabase 캐시가 만료됨 (72시간 경과)
- `count === 50` (정확히 50개)
- `meta.nextPageToken` 존재
   - → `await performTopUpUpdate(query, apiKeyValue, cacheData)`
   - → 추가 50개만 fetch (전체 재검색 대신)

## 4. NULL 데이터 업데이트 (`updateMissingData` - 백그라운드)

### 호출되는 경우:
- **검색 완료 후 백그라운드에서 자동 실행**
- `updateMissingDataInBackground(apiKeyValue, 50, query)`
- NULL 필드가 있는 비디오의 데이터만 업데이트
- 검색 성능에 영향 없음 (비동기)

## API 호출이 **생략**되는 경우:

### ✅ 캐시에 충분한 데이터가 있는 경우:
1. **로컬 캐시 사용**
   - `totalCount >= targetCount`
   - → API 호출 생략

2. **Supabase 캐시 사용 (신선함)**
   - `!isExpired && count > 0`
   - `totalCount >= targetCount`
   - → API 호출 생략

3. **Supabase 캐시 사용 (만료됨)**
   - `isExpired` (72시간 경과)
   - `totalCount >= targetCount`
   - → API 호출 생략, 캐시만 사용

### ⚠️ 할당량 초과 시:
- API 호출 시도 → `quotaExceeded` 에러
- → Supabase 캐시에서 모든 데이터 가져오기 (만료 여부 무시)
- → API 호출 중단

## 요약

| 상황 | API 호출 여부 | 함수 |
|------|-------------|------|
| 캐시 없음 | ✅ | `performFullGoogleSearch` |
| 캐시 만료 + 부족 | ✅ | `performFullGoogleSearch` |
| 캐시 부족 (일부) | ✅ | `fetchAdditionalVideos` |
| 캐시 충분 | ❌ | - |
| Google 외 캐시 | ✅ | `performFullGoogleSearch` (갱신) |
| 토핑 모드 | ✅ | `performTopUpUpdate` |
| NULL 데이터 업데이트 | ✅ | `updateMissingData` (백그라운드) |
| 할당량 초과 | ❌ | Supabase 캐시 사용 |

