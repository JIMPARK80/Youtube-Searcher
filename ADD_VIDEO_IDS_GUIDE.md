# 📹 키워드당 영상 데이터 ID 추가 가이드

## 현재 설정

- **저장 위치**: `videos` 테이블의 `keyword` 배열
- **VPH 추적**: `view_tracking_config.video_ids` 배열
- **자동 추가**: 검색 시 자동으로 `trackVideoIdsForViewHistory` 함수가 호출되어 추가됨

---

## 방법 1: 앱에서 자동 추가 (권장) ⭐

### 단계별 가이드

1. **앱 실행**
   - 브라우저에서 앱 열기

2. **검색창에 키워드 입력**
   - 예: "인생사연"

3. **최대 결과 수 설정**
   - 검색창 옆의 드롭다운에서 **130** 선택 (또는 원하는 개수)
   - 현재 100개가 있으면 130개로 설정

4. **검색 버튼 클릭**
   - 앱이 자동으로:
     - 기존 100개 확인
     - 부족한 30개 추가 검색
     - 중복 제거 후 저장
     - `videos` 테이블에 자동 추가
     - `view_tracking_config.video_ids`에 자동 추가

### 동작 원리

```javascript
// js/ui.js의 fetchAdditionalVideos 함수가 자동 실행
// 1. 기존 비디오 ID 확인
// 2. 필요한 개수만큼 추가 검색 (중복 제거)
// 3. Supabase에 자동 저장
// 4. view_tracking_config에 자동 추가
```

---

## 방법 2: SQL로 직접 추가

### 2.1 특정 키워드에 영상 추가

```sql
-- 1. 현재 키워드의 영상 개수 확인
SELECT 
    keyword,
    COUNT(*) as video_count
FROM videos
WHERE keyword @> ARRAY['인생사연']
GROUP BY keyword;

-- 2. 특정 영상 ID를 키워드에 추가
-- 예: video_id 'abc123'을 '인생사연' 키워드에 추가
UPDATE videos
SET keyword = array_append(keyword, '인생사연')
WHERE video_id = 'abc123'
  AND NOT (keyword @> ARRAY['인생사연']); -- 중복 방지
```

### 2.2 여러 영상 ID를 한 번에 추가

```sql
-- 여러 video_id를 배열로 지정하여 추가
UPDATE videos
SET keyword = array_append(keyword, '인생사연')
WHERE video_id = ANY(ARRAY['video_id_1', 'video_id_2', 'video_id_3'])
  AND NOT (keyword @> ARRAY['인생사연']);
```

### 2.3 view_tracking_config에도 추가

```sql
-- view_tracking_config의 video_ids 배열에 추가
UPDATE view_tracking_config
SET 
    video_ids = array(
        SELECT DISTINCT unnest(video_ids) || ARRAY['new_video_id_1', 'new_video_id_2']
    ),
    updated_at = NOW()
WHERE id = (SELECT id FROM view_tracking_config LIMIT 1);
```

---

## 방법 3: Edge Function으로 추가 (고급)

### 3.1 update-trending-videos 수정

`supabase/functions/update-trending-videos/index.ts`를 수정하여 특정 키워드로 더 많은 영상을 검색하도록 할 수 있습니다.

```typescript
// maxResults를 130으로 변경
url.searchParams.set("maxResults", "130");
```

### 3.2 수동 실행

1. **Supabase Dashboard** → **Edge Functions**
2. `update-trending-videos` 선택
3. **Invoke function** 클릭

---

## 확인 방법

### 현재 키워드의 영상 개수 확인

```sql
-- 특정 키워드의 영상 개수
SELECT 
    keyword,
    COUNT(*) as video_count
FROM videos
WHERE keyword @> ARRAY['인생사연']
GROUP BY keyword;

-- 전체 키워드별 영상 개수
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count
FROM videos
GROUP BY unnest(keyword)
ORDER BY video_count DESC;
```

### view_tracking_config 확인

```sql
-- VPH 추적 중인 비디오 개수
SELECT 
    array_length(video_ids, 1) as tracked_video_count,
    updated_at
FROM view_tracking_config
LIMIT 1;
```

---

## 주의사항

1. **중복 방지**: 앱이 자동으로 중복을 제거하지만, SQL로 직접 추가할 때는 `NOT (keyword @> ARRAY['키워드'])` 조건을 사용하세요.

2. **키워드 형식**: 키워드는 소문자로 저장됩니다 (`trim().toLowerCase()`).

3. **자동 VPH 추적**: `trackVideoIdsForViewHistory` 함수가 자동으로 `view_tracking_config.video_ids`에 추가하므로, 별도로 추가할 필요가 없습니다.

4. **캐시 갱신**: 새로운 영상을 추가한 후 앱에서 해당 키워드로 다시 검색하면 캐시가 갱신됩니다.

---

## 추천 방법

**가장 간단한 방법**: 방법 1 (앱에서 자동 추가)
- ✅ 자동 중복 제거
- ✅ 자동 저장
- ✅ VPH 추적 자동 추가
- ✅ UI에서 바로 확인 가능

**대량 추가가 필요한 경우**: 방법 2 (SQL)
- ✅ 빠른 대량 처리
- ✅ 스크립트로 자동화 가능

