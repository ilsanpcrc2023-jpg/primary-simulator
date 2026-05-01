# v6.9.3 인계장 — 명칭 체계 (PB·PF) + 정책 모드 노출 구조 + 의원 KPI 재정의

**완료일**: 2026-05-02
**선행**: v6.9.2-bidir (F 균형추 양방향 + 절대 재정중립)
**브랜치**: `feature/v6.9.3-naming-pb-pf` (main 미머지 · 사용자 승인 대기)
**입력 자료**:
- 사용자 코드 통합 지시서 「시뮬레이터 코드 통합 지시서 v6.9.3 — 명칭 체계 v6.1 + 정책 모드 노출 구조 개편」 (2026-05-01)
- 세션 중 사용자 추가 피드백 6건 (균형추 추 모양·KPI 재정의 등, 2026-05-01~02)

---

## 0. 한 줄 요약

정책 모드 첫 화면을 `P = PB + PF` 단순합 구조로 재구성. **PB**(=B×(1−L1)) 신규 노출, F 기호를 **PF**로 변경(한국어 "일차의료 기능보정" 유지). 의원 수입 KPI를 "**의원 공단지급분 변화**"로 재정의해 modelEffect의 PB 캘리브레이션 drift를 제거하고 PF 가산 효과를 별도 행으로 보존 → 균형추 우측 카드와 정확히 매칭. 균형추 추 모양을 사다리꼴 무게추로, % 표시는 추 위 floating bubble로 통합.

---

## 1. 변경 배경

### 1.1 명칭 체계 (P 채팅 합의, 2026-05-01)

v6.9.2-bidir 화면 검토에서 발견:
- 정책 모드 첫 화면에 B·F·균형추 세 카드가 **동등 위계로 평면 노출** → 정책입안자에게 "복잡한 합성 계산"이라는 오해 유발
- B 자체가 이미 `HCC × CR` 합성값인데도 단일 노출되는 패턴이 일관 적용되어 있는 반면, `B(1−L1)` 단계는 사용자가 머릿속에서 조립해야 하는 부담

해결: 한 단계 더 추상화하여 `B(1−L1)`을 **PB (일차의료 기본수가)** 라는 신규 항목으로 노출. F는 기호만 PF로 변경하여 PB와 동등 위계 표현. 결과:

```
[v6.9.3 정책 모드 화면]
🏛️ 일차의료수가  P  =  PB  +  PF       ← 신규 상단 공식 박스
   ────────────────────────────
   1. 일차의료 기본수가 (PB) — 데이터 기반 (NumBox만, 슬라이더 없음)
   2. 일차의료 기능보정 (PF) — 정책 협상 (슬라이더 + NumBox)
      └ ⚖️ PF 자동 산출 도구 ▶  (controlled accordion, 기본 접힘)
   ▼ ⚙️ 고급 설정  — 환자군 기준의료비(B) · L1 직접 조정 (기본 접힘)
```

### 1.2 의원 KPI 재정의 (P 채팅 합의, 2026-05-01)

v6.9.3 1차 구현 후 사용자 검수에서 발견:
- 정책 모드 KPI "지불방식 전환 효과 (선지급) +17,287만원"이 균형추 우측 카드 "+8,911만원"과 **숫자가 맞지 않음**
- 사용자 분석: "PB는 이미 L1을 흡수해 구조적으로 중립이어야 하는데, 데이터 캘리브레이션 drift 때문에 의원 수입에 +17,287만원이 잘못 계상되고 있다"

핵심 메커니즘 (사용자 명시):
- **시뮬레이터 원래 설계**: L 변화만이 의원 수입의 동인. L 변화 0 → 수입 변화 0
- **v6.7 L1·L2 분리 후**: L1은 PB에 구조적으로 흡수. 수입 변화는 ① PF (정책 가산금) ② L2 ↓ (포괄관리 성과가산) ③ 환자 panel 변화 — 이 셋에서만 발생
- L2 ↓ → 의원 수입 ↑ + 공단 지출 ↓ 동시 발생 메커니즘: 안과·정형외과·검사기관 단가 > 일차의료 의원 단가이므로, 환자가 일차의료에 머물수록 공단 외래 총지출 자연 감소

따라서 modelEffect = `Σ n_reg × ((PB + PF + M1×0.3) − M1)` = `Σ n_reg × (PB + PF − M1×0.7)`에서 PB 부분은 **데이터 캘리브레이션 artifact** (B는 HCC×CR, M1은 실측에서 독립 산출되어 PB ≈ M1×0.7 보장 없음). 정책 의도상 0이어야 하는 양.

**해결 옵션 평가** (대화 §3에서 토론):
- **옵션 A**: ② 항목 완전 삭제, 순 변화 = panel + perfEffect만 — PF 효과도 사라짐 (정보 손실)
- **옵션 A2 (채택)**: ② → **PF 가산 효과 (Σ n_reg × PF)** 신규 행. PB drift만 제거하고 PF 가산은 보존. 균형추 우측 카드와 매칭

---

## 2. 이번 세션에서 완료된 일 (커밋 4건)

### 2.1 명칭 체계 + 정책 모드 노출 구조 (커밋 c86c77e)

#### 신규 utils
```js
// src/utils.js
export const calcPB = (B_g, L1_g) =>
  B_g.map((b, i) => Math.round(b * (1 - (L1_g?.[i] ?? 0.7))));

export const PBtoB = (PB_input, L1) =>
  Math.round(PB_input / Math.max(0.001, 1 - L1));
```

#### 함수명 정리
```js
// src/components/FBalanceCorrection.jsx
export function calcPF_fromBalance(targetPct, rule, T_nhi0, T_nhi, PF_current, B_g, n_reg_g) { ... }

// 하위 호환 alias
export const calcF_fromBalance = calcPF_fromBalance;
```

`state.F_g`·`state.P` 등 내부 변수명은 보존 (CLAUDE.md "기호 히스토리" 정신 정합 — `state.P`는 v6.2부터 B 값을 들고 있고 alias만 변경).

#### UI 마크업

| 요소 | v6.9.2-bidir | v6.9.3 |
|---|---|---|
| 정책 모드 상단 | B·F 통합 박스 + 균형추 평면 노출 + L1 박스 | 공식 박스(P=PB+PF) → PB 카드 → PF 카드(균형추 종속) → 고급 패널 |
| 1번 카드 | "환자군 기본수가 (B)" — 슬라이더 4개 | **"일차의료 기본수가 (PB)" — 데이터 기반 배지, 슬라이더 없음, NumBox만** |
| 2번 카드 | "일차의료 기능보정 (F)" | **"일차의료 기능보정 (PF)" — 정책 협상 배지** |
| 균형추 위치 | 평면 별도 카드 | **PF 카드 하단 controlled accordion 종속, 기본 접힘** |
| 균형추 토글 라벨 | (항상 펼침) | **"⚖️ PF 자동 산출 도구"** |
| B/L1 직접 조정 | 1번 박스 + L1 별도 박스 | **고급 패널 아코디언으로 후퇴** (B는 NumBox만, L1은 NumBox 4칸) |

#### FBalanceCorrection 라벨 일괄 치환 (F → PF)

`F 균형추 보정` → `PF 자동 산출 도구` / `F 4군 절대값` → `PF 4군 절대값` / `제안 F` → `제안 PF` / `위 F 값을 슬라이더에 적용` → `위 PF 값을 슬라이더에 적용` / `직전 F로 되돌리기` → `직전 PF로 되돌리기` / `F 분배 규칙` → `PF 분배 규칙` / `음수 F 시나리오` → `음수 PF 시나리오` / `F 가산분이 ...` → `PF 가산분이 ...` / `일차의료 지원 강화 (F 가산)` → `일차의료 지원 강화 (PF 가산)` / `일차의료 지원 영향 (F 차감)` → `일차의료 지원 영향 (PF 차감)`

#### 단위 테스트 추가 (4개 → 누적 67/67)

[src/test/utils.test.js](../src/test/utils.test.js):
- `calcPB`: B×(1−L1) 정확값 (84,250 / 90,060 / 157,074 / 223,595 검증)
- `calcPB`: per-group L1 (non-uniform) 동작
- `calcPB`: L1 fallback (0.7) — `[]` / `undefined` / `[null]` 모두 0.7 적용
- `PBtoB`: 라운드트립 검증 (90,000 ↔ 300,000)

### 2.2 균형추 UI 개선 + 고급 패널 B 슬라이더 제거 (커밋 f08df26)

#### 등록환자 규모 프리셋
NumBox 옆에 4개 버튼: `10만 / 100만 / 1,000만 / 3,000만 명` (M_clinics 자동 환산)

#### 사업 예산 규모 표시 박스 (이후 §2.4에서 삭제됨)
amber 박스에 `T_nhi0` (baseline 공단 외래 지출) 억원 단위 표시 — 정책 anchor용. **§2.4에서 사용자 요청으로 삭제**.

#### 추 모양 (사다리꼴 무게추)
[src/constants.js](../src/constants.js) `balance-thumb` CSS:
```css
input[type=range].balance-thumb::-webkit-slider-thumb {
  width: 50px; height: 56px; margin-top: -22px;
  cursor: grab; border: none;
  background: var(--thumb-bg, #7c3aed);
  clip-path: polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%);  /* 위 좁고 아래 넓은 무게추 */
  box-shadow: 0 6px 18px rgba(124,58,237,0.35);
  transition: transform 0.15s ease;
}
```

#### 추 위 floating % bubble
[src/components/FBalanceCorrection.jsx](../src/components/FBalanceCorrection.jsx) 슬라이더 위 absolute 배치:
- `left: ${pctToLeft(pct)}%` + `transform: translateX(-50%)`로 추 따라 이동
- 신호등 색상(`sig.color`) 매칭, 말풍선 꼬리 (border triangle) 추 위쪽 향함
- 기존 "현재 추 위치 +X%" 별도 박스 삭제 (bubble로 통합)

#### 고급 패널 B 슬라이더 제거
B(환자군 기준의료비)는 HCC×CR 산출값이므로 슬라이더 불필요 — NumBox 4칸 + "미세 수정만 권장" 안내문만 유지. 정책 모드 첫 화면 시각 부담 추가 감소.

### 2.3 PB 카드 슬라이더 제거 (커밋 9d3e4f0)

PB도 산출값(=B×(1−L1))이므로 슬라이더 불필요. NumBox 4칸 + "통상 엑셀 업로드와 L1 디폴트로 결정. 미세 수정만 권장 — 변경 시 내부 B 자동 역산" 안내문.

**산출값 vs 정책값 시각 패턴 통일**:

| 카드/섹션 | 입력 방식 | 의미 |
|---|---|---|
| **PB** (1번 카드) | NumBox만 | 산출값 (B × (1−L1)) |
| **PF** (2번 카드) | 슬라이더 + NumBox | 정책 협상 변수 |
| **B** (고급 패널) | NumBox만 | 산출값 (HCC × CR) |
| **L1** (고급 패널) | NumBox만 | 디폴트 0.70 |

### 2.4 의원 KPI "공단지급분 변화"로 재정의 + WinWinGrid 0% 정합성 (커밋 b62f751)

#### 정책 모드 KPI 카드 재구성

| 항목 | 이전 | v6.9.3 A2 |
|---|---|---|
| 헤더 | 의원 수입 변화 | **의원 공단지급분 변화** |
| 기준 | 기준 수입 (참여 전, 전원 FFS) | **기준 공단지급 (참여 전, 전원 FFS)** |
| ① | 환자군 패널 변화 효과 (panelEffect) | (유지) |
| ② | 지불방식 전환 효과 (선지급) — modelEffect | **PF 가산 효과 (Σ PF × 등록환자)** |
| ③ | 포괄관리 성과가산 (L2 기반) | (유지) |
| 순 변화 | panel + model + perf | **panel + pfEffect + perf** (modelEffect 제외) |
| 참여 후 | 의원당 수입 | **의원당 공단지급** (재계산) |
| 안내문 | 없음 | **본인부담 disclaimer + PB 중립 설명** |

#### pfEffect 계산
```js
// src/components/TabSimulation.jsx
const pfEffect = G.reduce((s, g, i) => s + g.n_reg * (F_g[i] ?? 0), 0);
const govNetChange = decomp.panelEffect + pfEffect + decomp.performanceEffect;
const govAfterIncome = decomp.baselineIncome + govNetChange;
```

균형추 우측 카드 `extraPerClinic = Σ ΔPF × regDist`는 ΔPF의 변화량을 보여주고, KPI ②는 현재 PF의 절대 효과를 보여줌. 균형추 적용 후 KPI ②는 `현재 + extraPerClinic` 만큼 변화 → 두 화면 정합성 보장.

#### 사업 예산 규모 행 삭제

§2.2에서 추가했던 amber 박스 제거 (정책 모드 첫 화면 정보 밀도 추가 감소).

#### WinWinGrid 우측 카드 0% 정합성

```js
// 0% (isExactZero) 분기 신규
{isExactZero ? "🟢 일차의료 지원 변동" : ...}
{isExactZero ? "±0원" : ...}
```

설명문: "✓ 재정중립 anchor — 추 위치 0%에서는 PF 가산 변동도 ±0원 (의원 공단지급분 변화 KPI의 ② PF 가산 효과 행과 일치). 적용 시 PB drift 보정 외 PF 자체는 유지."

#### 본인부담 disclaimer (KPI 카드 footer)
> ⓘ 환자 본인부담은 의료행위별 본인부담률에 따라 다양하게 발생하며, 본 카드는 공단으로부터 의원에게 지급되는 금액만 표시합니다. PB(=B×(1−L1))는 L1을 흡수해 구조적으로 중립이므로, 수입 변화는 PF·L2·panel 효과로만 발생합니다.

---

## 3. 검증 결과

### 3.1 빌드/테스트
- ✅ `npm test` — **67/67 통과** (기존 63 + v6.9.3 신규 4)
- ✅ 빌드 에러 0건
- ✅ 콘솔 에러 0건 (HMR 중간 에러는 정상)

### 3.2 preview 검증

| 시나리오 | 검증 항목 | 결과 |
|---|---|---|
| 정책 모드 진입 | 공식 박스(P=PB+PF), PB 카드, PF 카드, 접힌 균형추, 접힌 고급 패널 | ✓ |
| PB NumBox 90,000원 입력 | 내부 state.P (B) → 300,210원 자동 갱신 (data table 검증) | ✓ |
| 균형추 0% | 좌측 ±0원, 우측 "🟢 일차의료 지원 변동 ±0원" + 재정중립 anchor 설명 | ✓ |
| 균형추 +3% | 좌측 +XX억원, 우측 "🔵 일차의료 지원 강화 (PF 가산)" 분기 | ✓ |
| 추 위 floating bubble | 추 위치 따라 이동, 신호등 색상 매칭 | ✓ |
| 사다리꼴 추 모양 | clip-path 적용 확인 (`polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)`) | ✓ |
| 의원 모드 (`?mode=clinic`) | 정책 카드 모두 숨김 — formula box / PB / PF / balance / advanced 부재 | ✓ |
| 의원 KPI 재정의 | "의원 공단지급분 변화" 헤더, "PF 가산 효과" ② 행, 본인부담 disclaimer | ✓ |
| 사업 예산 규모 박스 제거 | "💰 사업 예산 규모" 텍스트 부재 | ✓ |

---

## 4. 인계장 지시서와의 차이점

원 지시서 §1 표는 `state.F_g → state.PF_g` 일괄 치환을 권장했으나, **내부 변수명은 보존** (B_g 유지 정합성, CLAUDE.md 기호 히스토리 정신). UI 라벨만 PF로 치환. 함수명 `calcF_fromBalance` → `calcPF_fromBalance`는 alias로 하위 호환.

지시서 §3.3 균형추 종속은 `<details>` 태그 사용을 명시했으나, 코드베이스 전체 일관성 위해 **기존 `useState(false) + ▼/▲ 버튼` controlled accordion 패턴 유지**.

지시서 §3.1 raw CSS는 **Tailwind utility + inline-style로 번역** (프로젝트 표준 정합).

PB 슬라이더는 지시서에서 ±50% 상대 range를 제안했으나, 사용자 추가 피드백으로 **슬라이더 자체 제거** (산출값이므로 NumBox만).

균형추 추 모양·% bubble·KPI 재정의·사업예산 박스 등은 지시서 외 **세션 중 추가 사용자 피드백** 반영 (커밋 f08df26 / 9d3e4f0 / b62f751).

---

## 5. 알려진 제한·주의사항

### 5.1 의원 KPI vs 의원 모드 Hero 정합성 (잠재적 회귀)

정책 모드 KPI는 modelEffect 제외, 의원 모드 Hero는 그대로 (decomp.netChange = panel + model + perf 사용). 같은 시나리오에서 **두 모드가 다른 숫자**를 보일 수 있음:
- 정책 모드 "참여 후 의원당 공단지급" = baseline + (panel + pfEffect + perf) per clinic
- 의원 모드 "참여 후" = baseline + (panel + model + perf) per clinic = 정책 모드보다 modelEffect만큼 큼

사용자가 정책 모드와 의원 모드를 비교할 때 혼란 가능. **다음 세션에서 정렬 검토 필요** (의원 모드 Hero도 공단지급분 관점으로 통일할지, 아니면 의원 모드는 본인부담 포함 실 수입 관점 유지할지 결정).

### 5.2 균형추 0% "±0원" 라벨 vs 알고리즘 disconnect

WinWinGrid 우측 카드는 0%에서 항상 "±0원" 표시하지만, 균형추 알고리즘 내부적으로는 0% = "공단 외래 지출 = baseline" 으로 정의되어 있어 실제 ΔPF가 0이 아닐 수 있음 (PB calibration drift 시). 사용자가 "✓ 적용" 클릭 시 PF가 변할 수 있음 — 라벨/동작 disconnect.

대안: 알고리즘 anchor를 baseline → current NHI로 변경하면 0% = "현재 유지"로 일치. 단 CLAUDE.md "baseline 대비" 정책 표준 깨지므로 별도 합의 필요.

### 5.3 데이터 캘리브레이션 가정

KPI ② = PF 가산 효과(절대값) ↔ 균형추 우측 카드 = ΔPF (변화량)는 **개념적으로 매칭되지만 단위가 다름**. 사용자 인지 시 보조 설명 필요 가능. 균형추 적용 전후 KPI ② 변화 = 균형추 우측 카드 값.

### 5.4 의원 모드 "환자군별 공단지급 수가" 라벨

TCard에서 의원 모드는 `simple={true}` → "일차의료수가" 단순 라벨. v6.9.3에서 이 부분은 변경하지 않음 (의원 모드 단순화 유지).

---

## 6. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| [src/utils.js](../src/utils.js) | `calcPB(B_g, L1_g)`, `PBtoB(PB_input, L1)` 신규 export |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | 정책 모드 KPI 재구성 — formula box / PBcard / PFcard / advancedPanel 컴포넌트 분리, KPI 카드 재정의 (modelEffect → pfEffect, 라벨/안내문) |
| [src/components/FBalanceCorrection.jsx](../src/components/FBalanceCorrection.jsx) | 라벨 F → PF 일괄 치환, `calcPF_fromBalance` rename + alias, 등록환자 규모 프리셋 4개, 추 thumb 사다리꼴, % bubble, WinWinGrid 0% 정합성 |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | FCard 라벨 "(F)" → "(PF)", TCard 공식 "(P = B(1−L1)+F)" → "(P = PB + PF)", 음수 F → 음수 PF 툴팁 |
| [src/constants.js](../src/constants.js) | `balance-thumb` CSS — 둥근 원 → 사다리꼴 (clip-path) |
| [src/test/utils.test.js](../src/test/utils.test.js) | 4 신규 테스트 (calcPB·PBtoB) → 누적 67/67 |
| [CLAUDE.md](../CLAUDE.md) | 상단 v6.9.3 블록 신규 (v6.9.2-bidir는 retention) |
| [docs/handoff_v6.9.3.md](handoff_v6.9.3.md) | (이 문서) |

---

## 7. 다음 세션 후보

- **main 머지 + Vercel production 배포 검증** — 사용자 승인 시 머지, 배포 후 정책 모드 첫 화면 + 균형추 + KPI 재검
- **의원 모드 Hero 카드 정렬** (§5.1) — 정책 모드와 일관성 검토. 의원 모드도 공단지급분 관점으로 통일할지 결정
- **균형추 0% 알고리즘 anchor 변경** (§5.2) — current NHI를 anchor로 변경 시 라벨/동작 일치. 정책 의미 보전 검토
- **L1 시드 갱신** — 데이터 수령 후 placeholder 0.70 → 실측 환자군별 차등값
- **모바일 720px 반응형 회귀** — 정책 모드 첫 화면 (formula box + PB + PF + 균형추 펼침)에서 가독성 점검
- **시뮬레이터 v7 명칭 정리** — 내부 변수명 (state.P, state.F_g) → 신 명칭(state.B, state.PF) 일괄 치환 (별도 PR, 호환성 영향 큼)

---

## 8. 머지 가이드

```bash
# 사용자 승인 후
git checkout main
git pull
git merge --no-ff feature/v6.9.3-naming-pb-pf -m "Merge 'feature/v6.9.3-naming-pb-pf' — v6.9.3 명칭 체계 PB·PF + KPI 재정의"
git tag v6.9.3 -m "v6.9.3: PB·PF 명칭 체계 + 의원 공단지급분 KPI"
git push origin main --tags
```

Vercel 자동 배포 (https://primary-simulator.vercel.app/) — 약 1~2분.

---

*문서 작성: 2026-05-02*
*세션 완료 커밋: c86c77e → f08df26 → 9d3e4f0 → b62f751*
*핵심 결정: PB·PF 명칭 채택, modelEffect → pfEffect 교체 (A2 옵션), 산출값 NumBox-only 패턴 통일, 사다리꼴 추 + floating bubble*
