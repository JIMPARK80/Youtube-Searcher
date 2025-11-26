# VPH 데이터 업데이트 메커니즘

## ✅ 네, VPH 관련 데이터는 1시간마다 업데이트됩니다.

## 업데이트 방식

### 1. 브라우저 측 폴백 (현재 활성화됨)
**파일**: `js/view-history.js`

- **초기화**: `main.js`에서 `initializeViewTrackingFallback()` 호출
- **주기**: `DEFAULT_INTERVAL_MINUTES = 60` (1시간)
- **동작 방식**:
  1. 브라우저가 열려있는 동안 1시간마다 자동 실행
  2. `view_tracking_config` 테이블의 `video_ids` 목록을 가져옴
  3. YouTube API를 호출하여 각 비디오의 현재 조회수(`view_count`)를 가져옴
  4. `view_history` 테이블에 스냅샷 저장
  5. 오래된 스냅샷 정리 (retention_hours, max_entries 기준)

**코드 위치**:
```javascript
// js/view-history.js
export async function initializeViewTrackingFallback() {
    const intervalMinutes = 60; // 1시간
    // ... 1시간마다 captureViewsForIds() 실행
}
```

### 2. Supabase Edge Function (서버 측)
**파일**: `supabase/functions/hourly-view-tracker/index.ts`

- **스케줄링**: `supabase/cron.sql`의 pg_cron을 통해 실행
- **주기**: `'0 * * * *'` (매 시간 정각, 0분)
- **동작 방식**:
  1. Supabase Edge Function이 1시간마다 자동 실행
  2. `view_tracking_config` 테이블에서 `video_ids` 가져옴
  3. YouTube API를 호출하여 조회수 가져옴
  4. `view_history` 테이블에 스냅샷 저장
  5. 오래된 스냅샷 정리

**설정 필요**:
- Supabase Edge Function 배포 필요
- pg_cron 설정 필요 (`supabase/cron.sql` 실행)

## 현재 상태

### ✅ 활성화됨
- **브라우저 측 폴백**: `main.js`에서 초기화됨
  - 브라우저가 열려있는 동안 작동
  - 사용자가 앱을 사용 중일 때만 업데이트

### ⚠️ 설정 필요
- **Supabase Edge Function**: 
  - Edge Function 배포 필요
  - pg_cron 설정 필요
  - 서버 측에서 항상 작동 (브라우저와 무관)

## VPH 계산

VPH는 `view_history` 테이블의 최근 2개 스냅샷을 사용하여 계산됩니다:

```javascript
// 최근 2개 스냅샷 가져오기
const snapshots = await fetchHistorySnapshots(videoId, 2);

// VPH 계산
const growth = latest.viewCount - previous.viewCount;
const diffHours = (latest.fetchedAt - previous.fetchedAt) / (1000 * 60 * 60);
const vph = growth / diffHours;
```

## 데이터 보관

- **retention_hours**: 기본 240시간 (10일)
- **max_entries**: 기본 240개 (10일치 스냅샷)
- 오래된 데이터는 자동으로 정리됨

## 요약

| 방식 | 주기 | 상태 | 비고 |
|------|------|------|------|
| 브라우저 폴백 | 1시간 | ✅ 활성화 | 브라우저가 열려있을 때만 |
| Supabase Edge Function | 1시간 | ⚠️ 설정 필요 | 서버 측, 항상 작동 |

**현재는 브라우저 측 폴백이 작동 중이며, 1시간마다 VPH 스냅샷이 생성됩니다.**

