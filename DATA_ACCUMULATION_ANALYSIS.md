# 데이터 누적 분석

## 현재 상황

### ✅ 중복 방지됨
- `video_id`가 **UNIQUE** 제약이 있음
- 같은 비디오는 **하나만** 저장됨
- `upsert`로 중복 저장 방지

### ⚠️ 문제점: keyword 덮어쓰기

**현재 스키마**:
```sql
video_id TEXT NOT NULL UNIQUE,  -- 같은 비디오는 하나만
keyword TEXT NOT NULL,           -- 단일 keyword만 저장
```

**문제 시나리오**:
1. "인생사연" 검색 → video_id "ABC123" 저장 (keyword="인생사연")
2. "뉴스" 검색 → 같은 video_id "ABC123" → **upsert로 keyword="뉴스"로 덮어쓰기**
3. 결과: 이전 keyword 정보 **사라짐** ❌

### 데이터 누적 방식

#### 1. 다른 비디오는 계속 추가됨
```
검색어: "인생사연"
- 1회: 100개 비디오 저장
- 2회: 같은 100개 → 업데이트만 (추가 안 됨)
- 3회: 새로운 20개 추가 검색 → 20개 추가 저장
→ 총 120개 비디오
```

#### 2. 같은 비디오는 업데이트만
```
video_id "ABC123":
- 1회 검색: keyword="인생사연" 저장
- 2회 검색: keyword="뉴스"로 덮어쓰기
- 결과: keyword="뉴스"만 남음 (이전 keyword 정보 손실)
```

## 현재 동작

### 저장 로직
```javascript
// saveToSupabase에서
upsert(batch, {
    onConflict: 'video_id',  // video_id 기준으로 업데이트
    ignoreDuplicates: false  // 기존 레코드 업데이트
})
```

### 결과
- ✅ 같은 `video_id`는 중복 저장 안 됨
- ❌ `keyword`는 마지막 검색어로 덮어쓰기됨
- ✅ 다른 비디오는 계속 추가됨

## 개선 방안

### 옵션 1: keyword를 배열로 저장 (권장)
```sql
-- keyword를 배열로 변경
ALTER TABLE videos 
ALTER COLUMN keyword TYPE TEXT[] USING ARRAY[keyword];

-- 여러 keyword 저장 가능
keyword = ['인생사연', '뉴스', '핫이슈']
```

**장점**:
- 이전 keyword 정보 보존
- 여러 검색어로 찾은 비디오 추적 가능

**단점**:
- 스키마 변경 필요
- 기존 데이터 마이그레이션 필요

### 옵션 2: 별도 테이블 (video_keywords)
```sql
CREATE TABLE video_keywords (
    video_id TEXT REFERENCES videos(video_id),
    keyword TEXT NOT NULL,
    PRIMARY KEY (video_id, keyword)
);
```

**장점**:
- 정규화된 구조
- 여러 keyword 관계 저장

**단점**:
- 조인 쿼리 필요
- 복잡도 증가

### 옵션 3: 현재 구조 유지
- 같은 비디오는 마지막 검색어만 저장
- 다른 비디오는 계속 추가
- 단순하고 빠름

## 현재 데이터 누적 패턴

### videos 테이블
- **다른 비디오**: 계속 추가됨 ✅
- **같은 비디오**: 업데이트만 (keyword 덮어쓰기) ⚠️

### view_history 테이블
- **1시간마다 스냅샷 추가**
- **10일 이상 오래된 데이터 자동 삭제** ✅
- **최대 240개 유지** ✅

### search_cache 테이블
- **검색어별 1개만** (UNIQUE keyword)
- **업데이트만** (추가 안 됨) ✅

## 결론

**현재 상태**:
- ✅ 중복 비디오는 저장 안 됨 (video_id UNIQUE)
- ⚠️ keyword는 마지막 검색어로 덮어쓰기됨
- ✅ 다른 비디오는 계속 추가됨
- ✅ view_history는 자동 정리됨

**데이터가 "쌓이는" 부분**:
- 다른 비디오들이 계속 추가되어 `videos` 테이블이 커짐
- 같은 비디오는 업데이트만 하므로 중복은 없음

**개선 필요**:
- keyword 정보 보존을 위해 배열 또는 별도 테이블 고려

