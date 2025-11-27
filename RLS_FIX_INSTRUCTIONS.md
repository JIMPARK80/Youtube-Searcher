# 🔧 RLS 정책 수정 가이드

## 문제
클라이언트에서 `videos` 테이블 데이터를 조회할 수 없습니다 (0개 반환).
Dashboard에서는 데이터가 보이지만, 클라이언트(anon key)에서는 접근이 차단되고 있습니다.

## 해결 방법

### 단계별 가이드

1. **Supabase Dashboard 접속**
   ```
   URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
   ```

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 **SQL Editor** 클릭
   - 또는 상단 메뉴에서 **SQL Editor** 선택

3. **새 쿼리 생성**
   - **New query** 버튼 클릭 (왼쪽 상단)
   - 또는 키보드 단축키: `Ctrl+N` (Windows) / `Cmd+N` (Mac)

4. **SQL 파일 내용 복사**
   - 파일 탐색기에서 `D:\GameMake\Youtube Searcher\fix-rls-policies.sql` 파일 열기
   - 전체 내용 선택: `Ctrl+A`
   - 복사: `Ctrl+C`

5. **SQL Editor에 붙여넣기**
   - SQL Editor의 빈 쿼리 창에 클릭
   - 붙여넣기: `Ctrl+V`

6. **실행**
   - **Run** 버튼 클릭 (우측 상단)
   - 또는 키보드 단축키: `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

7. **결과 확인**
   - 하단 결과 패널에서 "Success" 메시지 확인
   - 정책 목록이 표시되면 성공

8. **브라우저 새로고침**
   - 앱 페이지에서 `Ctrl+F5` (강력 새로고침)
   - "영어회화" 검색 테스트

---

## 예상 결과

### 성공 시
- SQL 실행 후 정책 목록이 표시됨
- 브라우저 콘솔에서:
  - `✅ 테스트 결과: 전체 X개 비디오 발견`
  - `📊 쿼리 결과: X개 비디오 발견`
  - 비디오가 화면에 표시됨

### 실패 시
- 에러 메시지가 표시됨
- 콘솔에서 여전히 "0개 비디오 발견" 메시지

---

## 문제 해결

### 에러가 발생하는 경우

1. **권한 에러**
   - Supabase Pro 플랜 이상인지 확인
   - Free 플랜에서는 RLS 정책 제한이 있을 수 있음

2. **정책이 이미 존재하는 경우**
   - SQL이 자동으로 기존 정책을 삭제하고 재생성함
   - 에러가 나도 무시하고 계속 진행 가능

3. **여전히 작동하지 않는 경우**
   - 브라우저 캐시 삭제 후 다시 시도
   - Supabase Dashboard에서 정책이 생성되었는지 확인:
     ```sql
     SELECT policyname, cmd FROM pg_policies WHERE tablename = 'videos';
     ```

---

## 확인 방법

SQL 실행 후 다음 쿼리로 확인:

```sql
-- videos 테이블 정책 확인
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'videos'
ORDER BY cmd;
```

**예상 결과**: 4개 정책 (SELECT, INSERT, UPDATE, DELETE)이 모두 표시되어야 합니다.

---

## 요약

1. ✅ SQL Editor 열기
2. ✅ `fix-rls-policies.sql` 내용 복사
3. ✅ 붙여넣기 후 실행
4. ✅ 브라우저 새로고침
5. ✅ 검색 테스트

이제 클라이언트에서도 데이터를 조회할 수 있습니다! 🎉

