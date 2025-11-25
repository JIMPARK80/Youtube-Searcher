# 📋 초기 설치부터 현재까지 작업 내역

## 🚀 1단계: 초기 Supabase 설정

### 1.1 Supabase 프로젝트 생성
- Supabase Dashboard에서 새 프로젝트 생성
- Project URL과 anon key 복사

### 1.2 기본 스키마 생성
**파일**: `supabase/schema.sql`

**실행 순서**:
1. Supabase Dashboard → SQL Editor
2. `supabase/schema.sql` 파일 내용 복사하여 실행

**생성된 테이블**:
- `videos` - 검색 결과 캐시
- `view_history` - VPH 추적용 조회수 스냅샷
- `search_cache` - 검색 결과 메타데이터
- `view_tracking_config` - 자동 추적 설정
- `users` - 사용자 정보
- `config` - API 키 등 설정

**RLS 정책**:
- 모든 테이블에 Row Level Security 활성화
- 공개 읽기 정책 설정

---

## 🔧 2단계: 스키마 수정 및 보완

### 2.1 누락된 컬럼 추가
**파일**: `supabase/fix-schema.sql`

**추가된 컬럼**:
- `search_cache.cache_version` - 캐시 버전 관리
- `videos.channel_id` - 채널 ID
- `videos.channel_title` - 채널 제목
- `videos.keyword` - 검색어

**실행**: Supabase SQL Editor에서 `fix-schema.sql` 실행

### 2.2 View History RLS 정책 수정
**파일**: `supabase/fix-view-history-rls.sql`

**변경 사항**:
- `view_history` 테이블의 SELECT 정책을 "누구나 읽기 가능"으로 변경
- VPH 계산을 위해 공개 읽기 필요

---

## 👥 3단계: 구독자 수 데이터 추가

### 3.1 구독자 수 컬럼 추가
**파일**: `supabase/add-subscriber-count.sql`

**SQL 쿼리**:
```sql
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS subscriber_count BIGINT;

CREATE INDEX IF NOT EXISTS idx_videos_subscriber_count ON videos(subscriber_count);
```

**실행**: Supabase SQL Editor에서 실행

### 3.2 JavaScript 코드 수정
**파일**: `js/supabase-api.js`

**변경 사항**:
- `saveToSupabase()` 함수에 `subscriber_count` 저장 로직 추가
- 기존 구독자 수 우선 사용 (서버 데이터 우선)
- 숨겨진 구독자 수는 `-1`로 저장

**파일**: `js/ui.js`

**변경 사항**:
- `restoreFromCache()` 함수에서 구독자 수 복원 로직 개선
- Supabase → 로컬 캐시 → 채널 정보 순서로 우선순위 설정

---

## 🔄 4단계: NULL 데이터 자동 업데이트

### 4.1 NULL 데이터 업데이트 함수 추가
**파일**: `js/supabase-api.js`

**함수**: `updateMissingData()`

**기능**:
- `videos` 테이블에서 NULL 필드 찾기
- YouTube API로 데이터 가져와서 업데이트
- 최대 2회 시도 후 계속 NULL이면 스킵
- 구독자 수, 조회수, 좋아요 수 등 모든 NULL 필드 처리

### 4.2 백그라운드 자동 업데이트
**파일**: `js/ui.js`

**함수**: `updateMissingDataInBackground()`

**기능**:
- 검색 완료 후 2초 뒤 자동 실행
- 현재 검색어의 비디오 우선 업데이트
- 중복 실행 방지 플래그 추가

---

## 📊 5단계: VPH 계산 및 정렬 개선

### 5.1 VPH 계산 로직 개선
**파일**: `js/ui.js`

**변경 사항**:
- `vphCalculatedVideos` Set으로 중복 계산 방지
- `vphRetryCount` Map으로 재시도 횟수 추적
- 데이터 부족 시 최대 3번 재시도 (5초 간격)
- 3번 실패 후 VPH를 0으로 표시

### 5.2 전역 정렬 구현
**파일**: `js/ui.js`

**변경 사항**:
- `renderPage()` 함수에서 `allItems` 전체 정렬 후 페이지네이션
- 모든 페이지에서 올바른 정렬 순서 유지
- VPH 계산 완료 후 자동 재정렬

### 5.3 반응 속도 개선
**변경 사항**:
- VPH 계산 완료 후 재정렬 확인: 1초 → 0.5초
- 재확인 딜레이: 2초 → 1초

---

## 🖼️ 6단계: 이미지 Fallback 처리

### 6.1 썸네일 이미지 Fallback
**파일**: `js/ui.js`

**변경 사항**:
- 이미지 로드 실패 시 자동 fallback 체인 구현
- Fallback 순서: maxres → high → default → hqdefault → mqdefault → default
- 모든 fallback 실패 시 이미지 숨김 처리
- 404 에러 및 UI 깜빡임 방지

---

## 📈 7단계: 영상 호출 개수 증가

### 7.1 최대 결과 개수 증가
**파일**: `js/api.js`, `js/supabase-api.js`

**변경 사항**:
- `MAX_RESULTS`: 10개 → 30개
- `searchYouTubeAPI()` 함수 수정

### 7.2 증분 검색 기능 추가
**파일**: `js/ui.js`

**함수**: `performIncrementalFetch()`

**기능**:
- 캐시가 30개 미만일 때 부족한 만큼만 추가로 가져오기
- 기존 비디오 ID 추적하여 중복 제거
- 만료된 캐시도 30개로 채우기

**예시**:
- 캐시에 10개 → 20개 추가로 가져와서 총 30개
- 캐시에 20개 → 10개 추가로 가져와서 총 30개

---

## 📝 SQL 쿼리 실행 순서 요약

### 초기 설치 시 (최초 1회)
1. ✅ `supabase/schema.sql` - 기본 스키마 생성
2. ✅ `supabase/fix-schema.sql` - 누락된 컬럼 추가
3. ✅ `supabase/fix-view-history-rls.sql` - RLS 정책 수정

### 구독자 수 기능 추가 시
4. ✅ `supabase/add-subscriber-count.sql` - 구독자 수 컬럼 추가

### 선택적 (필요 시)
5. ⚠️ `supabase/update-subscriber-count.sql` - 기존 데이터 확인용 (실행 불필요)
6. ⚠️ `supabase/cron.sql` - 스케줄 작업 설정 (선택사항)

---

## 🔑 주요 JavaScript 파일 변경 내역

### `js/supabase-api.js`
- ✅ `saveToSupabase()` - 구독자 수 저장 로직 추가
- ✅ `loadFromSupabase()` - 구독자 수 로드 우선순위 개선
- ✅ `updateMissingData()` - NULL 데이터 자동 업데이트
- ✅ `getRecentVelocityForVideo()` - VPH 계산용 스냅샷 조회

### `js/ui.js`
- ✅ `search()` - 백그라운드 업데이트 호출 추가
- ✅ `restoreFromCache()` - 구독자 수 복원 로직 개선
- ✅ `renderPage()` - 전역 정렬 구현
- ✅ `executeVphCalculation()` - 재시도 로직 및 0 표시
- ✅ `performIncrementalFetch()` - 증분 검색 기능
- ✅ `createVideoCard()` - 이미지 fallback 처리

### `js/api.js`
- ✅ `searchYouTubeAPI()` - MAX_RESULTS 30으로 증가

---

## 🎯 현재 상태

### 완료된 기능
- ✅ Supabase 기본 스키마 설정
- ✅ 구독자 수 데이터 저장/로드
- ✅ NULL 데이터 자동 업데이트
- ✅ VPH 계산 및 정렬
- ✅ 이미지 fallback 처리
- ✅ 영상 호출 개수 30개로 증가
- ✅ 캐시 증분 검색 (10개 → 30개)

### 데이터베이스 상태
- `videos` 테이블: 구독자 수 컬럼 포함
- `search_cache` 테이블: cache_version 포함
- `view_history` 테이블: VPH 계산용 스냅샷 저장 중
- 모든 테이블: RLS 정책 설정 완료

### 성능 최적화
- ✅ 다단계 캐싱 (로컬 → Supabase → API)
- ✅ 백그라운드 업데이트로 검색 속도 향상
- ✅ VPH 계산 재시도 제한으로 무한 루프 방지
- ✅ 이미지 fallback으로 404 에러 감소

---

## 📌 다음 단계 (선택사항)

1. **기존 데이터 마이그레이션**
   - 10개로 저장된 캐시를 30개로 확장
   - NULL 구독자 수 데이터 업데이트

2. **모니터링**
   - VPH 계산 성공률 확인
   - API 호출 횟수 모니터링

3. **추가 최적화**
   - 인덱스 최적화
   - 쿼리 성능 개선

---

## 🔍 문제 해결 가이드

### 구독자 수가 표시되지 않을 때
1. `supabase/add-subscriber-count.sql` 실행 확인
2. 새로 검색하여 데이터 저장 확인
3. `updateMissingData()` 함수가 실행되는지 확인

### VPH가 "계산 중..."으로 멈출 때
- 3번 재시도 후 자동으로 0으로 표시됨
- `vphRetryCount` 확인

### 캐시가 10개로 남아있을 때
- 다음 검색 시 자동으로 30개로 확장됨
- `nextPageToken`이 있어야 확장 가능

---

**마지막 업데이트**: 2025-01-25
**버전**: 1.32

