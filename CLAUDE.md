# 환자군(NHIS-HCC) 기반 일차의료 지불모형 시뮬레이터

국민건강보험 일산병원 일차의료개발센터. 정책 시뮬레이션 도구.

**정책 기준**: 노션 「일차의료 시범사업 지불체계 보완 방안 v2.7」 (2026-04-19)
**시뮬레이터 버전**: v6.1 (정책 v2.7 반영, R→F 용어 치환 + 환자군별 등록 분포 UI)

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

### 용어 (노션 v2.7 기준, 준수 필수)

| 기호 | 의미 | 단위 |
|---|---|---|
| P | 환자군 기본수가 = 환자군 기준의료비 × 의원급 외래비중 | 원/년/환자 |
| F | **일차의료 기능수가** (환자군별 배열 F_g[4]) — 주치의 등록관리 + 저평가된 본연 기능의 상대가치 보정 | 원/년/환자 |
| **T** | **통합 수가 = P + F (명목 청구수가)** | 원/년/환자 |
| **A** | **공단 실지급 = P × (1 − L) + F** | 원/년/환자 |
| B | 본인부담 = M1 × 30% (고정) | 원/년/환자 |
| L | 타원이용비중 (비용 기반, (C−M)/C) | 0~1 |
| LC | L 변화율 (정책 시뮬 슬라이더) | %p |
| M1 | 1인당 현행 등록의원 외래비 | 원/년 |
| N | 실인원 환자수 (연인원 아님) | 명 |
| M | 의원 수 | 개 |
| n_reg | 의원당 등록환자수 = Σ regDist | 명 |
| regDist | 의원당 환자군별 등록환자수 배열 (기본 [100,600,200,100]) | 명 |

**F는 L 우회**: F는 타원이용비중 L에 걸리지 않고 등록의원에 고정 지급. 공단 실지급 수식에서 F는 (1−L) 곱셈 밖에 위치.

**F의 정의 (v2.7)**: F는 행위별 수가에 얹는 add-on이 아니라, **환자군 기반 지불 구조 내부에 내장된 기능 상대가치 재조정 항목**. 주치의 등록관리 업무와 저평가된 일차의료 본연 기능(만성질환 포괄관리·재택의료·건강상담)의 상대가치를 동시에 보정. 가정의학과·내과 수련 후 피부미용 이탈 억제의 구조적 장치.

### 혼합 수입 수식

환자군 g에서 발생하는 의원 수입:
- 등록환자 (환자군 모형): `(P × (1−L) + F_g + M1 × 0.3) × n_reg_g`
- 비등록환자 (FFS 유지): `M1 × n_unreg_g`
- 의원 총 수입 = 위 두 합계

### Track 재해석 (v2.7 · 노션 Q3 "수입 감소 없음" 준수)

- Track A = FFS + F (행위별 수가 유지, F 가산)
- Track C = 환자군 모형 + F (LC 적용)
- Track B = A와 C의 hccPct 가중평균
- **모든 Track에서 등록환자에게 F 가산** (핵심 원칙)
- 비등록환자는 Track과 무관하게 항상 FFS
- Track 변화율 기준선 = 순수 FFS (T.inc0). Track A도 F 효과로 양(+) 변화.

## 파일 구조

```
src/
├── App.jsx                      # 탭 라우팅
├── main.jsx                     # 엔트리
├── constants.js                 # SH, CL, INIT_BASE, INIT_P, INIT_F, INIT_REG_DIST, ON
├── utils.js                     # f, fE, fSv, fAuto, pct, diffAuto
├── hooks/useSimulator.js        # 전역 상태·계산 (useReducer + useMemo)
├── components/
│   ├── Header.jsx
│   ├── DatasetSelector.jsx      # 프리셋 드롭다운
│   ├── TabSimulation.jsx        # 탭 1: P·F·T·LC·규모+분포·KPI·차트
│   ├── TabTrack.jsx             # 탭 2: Track A/B/C 비교
│   ├── TabSharedSaving.jsx      # 탭 3: C축 성과조정
│   ├── RegistrationPanel.jsx    # named exports: FCard, TCard, RegScaleCard
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
1. 환자군 기본수가 (P) 설정 — 흰 카드 (4 슬라이더 + NumBox)
2. **일차의료 기능수가 (F)** — 흰 카드. 슬라이더 없음. 환자군별 4 NumBox 메인. 프리셋 3종 (공식안 차등 / 균등 1만원 / 중증 편중).
3. **통합 수가 (T = P + F)** — **인디고 promoted** 카드 [명목 청구수가]. P + F 내역 표기.
4. 타원이용비중 (L) 변화율 — **보라 promoted** 카드 [핵심 인센티브]
   - 수식 `A = P × (1 − L) + F` · `B = M1 × 30%` 표기
   - 슬라이더 아래 **현재 L → 변화 후 L** 표시 (가중평균 + 환자군별 4박스)
5. 등록환자 규모 + 환자군별 분포 (통합 카드)
   - primary 입력: 의원당 실인원 (NumBox), M (NumBox)
   - M 변경 시 per-clinic 보존·totalN 자동 스케일
   - 의원당 등록환자수 (NumBox + 프리셋 500/1000/1500/2000) = Σ 환자군별
   - **환자군별 등록 분포 (명 + %)**: 4개 환자군 각각 NumBox(명) + % input
     - 명·% 상호 동기 — 명 입력 시 % 자동 재계산, % 입력 시 다른 군 비율 유지한 채 해당 군만 조정
     - 프리셋: 부록(10/60/20/10) · 균등(25×4) · 건강 편중 · 고위험 편중
   - 요약 3박스 (실인원·등록·비등록, per-clinic) + 항등식 캡션

**결과 영역:**
- KPI 2카드 **promoted**
  - 녹색 (의원 수입 변화): 전체 변화액 primary (text-3xl) + % 병기 → 의원당 평균 secondary (text-2xl) → 수식 설명("등록 + 비등록 FFS") → "의원당 수입 절대값" 접힘 토글 (기본 숨김)
  - 파랑 (**공단의 의원급 외래 의료비 지출 변화**): 전체 변화액 primary + % 병기, 기준선 주석
- 차트 2열 (환자군별 수입 / 의원급 외래 의료비 비교)
- 데이터 관리 (아코디언): 엑셀 업로드 / 내보내기 / 파일럿 복귀

## 입력값 범위 (슬라이더 vs NumBox 분리)

슬라이더는 **관행 범위** 제한, NumBox 직접 입력은 **하한만** 제한 (상한 무제한).

| 항목 | 슬라이더 범위 | NumBox 범위 | 디폴트 |
|---|---|---|---|
| P (환자군 수가) | 5만~200만원 | ≥ 0 | 22/30/52/74만원 |
| F (환자군별 기능수가) | 슬라이더 없음 | ≥ 0 | **공식안 차등**: 122,860 / 203,040 / 291,120 / 362,530원 (1:1.65:2.37:2.95) |
| regDist (환자군별 등록수) | 슬라이더 없음 | ≥ 0 | [100, 600, 200, 100] (부록 기준 10/60/20/10) |
| LC | -30~0%p | 무제한 | -3%p |
| 의원당 실인원 | 프리셋 1,000·1,500·2,000·3,000·5,000·7,000 | ≥ 1 | 파일럿 6,960 |
| M (의원 수) | 프리셋 10·100·1000·3000 | ≥ 1 | 10 (부록은 100) |

- totalN은 `의원당 실인원 × M` 으로 파생
- 의원당 등록 = Σ regDist. 의원당 등록 NumBox 편집 시 regDist가 비례 스케일(SCALE_REGDIST).

## 부록 수치 기반 검증 (노션 v2.7 §부록)

100기관 · 의원당 등록 1,000명 · 분포 10/60/20/10 기준:
- F 총액 ≈ **228.6억원/년** (공식안 차등 단가 × 분포)
- 단가 비율 1 : 1.65 : 2.37 : 2.95 (1·2·3·4군)
- L=77% 시 공단지급 A ≈ 87.4억원 (L 74% → 98.8억, L 80% → 76.0억)

현재 파일럿(10기관, 69,604명) 기본 시나리오에서는 F 총액 ≈ 22.9억원, 이는 100기관으로 환산 시 229억원으로 부록과 정합.

## 금액 포맷 규칙

`utils.js`의 `fAuto(v)`가 자동 단위 선택. KPI에서는 `diffAuto(a, b)` 사용.

## 엑셀 포맷 호환

**입력 파일**: `NHIS-HCC분석템플릿 v6.xlsx` (`시뮬레이터_출력` 시트 4행 × 6열)
- 헤더: `환자군 / 기준의료비 / 의원비중 / 환자수 / 현재외래비 / 타원이용비중 / 수가`

`src/hooks/useSimulator.js:handleFile`이 업로드 처리. F_g·regDist는 엑셀로 이관 안 됨 (UI에서 설정).

## 배포 워크플로

- `main` → Vercel production (https://primary-simulator.vercel.app/)
- `feature/*` push 시 자동 preview URL 생성
- **커밋 이메일은 반드시 GitHub noreply 형식**: `59140997+shleefm@users.noreply.github.com`
- **새 작업은 feature 브랜치 필수** (main 직접 푸시 금지)
- main 머지는 `--no-ff` 후 필요 시 버전 태그 부여 (선례: v5.0, v6.0.0)

## 파비콘·PWA

- `public/favicon.svg` · `public/icon-192.png` · `icon-512.png` · `public/manifest.webmanifest`
- SVG 수정 후 PNG 재생성: `npm install --no-save sharp && node scripts/gen-icons.mjs`

## 시뮬레이터 밖 항목 (노션 v2.7 명시, 수식 영향 없음)

- **등록 인센티브** (초진 진찰료 본인부담 50% 1회 감면) — 공단이 의원에 보충하므로 의원 수입 변동 0
- **일차의료 전환지원금 (PT)** — Track별 차등 (A=0 / B=1,500만원 / C=3,000만원). 초기 투자비 성격.
- **거점 일차의료지원센터 운영비** — 10개 × 3억원/년 (지원 기능, 진료 외)

이 세 항목은 정책 설계 요소이며 시뮬레이터 계산에 포함되지 않는다.

## 준수 사항 (정책 일관성)

1. **핵심 수식은 변경 금지**: P, A, B, L, T = P + F
2. **용어 통제**: 위 테이블 용어만 사용. 구버전 용어 "R(등록관리비)", "PP(최종 일차의료수가)", "포괄수가", "실지불액", "참여 지원금" 등 금지.
3. **T ≠ A**: T는 명목 청구수가, A는 공단 실지급. UI에서 둘 다 표기 필요
4. **F의 L 우회 규칙**: 수식·UI에서 반드시 명시
5. **모든 Track에 F 가산**: 노션 Q3 "수입 감소 없음" 원칙. 기준선은 순수 FFS(inc0)

## 메모리

프로젝트 메모리는 `{user-claude-dir}/projects/C--Users-User-projects-Primary-Simulator/memory/`에 저장. 주요 파일:
- `MEMORY.md` — 인덱스
- `user_role.md` — 사용자 프로필 (일산병원 일차의료개발센터장)
- `project_per_clinic_kpi.md` — 의원당 평균 수입 KPI 원칙
