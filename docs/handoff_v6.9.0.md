# v6.9.0 인계장 — UI 재구성 (모드별 차등화 강화)

**완료일**: 2026-05-01
**선행**: v6.8.3 (TCard 의원 모드 라벨 정비 + 수입 구성 안내)
**브랜치 흐름**: `feature/v6.9.0-ui-redesign` → `main` (`--no-ff`, tag `v6.9.0`)
**입력 자료**: 사용자 P→G 인계장(2026-05-01) + `simulator_v6_9_mockup.html` 목업

## 0. 한 줄 요약

의원 모드 첫 화면을 "결론 먼저" 구조로 재구성하고, Track 탭을 카드형 비교로 단순화. **공식 변경 없음 — UI 레이아웃·라벨·진입 흐름만 변경**.

---

## 1. 이번 세션에서 완료된 일

### [C] Track 탭 카드형 재구성 ([src/components/TabTrack.jsx](../src/components/TabTrack.jsx))

**커밋**: `3bb6e0d`

- ★ 메인: **Track 카드 비교** — 3 카드, 각 카드에 1년차/2년차~ 두 숫자 강조
  - 활성 Track: amber 보더 + 그림자 + "✓ 현재 선택" 배지 + 2년차~ 폰트 한 단계 크게(`text-2xl sm:text-3xl`)
  - 활성 Track만 인라인 분해 자동 펼침 (선지급 / +PT 1년차만 / +SS 매년 / +포괄관리 성과가산 매년)
- L2 슬라이더를 카드 비교 직전으로 **위치 승격** (PT/SS 격하에 맞춰)
- **📎 적용된 입력값** 아코디언 신설 — PT/포괄관리 성과가산/SS 편집 박스를 안에 통합
  - 의원 모드: 기본 접힘 → 1줄 요약 표시 (A/B/C 금액)
  - 정책 모드: 기본 펼침 → 정책 협의 시 PT %/SS % 편집 가능
- **Track 미세조정 슬라이더 (행위별 0~100%)** : 정책 모드 전용 노출, 의원 모드는 3 버튼만
- 7행 비교 표 폐기 (분해 정보는 활성 카드 내부로 격하)
- 인계장과의 차이: PT/SS 박스를 "참고 박스로 격하"라고만 했지만, **정책 협의에서 PT %/SS % 편집은 필수**이므로 박스 자체는 보존하고 아코디언으로 감쌌습니다.

### [A] Hero Before/After 박스 (의원 모드 KPI) ([src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx))

**커밋**: `fdad52c`

- 의원 수입 변화 좌측 박스를 모드 분기로 교체:
  - **의원 모드**: Hero Before/After (현재 FFS → 참여 후 큰 숫자, +X만원/년 강조 카드)
  - **정책 모드**: 기존 ①②③ 세부 분해 박스 그대로 유지 (정책 협의 진단용)
- Hero 박스 메타:
  - 헤더 우측: `현재 Track: A/B/C · L2 X%` 인디케이터
  - 푸터: 성과가산 ≥ 5천원이면 "위 금액에 포함됨" 안내, 미만이면 "L2 슬라이더 낮추면 추가" 안내
  - "전체 사업 합계: +X억원 (M개 의원)" 한 줄
- 공단 의원급 외래 지출 변화 박스(우측)는 양쪽 모드 공통

### [D] Shared Saving 의원 모드 차등화 ([src/components/TabSharedSaving.jsx](../src/components/TabSharedSaving.jsx))

**커밋**: `2615957`

- ★ 최상단 Hero 박스 신규: **🏥 우리 의원 예상 연간 성과배분**
  - 큰 숫자: 현재 Track 기준 의원당 ssAmt (디폴트 Track C → 3,624만원/년)
  - 산출 공식 박스: 절감배분액 ÷ 의원 수 × Track 지급률 단계별 표시
  - 푸터: "정책 가정값 / Track 변경은 Track 탭에서"
- 항목별 절감 · 의료비 절감 · 배분 비율 3카드를 **`<fieldset disabled={readOnly}>`로 감싸 읽기 전용** 처리
  - 의원 모드: opacity-70로 시각 약화, 사용자 입력 차단(`:disabled` CSS pseudo-class)
  - 정책 모드: 회귀 없음
- 항목별 카드 헤더에 "(정책 가정값 · 읽기 전용)" 라벨
- 슬라이더 영역 안내 박스: "정책 모드에서 조정 가능 · 의미 있는 결과는 위의 성과배분"

### [E] 의원 모드 디폴트 강제 ([src/App.jsx](../src/App.jsx))

**커밋**: `75e50e6`

- `readInitialMode`에서 **localStorage 우선순위 제거**
  - 기존: URL `?mode` > localStorage > "clinic"
  - 변경: URL `?mode` > "clinic" (localStorage 무시)
- `useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode])` 제거
- 효과: 이전 세션에서 정책 모드를 한 번 선택했더라도 다음 방문 시 의원 모드로 시작
- URL `?mode=policy`는 여전히 정책 모드로 진입 (오버라이드 작동)

### 추가: 탭 라벨 한글화 ([src/App.jsx](../src/App.jsx), [src/components/TabTrack.jsx](../src/components/TabTrack.jsx))

**커밋**: `ca6254c`

- App.jsx TABS 배열:
  - "📊 Track" → **"📊 Track 선택"** (short: "📊 Track")
  - "💰 Shared Saving" → **"💰 절감 성과 배분"** (short: "💰 배분")
  - 1번 "📋 수가 시뮬레이션"은 변경 없음
- TabTrack.jsx 안내 문구 3곳 ("Shared Saving 탭에서 ...") → "절감 성과 배분 탭에서 ..."로 일관화
- 코드 주석·도메인 비교 설명 ("Shared Saving과 달리 공유율 없음" 등)은 정책 표준 용어로서 그대로 유지

---

## 2. 변경 파일

| 파일 | 변경 |
|---|---|
| [src/components/TabTrack.jsx](../src/components/TabTrack.jsx) | 카드형 비교 + 아코디언 + 정책 모드 미세조정 슬라이더 |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | KPI 좌측 박스 모드 분기 (Hero / ①②③) |
| [src/components/TabSharedSaving.jsx](../src/components/TabSharedSaving.jsx) | Hero 박스 + fieldset disabled |
| [src/App.jsx](../src/App.jsx) | TABS 라벨, mode prop 전달, readInitialMode 단순화, 풋터 v6.9.0 |
| [CLAUDE.md](../CLAUDE.md) | 버전 줄·버전 이력 v6.9.0 누적 기록 |

---

## 3. 검증 결과

### 기능 검증 (preview 서버 + JS eval)

| 시나리오 | 결과 |
|---|---|
| 디폴트(L2=L1) Track C: 1년차/2년차~ | 52,305만원 / 54,929만원 (+22.2%) |
| L2를 -10%p 낮춤 (60%) Track C 참여 후 | 51,305 → 55,161만원 (+10,208만원) |
| 의원 모드 Hero 박스 표시 | "현재 Track: C · L2 70.0%" + Before/After |
| 의원 모드 SS Hero | 3,624만원/년 + 산출 공식 (36.2억 × 50% ÷ 100, Track C 100%) |
| 정책 모드 ①②③ 분해 | 그대로 유지 |
| localStorage='policy' + URL mode 없음 진입 | 의원 모드 (디폴트 강제 동작 ✓) |
| URL `?mode=policy` 진입 | 정책 모드 (오버라이드 ✓) |

### 빌드/테스트

- ✅ `npm test` — 36/36 통과
- ✅ `npm run build` — 성공 (xlsx 425kB · recharts 553kB · index 95kB)
- ✅ 콘솔 에러 0건

---

## 4. 인계장과의 차이점 (G 단계 작업자가 변경한 결정)

원 인계장(P→G)에서 다음 항목들에 대해 작업자(G)가 다른 결정을 내렸습니다:

1. **PT/SS/성과가산 박스 처리**: 인계장은 "참고 박스로 격하"라고만 명시 → **정책 협의에서 PT %/SS % 편집은 필수**이므로 박스 자체는 보존하고 아코디언 안에 통합. 의원 모드 기본 접힘 / 정책 모드 기본 펼침으로 차등화.
2. **환자 패널 단순화 [B]**: **보류**. 사업 참여 의원 수(M)·전체 등록자(N)는 SS 성과배분 분배의 직관(`재원 ÷ M`)을 위해 필요. 의원 모드에서도 표시 유지.
3. **균형 게이지 [E]**: **v7.0으로 미룸**. "재정 중립선 = 공단 지출 변화 0%" 정의가 단순 게이지로 표현되면 SS·간접효과 미반영의 정책적 오해 소지. v6.9.0에는 미포함.
4. **Track 인디케이터 별도 노출**: 인계장은 수가 시뮬레이션 탭 상단에 별도 인디케이터 추가 제안 → **의원 모드 Hero 박스 헤더에 통합**(`현재 Track: C · L2 X%`). v6.8.0/8.1에서 의원 모드 수가 탭의 Track 정보를 의도적으로 제거한 흐름과 충돌 방지.
5. **Hero 숫자 검증**: 인계장 목업 숫자(44,953→51,305)는 디폴트 시나리오에서 정확히 재현됨. L2 슬라이더 변화에 실시간 반응 명시.

---

## 5. 시뮬레이터 외부에 영향 (도메인/문서)

- **공식 변경 없음**: B, F, P = B(1−L1) + F, 공단지급, 본인부담, L1·L2, 성과가산 등 모든 수식 불변.
- 코드 주석/도메인 설명 텍스트("Shared Saving과 달리 ...")는 정책 표준 용어로서 보존.
- UI 라벨에서만 "Shared Saving" → "절감 성과 배분"으로 일괄 치환.

---

## 6. 다음 세션 후보 (v7.0 이전)

- **균형 게이지 (정책 모드)**: 수가 시뮬레이션 탭 상단에 공단 지출 변화 + 의원 수입 변화 동시 게이지. "재정 중립선" 정의 합의 후 도입.
- **의원 모드 환자 패널 단순화**: 거시 변수(N, M)를 전혀 안 보이게 할지, 아니면 표시는 유지하고 슬라이더만 숨길지 사용자 검토 필요.
- **모바일 반응형 강화**: 의원이 모바일로도 본다는 가정 검증 후, 의원 모드 카드들의 < 768px fallback 점검.
- **Track 색상 채도 조정**: 환자군 색(초록·파랑·진파랑·주황)과 Track A(초록)/C(주황) 충돌 — Track 색을 회색조 + 강세만 차이로 변경 검토.
- **수가 산출 구조 설명을 의원 모드용으로 단순화** (v6.8.3에서 이월된 후보).

---

## 7. 알려진 제한·주의사항

- **localStorage 잔존값**: 기존 사용자 브라우저에 `primarySim.mode = 'policy'`가 저장되어 있을 수 있음 — v6.9.0부터 무시되므로 영향 없음. 추후 cleanup 코드 추가는 불필요(저장 자체를 안 하므로 자연 소멸).
- **fieldset disabled 동작**: HTML5 표준에 따라 자식 input/button의 `disabled` DOM property는 false지만 `:disabled` CSS pseudo-class는 true. 사용자 인터랙션은 차단되므로 정상 동작.
- **Track 카드 활성 강조**: amber 컬러(#f59e0b)로 통일. Track A/B/C의 원 색상과 무관하게 활성 표시 일관성 유지.

---

**인계장 끝.**
