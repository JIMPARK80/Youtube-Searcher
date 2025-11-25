# Supabase API 호출 비용 분석

## 💰 Supabase 가격 정책

### Free Tier (무료)
- **Database Size**: 500 MB
- **API Requests**: **무제한** ✅
- **Database Egress**: 5 GB/월
- **Bandwidth**: 5 GB/월

### Pro Tier ($25/월)
- **Database Size**: 8 GB
- **API Requests**: **무제한** ✅
- **Database Egress**: 50 GB/월
- **Bandwidth**: 250 GB/월

## 📊 현재 시스템의 Supabase API 호출 분석

### 1. 검색 시 호출 (1회 검색당)

#### 캐시 확인 및 로드
```javascript
// loadFromSupabase()
- search_cache SELECT: 1회
- videos SELECT: 1회
```
**총 2회 쿼리**

#### 새 검색 결과 저장
```javascript
// saveToSupabase()
- search_cache UPSERT: 1회
- videos DELETE: 1회
- videos INSERT (배치): 1회 (10개 영상)
- trackVideoIdsForViewHistory()
  - view_tracking_config SELECT: 1회
  - view_tracking_config UPDATE: 1회
```
**총 4-5회 쿼리**

### 2. VPH 계산 시 호출 (영상 카드당)

```javascript
// getRecentVelocityForVideo() - 각 비디오마다
- view_history SELECT (최근 2개): 1회
- view_history SELECT (최초 1개): 1회
```
**총 2회 쿼리 per video**

**예시**: 10개 영상 검색 시
- VPH 계산: 10 × 2 = **20회 쿼리**

### 3. View Tracking (1시간마다)

```javascript
// captureViewsForIds()
- YouTube API 호출 (50개씩 배치)
- view_history INSERT: 1회 (배치)
- view_history DELETE (정리): 영상당 2회
```
**총 약 3-5회 쿼리 per 50 videos**

## 📈 일일 API 호출 예상량

### 시나리오 1: 일반 사용자 (하루 10회 검색)
```
검색: 10회 × 5회 = 50회
VPH 계산: 10회 × 10개 × 2회 = 200회
View Tracking: 24회 × 3회 = 72회
─────────────────────────────
총: 약 322회/일
```

### 시나리오 2: 활발한 사용자 (하루 50회 검색)
```
검색: 50회 × 5회 = 250회
VPH 계산: 50회 × 10개 × 2회 = 1,000회
View Tracking: 24회 × 3회 = 72회
─────────────────────────────
총: 약 1,322회/일
```

### 시나리오 3: 다중 사용자 (10명, 각 10회 검색)
```
검색: 100회 × 5회 = 500회
VPH 계산: 100회 × 10개 × 2회 = 2,000회
View Tracking: 24회 × 3회 = 72회
─────────────────────────────
총: 약 2,572회/일
```

## ✅ 결론

### API 호출 비용
- **Supabase Free Tier**: **API 요청 무제한** ✅
- **비용 발생 없음**: API 호출 자체는 무료

### 주의사항

#### 1. Database Egress (데이터 전송량)
- Free Tier: 5 GB/월
- 현재 시스템: 매우 적음 (텍스트 데이터 위주)
- **위험도: 낮음** ✅

#### 2. Database Size (저장 용량)
- Free Tier: 500 MB
- 현재 예상: ~48 MB (240,000개 스냅샷)
- **여유 있음** ✅

#### 3. Bandwidth (대역폭)
- Free Tier: 5 GB/월
- 현재 시스템: 매우 적음
- **위험도: 낮음** ✅

## 🎯 최적화 권장사항

### 1. VPH 쿼리 최적화 (이미 적용됨)
- ✅ LocalStorage 캐시 (5분 TTL)
- ✅ 복합 인덱스 사용
- ✅ 배치 쿼리 최소화

### 2. 추가 최적화 가능
- VPH 데이터를 한 번에 여러 영상 조회 (배치 쿼리)
- VPH 계산 결과를 더 오래 캐싱 (현재 5분 → 10분)

### 3. 모니터링
- Supabase Dashboard에서 API 호출량 확인
- Database Size 모니터링
- Egress 사용량 확인

## 📝 요약

| 항목 | Free Tier | 현재 사용량 | 상태 |
|------|-----------|------------|------|
| API Requests | 무제한 | ~1,000-3,000/일 | ✅ 안전 |
| Database Size | 500 MB | ~48 MB | ✅ 여유 |
| Egress | 5 GB/월 | 매우 적음 | ✅ 안전 |
| Bandwidth | 5 GB/월 | 매우 적음 | ✅ 안전 |

**결론: Supabase API 호출은 무료이며, 현재 사용량은 Free Tier 범위 내입니다.** ✅

