# v7.1.5 인계장 — 1차년도 시범사업 100개 디폴트 + UI 정리 + 엑셀 정합 테이블

**완료일**: 2026-05-09
**선행**: v7.1 (HCC v3.0 2025 데이터 탑재, main commit `25a9082`)
**브랜치**: `feature/v7.1.1-100clinic-default-and-table` → `main` `--no-ff` 머지
**태그**: `v7.1.5`
**입력 자료**: 사용자 세션 지시 (2026-05-09) — 첨부 엑셀 `NHIS-HCC_v3.0_2025_for_simulator.xlsx`, 1차년도 시범사업 100개 의원 운영 결정

---

## 0. 한 줄 요약

데이터 anchor(2,923개)는 그대로 보존하면서 **시뮬레이터 초기 디스플레이를 1차년도 시범사업 scope(100개 의원 × 의원당 4,379명 = 437,900명, 등록 100,000명 + 비등록 337,900명)** 으로 전환. ClinicCountCard 분리(상단 슬림 1줄 요약 + 고급설정 안 컨트롤), B·L1 중복 박스 삭제, 수가 산출 구조 박스를 데이터 관리 카드의 자료 분석 절차로 대체, 환자군별 상세 편집 테이블을 엑셀(NT/NC/A/CR/B/L1/C1/PB) 정합으로 재배치. 5개 누적 패치(v7.1.1 ~ v7.1.5) 완료. 단위 테스트 73/73 통과.

---

## 1. 변경 배경

### 1.1 사용자 결정 (시범사업 운영안)

> 사용자: "1차년도 시범사업 100개 의원으로 시작 예정이니, 초기 화면은 100개 의원 디폴트로. 의원당 환자수 4,379명이나, 의원당 등록 환자 제한을 1,000명으로 하니, 100개 의원 437,900명 중 100,000명 등록 환자 + 비등록환자 337,900명 표기"

### 1.2 정책 컨텍스트

- **데이터 baseline (HCC v3.0 2025)**: 만성질환관리 시범사업 참여의원 2,923개 / 12,801,143명 / 의원당 4,379명 (official_baseline.json 그대로)
- **시뮬레이터 v1 초기 디스플레이 (사용자 결정)**: 100개 의원 × 의원당 4,379명 × 의원당 등록 1,000명 = 사업 전체 437,900명, 등록 100,000명
- 두 anchor 분리: 데이터 anchor (datasetM=2,923) ≠ v1 디스플레이 anchor (M_clinics=100)

### 1.3 누적 정리 (5단계)

| 패치 | 제목 | 핵심 |
|---|---|---|
| v7.1.1 | 100개 디폴트 + 일만시 전체등록 + 엑셀 정합 테이블 | 데이터 anchor 보존 + 디스플레이 anchor 신설 + 엑셀 컬럼 정합 |
| v7.1.2 | ClinicCountCard 분리 + 고급설정 B·L1 삭제 | 정합성 중복 제거 |
| v7.1.3 | 수가 산출 구조 박스 삭제 + 자료 분석 절차 신설 | 메인 화면 단순화 + provenance 명시 |
| v7.1.4 | 일만시 모드 시멘틱 변경 (4,379→1,000) | 시범사업안 정합 |
| v7.1.5 | 일만시 모드 버튼 → 초기화 버튼 | 데드 코드 정리 + 1차년도 디폴트 복귀 |

---

## 2. 변경 파일 (8개)

### 2.1 `docs/NHIS-HCC_v3.0_2025_for_simulator.xlsx` (신규)
사용자 첨부 엑셀. 시범사업 설명·자료 분석 절차 시트 내 포함. v3.0(2025) baseline의 NT/NC/A/CR/B/RT/RC/L1/C1/PB 14개 컬럼 reference.

### 2.2 `src/data/presets/official_baseline.json` (확장)
A·CR·NT reference 필드 추가:
```json
{ "N": 2050360, "M1": 99879, "L": 0.7189, "A": 281847, "CR": 0.739, "NT": 12463713 }
```
시뮬 로직 동일, 표시·검증용. `B = round(A × CR) ≈ INIT_P[i]` (라운딩 오차 ±1%).

### 2.3 `src/constants.js`
**추가**:
- `INIT_DEFAULT_M = 100` (1차년도 시범사업 의원 수)
- `INIT_DEFAULT_TOTAL_N = 100 × INIT_PER_CLINIC = 437,900`
- `CLINIC_COUNT_PRESETS = [100, 1000, 3000, 2923(일만시)]`
- `REG_PER_CLINIC_PRESETS = [1000, 1500, 2000, 3000, 4000]`

**제거 (v7.1.4)**: `FULL_REG_REG_DIST` 상수 (N비례 분배 폐기)

### 2.4 `src/hooks/useSimulator.js`
- `initialState.M_clinics = INIT_DEFAULT_M (100)` (이전: INIT_M_CLINICS=2923)
- `initialState.totalN = INIT_DEFAULT_TOTAL_N (437,900)`
- `RESET_REG`: 초기화 target = M=100 (이전: datasetM)
- `LOAD_FULL_REG` 액션 폐기 (v7.1.5) — 일만시 모드 폐지로 데드 코드 정리
- `loadFullReg` callback 제거

### 2.5 `src/components/RegistrationPanel.jsx`
**ClinicCountCard 분리** (v7.1.2):
- `ClinicSummaryStrip` (상단 슬림 1줄): `🏥 100개 의원 | 의원당 4,379명 = 등록 1,000 + 비등록 3,379 | 사업 전체 437,900 = 등록 100,000 + 비등록 337,900`
- `ClinicCountControls` (고급설정 안): 의원 수 / 의원당 등록환자수 프리셋 버튼
- `ClinicCountCard` (deprecated alias): 두 컴포넌트 합성

### 2.6 `src/components/TabSimulation.jsx`
**KPI 다음 1줄 요약**: `<ClinicSummaryStrip state={state} />` (정책 모드 한정)

**고급 설정** (v7.1.2):
- B(환자군 기준의료비) NumBox 4개 삭제 → 환자군별 상세 편집 테이블에서 편집
- L1(평균 타원이용비중) NumBox 4개 삭제 → 테이블 L1 컬럼에서 편집
- 의원 수·의원당 등록환자수 컨트롤 신규 (`<ClinicCountControls>`)
- 헤더 부제 추가: "의원 수 · 의원당 등록환자수"

**수가 산출 구조 박스** (v7.1.3): 통째로 삭제 (`showFormula` state·formulaBox 제거). formula는 환자군별 상세 편집 테이블 컬럼 헤더(B=A×CR, PB=B×C1, P=PB+PF)와 중복.

**데이터 관리 카드** (v7.1.3):
- 최상단에 **📊 자료 분석 절차** 섹션 신설 (default expanded):
  - 1단계 (건보공단 전수자료 HCC 분석): 53,247,650명 → NHIS-HCC v3.0 → HCC 4분위 분류
  - 2단계 (일만시 참여의원 환자 중심 분석): 2,923개 / 12,801,143명 / 의원당 4,379명 → A → B=A×CR → PB=B×C1
  - cf. 일차의료 정책 보정: PF · P = PB + PF
- amber 버튼: "파일럿 로드" → "일만시 전체 등록 모드" → "일만시 모드" → **"↩ 초기화"** (v7.1.1 → v7.1.4 → v7.1.5)
- 환자군별 상세 편집 테이블 컬럼 12개로 확장 (엑셀 정합):
  | 환자군 | NT | NC | M1 | A | CR | B(=A×CR) | L1 | C1(=1−L1) | PF | PB(=B×C1) | P(=PB+PF) | 등록 |
  - 편집 가능: NC, M1, L (=L1 시드), A, CR, 등록
  - B 산출값과 정책 슬라이더 B 차이 시 ⚠ 노란색 안내

### 2.7 `src/App.jsx`
- `loadFullReg` prop 전달/제거 (v7.1.1 추가 → v7.1.5 제거)

### 2.8 `src/test/calculator.test.js`
신규 7개 테스트:
- `INIT_DEFAULT_M = 100` · `INIT_DEFAULT_TOTAL_N = 437,900`
- 데이터 anchor (2,923) 보존 검증
- `CLINIC_COUNT_PRESETS` 4개 (100/1000/3000/일만시 2923)
- `REG_PER_CLINIC_PRESETS` 5개 (1000/1500/2000/3000/4000)
- 100개 의원 디폴트 breakdown: 437,900 = 100,000 등록 + 337,900 비등록
- A·CR·NT reference 필드 검증 (B = round(A×CR) ≈ INIT_P[i])
- 초기화 (RESET_REG) 명세

기존 테스트 갱신: `INIT_BASE rows have only N, M1, L (v6.4 simplified)` → A·CR·NT 옵셔널 reference 필드 허용으로 완화.

---

## 3. 핵심 동작 검증

### 3.1 초기 디스플레이 (자동 진입)
```
🏥 100개 의원 | 의원당 4,379명 = 등록 1,000명 + 비등록 3,379명
사업 전체 437,900명 = 등록 100,000명 + 비등록 337,900명
의원 수입 변화 +4,917만원/년 · 공단 지출 변화 +42.5억원/년
```

### 3.2 등록환자수 1,000명 → 4,000명 변경 시
- 의원 수입 변화: +4,917만원 → **+14,684만원** (약 3배 증가)
- panelEffect=0, perf_blended=0 / modelEffect만 등록 수에 비례
- 사용자 직관 "1/4 정도" 부합 (정확히는 1/3)

### 3.3 의원 수 변경 (100개 ↔ 1,000개 ↔ 2,923개 일만시)
의원당 KPI 거의 동일 (regDist 합 같으면). 사업 전체 KPI는 의원 수 비례.

### 3.4 초기화 버튼 (데이터 관리 카드 amber)
M=2,923 + regDist 변경 상태에서 클릭 시 → M=100 + regDist=[100,600,200,100] 1,000명 복귀. PF·B·L1·L2 정책 슬라이더는 보존.

### 3.5 단위 테스트
```
Test Files  2 passed (2)
Tests       73 passed (73)
```

### 3.6 빌드
```
✓ 662 modules transformed
dist/assets/index-*.js     89.86 kB │ gzip: 25.42 kB
✓ built in ~2.9s
```

### 3.7 preview 검증 (Vite dev server)
- 콘솔 에러 0건
- 100개 디폴트 표시 ✓
- 의원 수 프리셋 4개 (100/1000/3000/일만시 2,923) ✓
- 등록환자수 프리셋 5개 (1000/1500/2000/3000/4000) ✓
- 환자군별 상세 편집 테이블 12개 컬럼 정상 렌더 ✓
- B 산출값 ⚠ 슬라이더 안내 표시 정상 ✓
- 초기화 버튼 → M=100 복귀 ✓

---

## 4. 의도적으로 손대지 않은 곳

| 식별자 | 사유 |
|---|---|
| `official_baseline.json` 핵심 필드 (`base[].N/M1/L`, `P`, `M_clinics`, `dataLabel`) | v7.1 데이터 그대로 |
| 시뮬 엔진 수식 (`G`, `T`, `decomp`, `performance`) | 사용자 결정: "수치 같으니 코드/수식 수정 없음" |
| 엑셀 업로드 파서 (`handleFile`) | 동일 데이터 → 같은 결과, 변경 불필요 |
| 정책 슬라이더 (B·L1·PF·L2) | 환자군별 상세 편집 테이블에서도 편집 가능하지만 PF는 슬라이더 전용 |
| Track 탭, 성과 공유 탭 | 영향 없음 |
| `state.regDist` 디폴트 [100,600,200,100] | INIT_REG_DIST 그대로 (v6.x 부록 분포) |
| `RegScaleCard` (deprecated v6.11.0) | legacy 코드 보존 |

---

## 5. 커밋 흐름

| Hash | 주제 |
|---|---|
| `5dc13d3` | feat(v7.1.1): 1차년도 시범사업 100개 디폴트 + 일만시 전체등록 모드 + 엑셀 정합 테이블 |
| `f72ce66` | refactor(v7.1.2): ClinicCountCard 분리 + 고급설정 정리 (B·L1 삭제, 의원 수 컨트롤 이동) |
| `e0f2869` | refactor(v7.1.3): 수가 산출 구조 박스 삭제 + 데이터 관리에 자료 분석 절차 신설 |
| `9074e5a` | refactor(v7.1.4): 일만시 모드 시멘틱 변경 — 시범사업안 등록 1,000명 |
| `a6dc0cf` | refactor(v7.1.5): 일만시 모드 버튼 → 초기화 버튼 (resetReg) |
| (이번) | docs(v7.1.5): 인계장 신설 + CLAUDE.md 버전 이력 갱신 + main `--no-ff` 머지 + 태그 v7.1.5 |

---

## 6. 알려진 제한 / 다음 세션 후보

1. **Excel 업로드 파서 NT/NC 모호성**: `COL_ALIASES.N`에 generic "환자수" alias가 있어 첨부 엑셀의 NT 컬럼을 NC 대신 잡을 수 있음 (substring match 한계). 현재는 official_baseline.json이 정답이라 문제 없으나, 사용자가 새 엑셀 직접 업로드 시 미세 정합 검증 필요.
2. **B 산출값 vs 정책 슬라이더 차이**: 환자군별 상세 편집 테이블에서 A·CR 편집해도 정책 슬라이더 B(=state.P)는 수동 동기화 필요. "⚠ 슬라이더" 안내로 차이 표시 중. 향후 "↪ B로 적용" 버튼 검토 가능.
3. **App.jsx 푸터 버전**: `v7.0` 그대로 유지 (v7.0.x·v7.1.x 모두 footer 미반영).
4. **CLAUDE.md 메모리 갱신**: project_v6_state.md에 v7.1.5 한 줄 추가 검토.
5. **deprecated 코드 정리**: `RegScaleCard` (v6.11.0 미사용), `ClinicCountCard` alias (v7.1.2 deprecated). 향후 정리 후보.

---

## 7. 메모리 갱신 권장

- `MEMORY.md` 인덱스: v7.1.5 한 줄 ("100개 디폴트 + 엑셀 정합 테이블 + 1줄 요약 + 자료 분석 절차 + 초기화 버튼")
- `project_v6_state.md`: v7.1.5 production URL과 함께 짧은 메모

---

## 8. 핵심 결정 메모 (다음 세션 reference)

- **두 anchor 분리**: datasetM (=2,923, 데이터 baseline) ≠ M_clinics (=100, v1 시범사업 디폴트)
- **초기화 시멘틱**: `RESET_REG` = "1차년도 시범사업 디폴트 복귀" (M=100, regDist=[100,600,200,100])
  · 데이터 anchor 전체로 가려면 ClinicCountCard 안 "↩ 2,923개로" 버튼 또는 "일만시 2,923" 프리셋 클릭
- **PF·B 슬라이더 vs 테이블 편집**: 두 입구가 있음. 테이블 A·CR 편집은 reference, B(=state.P) 정책값은 별도 슬라이더 — 의도적 분리
- **자료 분석 절차의 의미**: 데이터 provenance — "이 baseline 어디서 왔지?" 즉시 확인용. 시뮬 로직과 분리
