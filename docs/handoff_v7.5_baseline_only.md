# v7.5 인계장 — 데이터만 갱신 (의료비 0원 제외 baseline)

**상태**: ✅ main 머지 완료 (2026-05-20)
**브랜치**: `feature/v7.5-baseline-only-260520`
**선행 머지**: v7.2.3 (main commit `da8ca2c`)
**v7.4 보류**: `archive/v7.4-prerevert-260520` (PB·공단 산식 변경 + perf_blended 모순 발견 → 옵션 C 후속)

---

## 1. 한 줄 요약

NHIS-HCC v3.0 (의료비 0원 제외) 새 데이터를 main에 적용. **시뮬 산식은 v7.2.3 안정 유지**. v7.3.0/v7.4 산식 변경(PB=M1×0.7, 공단 ×0.7)은 perf_blended의 본인부담 처리 모순으로 보류, archive 브랜치에 보존.

---

## 2. 변경 범위 (데이터만)

| 파일 | 변경 |
|---|---|
| [src/data/presets/official_baseline.json](../src/data/presets/official_baseline.json) | 의료비 0원 제외 baseline (A·M1·CR·L1·NT·RR 4군 모두) |
| [src/constants.js](../src/constants.js) | INIT_REG_DIST [160,224,298,318] → [201,198,294,307], CLINIC_PRESETS.general 동기 |
| [src/hooks/useSimulator.js](../src/hooks/useSimulator.js) | handleFile 시트명 alias `핵심표` 추가 (NHIS-HCC v3.0 엑셀 직접 업로드 호환) |
| [src/components/TabSimulation.jsx](../src/components/TabSimulation.jsx) | 자료 분석 절차 텍스트 갱신 + 초기화 모달 메시지 갱신 |
| [src/test/calculator.test.js](../src/test/calculator.test.js) | 회귀값 갱신 (173/173 통과) |
| [docs/NHIS-HCC_Simulator_exc_zero_260518.xlsx](NHIS-HCC_Simulator_exc_zero_260518.xlsx) | 신규 — 분석 엑셀 보관 |
| [docs/data_dictionary_v7.5.md](data_dictionary_v7.5.md) | 신규 — A·M1·RC·CO = 총의료비 명시 |
| [CLAUDE.md](../CLAUDE.md) | v7.5 블록 + 버전 태그 이력 갱신 |

**시뮬 핵심 산식 (v7.2.3 그대로)**:
- 공단지급 = P = B × (1 − L1) + PF
- 의원 수입 = 공단지급 + M1 × 0.30 (본인부담)
- 성과급 = max(0, L1 − L2) × M1 × n_reg × TrackMul (베이스 M1, v7.3.0 유지)
- L2 효과는 perf_blended 모듈로 별도 격리

---

## 3. baseline 비교 (zero 포함 → exc_zero)

| 항목 | v7.2.3 (zero 포함) | v7.5 (zero 제외) |
|---|---|---|
| 전체 환자수 | 53,247,650 | **48,874,201** (-4.4M, -8.2%) |
| 참여의원 환자수 | 12,801,143 | **12,411,152** (-39만) |
| 의원당 환자수 | 4,379 | **4,246** |
| A 1군 | 281,847 | **405,180** (+44%) |
| A 2군 | 563,018 | **767,703** (+36%) |
| A 3군 | 1,261,710 | 1,355,881 (+7%) |
| A 4군 | 5,277,734 | 5,589,034 (+6%) |
| M1 1군 | 99,879 | **86,457** (-13%) |
| M1 4군 | 301,742 | **328,901** (+9%) |
| L1 1군 | 0.7189 | 0.7165 |
| L1 3군 | 0.7529 | **0.7605** |
| B = A × CR 1군 | 208,318 | **238,515** (+15%) |
| B 2군 | 316,212 | **413,166** (+31%) |
| INIT_REG_DIST | [160,224,298,318] | **[201,198,294,307]** |
| INIT_F (B×5%) | [10416,15811,28400,44228] | **[11926,20658,33124,50668]** |

---

## 4. v7.3.0/v7.4 보류 사유 (archive 브랜치 보존)

`archive/v7.4-prerevert-260520`에 보존된 산식 변경 시도:
- v7.3.0: PB = M1 × 0.7 (NT vs NC 코호트 불일치 제거)
- v7.4: 공단 지출 ×0.7 + L2 격리

검증 중 발견된 문제 (옵션 C로 후속 처리 예정):
- C 슬라이더 +24.5%p 시 환자 본인부담 30% 처리 누락
- perf_blended를 메인 KPI(의원 수입·공단 지출)에 동일 적용 → 본인부담 변동 무시
- 옵션 C: perf_blended를 메인 KPI에서 분리, 별도 카드로 "포괄관리성과 (추정)" 표시

후속 작업 시:
1. main에서 `feature/v7.6-perf-blended-separation` 분기
2. archive 브랜치 코드 참조 (PB=M1×0.7, 공단 ×0.7 + L2 격리 산식)
3. 추가로 옵션 C 적용 (perf_blended를 incTotal·nhiTotal에서 제거, 별도 KPI 카드)
4. 검증 후 main 머지

---

## 5. 검증 결과

- **단위 테스트**: 173/173 통과 (회귀값 갱신: ON·INIT_PER_CLINIC·INIT_REG_DIST·INIT_F·INIT_DEFAULT_TOTAL_N 등 10개)
- **빌드**: `npm run build` 성공
- **자료 분석 절차 텍스트**: 새 엑셀 시멘틱 정합 (48,874,201명 + 0원 제외 + 12,411,152명·4,246명 + PF 표기 보강)

---

## 6. 정책 발표 안전성 (v7.5 시점)

- 새 baseline으로 시뮬레이션 가능 (의료비 0원 제외 → 더 정확한 평균 의료비 A 사용)
- 시뮬 산식은 안정 v7.2.3 유지 → 시뮬 결과의 수치 형태는 이전 정책 발표와 호환
- PF=0%일 때 의원 수입 +양수 모순은 여전히 존재 (v7.3.0에서 해결할 산식 문제). 다만 perf_blended 모순까지 함께 해결하려면 옵션 C 작업 필요 → 후속.

---

## 7. 다음 작업 (v7.6 후보)

1. **옵션 C 적용**: perf_blended를 메인 KPI에서 분리, 별도 카드로 노출
2. **PB = M1 × 0.7 산식 정정**: archive 브랜치의 v7.3.0 변경 부분만 발췌하여 적용
3. **공단 지출 산식 ×0.7 정정**: archive 브랜치의 v7.4 변경 부분만 발췌 + 옵션 C와 함께
4. **C 슬라이더 범위 축소**: 0~+25%p → 0~+5%p 검토 (현실적 정책 범위)
