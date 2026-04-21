# v6.5.0 인계장 — Track 탭 참여의원 성과배분 박스 + PT/SS 편집 가능 + SS 분모 토글

**작업일**: 2026-04-22
**전 버전**: v6.4.8
**현 버전**: v6.5.0
**브랜치**: `feature/track-shared-saving-v6.5`
**작업 형태**: 브랜치에서 구현 → 프리뷰 검증 → 사용자 머지 지시 대기

---

## 작업 배경

일차의료개발센터장 요청으로 Track 탭에 성과배분(Shared Saving) 박스를 신설하여
**PT(1년차 1회) ↔ 성과배분(2년차~) 양축** 구조를 완성한다.
동시에 Shared Saving 탭의 "공단 적립" 개념을 "일차의료 전환 지원(재투자)" 로
리프레이밍하여 선순환 정책 메시지를 명확히 한다.

### 사용자 의도 (요약)
1. Track 탭 PT 박스 아래에 **참여의원 성과배분** 박스 신설
2. 재원 = SS 탭 일차의료 배분액 ÷ M_clinics (N분의 1 균등 배분)
3. PT와 동일한 Track 차등 (A 10% / B 50% / C 100%)
4. SS 탭의 배분 용도를 **참여의원 성과배분** / **일차의료 전환 지원(재투자)** 으로 리브랜딩
5. SS 절감률 분모를 건강보험 전체 vs 사업대상 환자로 토글 가능하게
6. PT / 성과배분 Track% 모두 편집 가능 (NumBox)

---

## 변경 요약

### ① 상태 추가 (src/hooks/useSimulator.js)
```
ptPctA: 10, ptPctB: 50, ptPctC: 100          // PT Track 지급률
ssPctA: 10, ssPctB: 50, ssPctC: 100          // 성과배분 Track 지급률
ssCostBase: "total"                          // "total" | "project"
ssProjectCost: 1.0                           // 조원 (사업대상 총진료비)
```

Reducer 신규 케이스:
- `RESET_PT_PCT` → PT 지급률 10/50/100 복귀
- `RESET_SS_PCT` → 성과배분 지급률 10/50/100 복귀
- `RESET_SS_COST` → 건강보험 전체 · 110.8조원 복귀

### ② SS 파생 변경 (useSimulator.js)
```js
const costBaseValue = ssCostBase === "project" ? ssProjectCost : ssTotalCost;
const totalMedCost = costBaseValue * 1e12;
```
MACRO_SYNC도 동일 기준 분모 사용. SS 객체에 `costBaseValue` 추가 (UI 표기용).

### ③ Shared Saving 탭 리브랜딩 (TabSharedSaving.jsx)
- **기준 토글**: 총괄 카드 상단에 라디오 2개 + 각각 입력 + 초기화 버튼
  - 선택된 쪽만 활성, 비선택은 disabled+opacity 40%
- **총 절감액 문구**: `"총 절감액 (건강보험 전체 110.8조원 기준)"` 등 선택된 기준 노출
- **배분 비율 카드 제목**: `Shared Saving 성과 배분 비율` → `절감액 배분 비율`
- **슬라이더 라벨**: `공단 적립` → **`일차의료 전환 지원`**, `일차의료` → **`참여의료 성과배분`**
- **프리셋 버튼**: `공단 적립 100%` → `전환지원 100%`, `일차의료 100%` → `성과배분 100%`
- **슬라이더 바로 아래 설명 박스 (신규)**:
  - 🟢 **참여의원 성과배분** — 사업 참여 의원에게 직접 지급되는 성과보상금
  - 🔴 **일차의료 전환 지원** — ① 신규 PT, ② 지원센터 구축·운영, ③ IT/교육/질 관리 시스템
- **파이 차트·범례**: 동일 라벨 변경
- **Win-Win-Win 의원 카드**: `절감 성과의 X% 배분` → `성과배분 X% · X억 의원 직접 지급`
- **Win-Win-Win 공단 카드**: `절감성과 X% 적립` → `전환 지원 X% 재투자 · X억 신규 PT·인프라`

### ④ Track 탭 재설계 (TabTrack.jsx)
- **PT 박스** — "일차의료 전환지원금 (PT) · 1년차 1회"
  - 우상단: 기준 금액 NumBox + **↩ 초기화**
  - Track A/B/C 각 칸에 **지급률 NumBox** (0~500% 범위)
  - 금액 = `pt_base × ptPct`
  - 기존 `getPTPct` 함수 제거 → `interp(hc, ptPctA, ptPctB, ptPctC)` 사용
- **참여의원 성과배분 박스 (녹색, 신규)** — "· 2년차부터 매년"
  - 재원: `SS.clinicFromItem` ÷ `M_clinics` = 의원당 기준 배분
  - 상단 한 줄 요약 (계산식 노출): `4,015억 ÷ 100개 × Track % = XXX만원`
  - Track A/B/C 각 칸에 **지급률 NumBox** + **↩ 초기화**
  - `SS.clinicFromItem == 0`이면 박스 `opacity: 0.7` + 안내 메시지
- **의원당 연간 수입 합계 박스 (노란색, 신규)**
  - 1년차 합계 (Track 수입 + PT + 성과배분)
  - 2년차 이후 매년 (Track 수입 + 성과배분)

### ⑤ App.jsx 프롭 추가
- TabTrack에 `SS` · `resetPtPct` · `resetSsPct` 전달
- TabSharedSaving에 `resetSsCost` 전달

### ⑥ 테스트 (src/test/calculator.test.js)
신규 describe 블록 "v6.5 PT/SS Track percentages" 5 tests:
- 기본값 10/50/100 확인
- 선형보간 엔드포인트/중간값
- 성과배분 의원당 = clinicFromItem / M × Track %
- 디폴트 cost base = "total" · 사업대상 디폴트 = 1.0조원
- derivedMacroPct가 선택 기준에 따라 스케일

**21/21 통과 (이전 16 + 신규 5)**

### ⑦ 상수 (src/constants.js)
```
INIT_PT_PCT_A / B / C = 10 / 50 / 100
INIT_SS_PCT_A / B / C = 10 / 50 / 100
INIT_SS_COST_BASE = "total"
INIT_SS_PROJECT_COST = 1.0
```

---

## 검증 (Preview MCP)

### SS 탭
- 건강보험 전체 ● 선택: "총 절감액 (건강보험 전체 110.8조원 기준) 8,030.0억원" · 절감률 0.72%
- 사업대상 환자 ● 선택: "총 절감액 (사업대상 1조원 기준) 8,030.0억원" · 절감률 80.3% (분모만 변경)
- 초기화 버튼: 건강보험 전체 + 110.8 복귀 확인
- 슬라이더 하단 🟢/🔴 설명 박스 노출 확인

### Track 탭 (Track C 기준)
- PT: A 100만 / B 500만 / C 1,000만 (디폴트)
- 성과배분: 재원 4,015억 ÷ 100 = 401,500만원 · A 40,150 / B 200,750 / C 401,500만원
- 1년차 합계: +2,887 + +1,000 + +401,500 = +405,387만원 ✓
- 2년차 이후: +2,887 + +401,500 = +404,387만원 ✓

### Track A 전환 (hccPct=0)
- PT 100만 · 성과배분 40,150만 활성화
- 1년차 합계: +2,288 + +100 + +40,150 = +42,538만원 ✓
- 2년차 이후: +2,288 + +40,150 = +42,438만원 ✓

### 콘솔
에러 0건.

---

## 수식 요약 (v6.5 신규)

```
Track 지급률 선형보간:
  interp(hc) = hc ≤ 50
             ? A + hc × (B − A) / 50
             : B + (hc − 50) × (C − B) / 50

PT:
  ptPct = interp(hccPct; ptPctA, ptPctB, ptPctC)
  PT    = pt_base × ptPct / 100        (의원당, 1년차)

성과배분:
  ssPerClinicFull = SS.clinicFromItem / M_clinics
  ssPct           = interp(hccPct; ssPctA, ssPctB, ssPctC)
  ssPay           = ssPerClinicFull × ssPct / 100     (의원당, 매년)

의원당 수입 합계:
  1년차        = (Track 후 수입 − 기준 수입) + PT + ssPay
  2년차 이후   = (Track 후 수입 − 기준 수입) + ssPay

SS 절감률 분모:
  costBaseValue = ssCostBase === "project" ? ssProjectCost : ssTotalCost
  derivedMacroPct = itemTotal / (costBaseValue × 1e12) × 100
```

---

## 알려진 미결

1. **사업대상 총진료비 자동 추정**
   - 현재 분석가 수동 입력(기본 1.0조원). 환자군별 M1·이용분포에서 자동 역산 옵션 검토 가능.
   - 보류 이유: 고위험군 1인당 의료비가 평균의 2~3배라 단순 비례가 부정확.

2. **성과배분의 규모 가중치(등록환자 수)**
   - 현재는 N분의 1 균등. 정책 고도화 시 "등록환자 수 가중" 토글 추가 여지.

3. **PT/SS NumBox 범위 상한 500%**
   - 실수 방지용 상한. 정책 협상에서 필요 시 조정.

---

## 변경 파일 요약

```
M  src/constants.js                      (+INIT_PT_PCT_A/B/C, INIT_SS_PCT_A/B/C, INIT_SS_COST_BASE, INIT_SS_PROJECT_COST)
M  src/hooks/useSimulator.js             (state 6개 추가, reducer 3 케이스, SS useMemo 재작성, 콜백 3개)
M  src/App.jsx                           (TabTrack에 SS/resetPtPct/resetSsPct · TabSharedSaving에 resetSsCost)
M  src/components/TabSharedSaving.jsx    (기준 토글 + 설명 박스 + 라벨/Win-Win 리브랜딩)
M  src/components/TabTrack.jsx           (PT NumBox 편집 + 성과배분 박스 신설 + 1년차/2년차 합계 분리)
M  src/test/calculator.test.js           (v6.5 PT/SS Track% describe 블록 5 tests 추가)
M  CLAUDE.md                             (v6.5.0 섹션, Track/SS 탭 순서 재작성, 태그 이력 동기화)
A  docs/handoff_v6_5_0.md                (본 문서)
```

---

## 머지 체크리스트

- [x] feature/track-shared-saving-v6.5 브랜치에서 구현
- [x] 단위 테스트 21/21 통과
- [x] 프리뷰 MCP로 SS 탭·Track 탭 시각 검증
- [x] 콘솔 에러 0
- [x] CLAUDE.md 동기화
- [x] handoff_v6_5_0.md 작성
- [ ] 사용자 "머지" 명시 지시 대기
- [ ] 머지 후 v6.5.0 태그 + origin push

---

# v6.5.1 추가 정비 (같은 브랜치 내)

## 작업 배경

사용자 추가 요청 (v6.5.0 프리뷰 확인 후):
1. SS 탭 헤더 `C] 성과기반 조정` 레이블 삭제 (불필요)
2. "일차의료 전환 지원" 색상 빨강(공단 관습색) → 파랑 — 공단이 가져가는 수익이 아니라 **일차의료 재투자** 재원이므로 공단 색상 부정확
3. SS 탭 Win-Win-Win 3카드 삭제 (Track/KPI와 중복)
4. Track 탭 KPI 2카드(Track 수입 변화 + 공단 외래 지출 변화) 삭제 — 수가 시뮬 탭과 중복
5. 맨 아래에 **Track 비교 전용 요약 박스** 신규 — 3 Track 병렬 + PT(1년차)/SS(매년) 구분 명확

## 변경 요약

### TabSharedSaving.jsx
- `<span>C] 성과기반 조정</span>` 제거
- `WinWinWin` import 제거 + 컴포넌트 블록 제거
- 빨강 `#dc2626/#ef4444` → 파랑 `#3b82f6/#2563eb`로 전환 (슬라이더 그라디언트·프리셋 버튼·분할바·파이 차트·범례·설명 박스 아이콘 🔴→🔵)
- 슬라이더 좌 라벨 `text-red-600` → `text-blue-600`

### TabTrack.jsx
- ③ KPI 2카드 블록 삭제 (Track 수입 변화 · 공단 의원급 외래 지출 변화)
- ⑥ 단일-Track 의원당 연간 수입 합계 박스 삭제 → 아래 비교 박스로 통합
- 신규 **⑥ Track별 수입 비교 박스** (맨 아래, 차트 다음):
  - 테이블: 3 Track 병렬
  - 행: Track 수입 / 변화(vs 기준 FFS) / PT(1년차) / 성과배분(매년) / 1년차 합계(Track+PT+성과) / 2년차 이후(Track+성과)
  - `tracks` 배열에서 각 Track의 income/chg/ptAmt/ssAmt/firstYear/ongoing 모두 계산
  - 최하단에 `기준 FFS 의원당 수입 = XX,XXX만원/년` 참조값 표시
- import 정리: `BarChart/fE/diffAuto` 제거, `fAuto` 유지

### 색상 선택 근거

| 요소 | v6.5.0 | v6.5.1 | 이유 |
|---|---|---|---|
| 일차의료 전환 지원 (SS 배분) | 빨강 | **파랑** | 공단 수익이 아니라 재투자 재원 |
| 참여의원 성과배분 | 녹색 | 녹색 | 의원 직접 수령 · 유지 |
| 총 절감액 (거시 숫자) | 빨강 | 빨강 | 절감 강조용 · 유지 |
| 기준 토글 카드 | 빨강 | 빨강 | 절감액 분모 선택이라 총 절감액과 관련 · 유지 |

## 검증

- 단위 테스트 21/21 통과 (계산 로직 변경 없음)
- 프리뷰 MCP:
  - SS 탭: "C]" 레이블 부재 · 파랑 그라디언트 · 🔵 아이콘 · Win-Win-Win 블록 없음 · 파이 차트 청/녹 조화 ✓
  - Track 탭 (A 상태): Track 선택 → L → PT → 성과배분 → 차트 → 비교 박스 (KPI 2카드 없음) ✓
  - Track 비교 테이블 수치 검증:
    - Track A: +42,538 (1년차) / +42,438 (2년차)
    - Track C: +405,387 (1년차) / +404,387 (2년차)
    - 기준 FFS = 44,954만원/년 표시 ✓
- 콘솔 에러 0

## 변경 파일 요약 (v6.5.1 추가)

```
M  src/components/TabSharedSaving.jsx    ('C]' 제거, Win-Win-Win 블록·import 제거, 빨강→파랑 전환)
M  src/components/TabTrack.jsx           (KPI 2카드·단일 합계박스 삭제, Track 비교 박스 신설, import 정리)
M  CLAUDE.md                             (Track/SS 탭 순서 v6.5.1 반영, 색상 근거 명시, 태그 이력 업데이트)
M  docs/handoff_v6_5_0.md                (본 문서 v6.5.1 섹션 추가)
```

---

---

# v6.5.2 Track 비교 박스 정비 (같은 브랜치 내)

## 작업 배경

사용자 v6.5.1 프리뷰 확인 후 추가 요청:
1. 1년차 합계 = **Track + PT** 만 (성과배분 제외) — 성과는 2년차부터 지급되는 개념 명확화
2. 하단 참고 문구 변경:
   - `기준 FFS 의원당 수입 = 44,954만원/년`
   - → `참고: 현행 FFS 진료 형태 사업 비참여 의원 수입 = 44,954만원/년`
3. 차트와 비교 박스 순서 swap (비교가 앞, 차트가 뒤)
4. 헤더의 `(의원당/년, M=100)` → `(의원당/년)` (M=100 삭제)
5. **합계 계산 근본 수정**: 현재 합계가 Track 수입보다 작게 나와서 직관 반대. 변화량(diffMan)이 아닌 **절대 수입(fMan)** 으로 표기

## 수정 내용 (TabTrack.jsx)

```js
// v6.5.1 (변화량 표기 — 직관 반대)
firstYear: gain + ptAmt + ssAmt,    // gain = income - baseFFS
ongoing:   gain + ssAmt,

// v6.5.2 (절대 수입값 + 인센티브)
firstYear: t.income + ptAmt,        // 1년차는 PT만 (성과 2년차부터)
ongoing:   t.income + ssAmt,
```

테이블 표시도 `diffMan` → `fMan`으로 전환 (부호 없이 절대 만원 값).

## 검증 (Preview MCP DOM 추출값)

| 항목 | Track A | Track B | Track C |
|---|---|---|---|
| Track 수입 | 47,241만원 | 47,541만원 | 47,841만원 |
| PT (1년차) | +100만원 | +500만원 | +1,000만원 |
| 성과배분 (매년) | +40,150만원 | +200,750만원 | +401,500만원 |
| **1년차 합계 (Track+PT)** | **47,341만원** | **48,041만원** | **48,841만원** |
| **2년차 이후 (Track+성과)** | **87,391만원** | **248,291만원** | **449,341만원** |

계산 검증:
- Track A 1년차: 47,241 + 100 = 47,341 ✓
- Track C 2년차: 47,841 + 401,500 = 449,341 ✓

합계가 이제 Track 수입보다 커서 직관에 맞음.

## 변경 파일 요약 (v6.5.2 추가)

```
M  src/components/TabTrack.jsx      (firstYear/ongoing 공식 절대값화, 차트 위치 swap, 참고 문구 변경, M=100 제거, diffMan/BarChart import 제거)
M  CLAUDE.md                         (Track 탭 순서 v6.5.2 반영, 합계 공식 · 태그 이력 업데이트)
M  docs/handoff_v6_5_0.md            (본 문서 v6.5.2 섹션 추가)
```

---

## 머지 체크리스트 (v6.5.0 + v6.5.1 + v6.5.2 통합)

- [x] feature/track-shared-saving-v6.5 브랜치에서 3 단계 구현
- [x] 단위 테스트 21/21 통과 (계산 로직 미변경)
- [x] 프리뷰 MCP DOM 추출로 Track 비교 박스 모든 수치 검증
- [x] 실제 렌더 화면 정상 (HMR 과정 중 과거 에러 기록은 무시)
- [x] CLAUDE.md v6.5.2 동기화
- [x] handoff_v6_5_0.md v6.5.2 섹션 추가
- [ ] 사용자 "머지" 명시 지시 대기
- [ ] 머지 후 `v6.5.2` 단일 태그 + origin push
