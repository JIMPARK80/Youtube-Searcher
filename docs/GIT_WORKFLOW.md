# 🌿 Git Workflow Guide

## 브랜치 구조 / Branch Structure

```
main (프로덕션)
  ↓
dev (개발)
  ↓
feat/*, fix/*, docs/* (기능별 브랜치)
```

---

## 📌 브랜치 네이밍 규칙

### Feature Branches (새 기능)
```bash
feat/language-toggle
feat/search-filter
feat/user-profile
```

### Bug Fix Branches (버그 수정)
```bash
fix/login-error
fix/api-timeout
fix/cors-issue
```

### Documentation Branches (문서)
```bash
docs/api-guide
docs/setup-instructions
```

### Refactoring Branches (리팩토링)
```bash
refactor/auth-module
refactor/api-structure
```

---

## ✍️ Commit Message Convention

### 기본 형식:
```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

### Type 종류:

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 추가 | `feat(i18n): add English translation` |
| `fix` | 버그 수정 | `fix(auth): resolve password validation` |
| `docs` | 문서 수정 | `docs(readme): update setup guide` |
| `style` | 코드 포맷팅 (기능 변경 없음) | `style(css): fix indentation` |
| `refactor` | 코드 리팩토링 | `refactor(api): improve error handling` |
| `test` | 테스트 추가/수정 | `test(auth): add login test cases` |
| `chore` | 빌드, 설정 파일 수정 | `chore(deps): update dependencies` |
| `perf` | 성능 개선 | `perf(search): optimize query speed` |

### 예시:
```bash
# 좋은 예시 ✅
git commit -m "feat(search): add video duration filter"
git commit -m "fix(ui): correct button alignment on mobile"
git commit -m "docs(api): add usage examples"

# 나쁜 예시 ❌
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
```

---

## 🚀 실전 워크플로우

### 1️⃣ 새 기능 시작

```bash
# dev 브랜치 최신화
git checkout dev
git pull origin dev

# 새 기능 브랜치 생성
git checkout -b feat/video-bookmark

# 작업 진행...
# 파일 수정, 추가, 삭제

# 변경사항 확인
git status
git diff
```

### 2️⃣ 커밋

```bash
# 파일 스테이징
git add .

# 커밋 (의미있는 단위로 자주!)
git commit -m "feat(bookmark): add bookmark button to video card"
git commit -m "feat(bookmark): implement bookmark save function"
git commit -m "feat(bookmark): add bookmark list page"
```

### 3️⃣ Push (기능 브랜치)

```bash
# feature 브랜치 push
git push origin feat/video-bookmark
```

### 4️⃣ Dev에 Merge

```bash
# dev로 이동
git checkout dev

# dev 최신화
git pull origin dev

# feature 브랜치 merge
git merge feat/video-bookmark

# dev에 push
git push origin dev

# feature 브랜치 삭제 (선택사항)
git branch -d feat/video-bookmark
git push origin --delete feat/video-bookmark
```

### 5️⃣ Main에 Release (충분한 테스트 후)

```bash
# main 브랜치로 이동
git checkout main

# main 최신화
git pull origin main

# dev 브랜치 merge
git merge dev

# main에 push
git push origin main

# 태그 추가 (선택사항)
git tag -a v1.2.0 -m "Release v1.2.0: Add bookmark feature"
git push origin v1.2.0
```

---

## 🎯 빠른 명령어 모음

### 브랜치 관리
```bash
# 브랜치 목록 확인
git branch -a

# 브랜치 생성 & 이동
git checkout -b feat/new-feature

# 브랜치 삭제 (로컬)
git branch -d feat/old-feature

# 브랜치 삭제 (원격)
git push origin --delete feat/old-feature

# 브랜치 이름 변경
git branch -m old-name new-name
```

### 작업 취소
```bash
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1

# 특정 파일만 unstage
git restore --staged <file>

# 특정 파일 변경사항 취소
git restore <file>
```

### 상태 확인
```bash
# 상태 확인
git status

# 로그 확인 (간단)
git log --oneline -10

# 로그 확인 (그래프)
git log --graph --oneline --all

# 변경사항 확인
git diff

# 특정 커밋 상세 보기
git show <commit-hash>
```

---

## 📋 체크리스트

### Commit 전:
- [ ] 코드가 제대로 작동하는가?
- [ ] 린터 에러가 없는가?
- [ ] 불필요한 코드/주석을 제거했는가?
- [ ] Commit 메시지가 명확한가?

### Push 전:
- [ ] 로컬 테스트를 완료했는가?
- [ ] 민감한 정보(API 키 등)가 포함되지 않았는가?
- [ ] Commit 히스토리가 깔끔한가?

### Merge 전:
- [ ] dev 브랜치를 최신화했는가?
- [ ] Conflict가 없는가?
- [ ] 충분한 테스트를 했는가?

---

## 🔥 긴급 상황 대처

### 잘못된 브랜치에서 작업한 경우
```bash
# 변경사항 임시 저장
git stash

# 올바른 브랜치로 이동
git checkout correct-branch

# 변경사항 복원
git stash pop
```

### Merge 충돌 해결
```bash
# 충돌 파일 확인
git status

# 파일을 직접 수정하여 충돌 해결
# (<<<<<<, =======, >>>>>>> 마커 제거)

# 해결 완료 후
git add .
git commit -m "fix: resolve merge conflicts"
```

### 실수로 push한 경우
```bash
# 주의: 공개 브랜치에서는 사용 금지!
# feature 브랜치에서만 사용

git reset --hard HEAD~1
git push origin feat/branch-name --force
```

---

## 💡 Best Practices

### ✅ DO (권장)
- 작은 단위로 자주 커밋
- 의미있는 커밋 메시지 작성
- 브랜치 이름을 명확하게
- 정기적으로 dev와 sync
- PR/MR로 코드 리뷰 진행

### ❌ DON'T (금지)
- main 브랜치에 직접 커밋
- "fix", "update" 같은 모호한 메시지
- 여러 기능을 한 커밋에 포함
- 테스트 없이 merge
- force push to main/dev

---

## 📚 참고 자료

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

**Created by Jim's YouTube Searcher Team**

