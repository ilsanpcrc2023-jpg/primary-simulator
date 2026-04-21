# v6.5.5 인계장 — Track 성과배분 박스 + Shared Saving 리브랜딩 (v6.5.0 ~ v6.5.5 통합)

**작업일**: 2026-04-22
**전 버전**: v6.4.8
**현 버전**: v6.5.5
**세션 태그**: v6.5.0 / v6.5.1 / v6.5.2 / v6.5.3 / v6.5.4 / v6.5.5 (6 태그)
**작업 형태**: 각 증분마다 feature 브랜치 → `--no-ff` 머지 → 태그 → origin push (사용자 검증 및 "머지" 명시 지시 시점에만 진행)

---

## 세션 배경

v6.4.8(P카드 헤더 동적 L% + 하단 수식 제거) 완료 후, 일차의료개발센터장 추가 요청으로 시작.

**핵심 요구**:
1. Track 탭에 **참여의원 성과배분** 박스 신설 (PT는 1회성, 성과배분은 2년차부터 매년)
2. Shared Saving 탭의 "공단 적립" 개념을 "일차의료 전환 지원(재투자)"로 **재프레이밍**
3. 사업대상 환자 의료비를 시뮬 중심 기준으로 전환 (디폴트 변경 + Track 재원 연동)
4. UI 간결화 (KPI 중복 카드 제거, Win-Win-Win 제거, Track 비교 테이블 통합)

---

## 태그별 변경 요약

### v6.5.0 (Track 성과배분 박스 + PT/SS Track% 편집 + SS 분모 토글 + 배분 용도 리브랜딩)
**커밋**: `094e163` → merge `147eb89`

- state 6개 추가: `ptPctA/B/C`, `ssPctA/B/C`, `ssCostBase`, `ssProjectCost`
- Reducer 신규 케이스: `RESET_PT_PCT`, `RESET_SS_PCT`, `RESET_SS_COST`
- SS useMemo 재작성: `costBaseValue`에 따라 분모 분기
- MACRO_SYNC도 기준 반영
- Track 탭: PT 박스에 Track별 지급률 NumBox 추가, 신규 참여의원 성과배분 박스
- SS 탭: 기준 토글(건보/사업대상) + 🟢/🔴 배분 용도 설명 박스 + 리브랜딩
- 단위 테스트 5 신규 (Track 지급률 보간, 성과배분 공식, cost base)

### v6.5.1 (Track 비교 박스 통합 + KPI/WinWinWin 삭제 + 전환 지원 색상 blue화)
**커밋**: v6.5.0과 같은 브랜치 내 후속. 같은 PR로 머지됨 (`147eb89`에 포함).

- Track 탭: KPI 2카드(Track 수입 변화·공단 외래) 삭제 (수가 시뮬 탭 중복)
- 단일 합계 박스 삭제 → Track별 수입 비교 박스로 통합 (3 Track 병렬 테이블)
- SS 탭: "C] 성과기반 조정" 레이블 제거 + Win-Win-Win 3카드 삭제
- **일차의료 전환 지원 색상 red → blue** (`#3b82f6`) — 공단 수익이 아니라 재투자 재원이라는 의미 명료화

### v6.5.2 (합계 공식 절대값화 + 1년차 PT만 + 참고문구 개선 + 차트 후치)
**커밋**: 같은 머지 `147eb89`에 통합.

- **합계 공식 근본 수정**: 1년차 합계가 Track 수입보다 작게 나오는 비직관 문제 해결
  - `firstYear = gain + ptAmt + ssAmt` → `firstYear = t.income + ptAmt` (절대값 + PT만, 성과 제외)
  - `ongoing = gain + ssAmt` → `ongoing = t.income + ssAmt`
  - `diffMan` → `fMan` 표시
- 참고 라인: `기준 FFS 의원당 수입 = ...` → `참고: 현행 FFS 진료 형태 사업 비참여 의원 수입 = ...`
- 차트 위치: 비교 박스 뒤로 이동 (결과 확인 → 세부 차트 순)
- 헤더 `(의원당/년, M=100)` → `(의원당/년)` (M=100 제거)

### v6.5.3 (SS 사업대상 단위 조원 → 억원)
**커밋**: `9b14cc0` → merge `e26b699`

- `INIT_SS_PROJECT_COST`: 1.0 (조원) → 10000 (억원)
- useSimulator SS 계산: 사업대상은 `×1e8`, 건보 전체는 `×1e12`
- TabSharedSaving: "조원" → "억원" 라벨, input 폭 w-14 → w-20
- 총 절감액 캡션 단위 분기 표기

**근거**: 사업대상 환자 총진료비는 수천~수만억 규모(100의원×3천명×200만원 ≈ 6,000억)라 조원 단위는 소수점 입력 필요해 분석가 편의 저하.

### v6.5.4 (디폴트 사업대상 1,000억 + Track 재원 사업대상 연동 + SS 절감액 비례 축소) ★ 핵심 구조 변경
**커밋**: `2981dff` → merge `b4aa85f`

- `INIT_SS_COST_BASE`: 'total' → **'project'** (앱 최초 진입 시 사업대상 선택)
- `INIT_SS_PROJECT_COST`: 10000 → 1000 (억원)
- **SS useMemo에 `projectScale` 도입** — 사업대상 기준 선택 시 절감액을 비례 축소
  ```js
  projectScale = (ssProjectCost × 1e8) / (ssTotalCost × 1e12)
  itemTotal = rawItemTotal × projectScale
  ```
  예: 건보 8,030억 절감 → 사업대상 1,000억 기준 ≈ 7.25억
- MACRO_SYNC는 항상 건보 기준(`ssTotalCost`)으로 역산 (사용자 편집 일관성)
- **macro %는 기준 독립** (raw/total = scaled/project 동일값)
- UI 문구:
  - "사업대상 환자" → "사업대상 환자 의료비"
  - Track 참여의원 성과배분 재원 라인에 설명 추가: "재원: Shared Saving 탭에서 산정된 **사업대상 환자 의료비 절감배분액**"
- 사용자가 사업대상 환자 의료비 변경 → Track 재원 비례 연동

### v6.5.5 (사업대상 환자 의료비 디폴트 1,000 → 10,000억원)
**커밋**: `55cf16f` → merge `93f2ebf`

- `INIT_SS_PROJECT_COST`: 1000 → 10000 (억원, 1조원 상당)
- 실제 사업 규모를 고려한 보수적 디폴트로 상향

**디폴트 시나리오 효과**:
- 총 절감액 (projectScale=0.00903): 72.5억원
- 배분 50:50 = 36.2억 / 36.2억
- Track 성과배분 재원 = 36.2억 ÷ 100 의원 = 의원당 약 3,620만원 (Track C 100%)

---

## 도메인 모델 변화 (v6.4 → v6.5)

### 신규 개념: 참여의원 성과배분
- **정의**: Shared Saving으로 창출된 절감액 중 참여의원에게 직접 배분되는 성과 보상금
- **지급 주기**: 2년차부터 매년 (PT는 1년차 1회와 대조)
- **재원**: `SS.clinicFromItem / M_clinics` (N분의 1 균등 배분)
- **Track 차등**: PT와 동일한 공식 (A 10% / B 50% / C 100%, 편집 가능)
- **개념 정당화** (CLAUDE.md에 명시):
  - 집단 인센티브: 참여 의원 전체가 만든 절감을 균등 분배
  - 참여 자격 = 질 지표 충족 전제 (무임승차는 사업 규정 영역)
  - 규모 가중은 정책 고도화 시 도입 여지

### 리브랜딩: 공단 적립 → 일차의료 전환 지원
- **취지**: 단순 공단 수익이 아니라 **일차의료 재투자 재원**이라는 메시지
- **용처 명시**:
  1. 신규 참여 의원 전환지원금(PT)
  2. 일차의료지원센터 구축·운영비
  3. IT 인프라·교육·질 관리 시스템
- 색상 red → **blue** (공단 관습색 회피)

### 신규 수식: projectScale (v6.5.4 핵심)
```
costBaseTotal   = ssTotalCost × 1e12   (건보 전체, 조원→원)
costBaseProject = ssProjectCost × 1e8  (사업대상, 억원→원)
projectScale    = ssCostBase === "project"
                  ? costBaseProject / costBaseTotal
                  : 1
itemTotal       = rawItemTotal × projectScale
```

**의미**: 사업대상 환자 의료비를 선택하면 전국 기준 절감액이 **사업 참여 규모에 비례**하여 축소. Track 재원은 이 축소된 금액의 참여의원 배분분.

---

## UI 구조 변화 (v6.4 → v6.5)

### Track 탭
**전**: Track 선택 → L → KPI 2카드 → PT 박스 → 차트
**후 (v6.5.2)**:
1. Track 선택
2. L 변화율
3. **PT 박스** (편집 가능 NumBox)
4. **참여의원 성과배분 박스 (신규)** — 재원 설명 + Track별 NumBox
5. **Track별 수입 비교 박스 (신규)** — 3 Track 병렬 테이블
   - 행: Track 수입 / 변화(vs FFS) / PT(1년차) / 성과배분(매년) / 1년차 합계(Track+PT) / 2년차 이후(Track+성과)
   - 하단 참고: 현행 FFS 비참여 의원 수입
6. Track별 환자군 1인당 실지불액 차트 (비교 뒤)

### Shared Saving 탭
**전**: 항목별 절감 → 총괄 → 배분 비율 → 파이 → Win-Win-Win
**후 (v6.5.5)**:
1. 항목별 절감 시뮬레이션
2. Shared Saving 총괄 — **기준 토글** (건보 전체 / 사업대상 환자 의료비 · 디폴트 project 10,000억)
3. 절감액 배분 비율 — 파란색 전환 지원 / 녹색 성과배분 + 🟢/🔵 용도 설명 박스
4. 절감액 배분 파이 차트
   (Win-Win-Win 삭제)

---

## 검증 (Preview MCP + 단위 테스트)

- **단위 테스트**: 22/22 통과 (v6.4.8 시점 16 → v6.5.5 시점 22, 신규 6)
- **프리뷰 MCP**:
  - 디폴트 로드 시 SS 탭 사업대상 환자 의료비 10,000억 선택 확인
  - 총 절감액 72.5억원 표시
  - Track C 선택 시 성과배분 의원당 3,620만원 표시
  - 1년차 합계 (Track 수입 + PT) · 2년차 이후 (Track 수입 + 성과) 검증
- **콘솔 에러**: 현재 렌더 정상 (HMR 중간 에러는 reload 후 해결)

---

## 알려진 미결

### v6.4 이전부터 이월
1. **L → 공단지출 역전 버그**
   - B가 C1을 초과하면 LC↓ 시 공단지출↑ 역전
   - 현재는 데이터 규율로 우회 (INIT_B < C1)
   - 근본 해결: `nhi2` D1 스케일링 재정의 또는 B 슬라이더 max를 C1로 캡

### v6.5 신규 식별
2. **projectScale 가정의 한계**
   - 현재는 "사업대상 의료비 / 건보 전체" 단순 비례 축소
   - 실제로는 사업 참여 환자군(만성질환 고령자) 1인당 의료비가 평균의 2~3배라 평균 비율 가정이 과소
   - 정책 고도화 시: 환자군별 가중치 도입 여지

3. **성과배분 N분의 1 균등의 무임승차 우려**
   - 정책 문서에 "참여 자격 = 질 지표 충족" 전제는 명시했으나 시뮬엔 미반영
   - v7에서 질 지표 통과율·규모 가중 토글 검토 가능

4. **PT/SS Track% NumBox 상한 500%**
   - 실수 방지용 상한. 정책 협상에서 필요 시 조정.

5. **콘솔 HMR 에러**
   - 개발 서버에서 빠른 저장 시 Hook 순서 경고 발생 (reload로 해결)
   - 프로덕션 빌드 영향 없음

### docs 정리
6. **docs/ 폴더 handoff 문서 9개 누적**
   - v6.4.8 시점 8개 + v6.5.0.md + v6.5.5.md = 10개
   - v7.x 진입 시 아카이브 디렉토리로 정리 권장

---

## 변경 파일 요약 (세션 전체, v6.4.8 → v6.5.5)

```
M  src/constants.js                        (+INIT_PT_PCT_A/B/C, INIT_SS_PCT_A/B/C, INIT_SS_COST_BASE, INIT_SS_PROJECT_COST=10000)
M  src/hooks/useSimulator.js               (state 6, reducer 3 케이스, SS useMemo 재작성 · projectScale, MACRO_SYNC 정비)
M  src/App.jsx                             (TabTrack에 SS/resetPtPct/resetSsPct · TabSharedSaving에 resetSsCost 전달)
M  src/components/TabSharedSaving.jsx      (기준 토글 + 설명 박스 + 파란색 리브랜딩 + 'C]' 제거 + WinWinWin 제거)
M  src/components/TabTrack.jsx             (KPI 삭제, PT 편집 가능, 성과배분 박스 신설, Track 비교 박스 통합, 차트 후치)
M  src/test/calculator.test.js             (v6.5 PT/SS Track%, projectScale, 연동 검증 6 tests 추가)
M  CLAUDE.md                               (v6.5.0~5 섹션 갱신, 용어·디폴트·태그 이력 동기화)
A  docs/handoff_v6_5_0.md                  (v6.5.0/1/2 상세 기록, 과거 참고용)
A  docs/handoff_v6_5_5.md                  (본 문서 · 세션 종합 인계장)
```

---

## 운영 규칙 (세션에서 재확인)

### ✅ 세션 시작 시 git fetch + pull
- 사용자 "CLONE/시작/대기" 지시 받으면 **먼저 `git fetch && git pull`**, 그 다음 CLAUDE.md·인계장 읽기
- 본 세션에서는 "Already up to date" 확인 후 바로 작업 진입

### ✅ feature 브랜치 분리 + --no-ff 머지
- 모든 작업은 feature 브랜치에서 (main 직접 푸시 금지)
- 본 세션에서는 5 브랜치 생성:
  1. `feature/track-shared-saving-v6.5` (v6.5.0+1+2)
  2. `feature/ss-project-cost-ok` (v6.5.3)
  3. `feature/ss-project-default-and-linkage` (v6.5.4)
  4. `feature/ss-default-10000` (v6.5.5)
  5. `feature/session-cleanup-v6.5.5` (본 문서)
- 각 브랜치 머지는 `--no-ff` + 태그 부여 후 origin push

### ✅ 머지는 사용자 명시 지시 시에만
- 프리뷰 검증 완료 후 "머지" 지시 대기 (자동 머지 금지)
- 본 세션에서는 사용자 "메인 머지" 지시 시마다 진행

### ✅ 프리뷰 MCP DOM 추출로 수치 검증
- 스크린샷 + preview_eval의 DOM 파싱을 병행하여 계산 결과 정확성 확인
- 특히 Track 비교 테이블 (Track A/B/C 3열) 수치는 DOM에서 직접 추출하여 크로스체크

---

## 머지 체크리스트

- [x] v6.5.0~5 6 태그 생성 및 origin 푸시
- [x] feature 브랜치 4개 (v6.5.0~5 구현) + 1개 (세션 정리) origin 푸시
- [x] 22/22 단위 테스트 전 태그에서 통과
- [x] Preview MCP로 SS 탭·Track 탭 시각·DOM 검증
- [x] CLAUDE.md 동기화 (v6.5.5 섹션 · 디폴트 테이블 · 태그 이력)
- [x] docs/handoff_v6_5_5.md 작성 (본 문서 · 세션 종합)
- [x] docs/handoff_v6_5_0.md 유지 (v6.5.0~2 상세 기록, 과거 참고용)
- [ ] 본 세션 정리 커밋 + `feature/session-cleanup-v6.5.5` 머지 + push (진행 중)
