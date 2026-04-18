# 환자군(HCC) 기반 일차의료 지불모형 시뮬레이터

국민건강보험 일산병원 일차의료개발센터. 정책 시뮬레이션 도구.

## 기술 스택

- React 18 + Vite 6 · Tailwind CSS 3
- Recharts (차트) · SheetJS/xlsx (엑셀 I/O)
- Vitest + @testing-library/react (단위 테스트)
- 배포: GitHub → Vercel 자동 배포 (main 브랜치 = production)

## 개발 · 운영 명령

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 로컬 확인
npm test          # 단위 테스트 (vitest run)
```

## 도메인 모델 · 핵심 수식

### 용어 (노션 @BH 기준, 준수 필수)

| 기호 | 의미 | 단위 |
|---|---|---|
| P | 환자군 기본수가 = 환자군 기준의료비 × 의원급 외래비중 | 원/년/환자 |
| R | 주치의 등록관리비 (환자군별 배열 R_g[4]) | 원/년/환자 |
| **PP** | **최종 일차의료수가 = P + R (명목 청구수가)** | 원/년/환자 |
| **A** | **공단 실지급 = P × (1 − L) + R** | 원/년/환자 |
| B | 본인부담 = M1 × 30% (고정) | 원/년/환자 |
| L | 타원이용비중 (비용 기반, (C−M)/C) | 0~1 |
| LC | L 변화율 (정책 시뮬 슬라이더) | %p |
| M1 | 1인당 현행 등록의원 외래비 | 원/년 |
| N | 실인원 환자수 (연인원 아님) | 명 |
| M | 의원 수 | 개 |
| n_reg | 의원당 등록환자수 | 명 |
| k_g | 환자군별 등록률 조정계수 (기본 1.0) | 배수 |

**R은 L 우회**: R은 타원이용비중 L에 걸리지 않고 등록의원에 고정 지급. 공단 실지급 수식에서 R은 (1−L) 곱셈 밖에 위치.

### 혼합 수입 수식 (v6 핵심)

환자군 g에서 발생하는 의원 수입:
- 등록환자 (환자군 모형): `(P × (1−L) + R_g + M1 × 0.3) × n_reg_g`
- 비등록환자 (FFS 유지): `M1 × n_unreg_g`
- 의원 총 수입 = 위 두 합계

### Track 재해석 (노션 Q6 "수입 감소 없음" 준수)

- Track A = FFS + R (등록환자도 행위별 진료, R만 추가)
- Track C = 환자군 모형 + R (LC 적용)
- Track B = A와 C의 hccPct 가중평균
- 비등록환자는 Track과 무관하게 항상 FFS
- Track 변화율 기준선 = 순수 FFS (T.inc0). Track A도 양(+)의 효과가 나옴.

## 파일 구조

```
src/
├── App.jsx                      # 탭 라우팅
├── main.jsx                     # 엔트리
├── constants.js                 # SH, CL, INIT_BASE, INIT_P, ON, COL_ALIASES
├── utils.js                     # f, fE, fSv, fAuto, pct, diffAuto
├── hooks/useSimulator.js        # 전역 상태·계산 (useReducer + useMemo)
├── components/
│   ├── Header.jsx
│   ├── DatasetSelector.jsx      # 프리셋 드롭다운 (현 파일럿 1개)
│   ├── TabSimulation.jsx        # 탭 1: P·R·PP·LC·규모·분포·KPI·차트
│   ├── TabTrack.jsx             # 탭 2: Track A/B/C 비교
│   ├── TabSharedSaving.jsx      # 탭 3: C축 성과조정
│   ├── RegistrationPanel.jsx    # named exports: RCard, PPCard, RegScaleCard, RegDistCard
│   ├── WinWinWin.jsx
│   └── shared/NumBox.jsx        # 클릭→편집 입력 (controlled-input 버그 회피)
├── data/presets/
│   ├── index.js
│   └── 2023.json                # 파일럿 데이터 (10개 의원, 69,604명)
└── test/
    ├── calculator.test.js
    └── utils.test.js
```

## UI 시각 위계 (수가 시뮬레이션 탭)

**핵심 5 카드 (모두 `text-base font-bold` 제목, 화면 상단부터 선형):**
1. 환자군 기본수가 (P) 설정 — 흰 카드
2. 주치의 등록관리비 (R) — 흰 카드 (환자군별 차등 아코디언 내장)
3. 최종 일차의료수가 (PP) — **인디고 promoted** 카드 [명목 청구수가]
4. 타원이용비중 (L) 변화율 — **보라 promoted** 카드 [핵심 인센티브]
   - 슬라이더 아래에 **현재 L → 변화 후 L** 표시 (가중평균 + 환자군별 4박스)
   - 가중평균 = Σ (이용환자 ratio_g × L_g)
5. 등록환자 규모 — 흰 카드
   - primary 입력: **의원당 실인원** (NumBox), M (NumBox)
   - M 변경 시 per-clinic 보존(totalN 자동 스케일) — 직관적 per-clinic 모델링
   - 파생 표기: 전체 실인원 N = 의원당 × M
   - n_reg 슬라이더(0~2,000) + 요약 3박스(실인원·등록·비등록, 모두 per-clinic) + 항등식 캡션

**고급 아코디언 2개 (기본 접힘, `text-sm font-semibold`):**
- 환자군별 차등 (고급) — R_g 개별 조정
- 등록환자 분포 조정 (고급) — k_g 환자군별 등록률

**결과 영역:**
- KPI 2카드 **promoted**
  - 녹색 (의원 수입 변화): 전체 변화액 primary (text-3xl/30px) + % 옆 병기 (text-xl/20px) → 의원당 평균 secondary (text-2xl/24px, %는 전체와 정의상 동일하므로 생략) → 수식 설명("등록 + 비등록")
  - 파랑 (**의원급 외래 의료비 변화** — "공단 총의료비"는 부정확한 구명칭, 사용 금지): 전체 변화액 primary + % 옆 병기, 기준선 주석 ("전원 FFS 의원급 외래 총액, 입원·약국·병원급 제외")
- 차트 2열 (환자군별 수입 / 의원급 외래 의료비 비교)
- 데이터 관리 (아코디언): 엑셀 업로드 / 내보내기 / 파일럿 복귀

## 입력값 범위 (슬라이더 vs NumBox 분리)

슬라이더는 **관행 범위** 제한, NumBox 직접 입력은 **하한만** 제한 (상한 무제한). 극단값 시나리오 탐색 허용.

| 항목 | 슬라이더 범위 | NumBox 범위 | 디폴트 |
|---|---|---|---|
| P (환자군 수가) | 5만~200만원 | ≥ 0 | 22/30/52/74만원 |
| R (등록관리비) | 0~10만원 | ≥ 0 | **1만원** (균등) |
| LC | -30~0%p | 무제한 | -3%p |
| n_reg (의원당 등록) | 0~2,000명 | ≥ 0 | 1,000명 |
| 의원당 실인원 | 프리셋 3,000·5,000·1만·2만 | ≥ 1 | 파일럿 6,960 |
| M (의원 수) | 프리셋 10·100·1000·3000 | ≥ 1 | 10 |

- totalN은 `의원당 실인원 × M` 으로 파생. 슬라이더 값 범위를 초과한 NumBox 입력 허용.
- 슬라이더 범위를 초과한 값을 NumBox로 입력한 경우 안내 텍스트 표시 (n_reg 한정).

## 금액 포맷 규칙

`utils.js`의 `fAuto(v)`가 자동 단위 선택. 작은 변화가 `0.0억`으로 반올림되지 않도록:
- ≥ 1조 → `X.XX조원`
- ≥ 1억 → `X.X억원`
- ≥ 1만 → `X,XXX만원`
- 그 미만 → `XXX원`

KPI에서는 `diffAuto(a, b)` 사용. 부호·단위 자동.

## 엑셀 포맷 호환

**입력 파일**: `NHIS-HCC분석템플릿 v6.xlsx` (`시뮬레이터_출력` 시트 4행 × 6열 헤더 구조)
- 헤더: `환자군 / 기준의료비 / 의원비중 / 환자수 / 현재외래비 / 타원이용비중 / 수가`
- v4·v5·v6 템플릿 모두 동일 구조로 호환

`src/hooks/useSimulator.js:handleFile`이 업로드 처리.

## 배포 워크플로

- `main` → Vercel production (https://primary-simulator.vercel.app/)
- `feature/*` push 시 자동 preview URL 생성
- **커밋 이메일은 반드시 GitHub noreply 형식**: `59140997+shleefm@users.noreply.github.com` (Vercel이 GitHub 계정 매칭을 요구)
- **새 작업은 feature 브랜치 필수** (main 직접 푸시 금지, 사용자 명시 승인 시만 예외)
- main 머지는 `--no-ff` 후 필요 시 버전 태그 부여 (선례: v5.0, v6.0.0)

## 파비콘·PWA

- `public/favicon.svg` — 브라우저 탭 아이콘 (vector)
- `public/icon-192.png`, `icon-512.png` — 홈화면·PWA 설치용
- `public/manifest.webmanifest` — 앱 이름, theme_color(#1a6fa8), 아이콘 3종
- `index.html`에 favicon·apple-touch-icon·manifest 링크 및 theme-color 메타태그
- SVG 수정 후 PNG 재생성: `npm install --no-save sharp && node scripts/gen-icons.mjs`

## 준수 사항 (정책 일관성)

1. **핵심 수식은 변경 금지**: P, A, B, L 공식은 노션 문서 고정값
2. **용어 통제**: 위 테이블 용어만 사용. "포괄수가", "실지불액", "참여 지원금" 등 구버전 용어 금지
3. **PP ≠ A**: PP는 명목 청구수가, A는 공단 실지급. UI에서 둘 다 표기 필요
4. **R의 L 우회 규칙**: 수식·UI에서 반드시 명시 (공단 서버 이관 시 혼선 방지)
5. **Track A도 R 효과**: 노션 Q6 "수입 감소 없음" 원칙. 기준선은 순수 FFS(inc0)

## 메모리

프로젝트 메모리는 `{user-claude-dir}/projects/C--Users-User-projects-Primary-Simulator/memory/`에 저장. 주요 파일:
- `MEMORY.md` — 인덱스
- `user_role.md` — 사용자 프로필 (일산병원 일차의료개발센터장)
- `project_per_clinic_kpi.md` — 의원당 평균 수입 KPI 원칙
