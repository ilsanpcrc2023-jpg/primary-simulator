# v6.9.2 인계장 — F 균형추 보정 모듈 (정책 모드 전용)

**완료일**: 2026-05-01
**선행**: v6.9.1 (3번 탭 라벨 재구성 — "절감 → 변화·성과·체계 지원" 프레임)
**브랜치**: `feature/v6.9.2-f-balance-correction` (main 미머지 · 검증 후 사용자 명시 지시 시 머지)
**입력 자료**: 사용자 코드 통합 지시서 (2026-05-01) — 「F 균형추 보정 모듈 v6.9.1 — 코드 통합 지시서 (보강판)」 + 페어 목업 HTML

---

## 0. 한 줄 요약

수가 시뮬레이션 정책 모드에 **F 균형추 보정 모듈** 신설. 추 위치(0~10%)로 "현 시뮬 공단 외래 지출 대비 추가 투입 강도"를 정하면 ΔF_total을 환자군별로 자동 분배(HCC비례·균등·역비례)해 4군 F 슬라이더에 적용. **Shared Saving은 일체 미포함** (별도 풀, 일차의료수가 아님 — 사용자 명시).

---

## 1. 변경 배경 (작업 착수 전 사용자 합의 4건)

지시서 검토 시 작업자(Claude) 의견 4가지 우려 → 사용자 결정:

1. **도메인 매핑 정정** — 지시서의 `BASE_NHI = 2064.4e8` 하드코딩과 `SS_PER_L2_PP = 14.7e8` 가정 폐기. 분모는 시뮬레이터 메모 `T.nhi`(현 시뮬·L2 반영)에서 derive, 좌측 윈윈 카드는 **포괄관리 성과가산 잠재**(`Σ 0.05 × B × n_reg × trackMul / M`)로 교체. **Shared Saving은 일차의료수가에 들어올 개념이 전혀 아니므로 본 모듈에 일체 미포함** (사용자 명시).
2. **부호 컨벤션 일관성** — `fChangeAuto`/`diffAuto`/`fMan`/`diffMan` 등 utils 헬퍼 재사용 (v6.9.1 컨벤션). `fChangeAuto`를 TabSharedSaving 안 정의 → utils로 끌어올림.
3. **드래그 패턴 (a) vs (b)** → 사용자 결정: **(b) 표준 `<input type="range">` + thumb 비주얼 styling**. 시뮬레이터의 모든 슬라이더가 `big-thumb` 패턴이므로 `balance-thumb` CSS만 입혀 64px 둥근 무게추 구현 (커스텀 드래그 핸들러 미사용 · 키보드/스크린리더 표준 폴백 자동).
4. **신호등 임계값 정책 근거** → 사용자: 정책 근거 없음. 시각적 가이드(메타포)로만 사용. 메모 박스에 "신호등 임계값: 시각적 가이드 (정책 근거 없음, v6.9.2)" 명시.

---

## 2. 이번 세션에서 완료된 일

### 2.1 신규 파일

- **[src/components/FBalanceCorrection.jsx](../src/components/FBalanceCorrection.jsx)** — 새 컴포넌트
  - `distribute(deltaTotal, rule, B, n_total_g)` — 분배 함수, export (테스트 가능)
  - `signalLevel(pct)` — 신호등 4단계, export
  - 슬라이더 + 신호등 배지 + 프리셋 + 직접입력 + 윈윈 카드 + 분배 규칙 + AI 결과 + 메모

- **[src/test/fBalance.test.js](../src/test/fBalance.test.js)** — 신규 단위 테스트 15개
  - distribute: zero-input, equal/hcc/inverse 합산 보존, hcc 단조증가, inverse 단조감소
  - signalLevel: 4 zone 경계값 (≤2, ≤5, ≤8, >8)
  - utils.fChangeAuto: 양수 prefix `−`, 0 부호 없음, 음수 pass-through

### 2.2 수정 파일

| 파일 | 변경 |
|---|---|
| [src/utils.js](../src/utils.js) | `fChangeAuto` export 추가 (TabSharedSaving 내부 정의에서 끌어올림) |
| [src/components/TabSharedSaving.jsx](../src/components/TabSharedSaving.jsx) | local `fChangeAuto` 정의 제거, utils import |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | `FBalanceCorrection` import 후 정책 모드(`mode === "policy"`)에서 F 박스 직후·TCard 직전에 마운트. props: `state`, `G`, `T`, `performance: perfMemo`, `setFAll` |
| [src/constants.js](../src/constants.js) | `sliderCSS`에 `balance-thumb` 스타일 + `pulse` 키프레임 추가 |
| [src/App.jsx](../src/App.jsx) | 풋터 v6.9.1 → v6.9.2 |
| [CLAUDE.md](../CLAUDE.md) | 상단 버전 줄 v6.9.2 + v6.9.1 누적 표기 / 파일 구조에 FBalanceCorrection·fBalance.test.js 추가 / 버전 태그 이력 줄에 v6.9.2 항목 |

### 2.3 도메인 매핑 (지시서 대비 정정 사항)

| 지시서 변수 | 지시서 값 | 시뮬레이터 매핑 (v6.9.2 실제) |
|---|---|---|
| `BASE_NHI` | 2064.4e8 (하드코딩) | **`T.nhi`** — 현 시뮬·L2 반영 공단 의원급 외래 지출. 디폴트 시나리오에서 1,975.7억 |
| `BASE_CLINIC_INCOME` | 44953e4 (하드코딩) | `decomp.baselineIncome / M` (직접 매핑) — 본 모듈에서는 윈윈 카드에 직접 노출 안 함 |
| `TRANSFER_GAIN` | 6352e4 (하드코딩) | `decomp.modelEffect / M` — 본 모듈에서는 KPI 박스에서 별도 표시 |
| `SS_PER_L2_PP` | 14.7e8 (출처 불명) | **폐기** — Shared Saving 모듈로부터 분리 (사용자 명시) |
| 좌측 윈윈 표시 | "L2 5%p 개선 시 절감 −74억" | **포괄관리 성과가산 잠재** (`Σ 0.05 × B × n_reg × trackMul / M`) — 의원당 추가 가산. 디폴트 시나리오에서 의원당 +1,928만원/년 |
| 우측 윈윈 표시 | "+8,416만원 (+18.7%)" | **F 가산 효과** (`Σ ΔF[i] × regDist[i]`) — 본 모듈 직접 효과. +3% 추 + HCC비례 시나리오에서 의원당 +5,956만원/년 |

### 2.4 분배 함수 (3종 모두 합산 보존)

```js
distribute(deltaTotal, rule, B, n_total_g)
```

- **HCC 비례** (`rule="hcc"`, 디폴트): `w_g = B_g × n_g`, `ΔF_g = (ΔTotal × w_g/W) / n_g`. 위험도 高 → 1인당 ΔF 두텁게 (4군 > 3군 > 2군 > 1군).
- **균등** (`rule="equal"`): `ΔF = ΔTotal / Σ n_g` (모든 군 동일).
- **역비례** (`rule="inverse"`): `w_g = (1/B_g) × n_g`, `ΔF_g = (ΔTotal × w_g/W) / n_g`. 경증 등록 진입 인센티브 (1군 > 2군 > 3군 > 4군).

모든 규칙에서 `Σ ΔF_g × n_g = ΔTotal` 합산 보존 (테스트로 검증).

### 2.5 신호등 임계값

| 추 위치 | 라벨 | 색상 | 의미 |
|---|---|---|---|
| 0~2% | 🟢 재정중립 | green | (시각 가이드 — 정책 근거 없음) |
| 2~5% | 🟡 적극 투자 | yellow | |
| 5~8% | 🟠 고투자 | orange | |
| 8% 초과 | 🔴 협상 한계 | red | |

CLAUDE.md·인계장·메모 박스에 "정책 근거 없음" 명시.

### 2.6 추 비주얼 (수평 균형추, 표준 input 베이스)

`<input type="range" class="balance-thumb">` — `constants.js sliderCSS`에 `balance-thumb` 정의:
- 트랙: 신호등 4구간 그라디언트 배경 (inline style로 설정)
- thumb: 64px 둥근 흰 추 + 보라(#7c3aed) 외곽선 + 그림자
- hover에 1.06배 확대 (transform), grab/grabbing 커서
- 키보드 ↑↓←→ 표준 동작 (input type=range 기본)

### 2.7 적용/되돌리기

- "✓ 위 F 값을 슬라이더에 적용" 클릭 → `setAppliedSnapshot([...state.F_g])` 백업 후 `setFAll(F_new)`
- 적용 후 "↩ 직전 F로 되돌리기" 버튼 노출 (조건부 렌더 — `appliedSnapshot` 있을 때만)
- 안내문: "적용 후 균형추를 다시 움직여도 F는 자동 갱신되지 않으며, 다시 적용 버튼을 눌러야 반영됩니다."

---

## 3. 검증 결과

### 3.1 빌드/테스트

- ✅ `npm test` — **51/51 통과** (기존 36 + 신규 15)
- ✅ `npm run build` — 성공 (xlsx 425kB · recharts 553kB · index 110kB · CSS 25.4kB)
- ✅ 콘솔 에러 0건

### 3.2 preview 검증 (디폴트 시나리오 = 100개 의원 × 의원당 1,000명 등록)

| 검증 시나리오 | 결과 |
|---|---|
| 정책 모드 진입 (`?mode=policy`) → F 박스 직후 균형추 마운트 | ✅ |
| 의원 모드 진입 (`?mode=clinic`) → 균형추 미노출 (가드 동작) | ✅ |
| 슬라이더 디폴트 값 = 30 (3.0%, 표준투입 active) | ✅ |
| 분모 메모 표시 = 1,975.7억 (`T.nhi`) | ✅ |
| 분자 메모 표시 = 99,385명 (`Σ G[i].n_reg`, 환자군별 N clamp 반영) | ✅ |
| 우측 윈윈 (F 가산): 의원당 +5,956만원·사업 전체 +59.6억 | ✅ (≈ 1,975.7×3% = 59.27억) |
| 좌측 윈윈 (포괄관리 성과가산 잠재): 의원당 +1,928만원 | ✅ (Track C 디폴트 trackMul=1 기반) |
| HCC 비례: 1군 +43,167원 / 2군 +46,144원 / 3군 +80,480원 / 4군 +114,563원 (단조증가) | ✅ |
| 균등: 모든 군 +59,638원 (1인당 동일) | ✅ |
| 역비례: 1군 +74,044원 / 2군 +69,267원 / 3군 +39,715원 / 4군 +27,899원 (단조감소) | ✅ |
| "✓ 적용" 클릭 → F 슬라이더 4개 갱신 (역비례 시 84k/89k/70k/68k) + 되돌리기 버튼 노출 | ✅ |
| "↩ 되돌리기" 클릭 → 직전 F [10k/20k/30k/40k] 복원 + 되돌리기 버튼 숨김 | ✅ |
| 풋터 = v6.9.2 | ✅ |

---

## 4. 인계장 지시서와의 차이점

원 지시서 대비 작업자(Claude) + 사용자 협의 결정 정정 6건:

1. **`SS_PER_L2_PP` 폐기** — Shared Saving 14.7억/L2 1%p 가정은 출처 불명 + Shared Saving은 일차의료수가에 들어올 개념이 아니므로 폐기 (사용자 명시).
2. **`BASE_NHI` 하드코딩 제거** — 시뮬레이터 메모 `T.nhi`로 derive하여 다른 변수 변경 시 자동 갱신.
3. **좌측 윈윈 카드 정의 변경** — "회수 잠재력 −74억"(SS 절감) → "포괄관리 성과가산 잠재 +1,928만원/의원·년" (`Σ 0.05 × B × n_reg × trackMul / M`).
4. **드래그 핸들러 미사용** — (b) 표준 `<input type="range">` + thumb CSS 패턴. 지시서 §3·§4의 `<div class="weight">` + onMouseDown/onTouchStart 코드는 채택 안 함. 이유: 시뮬레이터 일관성 + 키보드/스크린리더 폴백 자동.
5. **신호등 정책 근거 명시** — 메모 박스·CLAUDE.md·인계장에 "시각 가이드 · 정책 근거 없음" 명시.
6. **`fChangeAuto` 헬퍼 utils로 끌어올림** — TabSharedSaving 안 정의 → `src/utils.js` export → 양 컴포넌트에서 import. 컨벤션 일관성.

---

## 5. 알려진 제한·주의사항

- **F 슬라이더 step=1000** — 적용 시 `state.F_g`는 정확한 값(예: 84,044원)이지만 슬라이더 표시는 step에 맞춰 84,000으로 반올림되어 보임. NumBox에는 정확한 84,044원 표시. 정책 모드 미세조정 시 NumBox로 직접 입력해야 step 1,000 단위 한계 우회 가능.
- **포괄관리 성과가산 잠재 계산은 보조 표시** — `Σ 0.05 × B × n_reg × trackMul / M` 단순 가정. 실제 시뮬레이터 메모 `performance.perf_total`은 `Σ max(0, L1 − L2) × B × n_reg × trackMul`이며, "L2 5%p **추가** 개선"은 현재 L2 위치와 무관하게 +5%p 마진을 가정한 것. 만약 L2가 이미 L1 - 5%p보다 낮으면 이 추가 마진은 비현실적. 향후 보강 후보.
- **분배 후 NumBox·슬라이더 step 외 값 보존** — `setFAll`은 `Math.max(0, Math.round(value))`로 라운드. 84,044원같은 1원 단위 값도 그대로 보존됨 (NumBox 표기 정확). 슬라이더 thumb 위치만 step=1,000 반올림.
- **추 위치 0~10% 고정** — 디폴트 범위. 정책 협상 단계에서 ±15% 등 확장 검토는 향후.
- **분배 규칙 3종만 제공** — HCC비례·균등·역비례. 운영 후 "환자군별 수동 비율" 옵션은 향후.
- **윈윈 카드 dimmed 임계 0.5%** — 추 위치 < 0.5% 시 좌·우 카드 opacity-60. 정확한 0%일 때 양쪽 모두 투입 효과 0이라 이 처리가 시각적으로 자연스러움.
- **신호등 임계값 정책 근거 없음** — 사용자 결정. 향후 건정심 협상 가이드(통상 1~3%)와 매핑할 경우 임계값 조정 가능.

---

## 6. 시뮬레이터 외부 영향 (도메인/문서)

- **공식·계산 변경 없음**: B, F, P = B(1−L1) + F, 공단지급, 본인부담, L1·L2, 포괄관리 성과가산, SS 산식 모두 불변.
- **Shared Saving 모듈 영향 없음**: 본 모듈은 SS와 분리 운영. SS 탭 변경 없음.
- **변수명·함수명 보존**: `state.F_g`, `setFAll`, `T.nhi`, `G[i].n_reg`, `decomp.*` 등 영문 식별자 그대로.

### 통합참조 v6.0 본 문서 동시 반영 사항 (시뮬레이터 외부, 별도 진행)

- **Part 5.7 (균형 게이지)**: F 균형추 보정 모듈 신설 + 분배 규칙 3종 + 신호등 4단계 명시. 정책 근거 없음 명시.
- **Part 6 (시뮬레이터 UI 원칙)**: "정책 모드 한정 모듈" 운영 원칙 추가.

> 이 작업들은 시뮬레이터 코드 외 노션/문서 영역이며, 본 인계장 범위 밖.

---

## 7. 다음 세션 후보 (v7.0 이전)

- **Vercel 배포 검증** — 본 브랜치 머지 후 production preview에서 균형추 동작 확인.
- **포괄관리 성과가산 잠재 계산 보강** — L2 절대값과 무관한 +5%p 가정 → 현재 L2 위치 기반 derive로 정밀화.
- **F 슬라이더 step 1원 단위 옵션** — 현재 step=1000으로 인한 시각 반올림 문제 해소 (정책 모드 한정).
- **분배 규칙 4번째 옵션** — "환자군별 수동 비율" (정책 협상 단계 운영 후 검토).
- **신호등 임계값 데이터 기반 매핑** — 건정심 수가 인상률 가이드(통상 1~3%)와 매핑하여 정책 근거 부여.
- **균형추 추 위치 ±15% 확장** — 정책 협상 단계 시나리오 확장.
- **AI 산출 결과 박스 미세조정 영역** — 적용 전 4군 ΔF를 사용자가 1만원 단위로 미세조정하는 인라인 NumBox 4개.
- **모바일 720px 반응형 검증** — 데스크톱 우선으로 작성, 모바일 미검증.

---

## 8. 머지 안내

본 브랜치 (`feature/v6.9.2-f-balance-correction`)는 **검증 후 사용자 명시 지시 대기 중**. 머지 명령 시:

```bash
git checkout main
git merge --no-ff feature/v6.9.2-f-balance-correction \
  -m "Merge 'feature/v6.9.2-f-balance-correction' — v6.9.2 F 균형추 보정 모듈 (정책 모드 전용)"
git tag -a v6.9.2 -m "v6.9.2 — F 균형추 보정 모듈 (정책 모드 · F 박스 직후 마운트)"
git push origin main --tags
```

---

**인계장 끝.**
