# v6.9.6 인계장 — 데이터 기반 디폴트·anchor + L1=base.L 실측 자동 산출 + PF 음수 금지

**완료일**: 2026-05-02
**선행**: v6.9.3 (명칭 PB·PF + 정책 모드 노출 구조 + 의원 KPI 공단지급분 변화 재정의)
**브랜치**: `feature/pilot-defaults-reset` → main 머지 완료
**입력 자료**: 사용자 세션 피드백 3건 (2026-05-02)

---

## 0. 한 줄 요약

복지부 시범사업안 임의 디폴트(100기관 × 3,000명)를 **파일럿 데이터 anchor(10기관 × 6,960명 = 69,604명)**로 정렬. L1을 데이터 실측 그 자체(`base.L`)로 자동 산출하고 새 데이터 업로드 시 자동 동기화 — 향후 3,000개 의원 만성질환관리시범사업 데이터 업로드만으로 모든 디폴트가 그 데이터로 전환됨. PF는 정책 협상 변수로서 음수 시나리오 도입했던 v6.9.2-bidir 결정을 폐기하고 슬라이더 min=0 + reducer 0 floor.

---

## 1. 변경 배경

### 1.1 환자군 패널 디폴트 (v6.9.4)

사용자 세션 피드백:
> "원래 파일럿 전체 N(10개 의원, 69,604명)로 만든 시뮬레이터인데, 환자군 패널을 만들면서 임의로 전체 환자수를 3천명으로 설정해버렸어. (한 의원이 너무 많은 환자를 보는 것 같아서)"
> "시뮬레이터 초기화 버튼은 모두 파일럿 테스트에서 나온 값으로 초기화"
> "지금 분석 중인 만성질환관리시범사업 참여의원 약 3천개 의원의 데이터 결과가 나오면 그대로 시뮬레이터에 업로드할 예정이므로 그를 위해서도 데이터 기반한 초기화 버튼 필요"

핵심 요구:
- 디폴트값이 **데이터(파일럿 또는 향후 3,000개 의원 데이터)에 항상 정렬**
- 초기화 버튼이 그 데이터 anchor로 복귀
- 사용자가 임시로 의원 수·환자수를 변경해도 anchor는 보존

### 1.2 L1 시멘틱 명확화 (v6.9.5)

사용자 세션 피드백:
> "파일럿 실측 L(0.77~0.80)을 그대로 적용하여, 환자군별 L1을 실측값으로 갱신해야 하겠어"
> "추후 3천개 의원 데이터 새로 업로드해도 그 데이터 실측값 L1을 사용하도록 세팅"
> "L1 — 정책 협상 변수가 아니고, base.L — 데이터 실측 타원이용비중이어야 한다. CLAUDE.md '디폴트 0.70 placeholder'도 원래 설계대로 데이터 실측을 출발점으로"

설계 의도 회복:
- v6.7부터 CLAUDE.md에 "L1 디폴트 0.70 (데이터 수령 전 placeholder)"로 명기되어 있었으나, 데이터 수령 후에도 placeholder 유지 + "엑셀 L → L1 복사" 수동 버튼만 제공
- 사용자 결정: L1은 협상 변수가 아니라 **데이터 실측 그 자체**. 디폴트가 곧 base.L. 새 데이터 업로드 시 자동 동기화.

### 1.3 PF 음수 금지 (v6.9.6)

사용자 세션 피드백 (스크린샷 첨부):
> "PF 는 음수값 없애고 최소 0으로 해 줘"

배경: v6.9.2-bidir에서 도입했던 음수 PF 시나리오(하한 -B/2, "정책 협상 하한선 탐색용")는 정책 의도와 어긋난다고 판단. 균형추 모듈에서 음수 시나리오 산출 후 PF 슬라이더에 적용되는 경로 차단.

---

## 2. 구현 내역

### 2.1 환자군 패널 anchor (v6.9.4)

[`src/constants.js`](../src/constants.js):
- `INIT_TOTAL_N = sum(INIT_BASE.N)` 자동 산출 (= 69,604)
- `INIT_M_CLINICS = officialBaseline.M_clinics ?? 10` (JSON 메타에서 읽기, fallback 10)
- `INIT_PER_CLINIC = round(INIT_TOTAL_N / INIT_M_CLINICS)` (= 6,960)
- `INIT_BASE_PER_CLINIC = INIT_PER_CLINIC`
- `INIT_DATA_LABEL = officialBaseline.dataLabel ?? "데이터 baseline (..)"`

[`src/data/presets/official_baseline.json`](../src/data/presets/official_baseline.json):
- `M_clinics: 10` 필드 신규
- `dataLabel: "10개 의원 파일럿 (2023, 69,604명)"` 필드 신규
- `version: "6.9.4"`

[`src/hooks/useSimulator.js`](../src/hooks/useSimulator.js):
- `state.datasetM`, `state.datasetTotalN`, `state.datasetLabel` anchor state 신설
- `LOAD_DATA`가 anchor 갱신 (action.M_clinics가 있으면 datasetM 함께 갱신)
- `RESET_REG`이 anchor로 복귀:
  - `totalN = sum(state.base.N)` (사용자 인라인 편집 반영)
  - `M_clinics = state.datasetM`
  - `baseN_per_clinic = round(totalN / M)`

[`api/commit-baseline.js`](../api/commit-baseline.js):
- 요청 body에서 `M_clinics`·`dataLabel` 추가 수용 (검증 후 JSON에 저장)

[`src/components/TabSimulation.jsx`](../src/components/TabSimulation.jsx):
- "공식 baseline 등록" 모달 미리보기에 의원 수·sum(N)·dataLabel 추가 노출
- POST 본문에 `M_clinics`, `dataLabel` 함께 전송

### 2.2 L1 실측 자동 산출 (v6.9.5)

[`src/constants.js`](../src/constants.js):
- `INIT_L1 = INIT_BASE.map(b => b.L)` 자동 산출 (파일럿: [0.7975, 0.7934, 0.7943, 0.7722])

[`src/hooks/useSimulator.js`](../src/hooks/useSimulator.js):
- `LOAD_DATA`가 `L1`을 새 `action.base.map(b => b.L)`로 자동 동기화 (옵션 A)
- `RESET_L1`이 현재 `state.base.map(b => b.L)`로 복귀 (data anchor 패턴)

[`src/components/TabSimulation.jsx`](../src/components/TabSimulation.jsx) — 고급 패널 L1 박스:
- 부제 라벨: `디폴트 0.70` → `디폴트 = 데이터 실측 L`
- 버튼 라벨: `엑셀 L → L1 복사` → `↩ 실측 L로 동기화` (사용자가 임의 조정 후 되돌리기)

### 2.3 PF 음수 금지 (v6.9.6)

[`src/components/RegistrationPanel.jsx`](../src/components/RegistrationPanel.jsx) — FCard:
- 슬라이더 `min=-B/2` → `min=0`
- `isNeg` 분기·빨강 트랙·⚠ 배지·rose ring 제거 → 단일 양수 패스만

[`src/hooks/useSimulator.js`](../src/hooks/useSimulator.js):
- `SET_F_AT`: `Math.round(action.value)` → `Math.max(0, Math.round(action.value))`
- `SET_F_ALL`: `action.values.map(v => Math.round(v))` → `Math.max(0, Math.round(v))`
  - 균형추(`calcPF_fromBalance`)가 음수 PF 산출 → "적용" 버튼 클릭 시에도 0으로 floor

### 2.4 단위 테스트 (8개 신규/갱신 — 누적 73/73 통과)

[`src/test/calculator.test.js`](../src/test/calculator.test.js):

**v6.9.4 (4개)**:
- `INIT_TOTAL_N === ON === 69604`
- `INIT_M_CLINICS === 10`
- `INIT_PER_CLINIC === 6960`
- 회귀 방지: 디폴트가 임의 100/3,000/300,000이 아님

**v6.9.5 (4개)**:
- `INIT_L1`이 `INIT_BASE.L`과 일치 (placeholder 0.70 폐기)
- `INIT_L1` 가중평균이 78.6% (파일럿 baseLavg)
- `LOAD_DATA L1 동기화 명세` (새 base의 L → L1)
- `RESET_L1 base.L 복귀 명세`

(기존 `INIT_L1=0.7` 가정 테스트 2개는 신규 시멘틱에 맞춰 갱신)

---

## 3. 향후 3,000개 의원 데이터 시나리오

1. 관리자가 새 엑셀 업로드 → `state.base`·`state.P`(=B)·`state.L1` 모두 그 데이터로 동기화
2. 환자군 패널 NumBox로 의원 수 조정 (예: 3,000개)
3. "🏛️ 현재 값을 공식 baseline으로 등록" 버튼 클릭
4. `/api/commit-baseline`이 `base`·`P`·`M_clinics`·`dataLabel`을 GitHub Contents API로 `official_baseline.json` 갱신
5. Vercel 자동 재배포 (1~2분)
6. 모든 사용자의 디폴트 `INIT_BASE`·`INIT_B`·`INIT_L1`·`INIT_M_CLINICS`·`INIT_TOTAL_N`·`INIT_DATA_LABEL`이 새 데이터로 자동 정렬
7. 환자군 패널 / L1 카드 "↩ 초기화" 버튼이 새 데이터 anchor로 복귀

---

## 4. 정책 의미

- **L1은 협상 변수가 아니라 데이터 그 자체**: CLAUDE.md 도메인 모델에서 "선지급 기준 타원이용비중 (과거 평균 기반)"이라고 적힌 것의 직관적 해석. 사용자가 정책 시나리오 탐색을 위해 슬라이더로 임시 조정은 가능하나, 디폴트와 reset은 항상 데이터 실측.
- **PF는 정책 협상 변수**: 환자군별 차등 가능, 코디네이터·간호사·영양사 등 일차의료 기능 강화 자원으로 활용. 다만 음수(=환자군 기본수가에서 차감) 시나리오는 정책 의도 밖이라 v6.9.6에서 폐기.
- **데이터 anchor 패턴**: 환자군 패널·L1 카드·B 카드의 "↩ 초기화"가 모두 "현재 데이터(파일럿 또는 업로드된 데이터)의 실측값"으로 복귀. 사용자가 정책 슬라이더로 시나리오를 만들었다가 데이터 baseline을 비교하고 싶을 때 한 클릭으로 복귀 가능.

---

## 5. 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| [src/constants.js](../src/constants.js) | `INIT_TOTAL_N=ON` · `INIT_M_CLINICS=JSON.M_clinics ?? 10` · `INIT_PER_CLINIC=round(N/M)` · `INIT_L1=INIT_BASE.L` |
| [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) | `state.datasetM/datasetTotalN/datasetLabel` anchor · `LOAD_DATA`가 anchor + L1 동기화 · `RESET_REG`/`RESET_L1`이 anchor로 복귀 · `SET_F_AT`/`SET_F_ALL` 0 floor |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | FCard 슬라이더 `min=0`, 음수 시각 처리 제거 |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | 공식 baseline 등록 모달 + POST에 M_clinics·dataLabel · L1 카드 라벨 정합 |
| [src/data/presets/official_baseline.json](../src/data/presets/official_baseline.json) | `M_clinics: 10`·`dataLabel` 필드 추가, version 6.9.4 |
| [api/commit-baseline.js](../api/commit-baseline.js) | M_clinics·dataLabel 검증·저장 |
| [src/test/calculator.test.js](../src/test/calculator.test.js) | 8 신규/갱신 테스트, 누적 73/73 |
| [CLAUDE.md](../CLAUDE.md) | v6.9.4·v6.9.5·v6.9.6 블록 추가, L1 정의·placeholder 표현 정합 |
| [docs/handoff_v6.9.6.md](handoff_v6.9.6.md) | (이 문서) |

---

## 6. 다음 세션 후보

- **균형추(FBalanceCorrection) 음수 영역 정합 정리** — 슬라이더 −5%~0% 음수 영역, 음수 PF 안내 배너·경고 배지 등을 0%~+10% 단방향으로 폐기 (v6.9.2-bidir의 양방향 메커니즘 단순화). 현재는 균형추가 음수 PF 산출해도 "적용" 시 reducer 0 floor로 잘리지만 산출-적용 시각 불일치 잠재.
- **3,000개 의원 만성질환관리시범사업 데이터 업로드** — 분석 결과 수령 후 엑셀 업로드 → "공식 baseline 등록" 버튼 클릭 → 모든 사용자 디폴트 갱신 검증
- **v6.9.5 L1 자동 동기화 UX 안내** — LOAD_DATA 직후 "L1이 새 데이터의 실측 L로 자동 갱신됨" 토스트 추가 검토 (균형추 모듈의 "직전 PF로 되돌리기" 패턴과 동일)
- **시뮬레이터 v7 명칭 정리** — 내부 변수명(state.P, state.F_g) → 신 명칭(state.B, state.PF) 일괄 치환 (별도 PR, 호환성 영향 큼)

---

## 7. 머지 완료 (2026-05-02)

✅ **main 머지 완료** — commit `832f32f` (--no-ff), tag `v6.9.6` push.

Vercel 자동 배포: https://primary-simulator.vercel.app/ — 약 1~2분 후 v6.9.6 화면 적용.

```bash
# 실행된 명령
git checkout main && git pull --ff-only origin main
git merge --no-ff feature/pilot-defaults-reset -m "Merge ... v6.9.6 데이터 기반 디폴트·anchor + L1 실측 자동 산출 + PF 음수 금지"
git tag v6.9.6 -m "v6.9.6: 데이터 기반 디폴트·anchor + L1=base.L 실측 자동 산출 + PF 음수 금지"
git push origin main --tags
```

검증 권장:
- production URL 첫 진입 (의원 모드) → 환자군 패널: 10기관 × 6,960명 = 69,604명, 등록 1,000명/의원
- 정책 모드 진입 → 고급 패널 펼치기 → L1 박스: [0.80, 0.79, 0.79, 0.77] / 가중평균 78.6%
- PF 카드 (정책 모드): 음수 슬라이더 영역·빨강 트랙 사라짐, min=0 단방향
- 의원 수를 100으로 임시 변경 → 환자군 패널 "↩ 초기화" → 10기관 / 69,604명 복귀
- L1 슬라이더로 임의 조정 → "↩ 초기화" → 파일럿 base.L로 복귀

---

*문서 작성: 2026-05-02*
*머지 commit: 832f32f / tag: v6.9.6*
*세션 commits: 078ae67 (v6.9.5) → 7274e2c (v6.9.6) → 832f32f (merge)*
*핵심 결정: 디폴트·anchor 모두 데이터 기반 정렬 / L1은 협상 변수 아님 / PF 음수 폐기 / "머지" 명시 시 commit·push·docs 정합 한 묶음 (메모리 갱신)*
