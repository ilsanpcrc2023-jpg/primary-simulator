# v6.10.0 인계장 — PF 단순화 (통합 슬라이더 + 분배 토글) · 균형추 모듈 폐지 · 정책 시나리오 프리셋

**완료일**: 2026-05-02
**선행**: v6.9.6 (데이터 기반 디폴트·anchor + L1=base.L 실측 자동 산출 + PF 음수 금지)
**브랜치**: `feature/v6.10.0-pf-simplify` → main 머지 완료
**입력 자료**: 사용자 세션 지시 (2026-05-02) — 작업 6개 항목 + 추가 L2 슬라이더 범위 변경

---

## 0. 한 줄 요약

PF를 협상 가능한 정책 변수로 명확화하면서 **UI를 단순화**: 통합 슬라이더(B의 X%, 0~20%, 디폴트 10%) + 분배 규칙 3-toggle(HCC비례·균등·역비례) + 환자군별 슬라이더 4개 자동 연계. 균형추(FBalanceCorrection) 모듈 + 신호등 7단계 + WinWinGrid는 v6.9.4 데이터 anchor 정렬로 baseline 보상 불필요해져 전면 폐지. 정책 시나리오 프리셋 4종(파일럿/시범사업/NHS/네덜란드)을 환자군 패널 정책 모드 전용으로 추가. L2 변화율 슬라이더 범위를 -50%p → -25%p로 축소(5%p 간격 표기).

---

## 1. 변경 배경

### 1.1 사용자 세션 지시 (2026-05-02)

> "원래 파일럿(10의원, 69,604명) 기반인데, 어느 시점부터 의원당 환자수만 임의 3,000명으로 바뀌어 환자군 패널 N(파일럿값 그대로)과 충돌. 이 충돌이 baseline 계산까지 오염시켜 PF=0에서 −5.4% 갭 발생. 균형추 모듈은 이 갭을 보상하려 만들어진 건데, baseline이 정확해지면 불필요."

핵심 결정:
- **PF 단위 = B**: 모형이 의원급 외래에 한정인데 분모도 의원급 외래로 정렬해야 정합. PB 기준은 시민단체에 "수가 70% 인상"으로 보여 부담.
- **B의 10% 디폴트**: 의원수입 +43%. 협상에서 16~18%까지 양보 가능.
- **슬라이더 상한 20%**: PB ≈ PF 동수선이 자연스러운 한계. 21%(재정중립)·25%(재정 부담)는 시뮬레이터에 노출 안 함.
- **균형추 삭제**: baseline 정확해지면 보상 불필요. 신호등 7단계는 정책 근거 없음.
- **HCC 비례 디폴트**: "1군 28,083원 = B 280,832원의 10%"가 가장 강한 답변. 균등은 "왜 위험도 무관 균등인가" 더 어려운 질문 유발 → 토글 옵션으로만 제공.

### 1.2 우상단 KPI 카드 변경 없음

> "맞음. 우상단 KPI 카드와 분해(①②③) 그대로 유지. 균형추는 입력 도구, KPI는 출력 도구."

---

## 2. 구현 내역

### 2.1 PF 디폴트 = B의 10% (HCC 비례 자동)

[`src/constants.js`](../src/constants.js):
- `INIT_PF_PCT = 10` 신규 (통합 슬라이더 디폴트)
- `INIT_PF_RULE = "hcc"` 신규 (분배 규칙 디폴트)
- `INIT_F = INIT_B.map(b => Math.round(b * INIT_PF_PCT / 100))` (자동 산출)
- 파일럿 baseline 적용 시: `[28083, 30020, 52358, 74532]`
- `INIT_R = INIT_F` (하위 호환 alias)

### 2.2 PF 카드 재구성 (FCard 전면 재작성)

[`src/components/RegistrationPanel.jsx`](../src/components/RegistrationPanel.jsx):

**신규 구조** (위→아래):
1. **통합 슬라이더** (B의 X%, 0~20%, step 0.5%, 디폴트 10%, **음수 불허**)
   - mini display: `공단지출 +X.X억 (+X.X%)`
   - 분모 = `Σ regDist × M1 × M_clinics` (등록환자 의원급 외래 FFS, 동적)
2. **분배 규칙 3-toggle**: 📊 HCC 비례 (디폴트) / ⚖️ 균등 / 🌱 역비례
3. **환자군별 슬라이더 4개** (자동 연계 + 개별 미세 조정 가능)
   - 라벨에 `B의 X.X%` 동적 표시

**폐지**:
- 액션 버튼 균등/차등/끝자리 보정 (분배 규칙 토글이 흡수)
- 균형추 controlled accordion (TabSimulation에서 마운트 제거)

### 2.3 균형추 모듈 + 신호등 + WinWinGrid 전면 폐지

**삭제**:
- [`src/components/FBalanceCorrection.jsx`](../src/components/FBalanceCorrection.jsx) (전체)
- [`src/test/fBalance.test.js`](../src/test/fBalance.test.js) (전체)
- [`src/constants.js`](../src/constants.js) `balance-thumb` CSS 블록
- TabSimulation.jsx `import FBalanceCorrection` + `showBalance` state + controlled accordion

**보존**:
- `distribute()` 함수만 [`src/utils.js`](../src/utils.js)로 이전 (PF 분배 토글에서 재사용)
- `calcPB`/`PBtoB` (PB 카드 별개 기능, v6.9.3)

### 2.4 신규 utils

[`src/utils.js`](../src/utils.js):

```js
// 분배 함수 (균형추 폐지 후 PF 카드 분배 토글에서 재사용)
distribute(totalTarget, rule, B, n_g) → 1인당 PF 절대값 4-array

// 통합 슬라이더 → 4군 PF 산출 (0 floor)
calcPFfromPct(pfPct, rule, B, n_reg_g) → 1인당 PF 절대값 4-array (반올림)

// 개별 조정 후 통합 슬라이더 위치 역산
inferPFpct(F_g, B, n_reg_g) → pfPct (가중평균 %)
```

### 2.5 state · reducer

[`src/hooks/useSimulator.js`](../src/hooks/useSimulator.js):

- `state.pfRule = INIT_PF_RULE` 신규
- `SET_PF_RULE` 액션 신규 + `setPfRule` callback export
- `RESET_F`: F_g + pfRule 함께 디폴트 복귀 (v6.10.0 — 기존엔 F_g만)

### 2.6 정책 시나리오 프리셋 4종 (정책 모드 전용)

[`src/constants.js`](../src/constants.js):

```js
POLICY_SCENARIOS = [
  { key: "pilot",  label: "파일럿",   perClinic: 6960, sub: "2023 실측" },
  { key: "korea",  label: "시범사업", perClinic: 1500, sub: "복지부안" },
  { key: "nhs",    label: "NHS",      perClinic: 2200, sub: "영국 GP" },
  { key: "nl",     label: "네덜란드", perClinic: 2200, sub: "GP 평균" },
]
```

[`src/components/RegistrationPanel.jsx`](../src/components/RegistrationPanel.jsx) RegScaleCard:
- `mode === "policy"`에서만 노출 (의원 모드는 기존 CLINIC_PRESETS 분포 프리셋만)
- 클릭 시 `setPerClinic(value)` (totalN = value × M_clinics)
- 캡션: "파일럿(2023 실측) · 시범사업(복지부안) · NHS(영국) · 네덜란드(GP 평균)"

### 2.7 L2 변화율 슬라이더 범위 축소 (사용자 추가 지시)

> "L2 변화율을 -50%에서 -25%로 줄여주고, 5% 간격으로 숫자 표기"

[`src/components/TabSimulation.jsx`](../src/components/TabSimulation.jsx) + [`src/components/TabTrack.jsx`](../src/components/TabTrack.jsx):
- `min={-50}` → `min={-25}` (양쪽 동기화)
- `clamp range` -50~0 → -25~0
- `sliderBg pct` 분모 50 → 25
- 라벨: -50/-40/-30/-20/-10/0 (10%p 간격) → **-25/-20/-15/-10/-5/0 (5%p 간격)**

### 2.8 단위 테스트 — 누적 65/65 통과

[`src/test/calculator.test.js`](../src/test/calculator.test.js):
- **fBalance.test.js 23개 제거** (균형추 모듈 폐지)
- **신규 17개**:
  - PF 디폴트: `INIT_F[i] === Math.round(INIT_P[i] * 0.10)` 정확값 검증 + 회귀 방지
  - distribute: HCC/균등/역비례 합산 보존 + 단조성 검증 (4 tests)
  - calcPFfromPct: 통합 슬라이더 정합, 0% 음수 floor, 합산 = pfBaseline × pfPct (5 tests)
  - inferPFpct: 라운드트립 (1 test)
  - pfBaseline: 동적 산출, 의원수 비례, 2064.4억 fixture 회귀 방지 (3 tests)
  - POLICY_SCENARIOS: 4 항목 정책 근거값 정합 (3 tests)

---

## 3. 정책 의미

- **PF는 정책 협상 변수** (B는 데이터 기반): UI 시각 차별화로 사용자가 "조작 가능한 정책 변수"와 "데이터 기반 산출값"을 명확히 구분.
- **PF 단위 = B**: 모형이 의원급 외래에 한정. 분모(공단지출 baseline)도 등록환자 의원급 외래 FFS(`Σ regDist × M1 × M`)로 정렬. PB 기준이 아닌 이유 — 시민단체에 "수가 70% 인상"으로 비치는 부담 회피.
- **HCC 비례 디폴트**: 환자군 위험도 가중. "1군 28,083원 = B 280,832원의 10%"로 답변 가능. 분배 규칙은 정책 협상 단계에서 토글로 변경 가능 (균등·역비례).
- **공단지출 +36% (mini display)**: PF=10%(HCC비례) 시 등록환자 의원급 외래 FFS 대비 +36%. 의도된 결과 — B가 M1보다 약 4배(파일럿 평균). 의원수입 +43%(별도 KPI ①②③ 분해)와 공단지출 +36%(분자/분모 도메인 일치) 두 지표 병기.

---

## 4. 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| [src/constants.js](../src/constants.js) | `INIT_PF_PCT=10` · `INIT_PF_RULE="hcc"` · `INIT_F = INIT_B × 10%` · `POLICY_SCENARIOS` 신규 · `balance-thumb` CSS 제거 · `INIT_R = INIT_F` alias |
| [src/utils.js](../src/utils.js) | `distribute` (균형추에서 이전) · `calcPFfromPct` · `inferPFpct` 신규 |
| [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) | `state.pfRule` · `SET_PF_RULE` 액션 · `setPfRule` export · `RESET_F`이 pfRule 함께 복귀 |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | FCard 전면 재작성 (통합 슬라이더 + 분배 토글 + 4군 슬라이더 + mini display) · RegScaleCard에 POLICY_SCENARIOS 행 추가 |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | `import FBalanceCorrection` 제거 · `showBalance` state 제거 · 균형추 controlled accordion 제거 · L2 슬라이더 범위 -25~0%p 축소 + 5%p 라벨 · setPfRule prop 전달 |
| [src/components/TabTrack.jsx](../src/components/TabTrack.jsx) | L2 슬라이더 범위 -25~0%p 축소 + 5%p 라벨 (TabSimulation과 동기) |
| [src/App.jsx](../src/App.jsx) | setPfRule prop 전달 · 푸터 v6.10.0 |
| [src/components/FBalanceCorrection.jsx](../src/components/FBalanceCorrection.jsx) | **삭제** |
| [src/test/fBalance.test.js](../src/test/fBalance.test.js) | **삭제** |
| [src/test/calculator.test.js](../src/test/calculator.test.js) | 신규 17 테스트 추가 (누적 65/65 통과) |
| [CLAUDE.md](../CLAUDE.md) | v6.10.0 블록 추가 · 기본 시나리오(10/6960/69604) · 입력값 범위 표 갱신 · 파일 구조 갱신 · 버전 태그 이력 |
| [docs/handoff_v6.10.0.md](handoff_v6.10.0.md) | (이 문서) |

---

## 5. 검증

### 5.1 빌드·테스트
- `npm test`: **65/65 통과**
- `npm run build`: 클린 (107.77 kB / gzip 29.11 kB)

### 5.2 브라우저 미리보기 (정책 모드)

DOM 검증:
- PB 카드: 56,868 / 62,021 / 107,701 / 169,783원 (B × (1−L1)) ✓
- PF 4군: 28,083 / 30,020 / 52,358 / 74,532원 (= B × 10% HCC 비례) ✓
- PF 통합 슬라이더 = 10% ✓
- 분배 규칙 토글: HCC 비례 활성 ✓
- 분배 규칙 균등 클릭 → 4군 모두 39,000원 (1인당 동일) ✓
- 정책 시나리오 4 버튼: 파일럿 6,960 / 시범사업 1,500 / NHS 2,200 / 네덜란드 2,200 ✓
- 시범사업 클릭 → totalN = 15,000명 (= 1,500 × 10 의원) ✓
- 의원당 환자수 6,960명 / M_clinics 10 (디폴트 정합) ✓
- L1 평균 78.6% (파일럿 가중평균) ✓
- L2 슬라이더: min=-25, max=0, 라벨 -25/-20/-15/-10/-5/0 ✓
- L2 -15%p 적용 → 후 78.6 − 15 = 63.6% ✓
- mini display: `공단지출 +3.9억 (+36.0%)` ✓ (PF 가산 / 등록환자 FFS baseline)

---

## 6. 다음 세션 후보

- **3,000개 의원 만성질환관리시범사업 데이터 업로드** — 분석 결과 수령 후 엑셀 업로드 → "공식 baseline 등록" 버튼 클릭 → 모든 사용자 디폴트 갱신 검증. 새 데이터의 base.L이 자동으로 L1 디폴트가 되고, M_clinics·dataLabel도 anchor로 갱신됨 (v6.9.4·v6.9.5).
- **공단지출 +X% 표시 정책 명료화** — 현재 분모는 "등록환자 의원급 외래 FFS"이지만, 다른 후보 분모(예: 사업대상 환자 총진료비 = 1조원, 또는 건강보험 전체 110.8조)와 비교 안내 추가 검토.
- **시뮬레이터 v7 명칭 정리** — 내부 변수명(state.P, state.F_g) → 신 명칭(state.B, state.PF) 일괄 치환 (별도 PR, 호환성 영향 큼).
- **Track 카드 인라인 분해 v6.10.0 정합** — Track 탭의 카드 인라인 분해에 PF가 새 기본수가 디폴트로 반영되어 있는지 회귀 점검 (단위 테스트는 통과했으나 시각 점검 필요).

---

## 7. 머지 완료 (2026-05-02)

✅ **main 머지 완료** — commit `33b89ca` (--no-ff), tag `v6.10.0` push.

Vercel 자동 배포: https://primary-simulator.vercel.app/ — 약 1~2분 후 v6.10.0 화면 적용.

```bash
# 실행된 명령
git checkout main && git pull --ff-only origin main
git merge --no-ff feature/v6.10.0-pf-simplify -m "Merge ... v6.10.0 PF 단순화 + 균형추 폐지 + 정책 시나리오 프리셋"
git tag v6.10.0 -m "v6.10.0: PF 단순화 (통합 슬라이더 + 분배 토글) · 균형추 모듈 폐지 · 정책 시나리오 프리셋"
git push origin main --tags
```

검증 권장:
- production URL 첫 진입 (의원 모드) → 환자군 패널: 10기관 × 6,960명 = 69,604명, 등록 1,000명/의원
- 정책 모드 진입 → PF 카드: 통합 슬라이더 10% / 분배 규칙 HCC 비례 / 4군 [28083, 30020, 52358, 74532]
- PF 카드 mini display: `공단지출 +3.9억 (+36.0%)`
- 분배 규칙 균등 클릭 → 4군 모두 약 39,000원 (1인당 동일)
- 환자군 패널 정책 시나리오 4 버튼 노출 + 시범사업 클릭 시 N=15,000명
- L2 슬라이더 범위 -25~0%p, 라벨 5%p 간격
- 균형추 모듈·신호등 영역·WinWinGrid 사라짐

---

*문서 작성: 2026-05-02*
*머지 commit: 33b89ca / tag: v6.10.0*
*세션 commits: 8088156 (v6.10.0 PF 단순화) → e4893ef (L2 -25%p) → 33b89ca (merge)*
*핵심 결정: PF 협상 변수 명확화 + 통합 슬라이더 단순화 / 균형추는 데이터 anchor 정렬로 불필요해져 폐지 / HCC 비례 디폴트 (1군 28,083원 = B의 10%) / L2 범위 축소로 정책 협상 가능 범위 명확화*
