# v6.9.2-bidir 인계장 — F 균형추 양방향 + 절대 재정중립

**완료일**: 2026-05-01
**선행**: v6.9.2 (F 균형추 보정 모듈 1차 구현 — "ΔF 추가" 해석)
**브랜치**: `feature/v6.9.2-f-balance-bidir` (main 미머지 · 사용자 승인 대기)
**입력 자료**: 사용자 코드 통합 지시서 「F 균형추 보정 모듈 v6.9.2 — 양방향 균형추 + 절대 재정중립」 (2026-05-01)

---

## 0. 한 줄 요약

균형추 0% 위치의 의미를 **"공단 외래 지출 변화 0원 (baseline 대비)"** 으로 확정. 추 위치는 더 이상 ΔF 추가 강도가 아니라 baseline 대비 목표 변화율(−5%~+10%)이며, F 4군은 그 목표를 만족하도록 **절대값으로 자동 산출**된다 (음수 가능). 이전 v6.9.2의 "재정중립 0%인데 +44.5억 표기" 라벨/산출 불일치 해소.

---

## 1. 변경 배경

v6.9.2 1차 구현 후 사용자 검수 시 발견한 문제:

```
[v6.9.2 화면]
균형추 위치: 0% "재정중립" "자동균형"
실제 공단 외래 지출 변화: +44.5억원 (+2.15%)
```

→ "재정중립"이라는 단어가 절대적 의미(공단 지출 변화 0원)를 시사하나 실제 산출은 "추가 ΔF 투입 0원" 의미(현재 시뮬을 그대로 두는 것)로 동작. 정책입안자 멘탈 모델과 정면 충돌.

근본 원인: 균형추를 "현재 시뮬 위에 ΔF를 추가하는 도구"로 설계했으나, 사용자 기대는 "F 4군 절대값을 자동 산출하는 도구". 후자가 정책 모드 멘탈 모델에 압도적으로 자연스러움. 정책입안자가 묻는 진짜 질문은:

> "공단 지출을 baseline 대비 X%만큼 변화시키려면 F 4군이 어떻게 정해져야 하는가?"

균형추는 이 질문에 답하는 **단일 다이얼**이어야 하며, 0%는 자연스러운 중심점이 되고 좌우 대칭으로 절감/투자 영역이 갈라진다.

P 채팅 결정 (2026-05-01):
- Q1. 슬라이더 범위 = **−5% ~ +10%**
- Q2. F 슬라이더 음수 허용 = **허용** (정책 도구 정직성 우선, 협상 하한선 탐색용)

---

## 2. 이번 세션에서 완료된 일

### 2.1 핵심 수식 교체

`distribute()` 함수의 출력 의미가 "ΔF 추가" → "F 절대값"으로 전환되며, 산출 입력이 변경됨:

| 항목 | v6.9.2 (1차) | v6.9.2-bidir |
|---|---|---|
| 추 의미 | "현재 시뮬 위 ΔF 추가량" | **"baseline 대비 공단 외래 지출 목표 변화율"** |
| 0% 정의 | "ΔF 0원 추가" | **"baseline 대비 변화 0원"** |
| 입력값 | `deltaTotal = T.nhi × pct/100` | **`F_total_target = T.nhi0×(1+pct/100) − (T.nhi − Σ F×n_reg)`** |
| 출력 의미 | F 슬라이더에 **더할** ΔF | F 슬라이더의 **새 절대값** |
| 슬라이더 범위 | `0 ~ +10%` | **`−5% ~ +10%`** |
| 위치 매핑 | `left% = pct × 10` | `left% = ((pct + 5) / 15) × 100` (0%는 33.33%) |
| 디폴트 추 위치 | 3.0% | **0% (재정중립 자동 진입)** |

### 2.2 신규 핵심 함수 `calcF_fromBalance`

```js
// src/components/FBalanceCorrection.jsx
export function calcF_fromBalance(targetPct, rule, T_nhi0, T_nhi, F_current, B_g, n_reg_g) {
  const targetNHI = T_nhi0 * (1 + targetPct / 100);
  const F_contribution = F_current.reduce(
    (acc, Fv, i) => acc + (Fv || 0) * (n_reg_g[i] || 0), 0
  );
  const NHI_withoutF = T_nhi - F_contribution;
  const F_total_target = targetNHI - NHI_withoutF;
  return distribute(F_total_target, rule, B_g, n_reg_g);  // 음수 허용
}
```

- `T_nhi0`: 참여 전 baseline (전원 FFS 가정)
- `T_nhi`: 현재 시뮬 NHI (사업 후·L2 반영, F 포함)
- `NHI_withoutF`: 현 NHI에서 F 기여분만 제거 → "F=0 시 어떤 NHI가 나오는가"
- `F_total_target`: 목표 NHI를 만족하는 F 합계 총액 (음수 가능)
- `distribute()`: HCC비례·균등·역비례 중 선택 → 4군 1인당 F 절대값

### 2.3 신호등 7단계 + 6단계 그라디언트 + 0% 중심선

`signalLevel(pct)`:

| 추 위치 | 라벨 | 색상 cls |
|---|---|---|
| ≤ −3 | 🔵 강한 절감 | deep-blue |
| ≤ −1 | 🟦 절감 | blue |
| ≤ 0 | 🟢 미세조정 | green-pale |
| ≤ 2 | 🟢 재정중립 | green |
| ≤ 5 | 🟡 적극 투자 | yellow |
| ≤ 8 | 🟠 고투자 | orange |
| > 8 | 🔴 협상 한계 | red |

그라디언트 6 stop (각 zone에 한 색상 채움): `#bfdbfe → #dbeafe → #d1fae5 → #a7f3d0 → #fde68a → #fed7aa → #fecaca`. 0% 중심선 (33.33% 위치)에 `#10b981` 세로선 + "재정중립" 라벨 표기.

영역 라벨 7개 (전체 폭 분할): `13.33% / 13.33% / 6.67% / 13.33% / 20% / 20% / 13.33%`.

### 2.4 F 슬라이더 음수 허용

[src/hooks/useSimulator.js](../src/hooks/useSimulator.js) reducer:
- `SET_F_AT`: `Math.max(0, ...)` 가드 제거 → `Math.round(value)`
- `SET_F_ALL`: 동일

[src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) F 슬라이더:
- 음수 하한: `min={-Math.round(B_g[i] / 2)}` (정책 가드레일 −B/2)
- 음수 시 NumBox 빨강 ring + `⚠` 마크
- 트랙 fill 분기: 양수면 환자군 색상, 음수면 빨강(`#fecaca` ~ 0 위치까지)

### 2.5 윈윈 카드 3-mode 분기 (`WinWinGrid` 컴포넌트 내부 분리)

| pct 영역 | 좌측 카드 | 우측 카드 |
|---|---|---|
| `\|pct\| < 0.05` (정확 0%) | 🟢 재정 중립 달성 ±0원 | 🔵 의원 수입 영향 (회색 톤) |
| `pct < −0.05` (음수) | 🟦 공단 외래 지출 절감 | 🟡 의원 수입 영향 (F 차감) amber 톤 + ⚠ 안내 |
| `pct > 0.05` (양수) | 🔵 공단 외래 지출 변화 (현재 vs 적용 후 2칸) | 🔵 의원 수입 강화 (F 가산) |

### 2.6 AI 산출 결과 음수 F 경고

- `F_new.some(v => v < 0)` 시 헤더에 "⚠️ 음수 F 포함" 빨강 배지
- 4군 카드 중 음수 군: 빨강 배경(`rgba(239,68,68,0.18)`) + `⚠` 마크 + 빨강 텍스트
- 카드 그리드 하단: 빨강 안내바 ("환자군 기본수가에서 차감되는 시나리오로, 실제 시범사업 적용 시 권장되지 않습니다. 정책 협상 하한선 탐색용으로만 활용하세요.")
- 음수 영역(`pct < −0.05`) 진입 시 모듈 상단에 amber 박스 자동 노출 (메인 안내)

### 2.7 프리셋 6개

| pct | label | sub |
|---|---|---|
| −3% | 강한 절감 | (deep-blue) |
| −1% | 절감 | (blue) |
| 0% | 재정중립 | (green) |
| +1% | 최소투입 | (green) |
| +3% | 표준투입 | (yellow) |
| +5% | 적극투입 | (yellow) |

### 2.8 단위 테스트 누적 23개 (기존 15 + 신규 8)

[src/test/fBalance.test.js](../src/test/fBalance.test.js):

신규:
- `distribute()` 음수 totalTarget 허용 — equal 합산 보존, hcc 단조성 반전 (4군 가장 깊은 음수)
- `calcF_fromBalance(0, ...)` → 적용 후 NHI = baseline (1억 이내)
- `calcF_fromBalance(+5, ...)` → 적용 후 NHI = baseline × 1.05 (1억 이내)
- `calcF_fromBalance(-3, ...)` → 적용 후 NHI = baseline × 0.97 (1억 이내)
- `calcF_fromBalance(-5, ...)` → 음수 F 포함 (`F_new.some(v => v < 0)`)
- `signalLevel` 7단계 경계값 (deep-blue/blue/green-pale/green/yellow/orange/red)
- 위치 매핑 `pctToLeft` (−5%→0, 0%→33.33, +10%→100)

기존 9개는 `distribute()` 시그니처·합산 보존 의미 동일하므로 그대로 통과.

---

## 3. 검증 결과

### 3.1 빌드/테스트

- ✅ `npm test` — **63/63 통과** (기존 51 + v6.9.2-bidir 신규 12)
- ✅ `npm run build` — 성공 (CSS 25.4kB → 26.7kB · JS 110kB → 118kB · recharts 553kB · xlsx 425kB)
- ✅ 콘솔 에러 0건

### 3.2 preview 검증 (디폴트 시나리오 = 100개 의원 × 의원당 1,000명 등록)

| 추 위치 | 좌측 카드 (균형추 적용 시) | 우측 카드 | 라벨 분기 |
|---|---|---|---|
| **0%** | **±0원** (+0.00%) ← baseline 정확 일치 | +8,911만원/의원·년 | 🟢 재정 중립 달성 ✓ |
| +5% | +103.2억원 (+5.00%) ← `T.nhi0 × 5% = 103.22억` ✓ | +192.8억 사업 전체 | 🔵 공단 외래 지출 변화 ✓ |
| −3% | −61.9억원 (−3.00%) ← `T.nhi0 × −3% = −61.93억` ✓ | +26.9억 (ΔF 양수) | 🟦 공단 외래 지출 절감 ✓ |
| −5% | −103.2억원 (−5.00%) | −14.6억 (ΔF 음수) | 🟡 의원 수입 영향 (F 차감) ⚠ ✓ |

−5% 시나리오에서 AI 산출 결과: 1군 6,088원 / 2군 6,508원 / 3군 11,351원 / 4군 16,158원 (모두 양수). ΔF: −3,912 / −13,492 / −18,649 / −23,842 (모두 음수). 차감 시나리오 정확 분기.

**디폴트 시나리오에서 F 자체가 음수로 표시되지는 않음** — 현재 F=차등 [10k,20k,30k,40k]이 작은 값이라 −5%까지도 양수 영역 잔존. F 음수 시각화를 보려면 F 시작값을 크게 한 뒤 −5% 가야 발현. 정책 의도는 ΔF 음수 + 우측 카드 amber 분기로 충분히 전달.

### 3.3 핵심 회귀 검증

- 의원 모드 진입 시 균형추 미노출 가드 동작 ✓ (이전 v6.9.2 동일)
- "✓ F 슬라이더에 적용" 클릭 → setFAll(F_new) + appliedSnapshot 백업 ✓
- "↩ 직전 F로 되돌리기" 노출 + 동작 ✓
- 등록환자 NumBox 직접 입력 → M_clinics derive + reducer가 totalN 자동 동기화 ✓
- F 슬라이더 음수 입력 시 NumBox 빨강 + 트랙 빨강 fill ✓

---

## 4. 인계장 지시서와의 차이점

원 지시서 §3 "UI 마크업 변경"은 `<div class="weight">` 커스텀 드래그 핸들러를 권장했으나, v6.9.2와 동일하게 **표준 `<input type="range">` + `balance-thumb` CSS 패턴 유지**. 이유: 시뮬레이터 일관성 + 키보드/스크린리더 폴백 자동 + v6.9.2 P 채팅의 결정 4건과 정합.

지시서 §6 "윈윈 카드 양방향 표현"의 좌측 카드 "🟢 선순환 잠재력 (L2 5%p 개선 시)"은 v6.9.2 사용자 피드백(0c9866d)에서 이미 **"공단 외래 지출 변화" 2칸 비교**로 교체된 상태. 본 v6.9.2-bidir에서도 그 결정 유지(좌측 = 공단 영향, 우측 = 의원 영향).

---

## 5. 알려진 제한·주의사항

- **디폴트 시나리오에서 음수 F 미발현** — 현재 F=차등 [10k,20k,30k,40k]은 작아서 −5%까지도 양수 잔존. 음수 F 시각 검증을 보려면 F를 (예: 20·40·60·80만 등) 크게 둔 뒤 균형추를 음수로. ΔF는 음수로 정상 표시되어 정책 의도는 전달됨.
- **F 슬라이더 step 1000원** — 음수 영역도 동일. 적용 후 NumBox에는 정확한 1원 단위 값(예: 6,088원), 슬라이더 thumb는 step에 맞춰 6,000으로 시각 반올림. 미세조정 시 NumBox 직접 입력 필요.
- **현재 NHI < baseline 시나리오에서 −% 추 위치도 양수 ΔF 가능** — 디폴트가 그 케이스. 시뮬 NHI = baseline − 88.7억(현 F 차등이 작아 baseline 보다 낮음)인데 추 위치를 −3%로 두면 목표 NHI = baseline − 61.9억이 되어, NHI를 +26.9억 끌어올려야 하므로 ΔF 양수가 됨. 라벨은 "🟦 공단 외래 지출 절감" 으로 정확히 표기 (절대 재정중립 의미 정합).
- **추 위치 −5%/+10% 고정 범위** — 정책 협상 단계에서 ±15%로 확장 시 `PCT_MIN`/`PCT_MAX` 상수 1줄 변경 + 그라디언트 stop 위치 재계산 필요.

---

## 6. 변경 파일 목록

| 파일 | 변경 |
|---|---|
| [src/components/FBalanceCorrection.jsx](../src/components/FBalanceCorrection.jsx) | 전체 재작성 — `calcF_fromBalance` 신규 export, `distribute` 음수 허용(가드 `<= 0` → `=== 0`), `signalLevel` 7단계, 슬라이더 양방향, 6단계 그라디언트, 0% 중심선, 7개 영역 라벨, 6 프리셋, 윈윈 카드 3-mode 분기, 음수 F 경고 배지·안내바·배너 |
| [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) | reducer `SET_F_AT`/`SET_F_ALL` 음수 가드 제거 |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | FCard F 슬라이더 음수 하한 `-B/2` + 빨강 시각 강조 + 트랙 fill 분기 |
| [src/test/fBalance.test.js](../src/test/fBalance.test.js) | 23 테스트 (기존 9 → 신규 14 추가, 기존 9 그대로 통과) — calcF_fromBalance, signalLevel 7단계, 음수 분배 |
| [src/App.jsx](../src/App.jsx) | 풋터 v6.9.2 → v6.9.2-bidir |
| [CLAUDE.md](../CLAUDE.md) | 상단 v6.9.2-bidir 블록 신규 (v6.9.2는 1차 구현 historical로 retention) · 파일 구조 코멘트 갱신 · 버전 태그 이력에 v6.9.2-bidir 추가 |

---

## 7. 다음 세션 후보

- **사용자 검수 + main 머지** — 본 인계장 검토 후 사용자 명시 지시 시 main 머지 + 태그 `v6.9.2-bidir`.
- **Vercel production 배포 검증** — 머지 후 `?mode=policy`에서 0%·±5%·−3%/−5% 시나리오 재검.
- **F 음수 시각 검증 회귀** — 의도적으로 큰 F를 두고 −5% 가서 4군 모두 음수 표기 확인. (preview에서 현재 모듈만 검증, 큰 F 시나리오 미검.)
- **추 위치 ±15% 확장** — 정책 협상 단계 시나리오 확장.
- **분배 규칙 4번째 옵션** — "환자군별 수동 비율" (정책 협상 단계 운영 후 검토).
- **음수 F를 환자군별로 다르게 분배하는 옵션** — 현재 HCC 비례에서는 4군이 가장 깊은 음수. "1군만 음수, 4군은 양수" 같은 정밀 분배 옵션 추가 가능.
- **모바일 720px 반응형 검증** — 데스크톱 우선으로 작성, 7개 영역 라벨이 좁은 화면에서 겹칠 가능성 점검.

---

**인계장 끝.**
