# v6.7.0 인계장 — L1·L2 분리 (선지급 vs 사후 성과급)

**날짜**: 2026-04-24
**브랜치**: `feature/v6.7-l1-l2-split` → (머지 대기 · 사용자 명시 지시 시 `--no-ff` 머지 + `v6.7.0` 태그)
**상태**: 코드·문서·테스트·빌드·dev 서버 UI 검증 완료

---

## 이번 세션 요지

사용자(센터장)와의 설계 합의:

1. **타원이용비중(L)을 두 층으로 분리**:
   - L1 = 선지급 기준 (과거 평균, 환자군별 4개)
   - L2 = 실측 · 사후 성과급 귀속 (단일 스칼라)
2. **공단지급 단일화**: `P = B(1−L1) + F`, 공단지급 = P (별도 축 없음)
3. **성과급 공식**: `max(0, L1 − L2) × B × n_reg × TrackMul` (no-downside 비대칭)
4. **공유율 없음 (v6.7 최종)**: 타원이용 절감은 공유율 없이 **의원 100% 환원** (Shared Saving은 ssClinicShare로 공유 유지). 초기 설계(α=0.5)는 사용자 후속 결정으로 폐기.
5. **Track 배수**: A=0 / B=0.5 / C=1.0 (선형 hccPct/100)
6. **Shared Saving과 귀인 분리**: SS=입원·응급 간접 관리, L2=외래 집중도 직접 행위. 재원 분리, 2년차부터 동일 분기 패키지 지급.

이 합의대로 v6.7.0 구현.

## 구현 내용

### 1. 상수·상태 (v6.7 신규)

- [src/constants.js](../src/constants.js)
  - `INIT_L1 = [0.7, 0.7, 0.7, 0.7]` — 데이터 수령 전 placeholder
  - `INIT_ALPHA = 0.5` — 50% 환원
- [src/hooks/useSimulator.js](../src/hooks/useSimulator.js)
  - `state.L1[4]`, `state.L2` (null=L1 가중평균) 추가 · state.alpha 및 INIT_ALPHA는 제거됨
  - `state.LC` 제거
  - 액션: `SET_L1_AT/ALL`, `RESET_L1`, `SET_L2`, `RESET_L2`, `SET_ALPHA`, `RESET_ALPHA`
  - 액션 제거: `RESET_LC`

### 2. 계산 엔진 재작성

- `G[i]`: `pay_gov = P[i] × (1 − L1[i]) + F_g[i]`, `ab_reg = pay_gov + M1×0.3`, `inc/nhi` 단일화 (cur/new 분기 제거)
- `T`: `inc`, `nhi`, `tA/tB/tC/tS` (Track per-pt · 선지급만)
- `L1avg` 메모 (N-가중평균)
- `performance` 메모 신설 — `L2eff`, `perf_raw_total`, `perf_total`(= raw_total, 공유율 없음), `perfByTrack{A,B,C}`, `perf_blended`(hccPct 선형)
- `decomp` — panelEffect + modelEffect (기존 2층 구조 유지, 성과급은 별도 축)
- Track 수식 갱신:
  - Track A: `M1 + F`
  - Track B: `0.5 × tA + 0.5 × tC`
  - Track C: `ab_reg = B(1−L1) + F + M1×0.3`

### 3. UI 재배치 ([src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx))

수가 시뮬레이션 탭 순서:
1. B (환자군 기본수가)
2. F (일차의료 기능보정)
3. **L1 카드 (신규)** — 4개 NumBox 입력, "엑셀 L → L1 복사" 버튼, ↩ 초기화
4. P 카드 ([TCard](../src/components/RegistrationPanel.jsx)) — 헤더 `P = B × (1 − L1) + F`, 4군 카드에 P=공단지급 + L1_g 표시
5. **L2 슬라이더 박스 (리브랜딩)** — 단일 슬라이더 0~1, 디폴트 = L1 가중평균, "↩ L1 복귀"
6. **성과급 미리보기 카드 (신규)** — Track A/B/C 병렬 3카드, n_reg 설명 (의원당 환자군별 등록환자수, 의원 100% 환원)
7. KPI 2카드 (선지급 기준 · 성과급은 하단에 Track C 미리보기 라인)
8. 환자군 패널
9. 차트
10. Win-Win-Win
11. 수가 산출 구조 아코디언 (v6.7 신규식)
12. 데이터 관리 — 상세 편집 테이블에 L1 컬럼 추가

Track 탭:
- PT 박스 (기존)
- 참여의원 성과배분 SS 박스 (기존)
- **성과급 L2 박스 (신규 · cyan)** — Track A(0)/B(0.5)/C(1.0) 비례 표시, 공식·n_reg 설명 명시
- Track 수입 비교 테이블: 성과급 L2 행 추가, "2년차 이후 (Track+SS+L2)" 합계

### 4. 테스트 ([src/test/calculator.test.js](../src/test/calculator.test.js))

- v6.7 신규 스위트 (7건 추가):
  - `INIT_L1` 기본값·길이·범위
  - `INIT_ALPHA = 0.5`
  - 성과급 공식 + no-downside (L2 ≥ L1)
  - Track 배수 선형성
  - L1 가중평균
  - Track A L1 무관성
  - Track B 혼합 수식
- v6.6 기존 테스트 수정: `A_cur` 테스트 → v6.7 `pay_gov` 테스트, `LC adjustment` → L1 효과 검증
- **37건 전체 통과**

### 5. 문서

- [CLAUDE.md](../CLAUDE.md): 버전 v6.7.0, 용어 테이블(L1/L2 추가, α 제거), 기호 히스토리 v6.7 열, 수식 섹션, 버전 태그 이력
- [docs/handoff_v6_7_design.md](handoff_v6_7_design.md): Phase 0 설계 문서 (본 구현의 청사진)
- [docs/handoff_v6_7.md](handoff_v6_7.md): 본 인계장
- [src/App.jsx](../src/App.jsx): 풋터 `v6.6.0 → v6.7.0`

## 검증 결과

- `npm test` → 37/37 통과
- `npm run build` → 성공 (기존 recharts 500kB 경고 무관)
- dev 서버 UI 확인:
  - L1 카드 4개 NumBox, L1 가중평균 70.0% 표시, 엑셀 L → L1 복사·초기화 버튼
  - P 카드: `P = B × (1 − L1) + F`, 4군에 P(공단지급)=94,250/110,060/187,074/263,595원 + L1_g 70.0%
  - L2 슬라이더 0.55로 내리면 성과급 카드에 Track A=0 / B=1,446만원 / C=2,892만원 나타남
  - KPI: "+ 성과급 (Track C) 2,892만원/년" 표시
  - Track 탭: 성과급 L2 cyan 박스, Track별 수입 비교 테이블에 성과급 L2 행 (0/1446/2892만원), 2년차 합계 (Track A=47,604 / B=52,531 / C=57,821만원)
  - 콘솔 에러 0건

## 다음 작업 후보

1. **v6.6 이월 — Vercel GITHUB_PAT 환경변수 e2e 검증** (아직 미검증)
2. **ADMIN_PWD UI** (v6.6 후보 #1 · baseline 등록 버튼 보호)
3. **L1 엑셀 컬럼 직접 인식** — 현재 "엑셀 L → L1 복사" 버튼 경유. 향후 `L1` 컬럼 자체를 `COL_ALIASES.L1`로 인식하여 자동 반영
4. **성과급 이력 시뮬** — 다년도 L2 추이에 따른 누적 성과급 차트
5. **Track 배수 편집 가능화** — 현재 하드코딩(0/0.5/1.0)을 편집 가능하게 (예: 중증 가산 시나리오)

## 정책 노트 (시뮬레이터 밖 · 사용자 협의됨)

### L1 Rebasing 권고

미국 ACO·PCF의 **rachet effect** 방지:
- L1은 3년 주기 재조정
- 재조정 시 절감액의 일정 비율(예: 50%)만 기준 반영
- "L을 낮출수록 다음 해 L1도 따라 내려가 성과급 영구 소멸" 구조 회피

정책 문서·의료계 질의 대응용으로 보존. 시뮬레이터에는 미반영(단일 해 기준).

## 롤백 경로

문제 발생 시:
```bash
git checkout main
git reset --hard v6.6.0    # 사용자 명시 승인 필요
```

또는 feature 브랜치 폐기:
```bash
git checkout main
git branch -D feature/v6.7-l1-l2-split
```

## 현재 파일 상태 체크리스트

- [x] `src/constants.js` — INIT_L1, INIT_ALPHA export
- [x] `src/hooks/useSimulator.js` — state·reducer·G·T·decomp·performance 메모 재작성, LC 제거
- [x] `src/components/TabSimulation.jsx` — L1 카드·L2 슬라이더·성과급 카드 신설, 레이아웃 재배치
- [x] `src/components/TabTrack.jsx` — 성과급 L2 박스 추가, 비교 테이블에 L2 행
- [x] `src/components/RegistrationPanel.jsx` — TCard `P = B(1−L1)+F`, 4군 카드에 L1_g 표시
- [x] `src/App.jsx` — 프롭 전달 갱신, 풋터 v6.7.0
- [x] `src/test/calculator.test.js` — v6.7 7건 추가, 기존 수정, 37/37 통과
- [x] `CLAUDE.md` — v6.7 용어·수식·기호 히스토리 반영
- [x] `docs/handoff_v6_7_design.md` — Phase 0 설계 문서
- [x] `docs/handoff_v6_7.md` — 본 인계장
- [x] `npm test` 통과 (37/37)
- [x] `npm run build` 통과
- [x] dev 서버 UI 렌더·인터랙션·콘솔 에러 0 확인
- [ ] `feature/v6.7-l1-l2-split` 브랜치 커밋·푸시 (본 작업 마지막 단계)
- [ ] main 머지 — **사용자 명시 지시 시에만**
