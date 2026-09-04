# 일차의료 지불체계 시뮬레이터 (NHIS-HCC 환자군 기반)

국민건강보험 일산병원 일차의료개발센터. 정책 시뮬레이션 도구.
시범사업 지불체계 최종 채택에 따라 "지불모형" → "지불체계"로 명칭 변경 (v6.8).

**정책 기준**: 노션 「일차의료 시범사업 지불체계 보완 방안」 후속 보완 (2026-04-22)
**시뮬레이터 버전**: **v7.5** (의료비 0원 제외 baseline 적용 — 데이터만, 산식은 v7.2.3 유지)

  · **데이터 갱신만 (v7.5)** — 2026-05-20. NHIS-HCC v3.0 (의료비 0원 제외, 48,874,201명 → 참여의원 12,411,152명) 새 데이터 적용. 시뮬 핵심 산식은 v7.2.3 안정 유지 (`PB = B × (1−L1)`, 본인부담 별도). v7.3.0/v7.4 산식 변경은 perf_blended 본인부담 처리 모순 발견 후 후속 작업으로 보류 (archive/v7.4-prerevert-260520 브랜치 보존).
    - 참여의원 환자수: 12,801,143 → **12,411,152명** (-39만)
    - 의원당 환자수: 4,379 → **4,246명**
    - A 4군 [281,847·563,018·1,261,710·5,277,734] → [**405,180·767,703·1,355,881·5,589,034**] (1·2군 30~44% 상승)
    - M1 4군 갱신 [86,457·125,057·189,058·328,901]
    - L1 4군 갱신 [0.7165·0.7448·0.7605·0.7419]
    - B = A × CR 4군 [**238,515·413,166·662,478·1,013,352**]
    - INIT_REG_DIST [160,224,298,318] → [**201,198,294,307**] (RD × 1,000명, largest-remainder)
    - INIT_F = B × 5% [**11,926·20,658·33,124·50,668**원]
    - 새 엑셀 보관: [docs/NHIS-HCC_Simulator_exc_zero_260518.xlsx](docs/NHIS-HCC_Simulator_exc_zero_260518.xlsx)
    - 데이터 사전: [docs/data_dictionary_v7.5.md](docs/data_dictionary_v7.5.md) — A·M1·RC·CO 모두 총의료비(공단+본인부담) 명시
    - 시트명 alias `핵심표` 파서 추가 (NHIS-HCC v3.0 엑셀 직접 업로드 호환)
    - 자료 분석 절차 텍스트 갱신 (48,874,201명·12,411,152명·4,246명 + PF 표기 보강)
    - 단위 테스트 회귀값 갱신 (173/173 통과)

  · **v7.5.1 — 환자군별 상세 편집 테이블 컬럼 재구성 (2026-09-04, 사용자 결정)** — 산식 변경 없음, UI·헬퍼만.
    - 컬럼 11개: `A(=T/NT) 1인당 평균 의료비 | CR 외래비중 | B(=A×CR) 1인당 의원급 외래비 | C1(=1−L1) 등록의원 외래 의료비 비중 | PB(=B×C1) 일차의료 기본수가 | F 일차의료 기능보정율(%) | PF(=B×F) 일차의료 기능보정 | P(=PB+PF) 일차의료수가 | 본인부담비(%) | 기준 군별 분포비(%) | 등록 군별 분포비(%)`. NT·RN·M1·RR 절대값 컬럼 제거 (엑셀 업로드·baseline으로 관리).
    - 편집 가능: A · CR · **C1** (→ `updL1(i, 1−C1)` + `updBase(i,"L",1−C1)` 동시 갱신, PB 즉시 반영) · **F(%)** (→ `updF(i, round(B×F/100))`, 상단 PF 슬라이더와 연동) · **등록 분포비** (→ `updRegDist(i, round(비율 × Σ regDist))`). 산출: B · PB · PF · P. 표시만: 본인부담비 30% 고정(`COPAY_RATE`), 기준 분포비.
    - **기준 군별 분포비 = ratio_i = N_i / ΣN** (실측, 편집 불가) · **등록 군별 분포비 = regDist_i / Σ regDist** (Σ=1,000이면 RR/1000). **등록 분포비 디폴트 = ratio_i** — "데이터 비례" 프리셋이 상수 `INIT_REG_DIST` 대신 `regDistFromRatios(ratiosFromBase(base), Σ regDist)` (largest-remainder)로 동적 산출. 현 baseline에서 [201,198,294,307] = INIT_REG_DIST 일치 (테스트 보장).
    - 신규: `constants.COPAY_RATE=0.30` (useSimulator.js:319·348 리터럴 0.30 치환) · `utils.ratiosFromBase(base)` · `utils.regDistFromRatios(ratios, total)`. 단위 테스트 +6 (90/90 통과).

  · **v7.5.2 — 상세 편집 테이블 입력 보강 (2026-09-04, 사용자 결정)** — UI·state만.
    - **표시 자릿수**: %는 소수 2자리(C1·F·본인부담비·기준/등록 분포비), 비중(CR)은 소수 4자리(0.XXXX), 금액은 정수.
    - **본인부담비 환자군별 수기 편집** — `state.copayRates[4]` 신규 (디폴트 `INIT_COPAY_RATES` = 4군 모두 30%). 엔진 `ab_reg = P + M1 × copayRates[i]` (`SET_COPAY_AT`, `updCopay`). 디폴트에서는 v7.5.1과 동일 값.
    - **기준 분포비(ratio_i) 수기 편집** — `utils.rescaleBaseN(base, i, ratio)`: i군 비율 고정 + ΣN 보존 + 나머지 군 비례 재배분 (합 100% 유지). `SET_BASE_RATIO_AT`, `updBaseRatio`.
    - **등록 분포비 자유 입력** — 분모를 Σ regDist → **1,000 고정**(RR/1000, 사용자 정의)으로 변경. 합 100% 강제 없음 (tfoot 합계 행에 합계 % · RR 표시).
    - **`DraftInput` 컴포넌트** (TabSimulation.jsx 내부) — 포커스 중 로컬 텍스트 유지, blur/Enter 시 commit, Esc 취소. 이전 controlled input이 키 입력마다 parse→dispatch→toFixed 재포맷을 돌려 "."·부분 입력이 막히던 문제("입력 제한") 해소. A·CR·C1·F·본인부담비·기준/등록 분포비 모두 적용.
    - 단위 테스트 +6 (96/96 통과).

  · **v7.5.3 — 기준 분포비 자유 입력 + 등록 분포비 디폴트 2자리 정합 (2026-09-04, 사용자 결정)** — UI·state만.
    - **기준 분포비 자유 입력** — v7.5.2의 "ΣN 보존 비례 재배분"(`rescaleBaseN`) 폐기. `state.baseRatios[4]` override 신설 (null = base.N에서 실측 산출). 입력값이 그대로 유지되고 다른 군은 불변, 합 100% 강제 없음 (tfoot 합계 + "수기" 배지). `SET_BASE_RATIO_AT` / `RESET_BASE_RATIOS`(↩ 기준 분포비 실측 복귀 버튼) / `LOAD_DATA` 시 null 복귀. 엔진 `ratios` 메모가 `baseRatios ?? N_i/ΣN`을 사용 → N_g·baseN_g·ffsPerPerson 모두 수기값 반영.
    - **등록 분포비 디폴트 = 기준 분포비와 소수 2자리(%)까지 동일** — regDist 단위를 정수 → **0.1명**으로 변경 (등록 분포비 % = RR/10). `INIT_REG_DIST`를 상수 대신 `INIT_BASE`에서 산출: `round(ratio_i × 1000, 1)` = **[201.6, 197.7, 293.8, 306.8]** (합 999.9, 군별 독립 반올림 — largest-remainder 합 보정은 2자리 동일성을 깨뜨려 폐기) ↔ 기준 분포비 20.16 / 19.77 / 29.38 / 30.68 %. `utils.regDistFromRatios(ratios, total, decimals=1)` 시그니처 변경, `utils.roundRegDist` 신규 (reducer `SET_REGDIST_AT`/`SET_REGDIST_ALL`/`SCALE_REGDIST`/`LOAD_DATA` RR 주입 공용). 1차년도 디폴트 사업 전체 등록 100,000 → **99,990명**(비등록 324,610). `CLINIC_PRESETS.general.regDist = INIT_REG_DIST` 참조.
    - 단위 테스트 93/93 통과 (rescaleBaseN 테스트 5개 제거, 2자리 동일성·roundRegDist 테스트 추가).

  · **v7.5.4 — 상세 편집 테이블 NT·RN 열 추가 + 기준 분포비 NT 기준 (2026-09-04, 사용자 결정)** — UI·state만.
    - 기준 분포비 왼쪽에 **NT(전체 환자수)** · **RN(일만시 참여의원 환자수)** 열 추가 (둘 다 DraftInput 편집 가능 → `updBase(i,"NT"|"N")`). tfoot에 ΣNT · ΣRN 표시.
    - **기준 분포비 = NT 기준**: `ratio_i = NT_i / ΣNT` (`utils.refRatiosFromBase`, NT 없으면 RN fallback). exc_zero: **28.78 / 21.10 / 25.12 / 25.00 %** (ΣNT 48,874,201). NT 편집 시 수기 override(`baseRatios`) 자동 폐기.
    - **등록 분포비 디폴트 = 기준 분포비** 규칙에 따라 `INIT_REG_DIST` → **[287.8, 211.0, 251.2, 250.0]** (합 1,000.0 · 사업 전체 등록 100,000명 복귀). v7.5.3의 RN 기준 [201.6, 197.7, 293.8, 306.8] 폐기.
    - **엔진 분리**: 참여의원 환자 배분(`ratios` 메모 → N_g·baseN_g·ffsPerPerson)은 **RN 기준 그대로** — `baseRatios` override를 엔진에서 제거. 기준 분포비는 등록 분포비 디폴트("데이터 비례" 프리셋)와 표시에만 사용. RN 편집은 엔진에 반영, NT·기준 분포비 편집은 프리셋 클릭 전까지 KPI 불변.
    - 단위 테스트 94/94 통과.

  · **v7.5.5 — 기준 분포비 RN 기준 복귀 (2026-09-04, 사용자 결정)** — v7.5.4의 NT 기준을 되돌림. NT·RN 열은 유지.
    - `refRatiosFromBase` = `ratiosFromBase(base, "N")` (RN_i / ΣRN). exc_zero: **20.16 / 19.77 / 29.38 / 30.68 %**. `INIT_REG_DIST` → **[201.6, 197.7, 293.8, 306.8]** (합 999.9 · 사업 전체 등록 99,990명). RN 편집 시 수기 override 자동 폐기(엔진 N_g에도 반영), NT는 참고 표시.
    - 단위 테스트 94/94 통과.

  · **v7.5.7 — 상세 편집 테이블 표시 자릿수 조정 (2026-09-04, 사용자 결정)** — 표시만, state 정밀도 불변.
    - %(C1·F·본인부담비·기준/등록 분포비·tfoot 합계) 소수 2자리 → **1자리**, 비중(CR) 소수 4자리 → **3자리**. regDist 0.1명 단위·baseRatios 등 내부 정밀도는 그대로 (입력한 값은 그대로 보존, 표시만 반올림).

  · **v7.5.8 — 분포비 단일화: 등록 분포비 = 기준 분포비, RR 표기 제거 (2026-09-04, 사용자 결정)** — UI·state만.
    - 상세 편집 테이블의 "기준 분포비"·"등록 분포비" 두 열 → **"분포비" 한 열**(% · 기준 = 등록). RR(명) 부제·RR/1000·합계 RR 표기 모두 제거. 컬럼 13개: `A | CR | B | C1 | PB | F | PF | P | 본인부담비 | NT | RN | 분포비`.
    - **분포비 편집 → regDist 자동 동기화**: `SET_BASE_RATIO_AT`가 `baseRatios[i]`와 `regDist[i] = ratio_i × base`를 함께 갱신. **base(등록 기준 총량) = Σ regDist ÷ Σ 현재 분포비** (`regBaseOf`, 디폴트 1,000 · 의원당 등록환자수 프리셋 1,500 등으로 스케일하면 그 값). 합 100%를 강제하지 않음 — 99.9%면 등록 999.9명, 119.8%면 1,198명, 프리셋으로 100% 복귀 시 1,000명 (사용자: "999명 처리 OK"). ClinicSummaryStrip·NumBox 표시는 정수 반올림. `SET_DIST_ALL`(프리셋 균등/건강편중/고위험편중 → 비율 배열) · `RESET_BASE_RATIOS`("데이터 비례"/"↩ 분포비 실측 복귀" → override 폐기 + regDist 실측 재산출) 신규/변경.
    - 동기화 규칙: `SET_REGDIST_ALL`(의원 모드 CLINIC_PRESETS)은 baseRatios도 같은 비율로 설정(실측과 같으면 null) · `SET_BASE N` 편집 시 regDist 실측 재산출 · `LOAD_DATA`는 RR 있으면 baseRatios = RR/ΣRR override, 없으면 새 실측 비율로 regDist 재산출(이전 "보존" 규칙 폐기) · `RESET_REG`는 baseRatios null.
    - 엔진: 참여의원 환자 배분(N_g)은 RN 실측 그대로(v7.5.5), 등록환자 배분(regRatios = regDist/Σ)이 분포비를 따름 → 분포비 편집이 KPI(등록 관련 항목)에 반영.
    - 단위 테스트 94/94 통과.

  · **v7.5.9 — 상세 편집 테이블 A·CR 편집 → 엔진 B 동기화 (2026-09-04, 버그 수정)** — 산식 변경 없음.
    - 증상: 테이블에서 A·CR을 바꾸면 테이블의 B·PB 표시만 바뀌고 상단 PB 카드·KPI(엔진 `state.P`)는 그대로 (⚠ 슬라이더 경고만 표시).
    - 수정: reducer `SET_BASE`(key A|CR)에서 `P[i] = clamp(round(A×CR), B_MIN, B_MAX)`로 동기화 (엑셀 업로드 경로와 동일 규칙). `F_g[i]`는 기존 비율(F_g/B_old)을 새 B에 곱해 재산출 → PF 슬라이더 "B 기준 X%" 위치 보존. A·CR 중 하나라도 없거나 0이면 B 유지.
    - 단위 테스트 +1 (95/95 통과).

  · **v7.5.10 — 상세 편집 테이블 분포비 열 화면 미노출 (2026-09-04, 사용자 결정)** — UI만.
    - 분포비 헤더·셀(DraftInput)·tfoot 합계를 제거. 컬럼 12개: `A | CR | B | C1 | PB | F | PF | P | 본인부담비 | NT | RN`. 내부 `baseRatios`·`regDist`·reducer(`SET_BASE_RATIO_AT`/`SET_DIST_ALL`/`RESET_BASE_RATIOS`)와 분포비 프리셋 버튼(데이터 비례·균등·건강편중·고위험편중, ↩ 실측 복귀)은 유지 — 등록 분포 변경은 프리셋으로만.

  · **v7.5.11 — 분포비 열 표시 전용으로 복귀 (2026-09-04, 사용자 결정)** — UI만.
    - v7.5.10에서 숨겼던 분포비 열을 다시 표시하되 **수기 입력 불가**(DraftInput 없음, 텍스트만). tfoot 합계 % + 프리셋 적용 시 "프리셋" 배지. 컬럼 13개: `A | CR | B | C1 | PB | F | PF | P | 본인부담비 | NT | RN | 분포비(표시 전용)`. 변경은 프리셋 버튼(데이터 비례·균등·건강편중·고위험편중, ↩ 실측 복귀)으로만.

  · **v7.3.0/v7.4 산식 보류** — archive/v7.4-prerevert-260520 브랜치에 보존. C 슬라이더 큰 값(예 +24.5%p) 시 환자 본인부담 30% 처리 누락이 발견되어 옵션 C(perf_blended를 메인 KPI에서 분리, 별도 카드로 노출) 적용 후 재시도 예정.

  · **TCard 안내 문구 삭제 (v7.2.3 누적)** — 사용자 결정 유지.

---

**v7.2.2 (PF 디폴트 5% + 소수점 표기 + PF 슬라이더 % 노출 + 엑셀 약어 정비 + regDist 데이터 비례)**
  · **PF 디폴트 5% (v7.2.2)** — 사용자 결정. `INIT_PF_PCT` 10 → 5. INIT_F = B × 5% (HCC 비례 자동) = [10416, 15811, 28400, 44228]원 (HCC v3.0 baseline). PF 통합 슬라이더 디폴트 위치 5%. "↩ 초기화" 시 5% 복귀.
  · **UI 정정 v7.2.1** — (1) NumBox `decimals` prop 추가: 포괄관리 지표 (C) "2.5%p" (이전 정수 라운딩 "2%p" 해소). (2) PF 통합 슬라이더 좌측에 "B 기준 N.N%" 표기 (예: 5.0%) — 사용자 의도 "슬라이더 움직이면 B 기준 몇%인지" 노출.
  · **엑셀 약어 체계 정비 (v7.2.0)** — NHIS-HCC v3.0 엑셀의 새 약어 체계와 시뮬레이터를 정합. 사용자 결정 5가지: (1) #14 RT·#15 RC 컬럼은 시뮬 미사용 reference (엑셀 검산용)이므로 코드 변경 없음. (2) #3 NC → **RN** (참여의원 전체 환자수, Registered N), `COL_ALIASES.N`에 alias 추가. (3) #6 신규 **RR** (참여의원당 등록환자수 = RD × 1,000) 컬럼 인식 → state.regDist 자동 주입. (4) #10 신규 **RO** (등록의원외래비) 컬럼 인식 → M1 누락 시 RO ÷ N으로 M1 fallback 산출. (5) NT/M1 명칭은 그대로 유지 (시뮬 내부 일관성).
  · **regDist 디폴트 = 데이터 비례 [160, 224, 298, 318] (v7.2.0)** — 이전 임의값 [100, 600, 200, 100] 폐기 (사용자 결정 — 시범사업 임의 분배, 데이터 근거 없음). NHIS-HCC v3.0의 참여의원 환자분포 RD (16.0/22.4/29.8/31.8%) × 1,000명. `INIT_REG_DIST` constants.js 갱신. 의원당 등록환자수 합 1,000명은 그대로, 환자군별 분포가 NC 비례로 변경 (4군 100→318, 2군 600→224 등). KPI·테스트 회귀값 동시 갱신.
  · **CLINIC_PRESETS 갱신 (v7.2.0)** — `general` 프리셋 라벨 "일반 의원" → "데이터 비례", regDist [100,600,200,100] → [160,224,298,318]. `elderly`(노인 집중)·`custom`(사용자 지정)은 그대로.
  · **상세 편집 테이블 헤더 갱신 (v7.2.0)** — NC → **RN** (참여의원 전체 환자수, 이전 NC), 등록 → **RR** (참여의원당 등록환자수). M1 컬럼 부제 "1인당 RC" → "RO ÷ RN" (수식 표기 정합). 등록 분포 프리셋 "부록" → "데이터 비례". 풋노트에 약어 매핑 안내 신설.
  · **handleFile 파서 보강 (v7.2.0)** — `findCol(row, COL_ALIASES.RR, 0)` · `findCol(row, COL_ALIASES.RO, 0)` 신규. M1=0이고 RO·N 양수면 `M1 = round(RO/N)` 자동 산출. RR이 4군 모두 양수면 `LOAD_DATA` action에 `regDist: RR_arr` 포함 → reducer가 state.regDist 갱신. 하나라도 0이면 기존 regDist 보존 (사용자 슬라이더 조정 보호).
  · **약어 충돌 잔재 (엑셀 측 정리 보류)** — 새 엑셀에 #14 RT (등록환자 외래 의료비, 타원포함, 9.37조) · #15 RC (등록환자 등록의원 외래의료비, RO와 데이터 동일)가 그대로 남음. 시뮬에서 직접 사용하지 않으므로 코드 영향 없음. C1 수식 표기 `C1=RC/RT`도 엑셀 내부 비고 (시뮬은 1−L1 직접 산출). 다음 엑셀 갱신 시 #14·#15 정리 권고 (사용자 후속 작업).
  · **단위 테스트 갱신 (v7.2.0)** — `INIT_REG_DIST = [160, 224, 298, 318]` 신규 기댓값. `COL_ALIASES` 키 검증에 RR·RO 추가. v7.1.1 RESET_REG 테스트의 regDist 기댓값 갱신. CLINIC_PRESETS general 라벨/regDist 회귀 방지 테스트 신규.

**시뮬레이터 버전 (v7.1.5)**: 1차년도 시범사업 100개 디폴트 + UI 정리 + 엑셀 정합 테이블 + 자료 분석 절차 + 초기화 버튼
  · **1차년도 시범사업 100개 디폴트 (v7.1.1)** — 데이터 anchor (datasetM=2,923, official_baseline.json)는 보존하면서 시뮬레이터 초기 디스플레이를 100개 의원으로 분리. `INIT_DEFAULT_M=100` · `INIT_DEFAULT_TOTAL_N=437,900` 신규. initialState.M_clinics=100, totalN=437,900 (이전: 2,923/12,801,143). RESET_REG도 M=100 디폴트 복귀로 변경. 사업 전체 437,900명 = 등록 100,000명(regDist 합 1,000) + 비등록 337,900명. ClinicCountCard 프리셋 4개 [100/1,000/3,000/일만시 2,923] · 의원당 등록환자수 프리셋 5개 [1,000/1,500/2,000/3,000/4,000].
  · **엑셀 정합 환자군별 상세 편집 테이블 (v7.1.1)** — 첨부 엑셀 `NHIS-HCC_v3.0_2025_for_simulator.xlsx` (`docs/`)와 정합. 컬럼 12개: 환자군 | NT(전체 환자수) | NC(참여의원 환자수) | M1 | A(평균 의료비) | CR(외래비중) | B(=A×CR) | L1(타원) | C1(=1−L1) | PF | PB(=B×C1) | P(=PB+PF) | 등록. official_baseline.json에 A·CR·NT reference 필드 추가 (시뮬 로직 동일). 편집 가능: NC·M1·L·A·CR·등록. B 산출값과 정책 슬라이더 B 차이 시 ⚠ 노란 안내.
  · **ClinicCountCard 분리 + 고급설정 정리 (v7.1.2)** — `ClinicSummaryStrip` (상단 슬림 1줄: `🏥 100개 의원 | 의원당 4,379명 = 등록 1,000 + 비등록 3,379 | 사업 전체 437,900 = 등록 100,000 + 비등록 337,900`) + `ClinicCountControls` (고급설정 안 컨트롤). 고급 설정에서 환자군 기준의료비(B) NumBox 4개·평균 타원이용비중(L1) NumBox 4개 삭제 — 환자군별 상세 편집 테이블과 중복. 대신 의원 수·의원당 등록환자수 컨트롤 배치. 헤더 부제 "의원 수 · 의원당 등록환자수".
  · **수가 산출 구조 박스 삭제 + 자료 분석 절차 신설 (v7.1.3)** — 📐 수가 산출 구조 아코디언 통째로 삭제 (`showFormula` state·formulaBox 제거). formula는 환자군별 상세 편집 테이블 컬럼 헤더(B=A×CR, PB=B×C1, P=PB+PF)와 중복. 데이터 관리 카드 최상단에 **📊 자료 분석 절차** 섹션 신설: 1단계 (건보공단 전수자료 53,247,650명 → NHIS-HCC v3.0 → HCC 4분위 분류) / 2단계 (일만시 참여의원 2,923개 / 12,801,143명 / 의원당 4,379명 → A → B=A×CR → PB=B×C1) / cf. 일차의료 정책 보정 (PF · P=PB+PF). 정책 모드 메인 화면 아코디언 3개 → 2개 (고급 설정 + 데이터 관리).
  · **일만시 모드 시멘틱 변경 (v7.1.4)** — 데이터 관리 카드 amber 버튼 "일만시 전체 등록 모드" → "일만시 모드"로 단순화. 시멘틱: M=2,923 + 의원당 4,379명 모두 등록(N비례 분배) → M=2,923 + 의원당 1,000명 등록(시범사업안 [100,600,200,100], 사용자 결정). 사업 전체 등록환자: 12,801,143명 → 2,923,000명. `FULL_REG_REG_DIST` 상수 폐기.
  · **일만시 모드 → 초기화 버튼 (v7.1.5)** — 라벨 "일만시 모드" → "↩ 초기화", 아이콘 🏥 → ↩. 동작: LOAD_FULL_REG (M=2,923) → resetReg 호출 (RESET_REG, M=100 시범사업 디폴트 복귀). `LOAD_FULL_REG` reducer case·`loadFullReg` callback·관련 prop 모두 제거. 1차년도 디폴트 복귀 reset 버튼 역할 명확화.
  · **정합성 검증** — 등록환자수 1,000명(+4,917만원) vs 4,000명(+14,684만원) 약 3배 차이로 modelEffect 비례 정상. 의원 수 변경 시 의원당 KPI는 거의 동일(regDist 합 같으면). 단위 테스트 73/73 통과.

**시뮬레이터 버전 (v7.1 누적)**: HCC v3.0 2025 데이터 탑재 — 환자군 평균 의료비 A 기반 산출
  · **HCC v3.0(2025) baseline 갱신** — 만성질환관리 시범사업 참여의원 **2,923개** 기준 실측 데이터로 official_baseline 전면 갱신. `M_clinics: 10 → 2923`, `dataLabel: HCC_2024_71_simple → HCC_v3.0_2025`, base.N(NC=참여의원 환자수)·M1(K/NC=등록환자의 등록의원 외래의료비/인)·L(L1=타원이용비중)·P(B=환자군 기준의료비) 4군 모두 신규 값. 이전 'HCC 4분위 평균 기반' 산출 → 'HCC 환자군의 실제 평균 의료비 A 기반' 산출로 정밀화 (시뮬레이터 로직은 동일, B = A × CR 식 그대로). 부수적으로 INIT_F(B의 10%)·INIT_PER_CLINIC·L1 가중평균 등 데이터 파생값이 새 baseline 따라 자동 갱신.
  · **명칭/문구 변경 (로직 동일)** — TabSimulation.jsx:156 환자군 기준의료비(B) 안내문 "B = HCC 평균 × 의원급 외래 비중" → "B = 환자군 평균 의료비(A) × 의원급 외래 비중(CR)". useSimulator.js 업로드 배너·detail 메시지 "HCC × 의원비중" → "환자군 평균 의료비 A × 의원급 외래비중 CR". constants.js COL_ALIASES.HCC에 신규 헤더 별칭 추가 (`환자군 평균\n의료비 A`, `환자군 평균 의료비 A`, `환자군 평균의료비` 등) — 엑셀 업로드 호환. 내부 키 `HCC` 자체는 하위호환 유지.
  · **테스트 갱신** — 기존 FALLBACK 파일럿(2023, 10기관/69,604명) hardcoded 기댓값 8개를 HCC v3.0 baseline에 맞춰 갱신. 65/65 통과. POLICY_SCENARIOS.pilot.perClinic은 2023 reference로 6,960 고정 유지 (시뮬레이터 디폴트 INIT_PER_CLINIC=4,379과 별도 anchor).

**시뮬레이터 버전 (v7.0.3 누적)**: 성과 배분 → 성과 공유 UI 라벨 일괄 치환
  · **"성과 배분" → "성과 공유" 일괄 치환**  — 사용자 결정에 따라 SS(Shared Saving) 한국어 명칭 정비. 탭 라벨 `"💰 성과 배분 (Shared Saving)"` / `"💰 성과배분"` → `"💰 성과 공유 (Shared Saving)"` / `"💰 성과공유"` (full·short 둘 다). TabSharedSaving 안내 배너 "성과 배분(Shared Saving)은 ... 성과 배분 섹션" → "성과 공유(Shared Saving)은 ... 성과 공유 섹션", 박스 헤더 "성과 배분 비율"·"참여의원 성과 배분 100%"·"성과 배분"(파이 차트)·"💡 성과 배분 구성"·"환자군 관리 성과... 성과 배분" 안내문 모두 치환. 슬라이더 aria-label "성과 배분 비율 슬라이더" → "성과 공유 비율 슬라이더". 코드 주석 "성과배분" → "성과공유" 정합 (constants.js:68 PT/SS Track 지급률 주석, useSimulator.js:52, TabSharedSaving.jsx:16 의원 모드 Hero 주석). 변수명·함수명·DOM key 등 영문 식별자(SS, ssClinicShare, sharedSaving 등)는 모두 보존. 단위 테스트 65/65 통과.

**시뮬레이터 버전 (v7.0.2 누적)**: 모바일 탭 라벨 SS → 성과배분
  · **모바일 탭 라벨 한국어화** — `src/App.jsx` TABS 배열 세 번째 항목 `short: "💰 SS"` → `short: "💰 성과배분"`. 영문 약어 대신 한국어로 표시하여 모바일 사용자 직관성 개선. full 라벨("💰 성과 배분 (Shared Saving)")은 유지. (v7.0.3에서 short도 "💰 성과공유"로 후속 치환됨.)

**시뮬레이터 버전 (v7.0.1 누적)**: 공식 도메인 primarysimulator.kr 정식 연결
**시뮬레이터 버전 (v7.0 누적)**: 정치 리스크 차단 + 의원 모드 단순화 + 포괄관리 지표 C 도입 + 모드 토글 재배치
  · **정치 리스크 차단** — 의원 총수입 절대값(예: 104,292만원·108,410만원·104,298만원·145,248만원 등) 화면 노출 전면 금지. 변화율(%) 텍스트 전면 제거 (분모 역추산으로 절대값 복원 차단). 모든 KPI를 **변화액(원) 단독**으로 단일화: `+4,719만원/년` 형식. 시민단체·언론 매출 왜곡 보도 방어. Track 우위 비교는 색상·폰트로만.
  · **포괄관리 성과가산 → 포괄관리성과** — 전 화면 일괄 치환. "성과가산"의 길고 위계 모호한 표현을 단순화.
  · **포괄관리 지표 C = 1 − L2 도입** — L1(타원이용비중, 미국 PCF 기반 환자군 구조 지표) 유지하면서 새 표시 차원으로 C(Comprehensiveness, 등록의원의 외래 진료비 비중) 신설. L1 카드 헤더 "선지급 기준" → "평균"으로 단순화. L2 카드 → C 카드로 전환: 헤더 "포괄관리 지표 (C)", 부제 "등록의원의 외래 진료비 비중 (C = 1 − L2)". 슬라이더 음수(-25~0%p) → 양수(0~+25%p, 우측 갈수록 포괄관리 개선). 가산 공식 등치: `포괄관리성과 = max(0, C − (1 − L1)) = max(0, L1 − L2)`. **내부 계산은 L1·L2 absolute 그대로 유지, C는 표시 파생 변수.** "L1은 환자군 구조 특성, C는 의원의 포괄관리 성과를 다른 각도로 보여줌"이 사용자 결정.
  · **Shared Saving Track 가산 분리** — C축(SS)은 시범사업 1~2년 종단 데이터 필요. 사전 Track 가산 약속은 신뢰도 리스크. B축(즉시 측정 가능 = 포괄관리성과)만 Track 연동 유지. `tracks.ongoing` 합산식: `income + ssAmt + perfAmt` → `income + perfAmt` (ssAmt 제외). ssAmt 산출 자체는 SS 탭 시연용으로 보존. 의원 수입 KPI(`decomp.afterIncome = T.inc + performanceEffect`)는 이미 SS 미반영 (구조적 정합). Track 탭에서 SS 박스(편집 UI)와 1줄 요약 SS 행 모두 제거.
  · **Shared Saving 탭 = 참고 시나리오** — 상단 amber 배너: "⚠️ 성과 배분(Shared Saving)은 일차의료 강화 후 입원·응급·요양병원 의료비 변화에 따른 성과 배분 섹션으로 앞선 수가 시뮬레이션 및 Track 선택에는 미반영 상태입니다." 의원 모드 Hero 박스 + readOnly fieldset 제거 → 정책 모드와 동일 노출 (양 모드 통일). ssPctA/B/C Track 지급률 박스(시연용) 삭제. 디폴트 변경: `ssAcutePct/ssEmergencyPct/ssLtcPct`: 2/3/1 → **1/1/1** (총 의료비 영향 ≈ −0.392%) · `INIT_SS_COST_BASE`: "project" → **"total"** (건강보험 전체 110.8조 기준).
  · **수가 시뮬 의원 모드 단순화** — 정책 모드와 차별. 의원 모드에서 ClinicCountCard(사업 참여 의원 수) / Track 비교 박스(v6.8.2) / 데이터 관리 박스 모두 정책 모드 전용으로 후퇴 (의원 모드는 KPI Hero · TCard · C 카드 · 차트 · WinWinWin만). 공식 박스(P=PB+PF) 삭제. 고급 설정 위치 하단으로 이동 (수가 산출 구조 위).
  · **PB/PF 카드 라벨 정리** (정책 모드) — PB 배지 "데이터 기반" → "환자군 위험도(HCC) 기반". PB 공식 안내 + 하단 ※ 모두 삭제. PF 배지 "정책 협상" → "일차의료 기능강화" + "환자등록관리" 2종. PF 설명문 삭제. mini display "PF=10%×B" 라벨 삭제. baseline 주석 단순화 ("환자군 기준의료비(B) 기준").
  · **TCard 새 헤더** — "일차의료수가 (P = PB + PF) L1 평균 78.6% · 공단지급 = P (단일화)" → **"일차의료수가(P)"** 큰 글씨 + 부제 작게 "일차의료 기본수가(PB) + 일차의료 기능보정(PF)". 카드 내 "P = 공단지급" / "L1_g 79.8%" 모두 삭제.
  · **FCard (RegistrationPanel.jsx) 정비** — 분배 토글 라벨 "분배 규칙" → "환자군별". 🌱 역비례 옵션 삭제. 분배 토글 우측에 ↩ 초기화 버튼 추가. 환자군별 슬라이더 위 "B의 X%" 라벨 삭제. mini display % 텍스트 삭제 (변화액만).
  · **Advanced panel L1 카드** — 헤더 "선지급 기준 타원이용비중(L1)" → **"평균 타원이용비중(L1)"**. "↩ 실측 L 동기화" + "↩ 초기화" 두 버튼 → 단일 ↩ 초기화 (RESET_L1 = base.L 복귀). "가중평균 78.6% · 디폴트 = 데이터 실측 L" 부제 삭제. amber ℹ️ 안내 박스 삭제. B 카드 안내문 ※ 삭제.
  · **ClinicCountCard 신규** (정책 모드 전용) — 환자군 패널(RegScaleCard) 대체 컴팩트 카드. 참여 의원 수만 노출. 디폴트 = 업로드된 데이터의 의원수(`state.datasetM`). 프리셋 [100, 1000, 3000]. 데이터로 복귀 버튼 (datasetM ≠ 현재 M일 때 노출).
  · **Track 탭 정비** — 행위별 ↔ 환자군 100% 미세조정 슬라이더 삭제. L2 슬라이더 → C 슬라이더 (수가 시뮬과 동일 0~+25%p 양수). 헤더 "Track별 의원 연수입 변화" → "Track 별 의원 수입 비교". Track 카드 div → button (카드 클릭으로 Track 직접 변경). 1년차/2년차 두 줄 → **변화액 한 줄** (포괄관리성과 포함, PT 미포함). 분해 라벨 "+ PT (1년차만)" → "+ 일차의료 전환지원금(PT) (1년차만)". 입력값 박스 헤더 "(PT · 포괄관리성과)" → "(일차의료 전환지원금 · 포괄관리성과)". PT 박스 라벨 "기준 금액" → "사업 투자액". 입력값 박스 아코디언 토글 제거 → 항상 노출. PT 박스 헤더에 cf 표기: "📋 (cf) 일차의료 전환지원금 (PT) · 1년차 1회 · 위 변화액 별도". 포괄관리성과 박스 완전 삭제 (Track 카드 변화액에 이미 반영). 📌 Shared Saving 분리 안내 박스 삭제.
  · **Track 비교 KPI 일치 (6만원 차이 해소)** — 기존: Track 비교 baseline = `T.inc0 / M` (totalN/M = 6960.4) vs 수가 시뮬 KPI = `baseN_per_clinic × ffsPerPerson × M` (6960). 4명 차이 → 6만원 표시 격차. v7.0 fix: useSimulator `tracks` 메모에 `netChange = ongoing − decomp.baselineIncome/M` 추가. 활성 Track netChange = 정확히 perClinicNet (예: +4,719만원).
  · **모드 토글 재배치** — 헤더의 [정책 모드 / 의원 모드] 세그먼티드 토글 제거(영향 범위 = 수가 탭 한정인데 모든 탭에서 작동하는 듯 보여 인지 불일치). TabSimulation 상단(안내 박스 아래)에 **"관점 선택"** 라벨 + [🏛 정책 모드 / 🏥 의원 모드] 토글 신설. Track·성과 배분 탭은 토글 미노출. Header.jsx의 mode/onModeChange props 제거.
  · **탭별 안내 문구 신설** — App.jsx에서 mode 무관 tab 분기:
    - tab===0 (수가): "이 시뮬레이터는 환자군 기반 일차의료 지불모형의 재정·수입 영향을 추정하기 위한 목적으로 개발되었습니다. · 의원 모드: 의료공급자의 수입 변화 추정 (기본) · 정책 모드: 일차의료 수가 산출 구조 및 재정 검토 (심화)"
    - tab===1 (Track): "각 의원은 상황과 준비 상태에 따라 Track을 선택할 수 있습니다. 기존 행위별 수가제(Track A)를 유지할 수 있으며, 혼합형(Track B)이나 환자군 수가형(Track C)으로 단계적으로 전환할 수도 있습니다. 어떤 Track을 선택하든 의원의 자율적 진료에는 영향을 미치지 않습니다."
    - tab===2 (SS): TabSharedSaving 자체 amber 배너 (위 Shared Saving 탭 항목 참조)
  · **단위 테스트 65/65 통과** (calculator.test.js의 `INIT_SS_COST_BASE` 검증을 'project' → 'total'로 갱신).

**시뮬레이터 버전 (v6.10.0 누적)**: PF 단순화 — 통합 슬라이더 + 분배 토글, 균형추 모듈 폐지 · 정책 시나리오 프리셋 신설
  · **PF 디폴트 = B의 10% (HCC 비례 자동, 사용자 결정)** — 임의값 [1·2·3·4만원] 폐기. `INIT_F = INIT_B.map(b => round(b × 0.10))` (파일럿 baseline 적용 시 [28083, 30020, 52358, 74532]). "1군 28,083원 = B 280,832원의 10%"가 가장 강한 답변. `INIT_PF_PCT=10` · `INIT_PF_RULE="hcc"` constants.js 신규.
  · **PF 통합 슬라이더 (B의 X%)** — 0~20%, step 0.5%, 디폴트 10%, **음수 불허**. 슬라이더 onChange 시 분배 규칙으로 4군 PF 자동 산출. 옆에 mini display: `공단지출 +X.X억 (+X.X%)` (분모 = `Σ regDist × M1 × M_clinics` 동적 baseline = 등록환자 의원급 외래 FFS).
  · **분배 규칙 3-toggle** — 📊 HCC 비례 (디폴트, "위험도 높을수록 두텁게") / ⚖️ 균등 ("등록환자 1인당 동일 PF") / 🌱 역비례 ("경증 등록 진입 인센티브"). `state.pfRule` 신규 + `SET_PF_RULE` 액션. 토글 변경 시 통합 슬라이더 % 유지하면서 4군 재산출 (HCC ↔ 균등 ↔ 역비례 가중 전환).
  · **환자군별 슬라이더 4개 자동 연계** — 통합 슬라이더 → 4 슬라이더 자동 갱신. 개별 미세 조정 가능 (변경 시 통합 슬라이더는 가중평균 derive). 라벨에 "B의 X.X%" 동적 표시. 폐지 액션 — 균등/차등/끝자리 보정 버튼 (분배 규칙 토글이 흡수).
  · **균형추 모듈 + 신호등 + WinWinGrid 전면 폐지** — `src/components/FBalanceCorrection.jsx` 삭제 / `src/test/fBalance.test.js` 삭제 / `balance-thumb` CSS 제거. 사용자 결정: "원래 파일럿 기반인데 어느 시점부터 의원당 환자수만 임의 3,000명으로 바뀌어 환자군 패널 N과 충돌. 이 충돌이 baseline 계산까지 오염시켜 PF=0에서 −5.4% 갭 발생. 균형추 모듈은 이 갭을 보상하려 만들어진 건데, baseline이 정확해지면 불필요." → v6.9.4에서 데이터 anchor로 디폴트 정렬 완료, v6.10.0에서 균형추 본체 제거. 신호등 7단계는 정책 근거 없어 제거. `distribute()` 함수만 [src/utils.js](src/utils.js)로 이전 (분배 토글에서 재사용).
  · **신규 utils** — `distribute(totalTarget, rule, B, n_g)` (균형추 폐지 후 PF 분배 함수, 합산 보존) · `calcPFfromPct(pfPct, rule, B, n_reg_g)` (통합 슬라이더 → 4군 PF 산출, 0 floor) · `inferPFpct(F_g, B, n_reg_g)` (개별 조정 후 통합 슬라이더 위치 역산). PB 관련 `calcPB`/`PBtoB`는 보존 (PB 카드 별개 기능).
  · **정책 시나리오 프리셋 4종 (환자군 패널 · 정책 모드 전용)** — RegScaleCard 상단에 4 버튼: **파일럿 (6,960)** · **시범사업 (1,500)** · **NHS (2,200)** · **네덜란드 (2,200)**. 클릭 시 `setPerClinic(value)` (totalN = value × M_clinics). 의원 모드는 기존 CLINIC_PRESETS(분포)만 노출. `POLICY_SCENARIOS` constants.js 신규 export. 캡션: "파일럿(2023 실측) · 시범사업(복지부안) · NHS(영국) · 네덜란드(GP 평균)".
  · **TabSimulation 정리** — `import FBalanceCorrection` 제거, `showBalance` state 및 controlled accordion 블록 제거. PB 카드(연회색, 데이터 기반)는 유지. PF 카드는 새 FCard(통합 슬라이더 + 분배 토글 + 4군 슬라이더 + mini display)로 전면 재작성. App.jsx → setPfRule prop 전달, 푸터 버전 표기 v6.10.0.
  · **단위 테스트 누적 65/65 통과** — fBalance.test.js 23개 제거, 신규 17개 추가 (`INIT_F = B × 10%` 정확값 검증 · `distribute` HCC/균등/역비례 합산 보존 + 단조성 · `calcPFfromPct` 통합 슬라이더 정합 + 0% 음수 floor + 합산 = pfBaseline × pfPct · `inferPFpct` 라운드트립 · `pfBaseline = Σ regDist × M1 × M` 동적 산출 + 의원수 비례 + 2064.4억 fixture 회귀 방지 · `POLICY_SCENARIOS` 4 항목 정책 근거값 정합).
  · **알려진 정합** — PF=10%(HCC비례) 시 mini display는 약 +36% (분자 = Σ PF × n_reg / 분모 = 등록환자 의원급 외래 FFS). 이는 의도된 결과 — B가 M1보다 약 4배 크기 때문 (PF 단위 = B). 의원수입 +43% (별도 KPI ①②③ 분해)·공단지출 +36%(분자/분모 도메인 일치) 두 지표 병기. 우상단 KPI 카드(의원 수입 / 공단 지출 ①②③)는 **변경 없음** — 균형추는 입력 도구, KPI는 출력 도구.

**시뮬레이터 버전 (v6.9.6 누적)**: 데이터 기반 디폴트·anchor — 파일럿 10기관/69,604명·L1=base.L 실측 자동 산출 (v6.9.4·v6.9.5 누적)
  · **L1 = 데이터 실측 자동 산출 (v6.9.5)** — 사용자 결정에 따라 L1 시멘틱을 "협상 변수"에서 "데이터 실측 그 자체"로 명확화. INIT_L1을 [0.7×4] placeholder에서 INIT_BASE.L 자동 산출로 변경 (파일럿: [0.7975, 0.7934, 0.7943, 0.7722]). LOAD_DATA(파일럿/엑셀)가 L1을 새 base.L로 **자동 동기화** (옵션 A — 사용자가 슬라이더로 임의 조정한 L1은 새 데이터 LOAD 시 덮어써짐). RESET_L1은 현재 base.L로 복귀 (data anchor 패턴 일관성 — 환자군 패널 reset과 동일 철학). 향후 3,000개 의원 데이터 업로드 시 그 데이터의 실측 L이 자동으로 L1 디폴트가 됨. 고급 패널 L1 박스의 "엑셀 L → L1 복사" 버튼은 라벨을 "↩ 실측 L로 동기화"로 변경 (사용자가 임의 조정 후 되돌리는 단축 동작). 단위 테스트 신규 4개 (INIT_L1 = INIT_BASE.L · L1 가중평균 ≈ 78.6% · LOAD_DATA L1 동기화 명세 · RESET_L1 base.L 복귀) 누적 73/73 통과.
  · **데이터 기반 디폴트 + anchor (v6.9.4)** — `INIT_M_CLINICS=100`, `INIT_PER_CLINIC=3,000` 임의값을 파일럿 anchor로 정렬: `INIT_TOTAL_N = sum(INIT_BASE.N) = 69,604`, `INIT_M_CLINICS = official_baseline.M_clinics = 10`, `INIT_PER_CLINIC = round(N/M) = 6,960`. `state.datasetM/datasetTotalN/datasetLabel` anchor state 신설 — LOAD_DATA 시 갱신, RESET_REG가 그 anchor로 복귀. 사용자가 임시로 의원 수를 변경해도 초기화 버튼은 데이터 anchor로 복귀. `official_baseline.json`에 `M_clinics`·`dataLabel` 필드 추가, `/api/commit-baseline`이 그 두 필드도 함께 저장. **3,000개 의원 데이터 업로드 시 관리자 "공식 baseline 등록" 클릭만으로 모든 사용자의 디폴트와 초기화 anchor가 그 값으로 전환**.

**시뮬레이터 버전 (v6.9.3 누적)**: 명칭 체계 PB·PF + 정책 모드 노출 구조 + 의원 KPI "공단지급분 변화" 재정의 · v6.9.2-bidir 누적
  · **명칭 체계 v6.1 (PB·PF 신규)** — 정책 모드 첫 화면을 `P = PB + PF` 단순합 구조로 재구성. **PB**(=B×(1−L1), 일차의료 기본수가) 신규 노출, F 기호를 **PF**로 변경(한국어 "일차의료 기능보정" 유지). 상단 공식 박스(인디고 그라디언트)에 한국어 풀이 — "PB: 환자군 위험도 반영" / "PF: 등록관리·포괄진료 가치". B는 더 이상 1번 카드에 직접 노출 안 됨 (HCC×CR 산출값으로 고급 패널 후퇴).
  · **신규 utils** — `calcPB(B_g, L1_g)` (B 4군 → PB 4군 산출), `PBtoB(PB_input, L1)` (PB NumBox 입력 → 내부 B 역산). 기존 `calcF_fromBalance` → `calcPF_fromBalance` rename + alias 유지 (하위 호환). 내부 변수명 `state.F_g`·`state.P` 보존 (CLAUDE.md 기호 히스토리 정신, B_g 유지 정합성).
  · **정책 모드 카드 시각 차별화** — 1번 PB 카드: 연회색 톤 + "데이터 기반" 배지 + 슬라이더 없음 NumBox만 (산출값). 2번 PF 카드: 연파랑 톤 + "정책 협상" 배지 + 슬라이더 + NumBox. **균형추 보정 모듈은 PF 카드 하단 controlled accordion 종속, 기본 접힘** (토글 라벨 "⚖️ PF 자동 산출 도구"). B(NumBox만)·L1 직접 조정은 별도 "⚙️ 고급 설정" 아코디언으로 후퇴 (기본 접힘).
  · **산출값 vs 정책값 시각 패턴 통일** — PB(산출)·B(산출, 고급)·L1(고급) 모두 NumBox만, PF(정책)만 슬라이더 + NumBox. 사용자가 "조작 가능한 정책 변수"와 "데이터 기반 산출값"을 시각적으로 구분.
  · **균형추 모듈 라벨 일괄 PF 치환** — "F 균형추 보정" → "PF 자동 산출 도구" / "F 4군 절대값" → "PF 4군 절대값" / "제안 F" → "제안 PF" / "F 분배 규칙" → "PF 분배 규칙" / "음수 F 시나리오" → "음수 PF 시나리오" / "일차의료 지원 강화 (F 가산)" → "일차의료 지원 강화 (PF 가산)" / "위 F 값을 슬라이더에 적용" → "위 PF 값을 슬라이더에 적용" / "직전 F로 되돌리기" → "직전 PF로 되돌리기".
  · **균형추 등록환자 규모 프리셋 4개** — NumBox 옆 버튼 `10만 / 100만 / 1,000만 / 3,000만 명` (M_clinics 자동 환산). 정책 의사결정 1차 anchor 노출.
  · **균형추 추 모양 사다리꼴 + floating % bubble** — `balance-thumb` CSS `clip-path: polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)` (위 좁고 아래 넓은 무게추). 추 위 `position:absolute` floating bubble로 % 직접 표기 (추 따라 이동, 신호등 색상 매칭, 말풍선 꼬리). 기존 "현재 추 위치" 별도 박스 삭제 (bubble 통합).
  · **의원 KPI "공단지급분 변화"로 재정의 (A2 옵션)** — modelEffect의 PB 캘리브레이션 drift 제거, PF 가산 효과 보존:
    - 헤더: "의원 수입 변화" → **"의원 공단지급분 변화"**
    - 기준: "기준 수입 (참여 전, 전원 FFS)" → **"기준 공단지급 (참여 전, 전원 FFS)"**
    - ② 항목 교체: "지불방식 전환 효과 (선지급)" (modelEffect, PB drift 포함) → **"PF 가산 효과 (Σ PF × 등록환자)"** (균형추 우측 카드와 정확히 매칭)
    - 순 변화 = panelEffect + **pfEffect** + perfEffect (modelEffect 제외)
    - 참여 후: "의원당 수입" → **"의원당 공단지급"** (재계산)
    - 본인부담 disclaimer footer: "환자 본인부담은 의료행위별 본인부담률에 따라 다양하게 발생, 본 카드는 공단지급분만 표시. PB는 L1을 흡수해 구조적으로 중립이므로 수입 변화는 PF·L2·panel 효과로만 발생."
  · **균형추 WinWinGrid 0% 정합성** — 우측 카드 0%(`isExactZero`) 분기 신규 — 라벨 "🔵 일차의료 지원 영향" → "🟢 일차의료 지원 변동", 금액 강제 "**±0원**" 표기 (정책 의도 = 의원 지원 변동 없음). 설명문 "✓ 재정중립 anchor — KPI ② PF 가산 효과 행과 일치". 좌·우 위치는 기존 유지(좌 공단·우 의원).
  · **사업 예산 규모 박스 (T_nhi0 amber)** — v6.9.3 중간 단계에 추가했다가 사용자 요청으로 삭제. 정책 모드 첫 화면 정보 밀도 추가 감소.
  · **단위 테스트 누적 67개 (기존 63 + 신규 4)** — `calcPB` 정확값 (84,250 / 90,060 / 157,074 / 223,595), per-group L1, L1 fallback, `PBtoB` 라운드트립.
  · **알려진 제한** — 정책 모드 KPI는 modelEffect 제외, 의원 모드 Hero는 그대로 (decomp.netChange = panel + model + perf 사용). 같은 시나리오에서 두 모드 숫자 차이 가능 — 다음 세션 정렬 검토. WinWinGrid 0% "±0원"은 라벨 우선 표기, 알고리즘 내부 ΔPF는 PB drift 보정으로 비0일 수 있음 (적용 시 PF 변경 가능).

**시뮬레이터 버전 (v6.9.2-bidir 누적)**: 정책 모드 — F 균형추 양방향 + 절대 재정중립 · v6.9.2 / v6.9.1 누적
  · **균형추 의미 재정의 (절대 재정중립)** — 추 위치 = `baseline T.nhi0` 대비 공단 외래 지출 목표 변화율. **0% = baseline 대비 변화 0원** (이전 v6.9.2의 "ΔF 추가 투입 0원" 해석은 라벨/실제 산출 불일치 — `재정중립 0%`인데 +44.5억 표기되던 문제 해소). 추 위치는 더 이상 ΔF가 아니라 **F 4군 절대값을 자동 산출**.
  · **양방향 슬라이더 −5% ~ +10%** — 좌측 절감 영역 (음수 F 시나리오, 정책 협상 하한선 탐색) + 우측 투자 영역. `<input type="range" min="-50" max="100">` (값 ×10 정밀도). 위치 매핑 `left% = ((pct + 5) / 15) × 100` → 0%는 33.33% 위치 (중심선 강조).
  · **신호등 7단계** — `≤−3` 🔵 강한절감 / `≤−1` 🟦 절감 / `≤0` 🟢 미세조정 / `≤2` 🟢 재정중립 / `≤5` 🟡 적극투자 / `≤8` 🟠 고투자 / `>8` 🔴 협상한계. 그라디언트 트랙 6 stop (deep-blue → blue → green-pale → green → yellow → orange → red). 0% 중심선 시각 강조 (#10b981 세로선 + "재정중립" 라벨). 시각 가이드 (정책 근거 없음).
  · **`calcF_fromBalance` 신규 함수** — `targetNHI = T_nhi0 × (1 + pct/100)` / `NHI_withoutF = T_nhi − Σ F_g[i] × n_reg_g[i]` (현 NHI에서 F 기여분만 제거) / `F_total_target = targetNHI − NHI_withoutF` → 분배 규칙으로 4군 절대값 산출. 분배 규칙 3종(HCC비례·균등·역비례) 시그니처·합산 보존 의미는 v6.9.2 동일하나 출력 의미가 "ΔF" → **"F 절대값"**으로 전환 (음수 가능).
  · **F 슬라이더 음수 허용** — 환자군별 음수 하한 = `-Math.round(B_g[i] / 2)` (정책 가드레일). reducer `SET_F_AT`/`SET_F_ALL`의 `Math.max(0, ...)` 가드 제거 → 음수 정수 허용. NumBox·라벨에 `⚠` 마크 + 빨강 강조 (CL → `#dc2626`). 슬라이더 트랙도 음수/양수 fill 분기 (음수 영역 빨강).
  · **윈윈 카드 3-mode 분기** — `WinWinGrid` 컴포넌트 신설. 양수(`pct > 0.05`) — 좌 "🔵 공단 외래 지출 변화" 2칸 비교 / 우 "🔵 의원 수입 강화 (F 가산)". 음수(`pct < −0.05`) — 좌 "🟦 공단 외래 지출 절감" 강조 / 우 `extraPerClinic < 0` 시 "🟡 의원 수입 영향 (F 차감)" amber 톤 + ⚠ 안내. 0% 정확(`|pct| < 0.05`) — 좌 "🟢 재정 중립 달성 ±0원" 강조 / 우 회색 중립 표기.
  · **AI 산출 결과 박스 음수 F 강조** — `F_new.some(v => v < 0)` 시 헤더에 "⚠️ 음수 F 포함" 빨강 배지 + 4군 카드 중 음수 군 빨강 배경(`rgba(239,68,68,0.18)`)·`⚠` 마크. 박스 하단에 빨강 안내바 ("음수 F는 환자군 기본수가에서 차감되는 시나리오로, 실제 시범사업 권장 안 함, 협상 하한선 탐색용").
  · **음수 영역 안내 배너** — 추 위치 `pct < −0.05` 진입 시 amber 박스 자동 노출 ("⚠️ 음수 F 시나리오 — 환자군 기본수가에서 일부 차감... 협상 하한선 탐색용으로만 활용").
  · **프리셋 6개 (절감 ~ 적극)** — `−3% (강한 절감)` / `−1% (절감)` / `0% (재정중립)` / `+1% (최소투입)` / `+3% (표준투입)` / `+5% (적극투입)`. 디폴트 추 위치 = **0%** (재정중립 자동 진입).
  · **단위 테스트 23개 (기존 15 + 신규 8)** — `calcF_fromBalance` 0%/+5%/−3%/−5% 시 NHI 정합성 (1억 이내), `distribute` 음수 totalTarget 허용 (equal/hcc 합산 보존 + 단조성 반전), `signalLevel` 7단계 경계값, 위치 매핑 `pctToLeft`. 누적 63/63 통과.
  · **사용자 피드백 후속 보강 1 (좌측 카드 단일 표시 — A안)** — "현재 시뮬" 비교 칸 제거. 새 해석에서 그 값은 본 모듈 위 KPI 박스에 이미 표시되며, "0%면 현재 시뮬과 같은 값이어야 한다"는 오해 위험. 좌측 카드를 hero 단일 표시로 단순화 (`text-base` 2-칸 grid → `text-2xl` 단일). "균형추 X% 적용 시 · baseline 대비" 부제 + "비율% · baseline N억원" 컨텍스트 라인 추가. `changeNow`/`pctNow` 변수와 `WinWinGrid` props 정리.
  · **사용자 피드백 후속 보강 2 (우측 카드 "일차의료 지원" 프레임 전환)** — 정책 프레이밍. "의원 수입 강화" 직설적 표현은 시민단체 등에서 "새 지불제도가 의사 개인 수입 증가" 프레임으로 받아들여 반대 명분 제공 가능 — F 가산은 실제로는 코디네이터 간호사·영양사 등 일차의료 기능 강화 인력 채용·운영 재원 성격이므로 이를 명시. 라벨 일괄 치환: `🔵 의원 수입 강화 (F 가산)` → `🔵 일차의료 지원 강화 (F 가산)` / `🟡 의원 수입 영향 (F 차감)` → `🟡 일차의료 지원 영향 (F 차감)` / `🔵 의원 수입 영향` → `🔵 일차의료 지원 영향`. 안내문 보강: "F 가산분이 ... 직접 적용" → "코디네이터 간호사·영양사 등 일차의료 기능 강화 인력 채용·운영 재원으로 활용 가능"; 음수 모드 좌측 footer "단, 의원 수입 영향 검토 필요" → "단, 일차의료 지원 재원 축소 영향 검토 필요". 본 모듈 외 KPI 박스 등은 별도 검토 대상 (변수명·함수명 등 영문 식별자는 보존).

**시뮬레이터 버전 (v6.9.2 누적)**: 정책 모드 — F 균형추 보정 모듈 신설 (v6.9.2-bidir 이전 1차 구현, 현재는 양방향으로 대체)
  · **F 균형추 보정 모듈 (정책 모드 전용)** — 마운트 위치: B+F 통합 박스 직후·L1 박스 직전 (새 순서 B → F → ⚖️ 균형추 → L1 → P → L2). 의원 모드 가드 (`mode === "policy"` 체크 — 의원 모드에서는 미노출). "✓ F 슬라이더에 적용" 결과를 위쪽 F 박스에서 즉시 확인.
  · **사업 규모 = 등록환자 NumBox 직접 입력** — 균형추 헤더에 "🏢 등록환자 규모 [NumBox] 명 = 의원당 N명 × 의원 M개"; M_clinics는 derive (등록환자 규모 / 의원당 등록환자수). 정책 의사결정 1차 변수를 "의원 N개" 대신 절대 인원으로 노출 — 사용자 통찰 반영. 의원당 등록환자수는 환자군 패널에서 조정.
  · **totalN 자동 동기화 (사업 규모 정합성)** — reducer SET 핸들러에서 `action.key === "M_clinics"` 시 `totalN = (totalN/M) × newM` 자동 갱신 (perClinic 보존). M=1,000으로 늘려도 의원당 등록환자 1,000명 정합 (이전 totalN clamp으로 179명까지만 채워지던 문제 해소). baseN_per_clinic("참여 전 기준선" · 패널 변화 효과 분해용)은 변경 안 함.
  · **좌·우 카드 (정책 trade-off 시각화)** — 좌 🔵 **공단 외래 지출 변화** (현재 시뮬 vs 균형추 적용 후 2칸 비교 — 디폴트 시나리오 −88.7억 → −29.4억, 절감폭 축소 명시). 우 🔵 **의원 수입 강화 (F 가산)** (`Σ ΔF[i] × regDist[i]`, 의원당 즉시 효과). **Shared Saving은 본 모듈에 일체 포함하지 않음** (별도 풀, 일차의료수가 아님 — 사용자 명시).
  · **신호등 임계값** — 0~2% 🟢 재정중립 / 2~5% 🟡 적극 투자 / 5~8% 🟠 고투자 / 8% 초과 🔴 협상 한계. **시각적 가이드 (정책 근거 없음)** — 향후 사용자 질의 시 "이상현 교수 결정, 협상 가이드 메타포"로 답변.
  · **추 비주얼 (수평 균형추)** — `<input type="range">` 표준 컨트롤에 `balance-thumb` CSS만 입혀 64px 둥근 무게추 구현 (기존 `big-thumb` 패턴 일관성 유지 · 커스텀 드래그 핸들러 미사용). 트랙은 0~100 위치(=0~10%) 신호등 그라디언트 배경.
  · **AI 산출 결과 박스** — 인디고 그라디언트 + 펄스 닷. 환자군별 F_new(현재 F + ΔF)와 ΔF 절대값 동시 표시. "✓ 위 F 값을 슬라이더에 적용" 버튼 클릭 시 `setFAll(F_new)` + 직전 F 백업(`appliedSnapshot`). 적용 후 "↩ 직전 F로 되돌리기" 버튼 노출.
  · **부호 컨벤션** — `fChangeAuto` 헬퍼를 [src/utils.js](src/utils.js)로 끌어올려 공유 (이전 TabSharedSaving 안 정의 → utils export). v6.9.1 부호 컨벤션과 일관.
  · **단위 테스트** — `src/test/fBalance.test.js` (15 테스트 신규 — distribute 합산 보존 · 단조성 · signalLevel 경계값 · fChangeAuto). 누적 51/51 통과.
  · **도메인 매핑 명시** (메모 박스): 분모 = `T.nhi` (현 시뮬·L2 반영), 분자 = 사업 참여 등록환자 합계(`Σ G[i].n_reg`).

**시뮬레이터 버전 (v6.9.1 누적)**: 3번 탭 라벨 재구성 — "절감 → 변화·성과·체계 지원" 프레임
  · **[F] 3번 탭 "절감 → 변화·성과" 프레임 일괄 치환** — 의료계 노출 시 "DRG·억제 보너스" 연상 차단 목적. 탭 라벨 "💰 절감 성과 배분" → "💰 성과 배분". 섹션 1 "항목별 절감 시뮬레이션" → "항목별 의료비 변화 추정" / "절감률" → "변화율" / "절감액" → "변화액". 섹션 2 "의료비 절감" → "총 의료비 영향" / "총의료비 절감률" → "총 의료비 변화율" / "총 절감액" → "총 변화액". 섹션 3 "절감액 배분 비율" → "성과 배분 비율" / "전환지원 100%" → "체계 지원 100%" / "일차의료 전환 지원" → "일차의료 체계 지원". 안내 박스 "절감 배분 분류" → "성과 배분 구성". PT 풀네임 통합참조 v6.0 정합 ("Transformation Payment" → "Primary care Transformation grant"). 도넛 제목 "절감액 배분" → "성과 배분"·범례 동기.
  · **음수 부호 일관 표기 (U+2212)** — 변화율 NumBox 좌측에 회색 `−` prefix(값 0이면 비움) · 결과 영역(항목별 변화액 / 총 변화액)에 `fChangeAuto()` 헬퍼로 `−` prefix 자동 부착 · 박스 헤더 부제 "이용 감소 가정 — 양수 입력 시 음(−) 효과로 표기됩니다." 명시.
  · **섹션 2 "총 변화액" 박스 색상 회색조 전환** — 빨강 단일 톤(`#fef2f2 / text-red-600`) → 슬레이트(`#f8fafc / text-slate-700`) 회피. "기준 토글" 박스도 빨강(red-200) → 회색(gray-200) 톤다운(부정 프레임 차단·정합성).
  · **Hero 박스 "산출 공식" 내부 라벨** — "사업대상 절감배분액" → "사업대상 성과배분 재원" (TabSharedSaving Hero, TabTrack 안내 박스 동일).
  · **TabTrack 잔존 표현 정리** — "절감 성과 배분 탭에서 조정/산정/활성화" → "성과 배분 탭에서 …" · 포괄관리 성과가산 박스 안내 "절감액은 의원 100% 환원 (Shared Saving과 달리 …)" → "이용 감소분은 의원 100% 환원 (성과 배분과 달리 …)".
  · **유지 항목**: 변수명·함수명·DOM key 등 영문 식별자 (sharedSaving / saving / itemTotal …) 모두 보존 · 코드 주석/테스트 설명문에 등장하는 "절감"·"Shared Saving"은 정책 표준 용어로 그대로 유지 (UI 노출만 치환).

**시뮬레이터 버전 (v6.9.0 누적)**: UI 재구성 — 모드별 차등화 강화
  · **[C] Track 탭 카드형 재구성** — 3 Track 카드, 1년차/2년차~ 두 숫자 강조, 활성 Track만 인라인 분해 자동 펼침. PT·SS·포괄관리 성과가산 박스 → 📎 적용된 입력값 아코디언으로 격하 (의원 모드 기본 접힘 / 정책 모드 기본 펼침). 7행 비교 표 → 카드형. Track 미세조정 슬라이더는 정책 모드 전용.
  · **[A] Hero Before/After 박스 (의원 모드 KPI)** — 의원 수입 변화 좌측 박스를 Hero 비교형으로 교체 (현재 FFS → 참여 후, +X만원/년 큰 카드, Track 인디케이터, L2 실시간 반응). 정책 모드는 ①②③ 세부 분해 박스 그대로 유지. 공단 지출 박스(우측)는 양쪽 모드 공통.
  · **[D] Shared Saving 의원 모드 차등화** — 상단에 "🏥 우리 의원 예상 연간 성과배분" Hero 박스 신규 (산출 공식: 성과배분 재원 × Track 지급률). 항목별 변화·총 의료비 영향·배분 비율 카드는 fieldset disabled로 읽기 전용 처리. 정책 모드는 변경 없음.
  · **[E] 의원 모드 디폴트 강제** — `readInitialMode`에서 localStorage 우선순위 제거. URL `?mode=policy`만 정책 모드 진입, 그 외 모든 첫 진입은 항상 의원 모드. localStorage 저장 useEffect도 제거 (이전 세션 캐시로 정책 모드가 첫 화면이 되는 일 차단).

## 기술 스택

- React 18 + Vite 6 · Tailwind CSS 3
- Recharts (차트) · SheetJS/xlsx (엑셀 I/O)
- Vitest + @testing-library/react (단위 테스트)
- 배포: GitHub → Vercel 자동 배포 (main 브랜치 = production)

## 개발 · 운영 명령

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 로컬 확인
npm test          # 단위 테스트 (vitest run)
```

## 도메인 모델 · 핵심 수식

### 용어 (v6.2.2 기준, 준수 필수)

| 기호 | 의미 | 단위 |
|---|---|---|
| **B** | **환자군 기본수가** = 환자군 기준의료비 × 의원급 외래비중 | 원/년/환자 |
| **F** | **일차의료 기능보정** (환자군별 배열 F_g[4]) — 등록 관리 업무 + 저평가된 본연 기능 상대가치 보정 | 원/년/환자 |
| **P** | **일차의료수가 = B × (1 − L1) + F (공단 선지급 본체)** | 원/년/환자 |
| **공단지급** | **= P (단일화, v6.7부터)** | 원/년/환자 |
| 본인부담 | M1 × 본인부담비 (환자군별, 디폴트 30% · v7.5.2 테이블에서 편집 가능) — 기호 없음 | 원/년/환자 |
| **L1** | **선지급 기준 타원이용비중 (환자군별 4개, 데이터 실측 = base.L 자동 산출 · v6.9.5)** | 0~1 |
| **L2** | **실측 타원이용비중 (단일 스칼라, 사업 중 관측치 · 성과급 산정)** | 0~1 |
| M1 | 1인당 현행 등록의원 외래비 | 원/년 |
| N | 실인원 환자수 (연인원 아님) | 명 |
| M | 사업 참여 의원 수 | 개 |
| n_reg | 의원당 등록환자수 = Σ regDist | 명 |
| regDist | 의원당 환자군별 등록환자수 배열 (v7.5.5: 0.1명 단위, 디폴트 = RN 기준 ratio_i × 1,000 [201.6, 197.7, 293.8, 306.8], 합 999.9 · 등록 분포비 % = RR/10) | 명 |
| PT | 일차의료 전환지원금 (의원당·1회·첫해) — pt_base × Track % | 원 |

**F는 L1 우회**: F는 타원이용비중에 걸리지 않고 등록의원에 고정 지급.

**B·F·P의 정의**: B는 환자군 기반 FFS 대체 수가, F는 등록 관리 + 저평가된 일차의료 본연 기능(만성질환 포괄관리·재택의료·건강상담) 상대가치 보정. P = B(1−L1) + F는 공단지급 선지급 본체.

**L1·L2 분리 핵심 (v6.7)**:
- **선지급층 (deterministic)** — L1이 고정한 P를 참여 의원에 선지급. L1은 사업 시작 전 과거 평균 = **데이터 실측 그 자체** (v6.9.5: 협상 변수가 아니라 base.L 자동 산출). 새 데이터 업로드 시 L1은 그 데이터의 실측 L로 자동 동기화됨.
- **사후 정산층 (performance)** — L2는 사업 중 관측된 실측 타원이용. L2가 L1보다 낮으면 절감분 전액을 Track 배수에 따라 의원에 성과급으로 환원. **공유율 없이 의원 100% 환원** (Shared Saving과 상이). L2 > L1이어도 환수 없음 (no-downside, 시범사업 수용성).
- **Track 배수**: A(FFS)=0 / B(혼합)=0.5 / C(환자군)=1.0. 선형 보간(hccPct/100).
- **Shared Saving과 분리**: SS는 입원·응급·요양병원 절감(간접 관리 · 의원·공단 공유율로 분배), 성과급 L2는 외래 집중도(직접 행위 · 의원 100% 환원). 재원·공유 구조 분리, 2년차부터 동일 분기에 패키지 지급.

### 기호 히스토리 (이전 코드 참조용)

| v6.1 | v6.2 (구) | v6.2.2 | v6.7.0 (현재) |
|---|---|---|---|
| P (환자군 기본수가) | B | B | **B** |
| F (일차의료 기능수가) | R (환자등록관리료) | F | **F** |
| T (통합 수가) | P (일차의료수가 = B+F) | P (= B+F) | **P (= B(1−L1)+F)** |
| A (공단 실지급) | A (공단 실지급) | 공단지급 | **공단지급 = P** |
| L (타원이용비중, 단일) | L + LC(변화율) | L + LC | **L1 (선지급) + L2 (성과급)** |
| — | — | — | **성과급 = max(0,L1−L2)×B×n_reg×TrackMul (의원 100% 환원)** |

코드 내부 변수명 `state.P`, `state.F_g`는 하위 호환을 위해 유지 (값은 각각 B·F). UI 라벨만 새 기호로 표시. `state.L1` (배열)·`state.L2` (스칼라, null=L1 가중평균)는 v6.7 신규. `state.LC`는 제거됨. 공유율 α는 타원이용 절감에는 적용하지 않음 (SS에서만 ssClinicShare로 유지).

### 혼합 수입 수식 (v6.7)

환자군 g에서 발생하는 의원 수입 — **선지급만**:
- 등록환자 (환자군 모형): `(B × (1 − L1_g) + F_g + M1 × 0.3) × n_reg_g`
- 비등록환자 (FFS 유지): `M1 × n_unreg_g`
- 의원 선지급 총수입 = 위 두 합계

사후 성과급 (L2 귀속, 2년차부터):
- `성과급_L2 = Σ_g max(0, L1_g − L2) × B_g × n_reg_g × TrackMul`
- `n_reg_g` = 의원당 환자군별 등록환자수 (state.regDist)
- 공유율 없이 **의원 100% 환원** (Shared Saving과 상이)
- TrackMul: A=0 / B=0.5 / C=1.0 (선형 보간 hccPct/100)
- L2 디폴트 = L1의 N-가중평균 (성과급 0 기준점)

**clamp 규칙**: `n_reg_g ≤ N_g` (환자군별 등록이 이용을 초과 못 함). 이용 분포와 등록 분포가 달라도 수학적 모순 제거.

### 패널 효과 vs 지불방식 효과 분해 (v6.2 핵심)

의원 수입 변화를 **두 효과로 분리**하여 정책 해석 용이:

```
기준 수입 (baseline) = baseN × ffsPerPerson × M     (참여 전 FFS)
  baseN = 참여 전 의원당 환자수
  ffsPerPerson = Σ ratios[i] × M1_g  (이용분포 기반 가중평균)

① 패널 효과 = Σ M1_g × (N_g_after − baseN_g)        (FFS 유지 가정)
② 모형 효과 = Σ n_reg_g × (ab_reg_new_g − M1_g)     (등록환자 HCC 프리미엄)

순 변화 = ① + ② = afterIncome − baselineIncome  ✓
```

**정책 함의**:
- ②가 충분히 크면 패널 축소에도 수입 유지 가능 → 등록 인센티브 근거
- ①이 너무 크면 등록률 목표치 설정 필요 → 최소 등록 규모 설계
- 손익분기 등록률 = `① + ② = 0` 지점

### Track 재해석 (v6.2 · 노션 "수입 감소 없음" 준수, v6.7 L1 반영)

- Track A = FFS + F (L1 미적용)
- Track B = 0.5 × (FFS + F) + 0.5 × (B(1−L1) + F + 본인) (혼합 50:50)
- Track C = B(1−L1) + F + 본인 (환자군 모형 전면)
- **모든 Track에서 등록환자에게 F 가산** (핵심 원칙)
- 비등록환자는 Track과 무관하게 항상 FFS
- Track 변화율 기준선 = 순수 FFS (T.inc0). Track A도 F 효과로 양(+) 변화.
- **v6.7 추가**: L2 성과급이 Track 배수(A=0 / B=0.5 / C=1.0)로 Track별 차등 지급

### PT (일차의료 전환지원금) — 시뮬레이터 수식과 독립

- **기준 금액 (pt_base)**: 사용자 편집 가능, 기본 **1,000만원**/의원 (v6.4.4부터)
- Track 지급률 (v6.5부터 **편집 가능**, 기본값 유지):
  - Track A: **10%** (hccPct 0) — `state.ptPctA`
  - Track B: **50%** (hccPct 50) — `state.ptPctB`
  - Track C: **100%** (hccPct 100) — `state.ptPctC`
  - 중간값은 A/B/C 3점 선형보간
- 실제 지급 = `pt_base × Track %`
- 1회성 · 첫해만 지급
- 시뮬레이터 의원 수입·공단 지출 계산에 포함되지 않음 (정보 표시만)

## 참여의원 성과배분 (v6.5 신규) — Shared Saving 파생

Track 탭에서 PT 박스 바로 아래에 배치. 2년차부터 매년 지급되는 성과 보상.

- **재원**: `SS.clinicFromItem` (Shared Saving 탭 · 일차의료 배분 %)
- **의원당 기준 배분** = `재원 / M_clinics` (참여 의원 수로 균등 N분의 1)
- **Track 지급률** (v6.5 편집 가능, 기본값 10/50/100):
  - Track A: `state.ssPctA` (기본 10%)
  - Track B: `state.ssPctB` (기본 50%)
  - Track C: `state.ssPctC` (기본 100%)
  - 중간값 선형보간 (PT와 동일 공식)
- 실제 지급 = `(재원/M) × Track %`
- `SS.clinicFromItem == 0`이면 박스 disabled, "Shared Saving 탭에서 성과배분 비율 0% 초과로 설정해야 활성화" 안내
- 시뮬레이터 의원 수입·공단 지출 계산에 포함되지 않음 (정보 표시만)

**개념 설계 원칙 (N분의 1의 정당화)**:
- **집단 인센티브(group incentive)**: 사업 참여 의원 전체가 만든 절감에 대한 균등 분배
- **참여 자격 = 질 지표 충족** 전제 (무임승차 방지는 사업 규정 영역)
- 규모(등록환자 수) 가중치는 정책 고도화 시 도입 여지로 남겨둠

## 파일 구조

```
src/
├── App.jsx                      # 탭 라우팅
├── main.jsx                     # 엔트리
├── constants.js                 # SH, CL, INIT_BASE (N·M1·L only — v6.4 단순화),
│                                # INIT_B(=INIT_P), INIT_F(= B×10% HCC 비례 자동, v6.10.0), INIT_R alias,
│                                # INIT_PF_PCT=5 (v7.2.2 · 이전 10%), INIT_PF_RULE="hcc", INIT_REG_DIST,
│                                # INIT_M_CLINICS, INIT_PER_CLINIC, INIT_BASE_PER_CLINIC,
│                                # INIT_TOTAL_N, INIT_PT_BASE, INIT_DATA_LABEL,
│                                # CLINIC_PRESETS (의원 모드 분포), POLICY_SCENARIOS (정책 모드 4종, v6.10.0),
│                                # COL_ALIASES (N · M1 · L 3개만)
├── utils.js                     # f, fE, fAuto, fMan, pct, diffAuto, diffMan, fChangeAuto,
│                                # calcPB/PBtoB (v6.9.3), distribute/calcPFfromPct/inferPFpct (v6.10.0)
├── hooks/useSimulator.js        # 전역 상태·계산 (useReducer + useMemo)
│                                # state.P (B 값), state.F_g (F 값), state.pfRule (v6.10.0), state.pt_base
│                                # decomp: baselineIncome·panelEffect·modelEffect
├── components/
│   ├── Header.jsx
│   ├── DatasetSelector.jsx
│   ├── TabSimulation.jsx        # 탭 1: 수가 시뮬레이션
│   ├── TabTrack.jsx             # 탭 2: Track A/B/C + PT
│   ├── TabSharedSaving.jsx      # 탭 3: Shared Saving
│   ├── RegistrationPanel.jsx    # named: FCard(PF 통합 슬라이더 + 분배 토글 + 4군 슬라이더 + mini display, v6.10.0), TCard(=P카드), RegScaleCard
│   ├── WinWinWin.jsx
│   └── shared/NumBox.jsx        # v6.10.0: FBalanceCorrection.jsx 폐지 (균형추 모듈)
├── data/presets/
│   ├── index.js
│   └── 2023.json                # 파일럿 데이터 (10개 의원, 69,604명)
└── test/
    ├── calculator.test.js       # v6.10.0: PF · distribute · pfBaseline · POLICY_SCENARIOS 테스트 추가 (fBalance.test.js 통합)
    └── utils.test.js
```

## UI 시각 위계 (v6.7 레이아웃)

### 수가 시뮬레이션 탭 순서 (v6.7 · L1·L2 분리)

1. **환자군 기본수가 (B)** — 4 슬라이더 + NumBox · 우상단 "↩ 초기화"
2. **일차의료 기능보정 (F)** — B와 동일 구조 4 슬라이더 + NumBox
   - 액션 버튼 3개 + 초기화: 균등/차등 (v6.4.7 누적 +1만원), 끝자리 보정 (v6.4.6)
3. **선지급 기준 타원이용비중 (L1)** (v6.7 신규 · teal 박스 · v6.9.5: 자동 산출)
   - 환자군별 4개 NumBox (0.00~1.00, **디폴트 = 데이터 실측 base.L 자동 산출** · 파일럿 [0.7975, 0.7934, 0.7943, 0.7722])
   - 우상단 액션: `↩ 실측 L로 동기화` (L1을 임의 조정 후 base.L로 되돌리기) · `↩ 초기화` (현재 데이터의 base.L로 복귀)
   - L1은 P 계산의 선지급 기준 (B×(1−L1)+F). LOAD_DATA(파일럿/엑셀) 시 새 base.L로 자동 동기화.
4. **일차의료수가 (P = B × (1 − L1) + F)** — 항상 펼침 · indigo 박스
   - 헤더: `L1 평균 XX.X% · 공단지급 = P (단일화)`
   - 환자군별 카드: `P=공단지급` + dashed 분리선 + `L1_g XX.X%`
5. **타원이용비중 (L2) 변화율** — v6.7.6 구 LC 슬라이더 스타일 복원 · 슬림 박스
   - 헤더: `5. 타원이용비중 (L2) 변화율  전 XX.X% → 후 XX.X% [NumBox %p]  ↩ 초기화`
   - 슬라이더 범위: **-50%p ~ 0%p** (L1 대비 변화율)
   - 0%p = L1 수준 (성과급 0 기준점), 음수로 갈수록 L2 절감 → 성과급 발생
   - 내부: `state.L2`는 절대값 0~1, UI만 변화율 표기 (엔진 불변)
6. **KPI 2카드** (상시 표시 · L2 연동)
   - 녹색 (**의원 수입 변화**) — L1/L2 헤더 뱃지, L2 반응
     - 기준 수입 (참여 전, 전원 FFS) — XXX만원/의원·년
     - ① 환자군 패널 변화 효과 (FFS 유지 가정)
     - ② 지불방식 전환 효과 (선지급)
     - ③ **성과급 효과 (L2 기반)** (v6.7 신규 · amber)
     - 순 변화 (① + ② + ③)
     - 참여 후 의원당 수입
   - 파랑 (**공단 의원급 외래 지출 변화**) — L2 반응
     - 등록환자 타원 외래비에 L2 반영 + 성과급 지출 포함
     - 주석 2줄: `등록환자 공단지급 + L2 기반 타원 외래비 반영` / `성과급 X억 (현재 Track 반영) 포함`
7. **환자군 패널 (의원당 환자수)** — 항상 펼침, 우상단 "↩ 초기화"
   - 참여 전/후 환자수 + 등록·비등록 인라인 + 요약 줄
   - 사업 참여 의원 수 (프리셋 10·100·1,000·3,000)
8. 차트 2열 / Win-Win-Win
9. **📐 수가 산출 구조 (v6.7 L1·L2 분리)** (맨 아래 접힘)
   - `P_g = B_g × (1 − L1_g) + F_g` / `공단지급 = P` / `본인부담 = M1 × 30%`
   - `성과급_L2 = Σ max(0, L1_g − L2) × B_g × n_reg_g × TrackMul` (의원 100% 환원, 공유율 없음)
10. **⚙️ 데이터 관리** (접힘)
    - 엑셀 업로드/내보내기, 파일럿 로드, 공식 baseline 등록, 환자군별 상세 편집 테이블
    - 테이블 컬럼 (v7.5.11): `환자군 | A(=T/NT) | CR | B(=A×CR) | C1(=1−L1) | PB(=B×C1) | F(기능보정율 %) | PF(=B×F) | P(=PB+PF) | 본인부담비(%) | NT(전체 환자수) | RN(일만시 환자수) | 분포비(% · 기준 = 등록, 표시 전용)` — 분포비 변경은 프리셋 버튼으로만
    - L1은 위쪽 L1 카드의 정책 슬라이더 값을 표시 (편집은 상단 박스에서)

### Track 탭 순서 (v6.7.5 · L2 슬라이더 재배치)

1. Track 선택 (A/B/C 버튼 + 행위별↔환자군 슬라이더)
2. **PT 박스** (황색) — "일차의료 전환지원금 (PT) · 1년차 1회"
3. **타원이용비중 (L2) 변화율** (v6.7.6 · 구 L 슬라이더 스타일) — 슬림 박스
   - 수가 시뮬레이션 탭 L2와 동일 state 공유 (양방향 동기화)
   - 슬라이더: -50%p ~ 0%p
4. **성과급 L2 (타원이용 절감) 박스** (v6.7.5 · cyan) — "· 2년차부터 매년"
   - 공식: `Σ max(0, L1 − L2) × B × n_reg × Track 배수`
   - Track A(×0) / B(×0.5) / C(×1.0) 병렬 3카드
   - L2 현재값 · L1 가중평균 · 전체 최대(Track C) 표시
5. **참여의원 성과배분 (SS) 박스** (녹색) — "· 2년차부터 매년"
   - 재원: `SS.clinicFromItem / M` · Track A/B/C 편집 가능 (10/50/100%)
6. **Track별 수입 비교 박스** — 3 Track 병렬 테이블 (v6.5.2)
   - 행: Track 수입(선지급) / 변화(vs FFS) / PT(1년차) / 성과배분 SS(매년) / **성과급 L2(매년, v6.7)** / 1년차 합계 / 2년차 이후
   - 2년차 이후 = Track 수입 + SS + L2
7. Track별 환자군 1인당 실지불액 차트

### Shared Saving 탭 순서 (입력 → 결과, v6.5 리브랜딩 반영)

1. 항목별 절감 시뮬레이션 (급성기 입원 · 응급 · 요양병원)
2. **의료비 절감** (v6.5.6 리네이밍 — 구 "Shared Saving 총괄")
   - **기준 토글** (v6.5.5): `( ) 건강보험 전체 [110.8] 조원` / `(●) 사업대상 환자 의료비 [10,000] 억원` · `[↩ 초기화]`
   - 건강보험 전체는 조원 단위, 사업대상 환자 의료비는 **억원 단위**
   - **디폴트 · 초기화 = 사업대상 환자 의료비 10,000억원** (v6.5.5부터 · 이전 v6.5.4는 1,000억원)
   - **사업대상 기준 선택 시 절감액이 비례 축소** (`projectScale = 사업대상/건보전체`)
     - 예: 건보 8,030억 절감 → 사업대상 10,000억 기준 ≈ 72.5억 (비율 0.00903)
     - 사업대상 환자 의료비 변경 시 절감액과 Track 재원 연동
     - macro %는 기준 독립 (raw/total = scaled/project 동일)
3. **절감액 배분 비율**
   - 좌: **일차의료 전환 지원** (파란색 `#3b82f6`) · 우: **참여의원 성과배분** (녹색 `#16a34a`)
   - "공단 적립"은 실제로 공단이 가져가는 수익이 아니라 일차의료 생태계 재투자 재원이므로, 빨간색(공단 관습색)을 피하고 파란색 사용
4. 파이 차트 (v6.5.1부터 Win-Win-Win 카드 삭제 — Track/KPI 정보와 중복 제거)
5. **💡 절감 배분 분류** (v6.5.6 — 구 "Shared Saving 배분 용도", 파이 차트 뒤로 이동)
   - 🟢 참여의원 성과배분 — 사업 참여 의원에게 직접 지급되는 성과보상금 (환자군 관리 성과 배분)
   - 🔵 일차의료 전환 지원 — 다음해 사업 유지·확장을 위한 재투자 재원 (신규 PT · 지원센터 · IT/교육/질관리)

### 토글 아이콘 위치 규칙

모든 아코디언의 **▲/▼ 아이콘은 문장 앞(좌측)**에 배치. 우측에는 초기화·액션 버튼만.

## 입력값 범위

| 항목 | 슬라이더 범위 | NumBox 범위 | 디폴트 |
|---|---|---|---|
| B (환자군 기본수가) | 5만~200만원 | ≥ 0 | **280,832 / 300,199 / 523,581 / 745,317원** (v6.4.5 · HCC 분석표 반영) |
| **PF 통합 슬라이더 (B의 X%)** | **0~20%, step 0.5%** (v6.10.0) | — | **5%** (v7.2.2 · HCC 비례 자동) |
| PF 환자군별 (= F) | 0~60만원 (개별 미세 조정) | ≥ 0 (음수 불허) | **B의 5% = 10,416 / 15,811 / 28,400 / 44,228원** (v7.2.2 · HCC v3.0 baseline · HCC 비례 자동) |
| **PF 분배 규칙** | 3-toggle | — | **HCC 비례** (균등 / 역비례 옵션) |
| **L1 (선지급 기준 타원이용비중)** | NumBox 4개 | 0.00~1.00 | **데이터 실측 base.L 자동 산출** (v6.9.5 · 파일럿: 0.7975 / 0.7934 / 0.7943 / 0.7722) |
| **L2 변화율 (실측)** | **-50~0%p** (v6.7.6 변화율 UI) | 무제한 | **0%p = L1 수준** (성과급 0 기준점) |
| regDist (환자군별 등록수, RR) | 슬라이더 없음 | ≥ 0 | **[160, 224, 298, 318]** (v7.2.0: 데이터 비례, 이전 임의값 [100,600,200,100] 폐기) |
| 참여 전·후 환자수 | 프리셋 **2,000·3,000·5,000·7,000** + **정책 시나리오 4종** (v6.10.0 · 정책 모드) | ≥ 1 | **6,960** (파일럿 anchor) |
| **정책 시나리오 프리셋 (정책 모드)** | 4 버튼 (v6.10.0) | — | **파일럿 6,960 / 시범사업 1,500 / NHS 2,200 / 네덜란드 2,200** |
| M (사업 참여 의원 수) | 프리셋 10·100·1,000·3,000 | ≥ 1 | **10** (파일럿 anchor) |
| 의원당 등록 | 프리셋 500·1,000·1,500·2,000 | ≥ 0 | 1,000 |
| PT 기준 금액 | 자유 입력 | ≥ 0 | **1,000만원** (v6.4.4) |

## 기본 시나리오 (파일럿 anchor 데이터 기반 · v6.9.4 이후)

- **M_clinics = 10 · 참여 전·후 의원당 환자수 6,960명 · totalN 69,604명** (파일럿 2023 실측)
- 의원당 등록환자 1,000명 (14.4%) · 비등록 5,960명 (85.6%) (regDist=[160,224,298,318] · v7.2.0 데이터 비례)
- 환자군별 분포 = 파일럿 실측 (1·2·3·4군 N: 11956 / 13778 / 18089 / 25781)
- **B 환자군별 (v6.4.5)**: 280,832 / 300,199 / 523,581 / 745,317원 (HCC 분석 · 1군은 대상군 n=69,604 의원급 외래비중, 2~4군은 전국 외래비율 차이 보정값)
- **PF 환자군별 = B의 5% (v7.2.2 · HCC v3.0 · HCC 비례 자동)**: 10,416 / 15,811 / 28,400 / 44,228원 (분배 규칙 디폴트 hcc · 통합 슬라이더 5%)
- **L1 디폴트 = base.L 실측 자동 산출** (v6.9.5 · 파일럿: 0.7975 / 0.7934 / 0.7943 / 0.7722 · 가중평균 78.6%)
- **L2 디폴트 = L1 가중평균** (변화율 0%p 기준점, 성과급 0)
- **P = B(1−L1) + PF** 기본값(L1=base.L · v7.2.2 PF=B×5% 적용): 약 68,975 / 96,635 / 168,753 / 277,016원
- PT 기준 금액 **1,000만원** (Track A 100만 / B 500만 / C 1,000만)
- L(base, 실측): 파일럿 실측 (평균 78.6%) — 비등록환자 외래비 산정용
- **사업 전체 등록환자수**: 1,000명/의원 × 10 의원 = 10,000명 (사업 전체 N의 14.4%)
- **PF 동적 baseline (mini display 분모)**: Σ regDist × M1 × M_clinics ≈ 10.77억 (파일럿 디폴트)

**파일럿 데이터 전환**: 데이터 관리 카드의 "파일럿 데이터 로드" 버튼 → `loadPreset(presets[0])`로 2023 파일럿(10기관·69,604명, L·M1 실측값). baseN_per_clinic도 파일럿 의원당 실인원으로 자동 설정.

## 박스별 초기화 규칙

모든 카드에 독립 "↩ 초기화" 버튼 (전체 초기화 없음):
- **B 카드** (resetP/resetB): INIT_B만 복귀 (HCC 신값)
- **PF 카드** (resetF): INIT_F (= B × 5%, HCC 비례 자동, v7.2.2) + pfRule = "hcc" 함께 복귀
- **L1 카드** (resetL1): 현재 데이터의 base.L 실측값으로 복귀 (v6.9.5 · data anchor 패턴)
- **L2 슬라이더** (resetL2): `state.L2 = null` → L1 가중평균 사용 (변화율 0%p, v6.7)
- **의원당 환자 규모 카드** (resetReg): baseN·M·totalN·regDist·dataLabel만 복귀

다른 설정은 유지.

## 금액 포맷 규칙

`utils.js` helpers:
- `fAuto(v)` — 자동 단위 (조/억/만원/원)
- `fMan(v)` — 만원 단위 고정 (의원당 평균)
- `diffAuto(a, b)` · `diffMan(delta)` — 부호 포함 변화량

KPI에서:
- 전체 변화액 → `diffAuto` (억원 단위)
- 의원당 평균 변화 → `diffMan` (만원 단위)
- 의원당 수입 절대값 → `fMan` (만원/년)

## 엑셀 포맷 호환 (v6.6 / v7.2.0 · 7 필드 · RR/RO 추가)

`docs/NHIS_HCC_시뮬레이터_업로드_v2.xlsx` — 시뮬레이터 입력 전용 단순 템플릿(v6.4 기준).
허브 엑셀 `HCC_분석_데이터셋_v4.xlsx` (시트 `2_시뮬레이터_업로드` 6열) 업로드 호환.

**v6.6 확장**: 엑셀에서 **HCC 예측 평균의료비 · 의원급외래 비중**도 읽어 `B_suggested = HCC × CR`로 환자군 기본수가 B 슬라이더 초기값 자동 설정. HCC/CR이 0/누락이면 해당 군은 기존 슬라이더값 유지. clamp [5만, 200만] 적용.

**v6.4 결정 사유 (유지)**: v1/v6.3의 15열 템플릿(원자료·파생·산출 3층)이 엑셀 자동 재계산으로
**B 컬럼 자체**가 `ref×cr` 값으로 덮어써져 `state.P`를 오염시키고, `B > C1` → `LC↓ → 공단지출↑` 역전 현상 발생. v6.6도 이 원칙 준수 — **B 컬럼은 엑셀에 두지 않고**, 시뮬레이터 파서가 HCC·CR을 곱해 산출 (엑셀 자가오염 경로 차단).

**시트**: `시뮬레이터_업로드` (시뮬레이터가 `includes("시뮬레이터")` 자동 선택)
**구조**: 단일 시트, 1행 헤더, 2~5행 4군 데이터, 6행 합계/가중평균

**인식 컬럼** (7 필드, v7.2.0 RR·RO 추가):
| 필드 | 별칭 (COL_ALIASES) | 단위 | 용도 |
|---|---|---|---|
| **N** (= RN) | `N` · `RN` · 환자수 · 등록환자수 · 실인원 · 참여의원 전체 환자수 | 명 | 환자군 참여의원 환자수 |
| **M1** | `M1` · 1인당 등록의원 외래비 · 1인당 의원외래비 · 현재외래비 | 원/년 | 1인당 등록의원 외래비 (= RO ÷ N) |
| **L** | `L` · 타원이용비중 · 비용기반 L · cf. 타원이용비중 L1 | 0~1 (또는 %) | 타원이용비중 |
| **HCC** (= A) | `HCC` · HCC예측 · 환자군 평균 의료비 A · 평균 의료비 A | 원/년 | **B 자동 유도 재료** |
| **CR** | 의원비중 · 의원급외래 비중 · 의원급외래비중 | 0~1 (또는 %) | **B 자동 유도 재료** (B = A × CR) |
| **RR** (v7.2.0) | `RR` · 참여의원당 등록환자수 | 명/의원 | **state.regDist 자동 주입** (4군 모두 양수일 때) |
| **RO** (v7.2.0) | `RO` · 등록의원외래비 · 등록의원 외래비 | 원 | **M1 fallback 재료** (M1 누락 시 RO ÷ N) |

- 분석가 입력 = 7 필드 × 4군 = 28 셀 (허브 엑셀에서 자동 계산되면 입력 없이 링크만)
- `B = A × CR` → 시뮬레이터 파서가 계산 (엑셀에 B 컬럼 없음 — 자가오염 방지)
- `M1 = RO ÷ N` (M1 컬럼 누락 시 fallback) — NHIS-HCC v3.0 정의 R1 = RO/RN 정합
- `regDist = RR` (4군 모두 양수일 때 자동 주입), 하나라도 0이면 기존 슬라이더 조정값 보존
- 합계 행은 SUMPRODUCT 기반 가중평균 (엑셀 내 자동)
- L, CR이 1 초과이면 자동 ÷100 보정 (퍼센트 입력 방어)

### v7.2.0 약어 매핑 (NHIS-HCC v3.0 엑셀)

| 컬럼 | 약어 | 풀네임 | 시뮬 매핑 |
|---|---|---|---|
| #2 | NT | 환자군별 전체 환자수 (참고) | `base.NT` reference |
| #3 | **RN** | 참여의원 전체 환자수 (이전 NC) | `state.base.N` |
| #5 | RD | 참여의원 환자분포 (NC 비율) | (보조 reference) |
| #6 | **RR** | 참여의원당 등록환자수 = RD × 1,000 | `state.regDist` 자동 주입 |
| #7 | A | 환자군 평균 의료비 | `state.base.A` (B 산출 재료) |
| #9 | CO | 의원급외래비 | (미사용) |
| #10 | **RO** | 등록의원외래비 | M1 fallback 재료 |
| #11 | M1 | 1인당 등록의원 외래비 (= RO ÷ RN) | `state.base.M1` |
| #12 | CR | 의원급외래비중 | `state.base.CR` |
| #13 | B | 환자군 외래 기준의료비 (= A × CR) | `state.P` |
| #14 | RT (잔재) | 등록환자 외래 의료비, 타원포함 | (미사용 · 엑셀 검산용) |
| #15 | RC (잔재) | 등록환자 등록의원 외래의료비 (= RO 중복) | (미사용 · 엑셀 검산용) |
| #16 | L1 | cf. 타원이용비중 | `state.base.L` (L1 시드) |
| #17 | C1 | 포괄관리비중 (= 1 − L1) | (산출, 1−L1 자동) |
| #18 | PB | 일차의료 기본수가 (= B × C1) | (산출) |

**약어 충돌 잔재 (엑셀 측)**: #14 RT·#15 RC는 엑셀에 그대로 남아 있으나 시뮬에서 직접 사용하지 않으므로 코드 영향 없음. 다음 엑셀 갱신 시 #14 → 다른 약어 (예: RTO/RNT), #15 → 컬럼 자체 삭제 권고 (RO와 데이터 동일). 자세한 내용은 v7.2.0 PR 본문 참조.

**파서**: `handleFile` ([src/hooks/useSimulator.js](src/hooks/useSimulator.js)).
- 앞 4행만 환자군으로 읽음 (합계행 자동 제외)
- N/M1/L → base 갱신
- HCC × CR > 0인 군: `B = clamp(HCC × CR, 50000, 2000000)` → `state.P[i]`로 주입
- HCC 또는 CR 누락/0인 군: 해당 군은 현재 슬라이더값 유지
- F(`state.F_g`) 정책 슬라이더는 엑셀 비반영 (유지)
- 업로드 배너: 자동 유도된 군 개수 + 환자군별 상세 (`N, M1, L, HCC, CR → B` 또는 `B 유지`)

**내보내기**: `handleExport`가 4열(환자군·N·M1·L) 구조로 출력 (v6.4 호환 유지). HCC·CR은 내보내기 대상 아님 — 분석가는 허브 엑셀 `AGG_1` 원자료에서 관리.

**분석가 외부 작업**: 허브 엑셀 `HCC_분석_데이터셋_v4.xlsx`에서 공단 반출 집계표(`AGG_1~5`)를 입력하면 `1_지표산출` → `2_시뮬레이터_업로드` 순으로 수식 자동 갱신. 시뮬레이터가 `2_시뮬레이터_업로드` 시트를 직접 업로드.

regDist·pt_base·baseN_per_clinic·M_clinics·F(state.F_g)는 엑셀로 이관 안 됨 (UI에서만 설정). B는 엑셀에서 "자동 유도"되지만 컬럼 자체는 없고 시뮬레이터 계산 산물.

## 전역 공식 baseline (v6.6)

관리자가 현재 시뮬레이터 상태를 모든 사용자의 디폴트로 고정하는 기능.

**저장 위치**: [src/data/presets/official_baseline.json](src/data/presets/official_baseline.json)
- 앱 시작 시 [src/constants.js](src/constants.js)가 이 JSON을 읽어 `INIT_BASE`·`INIT_B`로 사용
- JSON 누락/손상 시 하드코딩된 FALLBACK으로 자동 복귀
- `OFFICIAL_BASELINE_META`로 버전·갱신일·갱신자 UI 표시

**갱신 경로**: 데이터 관리 카드 → 🏛️ "현재 값을 공식 baseline으로 등록" 버튼
1. 확인 모달에 4군 N·M1·L·B 미리보기 + 경고
2. `/api/commit-baseline` POST ([api/commit-baseline.js](api/commit-baseline.js))
3. Vercel 서버리스 함수가 GitHub Contents API로 `official_baseline.json` 갱신
4. main 브랜치 커밋 → Vercel 자동 재배포 (1~2분)
5. 모든 사용자 다음 방문 시 새 디폴트 적용

**필요 환경변수 (Vercel 대시보드)**:
- `GITHUB_PAT` (필수) — GitHub PAT, repo `contents:write` 스코프
- `GITHUB_REPO` (선택, 기본 `shleefm/primary-simulator`)
- `GITHUB_BRANCH` (선택, 기본 `main`)
- `ADMIN_PWD` (선택) — 설정 시 요청 본문의 `password`와 일치 필요

**영속성 규칙**:
- **엑셀 업로드·슬라이더 조정**: 세션 한정, 다른 사용자 미영향
- **공식 baseline 등록 버튼 클릭**: 전역 영속 (GitHub 커밋 → 전체 사용자 디폴트 갱신)
- 새로고침·새 브라우저·다른 PC — 모두 `official_baseline.json`의 값에서 출발

## 배포 워크플로

- `main` → Vercel production · **공식 도메인 https://primarysimulator.kr** (v7.0.1, 2026-05-02 정식 연결) · 백업/개발 URL https://primary-simulator.vercel.app
- `feature/*` push 시 자동 preview URL
- **커밋 이메일**: `59140997+shleefm@users.noreply.github.com`
- **새 작업은 feature 브랜치 필수** (main 직접 푸시는 사용자 명시 승인 시만)
  - **2026-09-04 사용자 결정 (상시 승인)**: 상세 편집 테이블 작업 브랜치(`claude/clinic-revenue-calculation-05n3mq`)는 **수정 커밋을 푸시할 때마다 main에 `--no-ff` 자동 머지** (테스트·빌드 통과 확인 후). 버전 태그는 이 세션의 git 프록시가 태그 푸시를 403으로 거부하므로 사용자가 로컬/GitHub Releases에서 별도 부여.
- main 머지는 `--no-ff` 후 버전 태그 부여
- 버전 태그 이력: `v5.0` · `v6.0.0` · `v6.1.0` · `v6.2.0~3` · `v6.3.0` · `v6.9.6` · `v6.10.0` · `v7.0` · `v7.0.1` · `v7.0.2` · `v7.0.3` · `v7.1.5` · `v7.2.0`/`v7.2.1`/`v7.2.2`/`v7.2.3` · `v7.4` (archive로 보존, main에서 revert) · **`v7.5`** (2026-05-20 main 머지 완료, **commit `0175dfd`, tag `v7.5`** + vercel.json `d9d0010` chore 머지로 모든 브랜치 preview deployment 명시 활성화. 의료비 0원 제외 NHIS-HCC v3.0 baseline 적용 · A 1·2군 30~44% 상승 · 참여의원 환자 12,801,143 → 12,411,152명·의원당 4,379 → 4,246명 · INIT_REG_DIST [160,224,298,318] → [201,198,294,307] · INIT_F = B×5% = [11,926/20,658/33,124/50,668] · 새 엑셀 docs/NHIS-HCC_Simulator_exc_zero_260518.xlsx + 데이터 사전 docs/data_dictionary_v7.5.md · 자료 분석 절차 텍스트 갱신 [48,874,201명·12,411,152명·4,246명·PF 표기 보강] · 시트명 alias `핵심표` 파서 추가 · 단위 테스트 173/173 통과 · 시뮬 산식은 v7.2.3 안정 유지 [PB = B × (1−L1), v7.3.0/v7.4 산식 변경은 archive 보존, perf_blended 본인부담 처리 검토 후 옵션 C로 후속]) · `v7.2.2` (2026-05-09 main 머지 완료, commit `a0ee64e` · NHIS-HCC v3.0 엑셀 약어 정비 [RN/RR/RD/RO 인식, alias 추가] · regDist 디폴트 [100,600,200,100] → [160,224,298,318] 데이터 비례 · `handleFile` 파서 보강 [RR 자동 주입, RO/N M1 fallback] · `CLINIC_PRESETS.general` 라벨 "데이터 비례" · 상세 편집 테이블 헤더 갱신 [NC→RN, 등록→RR, M1 부제 "RO ÷ RN"] · NumBox `decimals` prop 추가 [포괄관리 지표 (C) "2.5%p" 소수점 1자리] · PF 통합 슬라이더 좌측 "B 기준 N.N%" 표기 · PF 디폴트 10% → 5% [INIT_PF_PCT=5, INIT_F = B×5% [10,416/15,811/28,400/44,228원]] · 단위 테스트 84/84 통과), (엑셀 약어 체계 정비 + regDist 디폴트 데이터 비례 전환 — NHIS-HCC v3.0 엑셀의 새 약어 [RN/RR/RD/RO/CO]와 시뮬레이터 정합 · `COL_ALIASES.N`에 RN alias 추가 · 신규 `COL_ALIASES.RR`/`COL_ALIASES.RO` · `INIT_REG_DIST` [100,600,200,100] → [160,224,298,318] (참여의원 환자분포 RD × 1,000명) · `CLINIC_PRESETS.general` 라벨 "일반 의원" → "데이터 비례", regDist 동기 갱신 · 상세 편집 테이블 헤더 NC→RN, 등록→RR, M1 부제 "1인당 RC" → "RO ÷ RN" · `handleFile` 파서 보강 [RR 컬럼 → state.regDist 자동 주입, M1 누락 시 RO ÷ N fallback] · `LOAD_DATA` reducer에 regDist 옵션 추가 · 엑셀 #14 RT·#15 RC 잔재는 시뮬 미사용 reference라 코드 영향 없음 · 단위 테스트 회귀값 갱신 [INIT_REG_DIST 새 디폴트, COL_ALIASES.RR/RO 키 검증, RESET_REG 신규 기댓값]), (성과 배분 → 성과 공유 UI 라벨 일괄 치환 — 탭 라벨 [`💰 성과 배분 (Shared Saving)` / `💰 성과배분`] → [`💰 성과 공유 (Shared Saving)` / `💰 성과공유`] · TabSharedSaving 안내 배너·박스 헤더 [성과 공유 비율, 성과 공유 구성]·파이 차트 헤더·슬라이더 aria-label 모두 치환 · 코드 주석 [constants.js:68 PT/SS Track 지급률, useSimulator.js:52, TabSharedSaving.jsx:16 의원 모드 Hero] 정합 · 영문 식별자 보존 · 단위 테스트 65/65 통과 · feature 브랜치 `feature/v7.0.3-rename-share-distribution` → main `--no-ff` 머지) · `v7.0.2` (모바일 탭 라벨 SS → 성과배분 — short: `💰 SS` → `💰 성과배분` · v7.0.3에서 `💰 성과공유`로 후속 치환됨) · `v7.0.1` (공식 도메인 `primarysimulator.kr` 정식 연결 — index.html canonical/og:url/og:image/twitter:image 4건을 신 도메인으로 교체, public/og-image.svg 푸터 텍스트 동기화, README.md에 공식/백업 URL 안내 2줄 추가; main 직접 푸시 [사용자 명시 승인], Vercel 자동 재배포; CLAUDE.md/docs/handoff_*.md 등 개발자 문서와 vercel.json/api/package.json 등 내부 식별자는 보존) · `v7.0` (정치 리스크 차단 — 의원 총수입 절대값/% 노출 전면 금지, 변화액 단독 hero · 포괄관리 성과가산 → 포괄관리성과 일괄 치환 · 포괄관리 지표 C = 1 − L2 새 표시 차원 도입 [내부 L1·L2 그대로 · 양수 슬라이더 0~+25%p · `max(0, C − (1 − L1)) = max(0, L1 − L2)` 등치] · Shared Saving Track 가산 분리 [`tracks.ongoing` ssAmt 제외, 의원 KPI 이미 미반영 · SS 탭 참고 시나리오 배너] · SS 디폴트 1/1/1 + total 110.8조 · 의원 모드 단순화 [ClinicCountCard·Track 비교 박스·데이터 관리 모두 정책 모드 전용 후퇴] · PB 배지 "환자군 위험도(HCC) 기반" · PF 배지 2종 "일차의료 기능강화"·"환자등록관리" · 분배 토글 라벨 "환자군별" + 역비례 옵션 삭제 · L1 카드 "평균 타원이용비중(L1)" · TCard 새 헤더 "일차의료수가(P)" + 부제 · Track 카드 1년차/2년차 두 줄 → 변화액 한 줄 [포괄관리성과 포함, PT 미포함] · Track 비교 baseline = decomp.baselineIncome/M 으로 통일 [수가 시뮬 KPI와 6만원 차이 해소, 정확히 일치] · PT 박스 헤더 cf 표기 + 토글 없이 항상 노출 · 포괄관리성과 박스 삭제 [Track 카드와 중복] · Track 미세조정 슬라이더 삭제 · 모드 토글을 헤더 → 수가 시뮬 탭 상단 "관점 선택" 으로 이동 [영향 범위와 일치] · 탭별 안내 문구 신설 [수가/Track/SS 각자] · 단위 테스트 65/65) · `v6.10.0` (PF 단순화 — 통합 슬라이더 + 분배 토글, 균형추 모듈 폐지 · 정책 시나리오 프리셋 신설 · INIT_F = B×10% HCC 비례 자동 · `INIT_PF_PCT`/`INIT_PF_RULE` constants 신규 · `state.pfRule`/`SET_PF_RULE` reducer 신규 · `distribute`/`calcPFfromPct`/`inferPFpct` utils 신규 · `FBalanceCorrection.jsx` + `fBalance.test.js` + `balance-thumb` CSS 삭제 · `POLICY_SCENARIOS` 4종 신규 · 단위 테스트 누적 65/65) · `v6.9.3` (명칭 체계 PB·PF + 정책 모드 노출 구조 + 의원 KPI "공단지급분 변화" 재정의 — 상단 P=PB+PF 공식 박스 · 1번 카드 PB(데이터 기반 NumBox만) · 2번 카드 PF(정책 협상, 슬라이더+NumBox)에 균형추 보정 controlled accordion 종속 [기본 접힘] · B/L1 직접 조정 고급 패널 후퇴 · 균형추 등록환자 규모 프리셋 4개 [10만/100만/1,000만/3,000만] · 추 모양 사다리꼴 [clip-path] + floating % bubble · `calcPB`/`PBtoB` 신규 utils · `calcF_fromBalance` → `calcPF_fromBalance` rename + alias · 정책 모드 KPI ② "지불방식 전환 효과" → "PF 가산 효과 [Σ PF × 등록환자]" 교체 [PB drift 제거, 균형추 우측 카드와 매칭] · 본인부담 disclaimer footer · WinWinGrid 우측 카드 0%에서 "🟢 일차의료 지원 변동 ±0원" 우선 표기 · 단위 테스트 신규 4개 누적 67/67 통과) · `v6.4.0` · `v6.4.1~2` · `v6.4.3` (디폴트 복귀 + 프리셋 2k) · `v6.4.4` (PT 1천만 + 합계확대 + L헤더) · `v6.4.5` (INIT_B HCC + L -50%p) · `v6.4.6` (F버튼 정비) · `v6.4.7` (균등/차등 누적 +1만원) · `v6.4.8` (P카드 헤더 동적 L% + 하단 수식 제거) · `v6.5.0` (Track 성과배분 박스 + PT/SS Track% 편집 + SS 분모 토글 + 배분 용도 리브랜딩) · `v6.5.1` (Track 비교 박스 통합 + KPI/WinWinWin 삭제 + 전환 지원 색상 blue화) · `v6.5.2` (합계 공식 절대값화 + 1년차 PT만 + 참고문구 개선 + 차트 후치) · `v6.5.3` (SS 사업대상 단위 조원→억원) · `v6.5.4` (디폴트 사업대상 1,000억 + Track 재원 사업대상 연동 + SS 절감액 비례 축소) · `v6.5.5` (사업대상 디폴트 1,000→10,000억) · `v6.5.6` (SS 탭 용어 정비: 총괄→의료비 절감 / 배분 용도→절감 배분 분류 + 분류 박스 파이 차트 뒤로 이동) · `v6.6.0` (HCC×의원비중 B 자동유도 + official_baseline.json 런타임 로더 + /api/commit-baseline 서버리스 + 공식 baseline 등록 버튼) · `v6.7.0` (L1·L2 분리 · α 포함 초기 커밋) · `v6.7.1` (α 제거 · 의원 100% 환원 + n_reg 설명) · `v6.7.2` (수가 시뮬레이션 Track 구분 제거 + L2 KPI 연동) · `v6.7.3` (Track 탭 L2 슬라이더 신설 + 성과급 L2를 SS 위로 이동) · `v6.7.4` (L2 슬라이더 변화율 UI -50~0%p 복원 — 구 L 슬라이더 스타일 계승) · `v6.8.0` (명칭 변경 "지불모형 → 지불체계" · Header 우측 정책/의원 모드 토글 신설 · 디폴트 의원 모드 → Track 탭 · 수가 탭 B·F·L1 세 박스 의원 모드에서 "🏛️ 정책 고정값" 접힘 래퍼로 통합 · 모드 전환 시 기본 진입 탭 자동 이동 · URL `?mode=policy|clinic` 진입 지원 · 모드별 안내 배너) · `v6.8.1` (용어 재편: "타원이용비중 L2→포괄관리 지표 L2"·"성과급→포괄관리 성과가산" UI 일괄 치환 [L1 쪽 "타원이용비중"은 유지] · 모드 토글 좌측 이동 + 세그먼티드 컨트롤 + 2배 크기 + 남색(정책)/녹색(의원) · 첫 진입 의원 모드+수가 탭 [모드 전환 시 자동 탭 이동 제거] · 의원 모드 대폭 단순화 [정책 고정값 박스 제거·TCard 공식 라벨·L1 개별 표시·P=공단지급 부제·수가 산출 구조 아코디언 모두 숨김, TCard 제목을 "환자군별 공단지급 수가"로] · 모드별 안내 배너 재작성 · L2 설명문 2줄 교체) · `v6.8.2` (의원 모드 Phase 2 보강 — RegScaleCard 상단에 환자군 구성 프리셋 3버튼 [일반 의원 [100,600,200,100] · 노인 집중 [30,200,400,370] · 사용자 지정] 추가 [의원 모드 전용, 만성질환·신도시는 의도적 제외] · Win-Win-Win 직전에 Track 비교 요약 3카드 [2년차 이후 = Track 선지급 + SS + 포괄관리 성과가산, "✓ 현재 선택" 뱃지] 신설 · TabTrack의 tracks 계산을 useSimulator의 `tracks` 메모로 끌어올려 단일 소스 오브 트루스 [수가 탭 카드와 Track 탭 비교 테이블 숫자 일치 보장] · 정책 모드는 변경 없음) · `v6.8.3` (의원 모드 TCard 정비 — 제목 "환자군별 공단지급 수가 → 일차의료수가" 단순화 [정책 모드는 풀 라벨 유지] · 카드 그리드 하단 안내 한 줄 신설 "💡 의원 수입 = 일차의료수가(공단지급) + 환자 본인부담(현행 외래비의 30%)" — 의원이 카드 금액을 의원 수입과 동일시하지 않도록 구성 명시) · **`v6.9.1`** (3번 탭 라벨 재구성 — "절감 → 변화·성과·체계 지원" 프레임 일괄 치환 [의료계 노출 시 DRG·억제 보너스 연상 차단 목적] · 탭 라벨 "💰 절감 성과 배분" → "💰 성과 배분" · 섹션 1 "항목별 절감 시뮬레이션" → "항목별 의료비 변화 추정"·"절감률"→"변화율"·"절감액"→"변화액" · 섹션 2 "의료비 절감" → "총 의료비 영향"·"총 절감액"→"총 변화액" · 섹션 3 "절감액 배분 비율" → "성과 배분 비율"·"전환지원 100%"→"체계 지원 100%"·"일차의료 전환 지원"→"일차의료 체계 지원" · 안내 박스 "절감 배분 분류" → "성과 배분 구성" · PT 풀네임 통합참조 v6.0 정합 [Transformation Payment → Primary care Transformation grant] · 음수 부호 U+2212 일관 표기 [NumBox 좌측 회색 −prefix · 결과 영역 fChangeAuto 헬퍼] · 박스 헤더 부제 "이용 감소 가정 — 양수 입력 시 음(−) 효과로 표기" 명시 · 섹션 2 "총 변화액" 결과 박스 + "기준 토글" 박스 빨강→슬레이트/회색 톤다운 [부정 프레임 차단·정합성] · Hero 박스 "사업대상 절감배분액" → "사업대상 성과배분 재원" · TabTrack 잔존 표현 정리 ["절감 성과 배분 탭" → "성과 배분 탭" · "절감액은 의원 100% 환원" → "이용 감소분은 의원 100% 환원"] · 코드 식별자·테스트·내부 주석은 모두 보존 [정책 표준 용어로서의 "Shared Saving"·"saving"은 학술/정책 문서에서 유지]) · **`v6.9.2-bidir`** (F 균형추 양방향 + 절대 재정중립 — 추 의미 "ΔF 추가" → "F 4군 절대값 자동 산출" 전환 · 0% = baseline 대비 변화 0원 · 슬라이더 −5%~+10% 양방향 · 신호등 7단계 [강한절감/절감/미세조정/재정중립/적극투자/고투자/협상한계] · F 슬라이더 음수 허용 [하한 -B/2] · 윈윈 카드 3-mode 분기 [양수/음수/0%] · AI 산출 결과 음수 F 경고 배지·빨강 강조 · 음수 F 시나리오 안내 배너 · `calcF_fromBalance` 신규 함수 · `distribute()` 음수 totalTarget 허용 · 디폴트 추 위치 0% [재정중립 자동 진입] · 23 단위 테스트 누적 63/63 통과) · **`v6.9.2`** (정책 모드 — F 균형추 보정 모듈 신설 · 정책 모드 전용 · 의원 모드 가드 · F 박스 직후 마운트 · 추 위치 0~10% 신호등 그라디언트 트랙·64px 둥근 무게추 thumb [`balance-thumb` CSS, 표준 `<input type=range>` 베이스] · 분모 = `T.nhi` (현 시뮬·L2 반영) · 분자 = 사업 참여 등록환자 합계 · 분배 규칙 3종 [HCC비례·균등·역비례 / `Σ ΔF × n_reg = deltaTotal` 합산 보존] · 신호등 4단계 [재정중립 0~2% / 적극 투자 2~5% / 고투자 5~8% / 협상 한계 8%↑ — 시각 가이드 · 정책 근거 없음] · 윈윈 카드 좌·우 [좌 🟢 포괄관리 성과가산 잠재 (L2 5%p 추가 개선 가정 · `Σ 0.05 × B × n_reg × trackMul / M`) / 우 🔵 F 가산 효과 (`Σ ΔF × regDist`)] · **Shared Saving 일체 미포함** [별도 풀, 일차의료수가 아님 — 사용자 명시] · AI 산출 결과 박스 [환자군별 F_new + ΔF, "✓ 적용" 버튼 + 직전 F 백업 / "↩ 되돌리기"] · `fChangeAuto` 헬퍼 utils로 끌어올림 [TabSharedSaving 안 정의 → utils export, 컨벤션 일관] · 신규 단위 테스트 15개 [distribute 합산 보존 · 단조성 · signalLevel 경계값 · fChangeAuto] · 누적 51/51 통과) · **`v6.9.0`** (UI 재구성 — 모드별 차등화 강화 [3-step P→G 인계장 기반] · **[C] Track 탭 카드형 재구성** — 3 Track 카드 [1년차/2년차~ 두 숫자 강조 · 활성 Track 인라인 분해 자동 펼침 · "✓ 현재 선택" 배지 · 2년차~ 폰트 한 단계 크게] · PT·SS·성과가산 3박스 → "📎 적용된 입력값" 아코디언으로 격하 [의원 모드 기본 접힘 1줄 요약 / 정책 모드 기본 펼침] · 7행 비교 표 폐기 · Track 미세조정 슬라이더는 정책 모드 전용 · L2 슬라이더 위치 승격 · **[A] Hero Before/After (의원 모드 KPI)** — 의원 수입 변화 좌측 박스를 Hero 비교형으로 교체 [현재 FFS → 참여 후 큰 숫자, +X만원/년 강조 카드, Track 인디케이터, 성과가산 ≥ 5천원이면 "포함" 안내, 미만이면 "L2 낮추면 추가" 안내] · 정책 모드는 ①②③ 세부 분해 박스 유지 · **[D] Shared Saving 의원 모드 차등화** — 최상단 "🏥 우리 의원 예상 연간 성과배분" Hero 박스 신규 [큰 숫자 + 산출 공식 단계별 표시 + Track 지급률] · 슬라이더 영역 안내 박스 · 항목별 절감·의료비 절감·배분 비율 카드 fieldset disabled 처리로 읽기 전용 [opacity-70 시각 처리] · 정책 모드 회귀 없음 · **[E] 의원 모드 디폴트 강제** — readInitialMode에서 localStorage 우선순위 제거 · URL `?mode=policy`만 정책 진입 · localStorage 저장 useEffect 제거)

## 시뮬레이터 밖 항목 (정보 표시만)

- **등록 인센티브** (본인부담 50% 1회 감면) — 공단 보충, 의원 수입 변동 0
- **PT** — Track 탭에 표시 (v6.2부터 편집 가능), 시뮬레이터 수입 계산에 미포함
- **거점 일차의료지원센터 운영비** — 10개 × 3억원/년

## 준수 사항 (정책 일관성)

1. **핵심 수식 변경 금지**: B, 공단지급, 본인부담, L, **P = B + F**
2. **용어 통제**: 위 테이블 용어만. 구용어 "R(환자등록관리료)", "T(통합수가)", "PP(최종수가)", "포괄수가", "A(공단 실지급)" 금지.
3. **P ≠ 공단지급**: P는 명목 청구수가, 공단지급은 실지급. UI에서 둘 다 표기.
4. **F의 L 우회 규칙**: 수식·UI에서 명시.
5. **모든 Track에 F 가산**: 노션 "수입 감소 없음" 원칙.
6. **기호 B의 이중 역할 주의**: 본인부담(M1×30%)은 기호 없이 "본인부담" 텍스트만 사용.

## 메모리

프로젝트 메모리: `{user-claude-dir}/projects/C--Users-User-projects-Primary-Simulator/memory/`
- `MEMORY.md` — 인덱스
- `user_role.md` — 사용자 프로필
- `project_per_clinic_kpi.md` — 의원당 평균 수입 KPI 원칙
- `project_v6_state.md` — v6.2.0 main 머지 상태
- `feedback_branch_push.md` · `feedback_ui_style.md` · `reference_key_docs.md`
