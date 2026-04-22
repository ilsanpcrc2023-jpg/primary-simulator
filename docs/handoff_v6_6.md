# v6.6.0 인계장 — HCC×의원비중 B 자동유도 + 공식 baseline 등록

**날짜**: 2026-04-23
**브랜치**: `feature/v6.6-hcc-auto-B` → `main` --no-ff 머지 · 태그 `v6.6.0`
**상황**: 사용자(센터장)가 출근 전 자동처리 요청 → 코드·문서·커밋·푸시 완료. 남은 **수동 작업 1건 = Vercel 환경변수 설정**.

## 이번 세션 요지

이전 세션에서 사용자와 아키텍처 합의:

1. **"HCC 값 업로드 → B 자동 산출 → 슬라이더 조정 → 저장"** 루프가 자연스러운데 v6.4~v6.5는 데이터↔정책 엄격 분리로 이 흐름이 끊겨 있었음 → 복원 필요
2. 슬라이더 조정값은 **세션 한정** (다른 사용자 미영향) — 현재와 동일
3. **엑셀 업로드도 세션 한정**. 관리자가 "공식 baseline 등록" 버튼을 눌렀을 때만 전역 영속
4. 비밀번호는 나중에 — 버튼만 먼저 구현

이 합의대로 v6.6.0 구현.

## 구현 내용

### 1. HCC × 의원비중 → B 자동 유도 (업로드 파서 확장)

- [src/constants.js](../src/constants.js): `COL_ALIASES`에 `HCC`·`CR` 추가 (5 필드). `B_MIN=50000`·`B_MAX=2000000` 상수 export.
- [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) `handleFile`:
  - 5 필드(N·M1·L·HCC·CR) 읽기
  - `B_suggested = clamp(HCC × CR, B_MIN, B_MAX)` 계산
  - HCC 또는 CR이 0/누락이면 해당 군은 `state.P[i]`(현재 슬라이더값) 유지
  - `state.P` 갱신 (기존 v6.4 "슬라이더 보존" 규칙 폐기)
  - 배너에 자동 유도된 군 수(X/4) + 군별 `B=…` 상세 표시
- [src/test/calculator.test.js](../src/test/calculator.test.js): 별칭 매칭·clamp·fallback 테스트 8건 추가 → 30/30 통과

**v6.3 자가오염 사고 재발 방지**: 엑셀에는 **B 컬럼을 두지 않음**. 시뮬레이터가 HCC × CR을 계산. 엑셀 자동 재계산이 B를 덮어쓸 경로 원천 차단.

### 2. 공식 baseline 런타임 로더

- [src/data/presets/official_baseline.json](../src/data/presets/official_baseline.json): 초기 seed
  - `version`, `updated_at`, `updated_by`, `base`, `P` 필드
  - 현재 값은 v6.4.5 INIT_B와 동일 (변화 없음)
- [src/constants.js](../src/constants.js): 앱 빌드 시 JSON 정적 import
  - 유효성 검사(4군 × 필수 키 존재 + 타입) 후 `INIT_BASE`·`INIT_B`로 export
  - 손상/누락이면 하드코딩 FALLBACK으로 복귀 (앱 다운 방지)
  - `OFFICIAL_BASELINE_META` — UI에 현재 버전·갱신일·갱신자 표시

### 3. 서버리스 커밋 엔드포인트

- [api/commit-baseline.js](../api/commit-baseline.js): POST `/api/commit-baseline`
  - 입력 검증: `base`(4×{N,M1,L}) + `P`(4×number) 형태·범위
  - GitHub Contents API로 `official_baseline.json` 갱신
  - 응답: `{ success, commit_sha, commit_url, message }` 또는 에러
  - **필요 env**: `GITHUB_PAT` (필수), `GITHUB_REPO`/`GITHUB_BRANCH`/`ADMIN_PWD` (선택)
  - env 누락 시 503 + 친절한 안내 메시지 반환 (프런트가 배너로 표시)

### 4. UI: 공식 baseline 등록 버튼

- [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx): 데이터 관리 카드 하단에 추가
  - 현재 baseline 메타 한 줄 표시 (`v6.6.0 · 2026-04-23 · initial seed`)
  - 🏛️ 빨간 대시 버튼: "현재 값을 공식 baseline으로 등록 (전역 · 관리자)"
  - 클릭 → `confirm()` 모달에 4군 값 미리보기 + 경고 문구
  - 승인 시 `handleCommitBaseline()` 호출 → 업로드 배너로 결과 표시
- [src/App.jsx](../src/App.jsx): 풋터 버전 `v6.1` → `v6.6.0` 갱신, `handleCommitBaseline` 프롭 전달

### 5. 문서

- [CLAUDE.md](../CLAUDE.md):
  - 헤더 버전 `v6.5.6 → v6.6.0`
  - "엑셀 포맷 호환" 섹션 전체 재작성 (4열 → 5 필드)
  - "전역 공식 baseline (v6.6)" 새 섹션 (저장 위치·갱신 경로·환경변수·영속성 규칙)
  - 버전 태그 이력에 `v6.6.0` 추가

## 배포 후 필수 수동 작업 (사용자 해야 함) — 약 10분 소요

🏛️ **버튼이 작동하려면 GitHub PAT 발급 + Vercel 환경변수 설정 필요**. 이 작업 안 하면 버튼 클릭 시 503 에러 배너만 표시됨. 나머지 v6.6 기능(HCC×의원비중 자동유도 등)은 env 없이도 정상 작동.

---

### 단계 1: GitHub Personal Access Token 발급

1. https://github.com/settings/personal-access-tokens/new 접속
2. 입력:
   - **Token name**: `primary-simulator-baseline-commit`
   - **Expiration**: 1년 (또는 원하는 기간)
   - **Repository access**: "Only select repositories" → `shleefm/primary-simulator` 선택
   - **Permissions** → **Repository permissions**:
     - **Contents**: **Read and write** (이 하나만)
     - 나머지는 No access 그대로
3. 하단 `Generate token` 클릭
4. **생성된 토큰 값** (형식: `github_pat_xxxxxxxxx...`) **복사** — 이 화면 닫으면 다시 못 봅니다
   (잃어버리면 같은 페이지에서 새로 발급하면 됨)

### 단계 2: Vercel 환경변수 설정

1. https://vercel.com/dashboard 접속 → `primary-simulator` 프로젝트 클릭
2. 상단 탭에서 **Settings** 클릭
3. 좌측 사이드바에서 **Environment Variables** 클릭
4. 입력:
   - **Key**: `GITHUB_PAT`
   - **Value**: (단계 1에서 복사한 `github_pat_...` 값 붙여넣기)
   - **Environments**: **Production** 체크 (Preview·Development는 선택사항)
5. `Save` 클릭

### 단계 3: 재배포 (env 반영)

환경변수 변경은 **재배포해야 적용됨**.

1. 좌측 사이드바 위쪽 **Deployments** 탭 클릭
2. 맨 위 "Production" 배지가 달린 최신 배포 (v6.6.0 커밋) 우측 `⋯` 메뉴 → **Redeploy**
3. 모달에서 "Use existing Build Cache" 체크 해제 권장 → `Redeploy`
4. 1~2분 대기 (배포 화면에서 초록 "Ready" 표시 확인)

### 단계 4: 동작 검증

1. https://primary-simulator.vercel.app/ 접속 (강력 새로고침: Ctrl+F5)
2. 데이터 관리 아코디언 펼침
3. "현재 공식 baseline: v6.6.0 · 2026-04-23 · initial seed" 표시 확인
4. 1군 B 슬라이더 살짝 조정 (예: 280,832 → 285,000)
5. 🏛️ **현재 값을 공식 baseline으로 등록** 버튼 클릭 → 확인 모달에서 확인
6. 수 초 내 녹색 배너:
   ```
   ✅ 공식 baseline 갱신 완료. Vercel 재배포가 자동 시작됩니다 (1~2분).
   commit: [7자리 SHA]
   url: https://github.com/...
   ```
7. GitHub https://github.com/shleefm/primary-simulator/commits/main 확인 → 새 커밋 `chore(baseline): official baseline 갱신 2026-04-23` 보이면 성공
8. 2분 후 **시크릿 창에서 사이트 재오픈** → 1군 기본값이 285,000으로 표시되면 최종 성공

---

### 문제 발생 시 체크포인트

| 증상 | 원인 | 해결 |
|---|---|---|
| 503 "GITHUB_PAT 환경변수가 설정되지 않았습니다" | env 설정 후 재배포 안 됨 | Deployments → Redeploy 다시 (단계 3) |
| 401 "관리자 비밀번호가 일치하지 않습니다" | `ADMIN_PWD` env를 실수로 설정함 | Vercel env에서 `ADMIN_PWD` 항목 삭제 → Redeploy |
| 502 "커밋 실패" | PAT 권한 부족 | 단계 1에서 Contents: Read and write 재확인. 새 PAT 발급 후 Vercel env 갱신 |
| 커밋 됐는데 디폴트 안 바뀜 | Vercel 재배포 미완료 | Deployments 화면에서 baseline 커밋 트리거된 신규 배포 "Ready" 대기 (1~2분) |
| 브라우저에 옛 값 계속 표시 | 캐시 | 시크릿 창 / Ctrl+F5 강력 새로고침 |
| GitHub 페이지 UI가 본 인계장과 다름 | GitHub UI 개편 | Claude Code에 스크린샷 첨부하여 도움 요청 |

---

### CLI로 자동화하고 싶으면 (선택 · 다음 세션 작업)

매번 브라우저 안 거치고 터미널에서 처리하려면:
```bash
# Vercel CLI 설치
npm install -g vercel
# 프로젝트 폴더에서
vercel login
vercel link
# env 추가 (대화형)
vercel env add GITHUB_PAT production
# 재배포
vercel --prod
```
처음 한 번만 셋업하면 추후 PAT 갱신·env 변경이 1줄로 끝남. 셋업 자체를 다음 세션에서 도와드릴 수 있음.

## 다음 작업 후보 (우선순위 낮음)

1. **비밀번호 UI** — `ADMIN_PWD` 지원을 위한 비번 입력 모달 추가
2. **자동 테스트** — 서버리스 함수 모킹 테스트 (현재는 UI·상수·파서만 단위 테스트)
3. **프리셋 라이브러리 확장** — `src/data/presets/`에 정책 시나리오 JSON 추가 (A/B/C안), DatasetSelector에 드롭다운
4. **커밋 히스토리 UI** — 공식 baseline 변경 로그를 사이드 패널에 표시 (GitHub API `GET /commits`)
5. **허브 엑셀 개선** — 사용자 v4 파일의 `2_시뮬레이터_업로드!B6` 수식 오류(`"N열B2:B5, HCC열"` 한글 주석) 수정 권장

## 메모리 갱신 필요 사항

아래 파일을 다음 세션 초반에 업데이트하는 것이 좋음 (이 세션에서는 최우선 순위 작업 완료에 집중):

- `project_v6_state.md` — v6.6.0 main 머지 상태로 갱신
- `reference_key_docs.md` — 이 문서(`docs/handoff_v6_6.md`) 추가

## 현재 파일/설정 상태 체크리스트

- [x] `src/data/presets/official_baseline.json` 생성 (v6.6.0 seed)
- [x] `src/constants.js` — 로더 + `COL_ALIASES` 5 필드 + `B_MIN`/`B_MAX` + `OFFICIAL_BASELINE_META`
- [x] `src/hooks/useSimulator.js` — `handleFile` 확장 + `handleCommitBaseline` 추가
- [x] `src/components/TabSimulation.jsx` — 공식 baseline 등록 버튼 + 메타 표시
- [x] `src/App.jsx` — 프롭 전달 + 버전 갱신
- [x] `src/test/calculator.test.js` — 8건 추가, 30/30 통과
- [x] `api/commit-baseline.js` — 서버리스 엔드포인트
- [x] `CLAUDE.md` — v6.6 섹션 추가
- [x] `docs/handoff_v6_6.md` — 본 문서
- [x] `npm test` 통과
- [x] `npm run build` 통과 (기존 recharts 500kB 경고는 v6.5 이전부터 존재, 무관)
- [x] 개발서버 프리뷰로 UI 렌더 · 메타 표시 · 콘솔 에러 없음 확인
- [x] feature 브랜치 → main --no-ff 머지 → 태그 → 원격 푸시
- [ ] **Vercel `GITHUB_PAT` 환경변수 설정 (사용자 수동 작업 · 필수)**
- [ ] 버튼 동작 end-to-end 검증 (환경변수 설정 후)

## 긴급 롤백 방법

문제가 심각하면:
```bash
git checkout main
git revert -m 1 <merge_commit_sha>      # 머지 되돌리기
git push origin main
```
또는 v6.5.6 태그로 force-reset은 **사용자 명시 승인 시만** (메모리 규칙).
