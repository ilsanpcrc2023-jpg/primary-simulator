# v6.7.x 인계장 — L1·L2 분리 + α 제거 + 윈윈 구조 + L2 변화율 UI

**기간**: 2026-04-24 ~ 2026-04-25
**브랜치**: `feature/v6.7-l1-l2-split` (6 커밋 누적 · main 머지 대기)
**상태**: 모든 코드·문서·테스트·빌드·UI 검증 완료 · 사용자 명시 지시 시 main 머지

---

## 설계 합의의 진화 (2일 세션 요약)

### Day 1 (2026-04-24) — v6.7.0 초기 구현

정책 설계 합의:
1. **L1/L2 분리**: 선지급 기준(L1, 환자군별) + 실측 성과급(L2, 스칼라)
2. **공단지급 = P (단일화)**: `P = B(1−L1) + F`
3. **no-downside 비대칭**: L2 > L1이어도 환수 없음
4. **Track 배수**: A=0 / B=0.5 / C=1.0
5. **α 공유율 (초기)**: 기본 0.5, 편집 가능

### Day 1 후반 — v6.7.1 (α 제거)

사용자 후속 결정: **"타원이용 절감은 Shared Saving과 달리 공유율 없이 의원 100% 환원"**
- Shared Saving의 ssClinicShare는 유지 (입원·응급 절감 공단·의원 공유)
- L2 성과급은 의원 전액 환원 (정책 인센티브 단순화)
- `INIT_ALPHA`, `state.alpha`, α 입력 UI 전부 제거

### Day 2 (2026-04-25) — v6.7.2 윈윈 구조 명확화

사용자 피드백:
1. 수가 시뮬레이션 탭에서 Track A/B/C 구분 제거 — win-win 서사 단일화
2. L2 슬라이더 조정이 KPI에 반응 안 함 — 연동 필요
3. 중복 수식 표시 제거

구현:
- 성과급 미리보기 카드 삭제 (Track 탭으로 이관)
- 의원 수입 KPI에 `③ 성과급 효과 (L2 기반)` 라인 추가
- 엔진: G에 L2 기반 D1 반영 (등록환자 타원 외래비), T.nhi에 perf_blended 합산
- decomp.afterIncome = T.inc + perf_blended
- 결과: 의원 수입↑ & 공단 지출↓ 동시 가시화

### Day 2 중반 — v6.7.3 Track 탭 재배치

사용자 지시:
- 성과급 L2 박스를 SS 위로 이동
- 성과급 L2 박스 위에 L2 슬라이더 재신설 (수가 탭과 state 공유)

### Day 2 후반 — v6.7.4 L2 변화율 UI 복원

사용자 지시: **"이전 L 슬라이더처럼 변화율 0%p에서 감소하는 식으로 표기"**
- L2 슬라이더를 구 LC 변화율 UX (-50%p~0%p) 스타일로 개수
- 헤더 포맷: `타원이용비중 (L2) 변화율 · 전 XX.X% → 후 XX.X% · Δ%p`
- 내부 `state.L2`는 절대값 유지 (엔진 로직 무변경) · UI만 변화율 표기
- TabSimulation·TabTrack 양쪽 동일 패턴

---

## 최종 수식 (v6.7.4)

### 선지급 (수가 본체)
```
P_g = B_g × (1 − L1_g) + F_g       # 환자군별
공단지급 = P                        # 단일화 (별도 축 없음)
본인부담 = M1_g × 0.30             # 불변
```

### 사후 성과급 (L2 귀속 · 2년차부터 매년)
```
성과급_L2 = Σ_g max(0, L1_g − L2) × B_g × n_reg_g × TrackMul
  n_reg_g: 의원당 환자군별 등록환자수
  TrackMul: Track A=0, B=0.5, C=1.0 (선형 보간 hccPct/100)
  no-downside: L2 > L1 구간은 0 처리
  공유율 없음 (의원 100% 환원) — Shared Saving과 상이
```

### KPI 연동 (v6.7.2+)
```
의원 수입 KPI = 선지급(T.inc) + 성과급(perf_blended)
공단 지출 KPI = L2 반영 nhi(T.nhi) + 성과급 지출(perf_blended)
  · G.nhi = (ab_reg + D1_L2) × n_reg + C1 × n_unreg
  · D1_L2 = M1 × L2/(1−L2)   (등록환자 타원 외래비, L2 반응)
  · D1_base = M1 × b.L/(1−b.L)  (비등록환자, 기존 L 유지)
```

### Shared Saving (분리 유지)
기존 `SS.clinicFromItem` 로직 그대로. L2 성과급과 재원·귀인 완전 분리.

### Track 수입 (1인당 등록환자)
```
Track A (FFS): P_A_g = M1_g + F_g                   (L1 미적용)
Track B (혼합): P_B_g = 0.5 × P_A_g + 0.5 × P_C_g
Track C (환자군): P_C_g = B(1−L1_g) + F_g + M1×0.3
```

---

## 상태·변수 최종

| 기호 | 의미 | state 변수 | 디폴트 |
|---|---|---|---|
| L1_g | 선지급 기준 (환자군별) | `state.L1[4]` | `[0.7, 0.7, 0.7, 0.7]` |
| L2 | 실측 타원이용 (단일 스칼라) | `state.L2` | `null` (=L1 가중평균) |

**제거**: `state.LC`, `state.alpha`, `INIT_ALPHA`

**유지**: `state.P` (B 값, 기호 히스토리), `state.F_g`, 나머지 v6.6 state 전부

---

## UI 최종 구조

### 수가 시뮬레이션 탭

```
1. 환자군 기본수가 (B)        4 슬라이더
2. 일차의료 기능보정 (F)      4 슬라이더 + 균등/차등/끝자리 보정
3. 선지급 기준 타원이용비중 (L1)    4 NumBox (v6.7 신규, teal)
4. 일차의료수가 (P = B(1−L1)+F)    indigo 박스, L1_g 병기
5. 타원이용비중 (L2) 변화율        -50~0%p 슬라이더 (v6.7.4 변화율 UI)
6. KPI 2카드  (L2 연동)
   - 의원 수입 변화: ① 패널 + ② 지불방식 + ③ 성과급(L2)
   - 공단 외래 지출 변화: L2 반영 + 성과급 지출 포함
7. 환자군 패널
8. 차트 / Win-Win-Win
9. 📐 수가 산출 구조 (아코디언 · v6.7 공식)
10. ⚙️ 데이터 관리
```

### Track 탭

```
1. Track 선택 (A/B/C 버튼)
2. PT 박스 (1년차 1회)
3. 타원이용비중 (L2) 변화율 (v6.7.3 신설, 수가 탭과 state 공유)
4. 성과급 L2 박스 (v6.7.3 SS 위로 이동, cyan)
5. 참여의원 성과배분 (SS) 박스 (2년차 매년, 녹색)
6. Track별 수입 비교 테이블 (v6.7.2 성과급 L2 행 추가, 2년차 합계 = Track + SS + L2)
7. Track 차트
```

---

## 커밋 이력 (브랜치)

| Commit | 요약 |
|---|---|
| `e3602a7` | docs Phase 0: L1·L2 분리 설계 문서 |
| `53ab39c` | feat v6.7.0: 초기 구현 (α 포함) |
| `b5d1b1a` | refactor v6.7.1: α 공유율 제거 (100% 환원) |
| `ca95e74` | refactor v6.7.2: 수가 시뮬레이션 탭 윈윈 구조 + L2 KPI 연동 |
| `6619141` | refactor v6.7.3: Track 탭 L2 슬라이더 + 성과급 L2 SS 위로 이동 |
| `617aca9` | refactor v6.7.4: L2 슬라이더 변화율 UI 복원 |

추가 세션 정리 커밋 (본 인계장 커밋 포함) 예정.

---

## 검증 체크리스트

- [x] `npm test` 36/36 통과
- [x] `npm run build` 성공 (recharts 500kB 경고는 v6.5 이전부터, 무관)
- [x] dev 서버 UI 렌더·인터랙션 정상
  - L1 4개 입력 / `엑셀 L → L1 복사` 버튼 / ↩ 초기화
  - L2 변화율 슬라이더 -50~0%p · 0%p = L1 기준점
  - 디폴트 상태 (L2=L1): 의원 +6,352만원/의원, 공단 -88.7억원(-4.30%)
  - L2=55% 상태: 의원 +12,136만원/의원, 공단 -150.0억원(-7.26%)
  - Track 탭 L2 슬라이더 ↔ 수가 탭 L2 state 동기화 확인
- [x] 콘솔 에러 0건 (HMR 잔존 로그는 무시 가능)

---

## 파급 파일 요약

| 파일 | 변경 |
|---|---|
| [src/constants.js](../src/constants.js) | `INIT_L1` 추가 (`INIT_ALPHA` 제거) |
| [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) | state·reducer·G·T·decomp·performance 재작성 |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | L1 카드·P 수식·L2 변화율 슬라이더·③ 성과급 라인 KPI |
| [src/components/TabTrack.jsx](../src/components/TabTrack.jsx) | L2 슬라이더·성과급 L2 박스 SS 위 재배치·Track 비교 테이블 L2 행 |
| [src/components/RegistrationPanel.jsx](../src/components/RegistrationPanel.jsx) | TCard `P = B(1−L1)+F`, L1_g 병기 |
| [src/App.jsx](../src/App.jsx) | 프롭 전달 갱신, 풋터 v6.7.4 |
| [src/test/calculator.test.js](../src/test/calculator.test.js) | L1·L2·Track 배수 테스트 7건 추가 |
| [CLAUDE.md](../CLAUDE.md) | 용어 테이블·수식·UI 순서·버전 이력 반영 |
| [docs/handoff_v6_7_design.md](handoff_v6_7_design.md) | Phase 0 설계 (α 제거 이후 갱신) |
| [docs/handoff_v6_7.md](handoff_v6_7.md) | 본 인계장 |

---

## 정책 노트 (시뮬레이터 밖 · 사용자 협의됨)

### L1 Rebasing 권고

미국 ACO·PCF의 **rachet effect** 방지:
- L1은 3년 주기 재조정
- 재조정 시 절감액의 일정 비율(예: 50%)만 기준 반영
- "L을 낮출수록 다음 해 L1도 따라 내려가 성과급 영구 소멸" 구조 회피

정책 문서·의료계 질의 대응용. 시뮬레이터에는 미반영 (단일 해 기준).

### 공유율 α 제거의 의미

v6.7.0 초기 설계에서는 shared-saving 관행에 따라 α=0.5를 두었으나, 사용자 정책 판단으로 **L2 성과급은 의원 전액 환원**으로 전환:
- 명분: 타원이용 억제는 의원 행위 직접 결과 → 전액 인센티브가 정합적
- Shared Saving (입원·응급 간접 성과)은 ssClinicShare 유지 (공단·의원 공유 적절)
- 시범사업 참여 유인 최대화 효과

---

## 다음 작업 후보

### 이월 (v6.6부터 미결)
- **Vercel `GITHUB_PAT` 환경변수 e2e 검증** — v6.6 공식 baseline 등록 버튼 실동작 확인

### v6.7 파생 후보
- **ADMIN_PWD UI**: baseline 등록 버튼 비밀번호 보호
- **L1 엑셀 컬럼 직접 인식**: 현재는 "엑셀 L → L1 복사" 버튼 경유 · `COL_ALIASES.L1` 추가
- **Track 배수 편집 가능화**: 현재 하드코딩(0/0.5/1.0)
- **성과급 이력 시뮬**: 다년도 L2 추이 → 누적 성과급 차트

---

## 머지·롤백 경로

### main 머지 (사용자 명시 지시 시만)
```bash
git checkout main
git merge --no-ff feature/v6.7-l1-l2-split -m "Merge 'feature/v6.7-l1-l2-split' — v6.7.x L1·L2 분리 누적"
git tag v6.7.4
git push origin main --tags
```

### 롤백
```bash
# 전체 v6.7 폐기
git checkout main
git branch -D feature/v6.7-l1-l2-split

# 머지 후 문제 시 v6.6으로 복귀
git reset --hard v6.6.0    # 사용자 명시 승인 필요
```

---

## 메모리 갱신 권고

- `project_v6_state.md` — v6.7.4 main 머지 후 상태로 업데이트 (현재는 v6.6.0)
- `reference_key_docs.md` — 본 문서(`docs/handoff_v6_7.md`) 및 설계 문서 추가
