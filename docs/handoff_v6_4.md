# v6.4.0 인계장 — 엑셀 업로드 단순화 + base 구조 정리

**작업일**: 2026-04-21
**브랜치**: `feature/excel-upload-template-v1` (v6.4 작업 누적, 머지 직전)
**전 버전**: v6.3.0 (15열 시뮬-보고서 겸용 템플릿)
**현 버전**: v6.4.0 (4열 시뮬 전용 템플릿 + base 단순화)

## 변경 배경

### 발견된 버그

LC(타원이용비중 변화율)을 더 강하게 음수로 내릴수록 공단 의원급 외래 지출이 **증가**하는 역전 현상.
사용자 보고: LC=-3 → +59.8억, LC=-16 → +62.4억. 일반적 직관과 반대.

### 근본 원인 분석

`useSimulator.js` line 226:
```js
const nhi2 = (ab_reg_new + D1 * (b.L > 0 ? LL / b.L : 1)) * n_reg_g + C1 * n_unreg_g;
```
여기서 `ab_reg_new = p*(1-LL) + F + M1*0.30`, `D1 = M1*L/(1-L)`.

LC(=lc) 미분:
```
d(nhi2)/dlc = (-p + D1/L) * n_reg = (C1 - p) * n_reg
```

**p > C1이면 음의 기울기 → LC↓ 시 nhi2↑ (역전).**

기본 INIT_BASE에서는 `p < C1`로 정상이지만, 사용자가 v6.3 템플릿을 export → 엑셀로 열기만 해도
B 컬럼이 `=ROUND(F*G, 0)` 수식 자동 재계산으로 `ref × cr` 값으로 덮어써짐. 다시 import 시
`state.P`가 `ref × cr`로 갱신되어 환자군 2/3/4에서 `p > C1` 상태가 되어 버그 노출.

추가 문제:
- INIT_BASE의 `ref·cr·M1·L`이 서로 다른 데이터 소스에서 가져와 내부 정합성 없음 (`ref × cr ≠ M1`)
- 분석가가 채워야 할 입력층(원자료 4)과 시뮬레이터가 사용하는 파생층(4)이 한 시트에 섞여 혼동
- 정책 슬라이더(B·F)와 데이터 입력(N·M1·L)의 경계가 불분명

### 사용자의 결정

> "여기에 올리는 엑셀은 시뮬레이터 필요한 것으로만 단순 구성. 분석용 엑셀 파일은 따로 주더라도
> 결론적으로 시뮬레이터에서 사용한 필드 값만 공단 데이터 분석가에게 fill up 해달라고 하면 될 듯"

→ **두 파일 분리** + **시뮬레이터 입력은 N·M1·L 3개로 최소화** + **B·F는 정책 슬라이더 보존**.

## v6.4 변경 사항

### 1. base 구조 단순화 (`src/constants.js`, `src/data/presets/2023.json`)

**전 (v6.3)**: `{ ref, cr, N, M1, L }` — ref/cr는 시뮬 계산에 미사용, B 폴백·표시용으로만 잔존
**후 (v6.4)**: `{ N, M1, L }` — 시뮬이 실제로 쓰는 3 필드로 축소

ref/cr 제거 영향:
- B 폴백 경로 (`Math.round(b.ref * b.cr)`) 폐기 — 정책 슬라이더만 B 결정
- 편집 테이블에서 ref/cr 컬럼 삭제
- handleExport에서 T = ref×N, C = T×cr 역산 폐기

### 2. 엑셀 업로드 템플릿 v2 (4열, `scripts/gen_upload_template.cjs`)

| 열 | 필드 | 형식 | 비고 |
|---|---|---|---|
| A | 환자군 | "1군"~"4군" | 라벨 (시뮬 무시) |
| B | N | 정수 (명) | 실인원 |
| C | M1 | 정수 (원/년) | 1인당 의원외래비 |
| D | L | 0~1 (소수) | 타원이용비중 |

5번째 행 = 합계/가중평균 (SUMPRODUCT 수식). 시뮬은 앞 4행만 읽어 합계 행은 무시.
분석가 입력 = 12 셀 (3 필드 × 4군). v6.3의 16 셀 대비 25% 감소.

생성 산출물: `docs/NHIS_HCC_시뮬레이터_업로드_v2.xlsx`. v1 파일은 제거.

### 3. handleFile 단순화 (`src/hooks/useSimulator.js`)

**v6.3**: ref/cr/N/M1/L/B/F 모두 읽고 state.P, state.F_g 덮어씀
**v6.4**: N/M1/L만 읽고 base만 갱신. **state.P, state.F_g 슬라이더는 보존**.

```js
dispatch({
  type: "LOAD_DATA",
  base: newBase,        // {N, M1, L} × 4
  P: state.P,           // 슬라이더 보존
  F_g: state.F_g,       // 슬라이더 보존
  dataLabel: label,
  uploadBanner: { msg: `... (B·F 슬라이더 보존)`, ... },
});
```

업로드 배너 메시지에 "(B·F 슬라이더 보존)" 명시 — 사용자가 정책값이 유지됨을 인지하도록.

### 4. handleExport 단순화

업로드 템플릿과 동일 4열 구조로 출력 — 라운드트립(export → 엑셀 저장 → import) 결과 동일성 보장.
B/F 정책값은 엑셀에 포함되지 않으므로 라운드트립 시 자동으로 슬라이더 상태가 유지됨.

### 5. 편집 테이블 (`src/components/TabSimulation.jsx`)

**v6.3**: 9 컬럼 (환자군·기준의료비·의원비중·P·F·T·L·M1·N), L은 % 입력 (silent breakage)
**v6.4**: 7 컬럼 (환자군·N·M1·L·B·F·P=B+F)
- N·M1·L: 직접 편집 가능
- L: 0~1 소수점 입력 (예: 0.7975), `.toFixed(4)` 표시
- B·F: 위쪽 정책 슬라이더에서만 설정 (테이블에서는 표시만)
- P=B+F: 자동 계산
- 하단 안내문: "N·M1·L만 직접 편집 — 분석가가 채워야 할 데이터입니다."

L 입력 버그 수정:
- 전: 표시 "79.7", 입력 시 `v / 100` (사용자가 0.797 입력 → 0.00797 저장 — 무경고 오작동)
- 후: 표시 "0.7975", 입력 시 그대로 저장 (0~1 범위 검증)

### 6. COL_ALIASES 단순화

```js
{
  N:  ["N", "환자수", "등록환자수", ...],
  M1: ["M1", "현재외래비", "1인당 의원외래비", ...],
  L:  ["L", "타원이용비중", ...],
}
```
ref/cr/P/F 별칭 모두 제거. v6.3에서 P 별칭과 P 컬럼(B+F)이 충돌하여 의도적 제외했던 문제 자체가 사라짐.

### 7. 테스트 (`src/test/calculator.test.js`)

- `INIT_BASE rows have only N, M1, L` — 구조 검증
- `COL_ALIASES exposes only N, M1, L` — 별칭 단순화 검증
- ref/cr 관련 기존 테스트 제거
- 모든 16개 테스트 통과 (v6.3에서 16개 → v6.4에서 16개, 종류만 교체)

## 미해결 / 후속 (v6.5+)

### 우선순위 1: L→공단지출 역전 버그 본체 수정

v6.4는 **데이터 규율로 우회**(B 슬라이더 보존 → p > C1 상태로 빠지지 못함)했지만,
근본 수식 차원의 부호 역전 가능성은 남아 있음. 분석가가 정책 시뮬 중 B를 매우 높게(예: 100만원 이상)
설정하면 환자군 1까지도 `p > C1`이 되어 같은 현상 재발 가능.

**해결 방향 후보**:
- (a) `nhi2`의 D1 스케일링 항을 재정의 (`D1 * LL/L` 자체가 의미상 맞는지 재검토)
- (b) 슬라이더 max를 환자군별 C1로 캡 (UI 차원 가드)
- (c) 정책 모델상 "공단지출 = B*(1-L) + F" 만 표시하고 nhi2의 D1 항 분리 (등록환자에 D1 적용 여부 재정의)

(a)가 본질적 수정. v6.5에서 우선 진행 권장.

### 우선순위 2: 분석가 워크북 별도 제공 (선택)

현재 분석가는 자체 도구로 N/M1/L을 도출. 표준화된 분석 워크북(15열 v6.3 형식 등)을
시뮬과 분리된 docs/ 위치에 두어 참조 자료로 제공할지 결정 필요. 사용자 의향 확인 후 진행.

## 검증

```bash
npm test    # ✓ 16/16 passing
npm run build  # ✓ built in 11.89s, 661 modules
```

생성된 파일:
- `docs/NHIS_HCC_시뮬레이터_업로드_v2.xlsx` — v2 단순 4열 템플릿 (sample 데이터: 파일럿 2023)
- 제거: `docs/NHIS_HCC_시뮬레이터_업로드_v1.xlsx`

## 머지 체크리스트

- [x] `npm test` 통과
- [x] `npm run build` 통과
- [x] CLAUDE.md 업데이트 (버전, 엑셀 섹션, 파일 구조)
- [x] handoff_v6_4.md 작성
- [ ] feature/excel-upload-template-v1 → main `--no-ff` 머지
- [ ] 태그 `v6.4.0` 부여 + `git push --tags`
- [ ] Vercel production 배포 확인 (https://primary-simulator.vercel.app/)
- [ ] (후속) L→공단지출 역전 버그 v6.5 작업 시작

## 변경 파일 요약

```
M  CLAUDE.md
A  docs/handoff_v6_4.md
D  docs/NHIS_HCC_시뮬레이터_업로드_v1.xlsx
A  docs/NHIS_HCC_시뮬레이터_업로드_v2.xlsx
M  scripts/gen_upload_template.cjs
M  src/components/TabSimulation.jsx
M  src/constants.js
M  src/data/presets/2023.json
M  src/hooks/useSimulator.js
M  src/test/calculator.test.js
```
