# v6.8.x 인계장 — 명칭 변경 + 정책/의원 모드 이원화 + 용어 재편

**기간**: 2026-04-25 (v6.7.4 직후 동일 세션 누적)
**브랜치**: `feature/v6.8-rebrand-mode-split` (v6.7.4 base, 2 커밋 추가)
**상태**: 코드·CLAUDE.md 갱신 · main 머지 직전

---

## 변경 요지

### v6.8.0 — 명칭 변경 + 정책/의원 모드 이원화
- 시뮬레이터 명칭 **"지불모형" → "지불체계"** (시범사업 지불체계 최종 채택 반영)
- **모드 토글 신설**: `정책 모드` / `의원 모드` (Header 좌측)
- 디폴트 = **의원 모드**, localStorage `primarySim.mode`로 영속, URL `?mode=policy|clinic` 지원
- 모드별 안내 배너 (DatasetSelector 아래)
  - 정책 모드 (남색): "재정 안정과 의료계 수용성이 맞닿는 수가 조합 탐색"
  - 의원 모드 (녹색): "우리 의원에 이 제도가 어떻게 작용할지 확인"

### v6.8.1 — 용어 재편 + UI 단순화
- **L2 라벨 변경**: "타원이용비중 (L2)" → **"포괄관리 지표 (L2)"**
  - 절감의 결과(타원이용 감소)보다 의원 행위(포괄관리)에 초점
- **성과급 → 포괄관리 성과가산** (Track 탭·KPI 라인)
- 모드 토글 디자인: 좌측 세그먼티드 컨트롤 (남색=정책 / 녹색=의원, 2배 크기)
- **의원 모드 대폭 단순화**:
  - 정책 변수 카드(B·F·L1) 완전 숨김
  - P 카드(`TCard`) 라벨 "환자군별 공단지급 수가"로 교체, 공식·L1 개별 표시 숨김
  - 수가 산출 구조 아코디언 숨김
  - "현재 수가는 정부 협상 확정값" 안내
- 첫 진입은 useSimulator 초기 상태 (tab=0, 수가 탭). 모드 전환 시 현재 탭 유지.

---

## 구현 파일

| 파일 | 변경 |
|---|---|
| [src/App.jsx](../src/App.jsx) | 모드 state·localStorage·URL 파라미터, 안내 배너, mode prop 전달, 풋터 v6.8.1 |
| [src/components/Header.jsx](../src/components/Header.jsx) | 모드 토글 세그먼티드 컨트롤 |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | mode 분기 — 정책 변수 숨김, L2 라벨 "포괄관리 지표" |
| [src/components/TabTrack.jsx](../src/components/TabTrack.jsx) | L2 라벨 "포괄관리 지표", 성과급 라벨 "포괄관리 성과가산" |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | TCard mode 분기 (clinic은 금액만) |
| [CLAUDE.md](../CLAUDE.md) | 헤더 v6.8.1, 명칭 변경 메모, 모드 동작 설명 |

---

## 모드 동작 매트릭스

| 영역 | 정책 모드 | 의원 모드 |
|---|---|---|
| Header 토글 | 남색 활성 | 녹색 활성 |
| 안내 배너 | 남색 / "재정·수용성 탐색" | 녹색 / "우리 의원 작용" |
| B·F·L1 카드 | 표시 (편집 가능) | **숨김** (정부 협상 확정값) |
| P 카드 헤더 | "일차의료수가 (P = B×(1−L1)+F)" | "환자군별 공단지급 수가" |
| P 카드 본문 | 금액 + L1_g 표시 | 금액만 |
| L2 슬라이더 | "포괄관리 지표 (L2) 변화율" | 동일 |
| KPI 카드 | 양쪽 동일 (L2 연동) | 양쪽 동일 |
| 수가 산출 구조 아코디언 | 표시 | **숨김** |
| 데이터 관리 | 표시 (펼침으로 편집) | 표시 (관리자 baseline 등록 등) |

상태 영속: localStorage `primarySim.mode`. URL `?mode=policy` 또는 `?mode=clinic`로 진입 가능.

---

## 누적 v6.7.x → v6.8.x 핵심 (참고)

v6.7 시리즈 (앞선 인계장 [docs/handoff_v6_7.md](handoff_v6_7.md) 참고):
- L1 (선지급 기준, 환자군별 4개) + L2 (실측, 단일 스칼라) 분리
- `P_g = B(1−L1_g) + F_g` · 공단지급 = P 단일화
- 성과급 = `Σ max(0, L1−L2) × B × n_reg × TrackMul` (의원 100% 환원, 공유율 없음)
- L2 슬라이더 -50%p~0%p 변화율 UI

v6.8 시리즈 (본 문서):
- 명칭·라벨 정비 (지불체계, 포괄관리 지표)
- 정책/의원 두 청중을 위한 UI 분기

---

## 검증

- [x] `npm test` 36/36 통과 (수식 변경 없음, UI 분기만)
- [x] `npm run build` 성공
- [x] 풋터 v6.8.1 표시 (App.jsx 본 커밋에서 정정)
- [x] 의원 모드 진입 시 정책 변수 카드 숨김 확인
- [x] 모드 토글로 즉시 UI 전환 확인
- [x] L2 슬라이더 라벨 "포괄관리 지표 (L2) 변화율" 확인

---

## 머지 경로

```bash
git checkout main
git merge --no-ff feature/v6.8-rebrand-mode-split \
  -m "Merge 'feature/v6.8-rebrand-mode-split' — v6.7·v6.8 누적 (L1·L2 분리, 정책/의원 모드, 용어 재편)"
git tag v6.8.1
git push origin main --tags
```

머지 후 Vercel production 자동 배포 (1~2분).

---

## 다음 작업 후보 (이월)

### v6.6 미결
- **Vercel `GITHUB_PAT` 환경변수 e2e 검증** — 공식 baseline 등록 버튼 실동작 확인

### v6.7/v6.8 파생
- **ADMIN_PWD UI**: baseline 등록 버튼 비밀번호 보호
- **L1 엑셀 컬럼 직접 인식**: 현재는 "엑셀 L → L1 복사" 버튼 경유
- **Track 배수 편집 가능화**: 현재 하드코딩(0/0.5/1.0)
- **포괄관리 지표 다년도 시뮬**: L2 추이별 누적 성과가산 차트
- **의원 모드 전용 추가 가시화**: 우리 의원 시나리오 입력 → 1년차/2년차 수입 추정

---

## 메모리 갱신 권고

- `project_v6_state.md` — main 머지 후 v6.8.1 production 배포 상태로 갱신
- `reference_key_docs.md` — 본 문서·v6_7 인계장 추가
