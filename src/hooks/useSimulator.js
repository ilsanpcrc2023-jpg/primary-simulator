import { useReducer, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { INIT_BASE, INIT_P, INIT_F, INIT_REG_DIST, INIT_M_CLINICS, INIT_BASE_PER_CLINIC, INIT_TOTAL_N, INIT_DATA_LABEL, INIT_PT_BASE, INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C, INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C, INIT_SS_COST_BASE, INIT_SS_PROJECT_COST, INIT_L1, INIT_PF_PCT, INIT_PF_RULE, INIT_DEFAULT_M, INIT_DEFAULT_TOTAL_N, INIT_PER_CLINIC, ON, COL_ALIASES, COL_ALIASES_EXACT_ONLY, B_MIN, B_MAX, INIT_COPAY_RATES } from "../constants";
import { roundRegDist, refRatiosFromBase, regDistFromRatios } from "../utils";

// v7.5.8: 등록 기준 총량 (분포비를 곱하기 전 base) = Σ regDist ÷ Σ 현재 분포비. 디폴트 1,000명.
//   regDist_i = ratio_i × base 이므로 분포비 합이 100%가 아니어도(예 119.8% → 1,198명) base는 1,000으로
//   유지되고, "데이터 비례"/균등 프리셋으로 돌아오면 등록 총량도 base × Σ ratio로 복귀한다.
//   의원당 등록환자수 프리셋(SCALE_REGDIST)은 비율을 보존하며 스케일하므로 base가 그 값(1,500 등)으로 바뀐다.
const regBaseOf = (state) => {
  const s = (state.regDist || []).reduce((a, v) => a + (Number(v) || 0), 0);
  const ratios = Array.isArray(state.baseRatios) && state.baseRatios.length === state.base.length
    ? state.baseRatios
    : refRatiosFromBase(state.base);
  const r = ratios.reduce((a, v) => a + (Number(v) || 0), 0);
  return s > 0 && r > 0 ? s / r : 1000;
};

const initialState = {
  base: INIT_BASE,
  P: INIT_P,
  // v6.7: L1·L2 분리. LC(변화율) 제거. 공유율 α도 제거 (의원 100% 환원).
  // L1 = 선지급 기준 (환자군별, 0~1). P_g = B(1−L1_g) + F_g.
  // L2 = 실측 타원이용 (단일 스칼라, 0~1). null이면 L1 가중평균 사용 (성과급 0 기준점).
  // 성과급 = max(0, L1−L2) × B × n_reg × TrackMul (Shared Saving과 달리 공유율 없음).
  L1: [...INIT_L1],
  L2: null,
  // v6.9.4: 데이터 anchor — 환자군 패널 "↩ 초기화"가 복귀할 기준값.
  //   초기엔 official_baseline.json (HCC v3.0: 2,923기관 / 12,801,143명).
  //   엑셀 업로드·프리셋 로드 시 그 데이터의 M_clinics·sum(N)·라벨로 갱신됨.
  //   이후 사용자가 의원 수·환자수를 수동 변경해도, 초기화 버튼은 가장 최근 로딩한 데이터로 복귀.
  datasetM: INIT_M_CLINICS,
  datasetTotalN: INIT_TOTAL_N,
  datasetLabel: INIT_DATA_LABEL,
  // v7.1.1: 초기 디스플레이는 1차년도 시범사업 scope (100개 의원 × 의원당 4,379명 = 437,900명).
  //   데이터 anchor (2,923개) ≠ 초기 디스플레이 (100개) — 두 anchor 분리.
  //   "일만시 전체 등록 모드" 버튼 클릭 시에만 데이터 anchor 전체로 전환.
  totalN: INIT_DEFAULT_TOTAL_N,
  dataLabel: INIT_DATA_LABEL,
  tab: 0,
  showDetail: false,
  hccPct: 100,
  uploadBanner: null,
  ssTotalCost: 110.8,
  ssAcute: 29.9,
  ssEmergency: 3.5,
  ssLtc: 10.0,
  ssAcutePct: 1,         // v7.0: 디폴트 -1% (총 의료비 영향 ≈ -0.392%)
  ssEmergencyPct: 1,
  ssLtcPct: 1,
  ssMacroPct: 0.1,
  ssClinicShare: 50,
  // v2.7: 일차의료 기능수가 F (환자군별 차등, 복지부 공식안 준용)
  // v6.10.0: 디폴트 = B × INIT_PF_PCT/100 (HCC 비례 자동 산출).
  F_g: [...INIT_F],
  // v6.10.0: PF 분배 규칙 (hcc|equal|inverse) — PF 카드 분배 토글에서 사용.
  pfRule: INIT_PF_RULE,
  // v7.5.3: 기준 군별 분포비(ratio_i) 수기 override. null이면 base.N에서 산출 (N_i / ΣN).
  //   자유 입력 (합 100% 강제 없음). LOAD_DATA 시 null로 복귀 (새 데이터 실측 비율).
  baseRatios: null,
  // v7.6.2: 환자군별 본인부담비 (참고 항목 · 상세 편집 테이블 표시/편집만, 산식 미반영). 디폴트 30%.
  copayRates: [...INIT_COPAY_RATES],
  // v7.1.1: 초기 디폴트 = 100개 의원 (1차년도 시범사업).
  M_clinics: INIT_DEFAULT_M,
  // 의원당 환자군별 등록환자수 (부록 추정치 100/600/200/100)
  regDist: [...INIT_REG_DIST],
  // 참여 전 의원당 실인원 (FFS 기준선 계산용). 패널 변화 효과 분리를 위한 독립 변수.
  baseN_per_clinic: INIT_BASE_PER_CLINIC,
  // 일차의료 전환지원금 (PT) 기준 금액 — 의원당 1회, Track별 %로 차등
  pt_base: INIT_PT_BASE,
  // PT Track 지급률 (A/B/C, %) — 편집 가능, 중간 hccPct는 선형보간
  ptPctA: INIT_PT_PCT_A,
  ptPctB: INIT_PT_PCT_B,
  ptPctC: INIT_PT_PCT_C,
  // 성과공유 Track 지급률 (A/B/C, %) — 편집 가능
  ssPctA: INIT_SS_PCT_A,
  ssPctB: INIT_SS_PCT_B,
  ssPctC: INIT_SS_PCT_C,
  // Shared Saving 절감률 분모 기준 ("total"=건강보험 전체 / "project"=사업대상)
  ssCostBase: INIT_SS_COST_BASE,
  ssProjectCost: INIT_SS_PROJECT_COST,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      // v6.9.2: M_clinics 변경 시 totalN을 자동 동기화 (사업 규모 정합성).
      // perClinic = totalN / M을 보존하도록 newTotalN = perClinic × newM 으로 갱신.
      // 이로써 균형추 미러 프리셋과 RegistrationPanel의 M 컨트롤이 같은 결과를 보장하고,
      // M=1,000으로 늘릴 때 totalN clamp로 의원당 등록환자수가 비현실적으로 줄어드는 문제 해소.
      // baseN_per_clinic(참여 전 기준선)은 패널 변화 효과 분해용 독립 변수이므로 변경 안 함.
      if (action.key === "M_clinics") {
        const newM = Math.max(1, Math.round(action.value));
        const perClinic = state.M_clinics > 0
          ? state.totalN / state.M_clinics
          : state.baseN_per_clinic;
        const newTotalN = Math.max(1, Math.round(perClinic * newM));
        return { ...state, M_clinics: newM, totalN: newTotalN };
      }
      return { ...state, [action.key]: action.value };
    case "SET_P": {
      const P = [...state.P];
      P[action.i] = action.value;
      return { ...state, P };
    }
    case "SET_BASE": {
      const base = [...state.base];
      base[action.i] = { ...base[action.i], [action.key]: action.value };
      // v7.5.5: RN(N · 기준 분포비 재료) 편집 시 수기 override는 폐기 → RN 실측 비율로 재산출
      // v7.5.8: 등록 분포비 = 기준 분포비이므로 regDist도 새 실측 비율로 동기화
      if (action.key === "N") {
        return { ...state, base, baseRatios: null, regDist: regDistFromRatios(refRatiosFromBase(base), regBaseOf(state)) };
      }
      // v7.5.9: A·CR 편집 시 엔진 B(state.P)도 A × CR로 동기화 (사용자 결정 — 테이블 B·PB가 시뮬에 반영되지 않던 문제).
      //   엑셀 업로드와 동일하게 [B_MIN, B_MAX] clamp. A·CR 중 하나라도 없거나 0이면 B 유지.
      //   PF(F_g)는 "B × F%" 의미를 지키기 위해 기존 비율(F_g/B_old)을 새 B에 곱해 재산출 (PF 슬라이더 % 위치 보존).
      if (action.key === "A" || action.key === "CR") {
        const { A, CR } = base[action.i];
        if (typeof A === "number" && typeof CR === "number" && A > 0 && CR > 0) {
          const newB = Math.max(B_MIN, Math.min(B_MAX, Math.round(A * CR)));
          const oldB = state.P[action.i];
          if (newB !== oldB) {
            const P = [...state.P];
            P[action.i] = newB;
            const F_g = [...state.F_g];
            if (oldB > 0) F_g[action.i] = Math.max(0, Math.round((F_g[action.i] ?? 0) / oldB * newB));
            return { ...state, base, P, F_g };
          }
        }
      }
      return { ...state, base };
    }
    // v7.5.3: 기준 군별 분포비(ratio_i) 수기 편집 — 자유 입력 override (다른 군 불변, 합 100% 강제 없음).
    // v7.5.5: 디폴트(override 없을 때) = RN 기준 (refRatiosFromBase).
    // v7.5.8: 분포비 단일화 (사용자 결정) — 등록 분포비 = 기준 분포비. 분포비 편집 시 regDist도
    //   ratio_i × 등록 총량(Σ regDist, 디폴트 1,000)으로 동시 갱신. 합 1,000 강제 없음 (999.9 등 허용).
    case "SET_BASE_RATIO_AT": {
      const cur = state.baseRatios ?? refRatiosFromBase(state.base);
      const baseRatios = [...cur];
      baseRatios[action.i] = Math.max(0, Math.min(1, action.ratio));
      const regDist = [...state.regDist];
      regDist[action.i] = roundRegDist(baseRatios[action.i] * regBaseOf(state));
      return { ...state, baseRatios, regDist };
    }
    // v7.5.8: 분포비 일괄 설정 (프리셋 균등/건강편중/고위험편중) — 기준·등록 동시.
    case "SET_DIST_ALL": {
      const baseRatios = action.ratios.map(r => Math.max(0, Math.min(1, r)));
      return { ...state, baseRatios, regDist: regDistFromRatios(baseRatios, regBaseOf(state)) };
    }
    // v7.5.8: 실측 복귀 — 기준 분포비 override 폐기 + 등록 분포비도 실측 비율로 재산출 ("데이터 비례").
    // v7.6.2: 본인부담비 참고값 편집 (0~1 clamp) — 산식에는 쓰이지 않음.
    case "SET_COPAY_AT": {
      const copayRates = [...(state.copayRates ?? INIT_COPAY_RATES)];
      copayRates[action.i] = Math.max(0, Math.min(1, action.value));
      return { ...state, copayRates };
    }
    case "RESET_BASE_RATIOS":
      return { ...state, baseRatios: null, regDist: regDistFromRatios(refRatiosFromBase(state.base), regBaseOf(state)) };
    case "SET_F_AT": {
      // v6.9.6: PF 음수 금지 (사용자 결정). 0 floor.
      //   v6.9.2-bidir에서 도입한 음수 PF 시나리오는 폐기.
      //   균형추 calcPF_fromBalance가 음수 절대값을 반환해도 reducer 단에서 0으로 잘림.
      const F_g = [...state.F_g];
      F_g[action.i] = Math.max(0, Math.round(action.value));
      return { ...state, F_g };
    }
    case "SET_F_ALL":
      // v6.9.6: PF 음수 금지. 균형추 산출 결과 음수도 0으로 floor.
      return { ...state, F_g: action.values.map(v => Math.max(0, Math.round(v))) };
    case "SET_PF_RULE":
      return { ...state, pfRule: action.value };
    case "RESET_F":
      // v6.10.0: 디폴트 복귀 = INIT_F (B × 10%, HCC 비례). pfRule도 디폴트 복귀.
      return { ...state, F_g: [...INIT_F], pfRule: INIT_PF_RULE };
    case "RESET_P":
      return { ...state, P: [...INIT_P] };
    // v6.7: L1·L2·α 액션
    case "SET_L1_AT": {
      const L1 = [...state.L1];
      L1[action.i] = Math.max(0, Math.min(1, action.value));
      return { ...state, L1 };
    }
    case "SET_L1_ALL":
      return { ...state, L1: action.values.map(v => Math.max(0, Math.min(1, v))) };
    case "RESET_L1": {
      // v6.9.5: 현재 데이터의 실측 base.L로 복귀 (data anchor 패턴 일관성).
      //   파일럿 로드 후 = 파일럿 실측 [0.7975, 0.7934, 0.7943, 0.7722]
      //   엑셀 업로드 후 = 그 데이터의 실측 L
      //   사용자가 N/M1/L을 인라인 편집한 경우엔 편집된 base.L 반영.
      const fromBase = state.base.map(b => (typeof b?.L === "number" ? b.L : 0.7));
      return { ...state, L1: fromBase };
    }
    case "SET_L2":
      return { ...state, L2: action.value == null ? null : Math.max(0, Math.min(1, action.value)) };
    case "RESET_L2":
      return { ...state, L2: null };
    case "RESET_REG": {
      // v7.1.1: 초기화는 "1차년도 시범사업 scope"로 복귀 (100개 의원 × 의원당 4,379명).
      //   datasetM·datasetTotalN(2,923 anchor)이 아닌 v1 디폴트(INIT_DEFAULT_M=100)로 reset.
      //   data anchor 전체로 가려면 "일만시 전체 등록 모드" 버튼을 사용.
      //   의원당 환자수는 데이터 anchor에서 산출 (현재 base.N 합 / datasetM ≈ 4,379).
      const baseSum = state.base.reduce((s, g) => s + (g?.N || 0), 0);
      const anchorM = Math.max(1, state.datasetM || INIT_M_CLINICS);
      const perClinicAnchor = baseSum > 0 ? Math.max(1, Math.round(baseSum / anchorM)) : INIT_PER_CLINIC;
      const newM = INIT_DEFAULT_M;
      const newTotalN = Math.max(1, perClinicAnchor * newM);
      return {
        ...state,
        baseN_per_clinic: perClinicAnchor,
        M_clinics: newM,
        totalN: newTotalN,
        regDist: [...INIT_REG_DIST],
        baseRatios: null,   // v7.5.8: 분포비(기준=등록) 실측 복귀
        dataLabel: state.datasetLabel || INIT_DATA_LABEL,
      };
    }
    // v7.1.5: LOAD_FULL_REG 액션 폐기 (일만시 모드 버튼 → 초기화 버튼으로 교체).
    //   초기화는 RESET_REG로 처리 (M=100 시범사업 디폴트 복귀).
    case "RESET_PT_PCT":
      return { ...state, ptPctA: INIT_PT_PCT_A, ptPctB: INIT_PT_PCT_B, ptPctC: INIT_PT_PCT_C };
    case "RESET_SS_PCT":
      return { ...state, ssPctA: INIT_SS_PCT_A, ssPctB: INIT_SS_PCT_B, ssPctC: INIT_SS_PCT_C };
    case "RESET_SS_COST":
      return { ...state, ssCostBase: INIT_SS_COST_BASE, ssProjectCost: INIT_SS_PROJECT_COST };
    // v7.5.3: regDist는 0.1명 단위 (등록 분포비 % 소수 2자리와 1:1 대응). roundRegDist 공용.
    case "SET_REGDIST_AT": {
      const regDist = [...state.regDist];
      regDist[action.i] = roundRegDist(action.value);
      return { ...state, regDist };
    }
    case "SET_REGDIST_ALL": {
      // v7.5.8: 등록 분포비 = 기준 분포비 — 의원 모드 CLINIC_PRESETS 등 regDist 일괄 설정 시
      //   기준 분포비(baseRatios)도 같은 비율로 동기화. 실측 비율과 같으면 override 없음(null).
      const regDist = action.values.map(roundRegDist);
      const sum = regDist.reduce((s, v) => s + v, 0);
      const measured = refRatiosFromBase(state.base);
      const ratios = sum > 0 ? regDist.map(v => v / sum) : measured;
      const isMeasured = ratios.every((r, i) => Math.abs(r - measured[i]) < 0.0005);
      return { ...state, regDist, baseRatios: isMeasured ? null : ratios };
    }
    case "SCALE_REGDIST": {
      // 총합을 newTotal로 맞추되 비율 유지
      const sum = state.regDist.reduce((s, v) => s + v, 0);
      if (sum <= 0) {
        const even = roundRegDist(action.newTotal / 4);
        return { ...state, regDist: [even, even, even, even] };
      }
      const scale = action.newTotal / sum;
      const scaled = state.regDist.map(v => roundRegDist(v * scale));
      return { ...state, regDist: scaled };
    }
    case "LOAD_DATA": {
      const newTotalN = action.base.reduce((s, g) => s + g.N, 0);
      const newM = action.M_clinics ?? state.M_clinics;
      const perClinic = Math.max(1, Math.round(newTotalN / Math.max(1, newM)));
      // v7.7.0: 엑셀 업로드(preserveScale)는 현재 사업 규모(M × 의원당 환자수 = totalN)와 참여 전 기준선을 유지.
      //   테이블 RN 편집과 동일 규칙 — RN은 환자군 배분 비율(ratios)에만 반영. 프리셋/공식 baseline 로드는 종전대로 ΣN으로 재설정.
      const keepScale = action.preserveScale === true;
      // v6.9.4: 데이터 anchor 갱신.
      //   action.M_clinics가 있으면 (프리셋 로드 / 공식 baseline) → datasetM 함께 갱신.
      //   없으면 (엑셀 업로드 등) → datasetM은 그대로, datasetTotalN/datasetLabel만 갱신.
      const newDatasetM = action.M_clinics ?? state.datasetM ?? INIT_M_CLINICS;
      // v6.9.5: L1을 새 데이터의 실측 L로 자동 동기화 (옵션 A · 사용자 결정).
      //   L1은 협상 변수가 아니라 "과거 평균 타원이용비중" 데이터 실측 그 자체.
      //   사용자가 임의 조정한 L1은 새 데이터 LOAD 시 덮어써짐.
      const newL1 = action.base.map(b => (typeof b?.L === "number" ? b.L : 0.7));
      // v7.2.0: action.regDist (엑셀 RR 컬럼)가 4군 모두 양수면 자동 주입.
      // v7.5.8: 등록 분포비 = 기준 분포비 — RR이 있으면 기준 분포비도 RR 비율로 override,
      //   없으면 새 데이터의 실측 비율(RN_i/ΣRN)로 regDist 재산출 (등록 총량은 현재 Σ regDist 유지).
      const hasRR = Array.isArray(action.regDist) && action.regDist.length === 4 && action.regDist.every(v => v > 0);
      const rrSum = hasRR ? action.regDist.reduce((s, v) => s + v, 0) : 0;
      const newRegDist = hasRR
        ? action.regDist.map(roundRegDist)
        : regDistFromRatios(refRatiosFromBase(action.base), regBaseOf(state));
      const newBaseRatios = hasRR && rrSum > 0 ? action.regDist.map(v => v / rrSum) : null;
      return {
        ...state,
        base: action.base,
        P: action.P,
        F_g: action.F_g ?? state.F_g,
        copayRates: action.copayRates ?? state.copayRates,   // v7.7.0: 엑셀 본인부담비 열
        L1: newL1,
        regDist: newRegDist,
        baseRatios: newBaseRatios,
        totalN: keepScale ? state.totalN : newTotalN,
        dataLabel: action.dataLabel,
        uploadBanner: action.uploadBanner,
        M_clinics: newM,
        // 프리셋 로드 시 참여 전 기준 실인원을 해당 프리셋 의원당 실인원으로 자동 설정 (엑셀 업로드는 유지)
        baseN_per_clinic: keepScale ? state.baseN_per_clinic : perClinic,
        // v6.9.4: 초기화 버튼이 복귀할 anchor 갱신
        datasetM: newDatasetM,
        datasetTotalN: newTotalN,
        datasetLabel: action.dataLabel ?? state.datasetLabel ?? INIT_DATA_LABEL,
      };
    }
    case "MACRO_SYNC": {
      const { newPct } = action;
      // v6.5.4: 항목별 절감은 항상 건보 기준 원자료(조원 ×1e12)로 역산.
      // macro %는 기준 독립 (사업대상 기준일 때도 같은 % — projectScale이 상쇄되기 때문)
      const totalMedCost = state.ssTotalCost * 1e12;
      const targetSaving = totalMedCost * (newPct / 100);
      const pool = state.ssAcute + state.ssEmergency + state.ssLtc;
      if (pool <= 0) return { ...state, ssMacroPct: newPct };
      const distribute = (base) => {
        const share = base / pool;
        const itemSaving = targetSaving * share;
        const baseCost = base * 1e12;
        return Math.min(30, Math.max(0, (itemSaving / baseCost) * 100));
      };
      return {
        ...state,
        ssMacroPct: newPct,
        ssAcutePct: parseFloat(distribute(state.ssAcute).toFixed(2)),
        ssEmergencyPct: parseFloat(distribute(state.ssEmergency).toFixed(2)),
        ssLtcPct: parseFloat(distribute(state.ssLtc).toFixed(2)),
      };
    }
    case "RESET":
      return {
        ...initialState,
        tab: state.tab,
      };
    default:
      return state;
  }
}

// v7.7.0: 정규화(개행·공백 제거) 후 정확 일치만 — 단문자 헤더(F·NT·C1·PF)가 PF·N·P 등과 부분일치로 뒤섞이지 않도록.
function findColExact(row, aliases, fb) {
  const norm = k => String(k).replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
  const wanted = aliases.map(norm);
  for (const key of Object.keys(row)) {
    if (wanted.includes(norm(key))) {
      const v = row[key];
      if (v !== undefined && v !== null && v !== "") return Number(v);
    }
  }
  return fb;
}

function findCol(row, aliases, fb) {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== null && v !== "") return Number(v);
  }
  for (const key of Object.keys(row)) {
    const nk = key.replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
    for (const a of aliases) {
      const na = a.replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
      if (nk.includes(na) || na.includes(nk)) {
        const v = row[key];
        if (v !== undefined && v !== null && v !== "") return Number(v);
      }
    }
  }
  return fb;
}

export default function useSimulator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileRef = useRef(null);

  const {
    base, P, L1, L2, totalN, hccPct,
    ssTotalCost, ssAcute, ssEmergency, ssLtc,
    ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare,
    ssCostBase, ssProjectCost,
    F_g, M_clinics, regDist, baseN_per_clinic,
    baseRatios, copayRates,
  } = state;

  const ffsPct = 100 - hccPct;

  // 참여의원 환자 분포 (RN 기준) — N_g = totalN × ratios[i], baseN_g, ffsPerPerson 가중치.
  // v7.5.4/v7.5.5: 기준 분포비의 수기 override(state.baseRatios)는 여기에 연결하지 않는다.
  //   기준 분포비(RN 기준)는 등록 분포비 디폴트("데이터 비례")와 표시용. 참여의원 환자 구성은 RN 실측 그대로.
  const ratios = useMemo(() => {
    const t = base.reduce((s, g) => s + g.N, 0);
    return base.map(g => g.N / t);
  }, [base]);

  // v2.7: 등록환자 분포 (의원당 환자군별 절대 등록수 regDist에서 직접 산출)
  const regRatios = useMemo(() => {
    const sum = regDist.reduce((s, v) => s + v, 0);
    return sum > 0 ? regDist.map(v => v / sum) : ratios;
  }, [regDist, ratios]);

  // 등록/비등록 환자 수 산출 (의원당 등록 n_reg_pc = sum(regDist))
  const reg = useMemo(() => {
    const M = Math.max(1, M_clinics);
    const n_total_per_clinic = totalN / M;
    const n_reg_requested = regDist.reduce((s, v) => s + v, 0);
    const n_reg_pc = Math.min(n_reg_requested, n_total_per_clinic);
    const n_reg_total_raw = M * n_reg_pc;
    const n_reg_total = Math.min(n_reg_total_raw, totalN);
    const n_unreg_total = Math.max(0, totalN - n_reg_total);
    const regRate = totalN > 0 ? n_reg_total / totalN : 0;
    return { M, n_total_per_clinic, n_reg_pc, n_reg_requested, n_reg_total, n_unreg_total, regRate };
  }, [M_clinics, totalN, regDist]);

  // v6.7: L1 가중평균 (N 기반) — L2 디폴트 · 성과급 "0 기준점" 시각화용.
  // G보다 먼저 계산해서 L2eff를 G 안에서 사용 (등록환자 타원 외래비 L2 반영).
  const L1avg = useMemo(() => {
    const t = base.reduce((s, g) => s + g.N, 0);
    if (t <= 0) return 0.7;
    return base.reduce((s, g, i) => s + (L1[i] ?? 0.7) * g.N, 0) / t;
  }, [base, L1]);
  const L2eff = L2 ?? L1avg;
  // v7.6.8 (사용자 결정): L2를 스칼라 평균 하나로 전 군에 적용하던 것을 군별 L2_g = L1_g − Δ로 변경.
  //   Δ = L1avg − L2eff (C 슬라이더의 ΔC). Δ = 0이면 모든 군에서 참여 전·후 타원비가 같고 성과도 0 (진짜 무변화 기준점).
  //   state.L2(평균 수준 목표값)·setL2·UI 표시는 그대로 두고, 엔진 안에서만 군별로 환산한다.
  const dL2 = L1avg - L2eff;
  const L2_g = useMemo(() => L1.map(l => Math.max(0, Math.min(0.999, (l ?? 0.7) - dL2))), [L1, dL2]);

  // v6.7: L1 환자군별 배열에서 P_g 산출. LC(변화율) 제거.
  // 의원 선지급 = P_g = B(1−L1_g) + F_g, 공단지급 = P_g (단일화).
  // 공단 외래 지출은 등록환자 타원비를 L2 기반으로 반영 (L2 슬라이더 연동).
  const G = useMemo(() => {
    return base.map((b, i) => {
      const safeL2 = L2_g[i];                            // v7.6.8: 군별 L2_g = L1_g − Δ
      const N = Math.round(totalN * ratios[i]);
      const p = P[i];                                    // B value (state.P = B 기호 유지)
      const L1_g = L1[i] ?? 0.7;
      const F_i = F_g[i] ?? 0;
      // v7.6.0 (사용자 결정): 현행 1인당 외래비 M1을 더 이상 사용하지 않고 PB(= B × (1−L1))로 대체.
      //   baseline FFS·비등록 FFS·공단 외래비·Track A 모두 PB 기준. base.M1은 데이터 필드로만 보존.
      // v7.6.1 (사용자 결정): 참여 후 수입·공단 지출에 더해지던 본인부담 항(M1×0.3 → PB×본인부담비)은 잘못 추가된 값 → 완전 제거.
      //   등록환자 1인당 의원수입 = 공단지급 P = PB + PF (본인부담 없음).
      const PB_g = p * (1 - L1_g);                       // 일차의료 기본수가 (M1 대체)
      const pay_gov = PB_g + F_i;                        // 공단지급 = P_g
      const ab_reg = pay_gov;                            // 등록환자 1인당 의원수입 = P (본인부담 항 제거)
      // v7.6.3/v7.6.5 본인부담비 (상세 편집 테이블 · 디폴트 26.1%)
      const copay_i = Math.max(0, Math.min(1, copayRates?.[i] ?? INIT_COPAY_RATES[i]));
      // v7.6.5 (사용자 결정): 참여 후 공단 지출의 등록환자 항에서 PB에만 (1 − 본인부담비)를 곱하고 PF는 전액 공단 부담.
      //   의원 수입(ab_reg = PB + PF)은 불변 — 차액(PB × 본인부담비)은 환자 본인부담. D1_L2·비등록 C1 항은 그대로.
      const nhi_reg = PB_g * (1 - copay_i) + F_i;         // 등록환자 1인당 공단 부담분

      // 외래비 상수 (PB 기준)
      const C1 = PB_g / (1 - b.L);                       // 기존 L 기반 총 외래비 (비등록·baseline)
      const D1_base = C1 - PB_g;                         // 비등록환자 타원 외래비 (기존 L)
      const D1_L2 = PB_g * safeL2 / (1 - safeL2);        // 등록환자 타원 외래비 (L2 반영 · L2 슬라이더 연동)

      // 등록/비등록 (등록 ⊆ 이용 clamp)
      const n_reg_g_raw = reg.n_reg_total * regRatios[i];
      const n_reg_g = Math.min(n_reg_g_raw, N);
      const n_unreg_g = Math.max(0, N - n_reg_g);

      // 의원 수입 (선지급만 · 성과급은 T 레벨에서 합산)
      const inc0 = PB_g * N;                              // baseline: 전원 FFS (PB 기준)
      const inc = ab_reg * n_reg_g + PB_g * n_unreg_g;    // 참여 후 선지급 수입

      // 공단 의원급 외래 지출 — 등록환자는 L2 기반 타원비, 비등록은 기존 L 유지
      // v7.6.3 (사용자 결정): 참여 전 공단 지출 = 총 외래비 × (1 − 본인부담비). 참여 전(FFS)에는 본인부담이 있으므로
      //   공단 부담분만 baseline으로 잡는다.
      const nhi0 = C1 * N * (1 - copay_i);                // baseline (공단 부담분)
      // v7.6.6 (사용자 결정): 참여 후 공단 지출에서 타원 외래비 D1_L2·비등록 C1에도 (1 − 본인부담비) 적용 (FFS 공단 부담분).
      //   PF만 전액 공단 부담. 의원 수입(inc)은 불변.
      const nhi = (nhi_reg + D1_L2 * (1 - copay_i)) * n_reg_g + C1 * (1 - copay_i) * n_unreg_g;

      // Track (1인당 등록환자 실지불액 · 선지급만, 성과급은 T 레벨)
      const tA = PB_g + F_i;
      const tC = ab_reg;
      const tB = 0.5 * tA + 0.5 * tC;
      const tS = tA * (ffsPct / 100) + tC * (hccPct / 100);

      return {
        N, p, b, L1_g, PB: PB_g,
        pay_gov, ab_reg, nhi_reg, copay: copay_i,
        F_per_pt: F_i,
        n_reg: n_reg_g, n_unreg: n_unreg_g,
        inc0, inc, nhi0, nhi,
        tA, tB, tC, tS,
      };
    });
  }, [base, P, L1, L2_g, totalN, hccPct, ffsPct, ratios, regRatios, reg, F_g, copayRates]);

  const T = useMemo(() => {
    const s = { inc0: 0, inc: 0, nhi0: 0, nhi: 0, tA: 0, tB: 0, tC: 0, tS: 0 };
    G.forEach(r => {
      s.inc0 += r.inc0; s.inc += r.inc;
      s.nhi0 += r.nhi0; s.nhi += r.nhi;
      const unregFFS = r.PB * r.n_unreg;                 // v7.6.0: 비등록 FFS = PB 기준
      s.tA += r.tA * r.n_reg + unregFFS;
      s.tB += r.tB * r.n_reg + unregFFS;
      s.tC += r.tC * r.n_reg + unregFFS;
      s.tS += r.tS * r.n_reg + unregFFS;
    });
    return s;
  }, [G]);

  // v6.7: 성과급 메모 — no-downside 비대칭, 의원 100% 환원 (공유율 α 없음, SS와 상이)
  // Track 배수(A=0/B=0.5/C=1.0) 선형 보간 (hccPct/100)
  const performance = useMemo(() => {
    let perf_raw_total = 0;
    G.forEach((r, i) => {
      const diff = Math.max(0, (L1[i] ?? 0.7) - L2_g[i]);   // v7.6.8: 군별 L2_g → 모든 군에서 diff = Δ (clamp 전)
      perf_raw_total += diff * r.p * r.n_reg;
    });
    const perf_total = perf_raw_total;                    // Track C 최대치 = 전체 절감액 100% 환원
    const perfByTrack = {
      A: 0,
      B: perf_total * 0.5,
      C: perf_total * 1.0,
    };
    const trackMul = Math.max(0, Math.min(1, hccPct / 100));   // hccPct 0→A, 50→B, 100→C
    const perf_blended = perf_total * trackMul;
    // v7.6.7: 성과급은 공단→의원 직접 지급(진료비 청구 아님)이라 환자 본인부담이 없음.
    //   v7.6.6에서 곱했던 (1 − 본인부담비)를 성과 항목에서만 되돌려 공단 지출 = 의원 수령액(perf_blended)으로 정합.
    const perf_nhi = perf_blended;
    return {
      L2eff, L1avg, dL2, L2_g,
      perf_raw_total, perf_total, perfByTrack,
      trackMul, perf_blended, perf_nhi,
    };
  }, [G, L1, L2eff, L1avg, dL2, L2_g, hccPct]);

  // v6.7: KPI 변화율 — L2 연동
  //   의원 수입  = 선지급 inc + 성과급 perf_blended
  //   공단 지출 = L2 반영 nhi + 성과급 지급 perf_nhi (= perf_blended, v7.6.7: 성과에는 본인부담비 없음)
  const incTotal = T.inc + performance.perf_blended;
  const nhiTotal = T.nhi + performance.perf_nhi;
  const incChg = T.inc0 > 0 ? (incTotal - T.inc0) / T.inc0 : 0;
  const nhiChg = T.nhi0 > 0 ? (nhiTotal - T.nhi0) / T.nhi0 : 0;
  // 하위 호환 alias (v6.6까지 쓰던 이름 — 추후 제거 가능)
  const incCurChg = incChg;
  const incNewChg = incChg;
  const nhiNewChg = nhiChg;

  // v6.7 패널 분해 (L2 반응):
  //   baselineIncome = baseN × ffsPerPerson × M       (참여 전 전원 FFS)
  //   panelEffect    = Σ PB × (N_after − baseN)       (패널 변화 · FFS 유지)   ※ v7.6.0: M1 → PB
  //   modelEffect    = Σ n_reg × (ab_reg − PB)        (지불방식 전환 · 선지급 = PF, v7.6.1 본인부담 항 제거)
  //   performanceEffect = perf_blended                 (L2 성과급 · Track 배수 반영)
  //   afterIncome = 선지급 + 성과급 (의원 수입 KPI)
  const decomp = useMemo(() => {
    const M = Math.max(1, M_clinics);
    const baseN_total = Math.max(0, baseN_per_clinic) * M;
    const ffsPerPerson = G.reduce((s, r, i) => s + r.PB * ratios[i], 0);
    const baselineIncome = baseN_total * ffsPerPerson;
    const baseN_g = base.map((_, i) => baseN_total * ratios[i]);
    const panelEffect = G.reduce((s, r, i) => s + r.PB * (r.N - baseN_g[i]), 0);
    const modelEffect = G.reduce((s, r) => s + r.n_reg * (r.ab_reg - r.PB), 0);
    const performanceEffect = performance.perf_blended;
    const afterIncome = T.inc + performanceEffect;
    const netChange = afterIncome - baselineIncome;
    return {
      M, baseN_total, ffsPerPerson, baselineIncome,
      panelEffect, modelEffect, performanceEffect,
      netChange, afterIncome, incPre: T.inc,
      netChgPct: baselineIncome > 0 ? netChange / baselineIncome : 0,
    };
  }, [base, ratios, G, T.inc, performance.perf_blended, M_clinics, baseN_per_clinic]);
  // Track 변화율 기준 = 순수 FFS (inc0, 사업 미시행·R=0 기준선).
  // Track A에서도 R>0이면 양(+) 변화가 나와야 한다는 노션 Q6 정합.
  const tAchg = T.inc0 > 0 ? (T.tA - T.inc0) / T.inc0 : 0;
  const tBchg = T.inc0 > 0 ? (T.tB - T.inc0) / T.inc0 : 0;
  const tCchg = T.inc0 > 0 ? (T.tC - T.inc0) / T.inc0 : 0;
  const tSchg = T.inc0 > 0 ? (T.tS - T.inc0) / T.inc0 : 0;

  const SS = useMemo(() => {
    // v6.5.3: 분모 — "total"=건강보험 전체(조원, ×1e12) / "project"=사업대상 환자 의료비(억원, ×1e8)
    // v6.5.4: 사업대상 기준일 때 절감액을 사업대상 비율로 축소 (참여의원 재원이 사업대상 의료비와 연동)
    const costBaseTotal = ssTotalCost * 1e12;
    const costBaseProject = ssProjectCost * 1e8;
    const totalMedCost = ssCostBase === "project" ? costBaseProject : costBaseTotal;
    const costBaseValue = ssCostBase === "project" ? ssProjectCost : ssTotalCost;
    // 원시 절감액 (건강보험 전체 기준 · 항목별 입력 합)
    const acuteSaving_raw = ssAcute * 1e12 * (ssAcutePct / 100);
    const emergencySaving_raw = ssEmergency * 1e12 * (ssEmergencyPct / 100);
    const ltcSaving_raw = ssLtc * 1e12 * (ssLtcPct / 100);
    const rawItemTotal = acuteSaving_raw + emergencySaving_raw + ltcSaving_raw;
    // 사업대상 기준 선택 시: 건보→사업대상 비례로 절감액 축소 (e.g. 8,030억 × 1,000/110,800 = 72억)
    const projectScale = (ssCostBase === "project" && costBaseTotal > 0)
      ? costBaseProject / costBaseTotal
      : 1;
    const acuteSaving = acuteSaving_raw * projectScale;
    const emergencySaving = emergencySaving_raw * projectScale;
    const ltcSaving = ltcSaving_raw * projectScale;
    const itemTotal = rawItemTotal * projectScale;
    // macro %는 기준 독립 (raw/total = scaled/project, 동일값)
    const derivedMacroPct = totalMedCost > 0 ? (itemTotal / totalMedCost) * 100 : 0;
    const clinicPct = ssClinicShare / 100;
    const nhisPct = 1 - clinicPct;
    return {
      acuteSaving, emergencySaving, ltcSaving, itemTotal,
      totalMedCost, derivedMacroPct,
      clinicFromItem: itemTotal * clinicPct,
      nhisFromItem: itemTotal * nhisPct,
      clinicPct, nhisPct,
      costBaseValue,
    };
  }, [ssTotalCost, ssProjectCost, ssCostBase, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare]);

  // v6.11.0: Shared Saving은 Track 가산에서 분리 (시범사업 검증 후 도입 검토).
  // v7.0: 각 Track에 netChange 추가 (= ongoing − baselinePerClinic) — 수가 시뮬 KPI(perClinicNet)와 정확히 일치.
  //   기존엔 perClinicBase = T.inc0/M (totalN 기반) 사용해 baseN_per_clinic 기반 KPI와 미세 차이 발생.
  // 각 항목: income(선지급) · ptAmt(1년차 PT) · ssAmt(SS 탭 시연용) · perfAmt(매년 포괄관리성과) · firstYear · ongoing · netChange
  const tracks = useMemo(() => {
    const M = Math.max(1, M_clinics);
    const ssPerClinicFull = (SS?.clinicFromItem ?? 0) / M;
    const perfPerClinicFull = (performance?.perf_total ?? 0) / M;
    const baselinePerClinic = (decomp?.baselineIncome ?? 0) / M;
    const list = [
      { n: "Track A", d: "FFS 100%",   hc: 0,   c: "#22c55e", bg: "#f0fdf4", bd: "#86efac",
        income: T.tA / M, chg: tAchg, ptPct: state.ptPctA, ssPct: state.ssPctA, perfMul: 0 },
      { n: "Track B", d: "혼합 50:50",  hc: 50,  c: "#3b82f6", bg: "#eff6ff", bd: "#93c5fd",
        income: T.tB / M, chg: tBchg, ptPct: state.ptPctB, ssPct: state.ssPctB, perfMul: 0.5 },
      { n: "Track C", d: "환자군 100%", hc: 100, c: "#f97316", bg: "#fff7ed", bd: "#fdba74",
        income: T.tC / M, chg: tCchg, ptPct: state.ptPctC, ssPct: state.ssPctC, perfMul: 1.0 },
    ];
    return list.map(t => {
      const ptAmt = state.pt_base * t.ptPct / 100;
      const ssAmt = ssPerClinicFull * t.ssPct / 100;     // SS 탭 시연용 (Track 가산 합산에서 제외)
      const perfAmt = perfPerClinicFull * t.perfMul;
      const ongoing = t.income + perfAmt;                  // v6.11.0: ssAmt 제외
      return {
        ...t, ptAmt, ssAmt, perfAmt,
        firstYear: t.income + ptAmt,
        ongoing,
        netChange: ongoing - baselinePerClinic,            // v7.0: 수가 시뮬 KPI와 일치
      };
    });
  }, [M_clinics, T.tA, T.tB, T.tC, tAchg, tBchg, tCchg,
      state.ptPctA, state.ptPctB, state.ptPctC,
      state.ssPctA, state.ssPctB, state.ssPctC,
      state.pt_base, SS.clinicFromItem, performance.perf_total,
      decomp.baselineIncome]);

  const set = useCallback((key, value) => dispatch({ type: "SET", key, value }), []);
  const updP = useCallback((i, value) => dispatch({ type: "SET_P", i, value }), []);
  const updBase = useCallback((i, key, value) => dispatch({ type: "SET_BASE", i, key, value }), []);
  // v7.5.2: 상세 편집 테이블 — 기준 분포비(ratio_i) 수기 편집 (v7.6.1: 본인부담비 편집 제거)
  const updBaseRatio = useCallback((i, ratio) => dispatch({ type: "SET_BASE_RATIO_AT", i, ratio }), []);
  const resetBaseRatios = useCallback(() => dispatch({ type: "RESET_BASE_RATIOS" }), []);
  const setDistAll = useCallback((ratios) => dispatch({ type: "SET_DIST_ALL", ratios }), []);
  const updCopay = useCallback((i, value) => dispatch({ type: "SET_COPAY_AT", i, value }), []);   // v7.6.2 참고값
  const updF = useCallback((i, value) => dispatch({ type: "SET_F_AT", i, value }), []);
  const setFAll = useCallback((values) => dispatch({ type: "SET_F_ALL", values }), []);
  const setPfRule = useCallback((value) => dispatch({ type: "SET_PF_RULE", value }), []);
  const resetF = useCallback(() => dispatch({ type: "RESET_F" }), []);
  const resetP = useCallback(() => dispatch({ type: "RESET_P" }), []);
  // v6.7: L1·L2 setters / resetters (LC·α 제거)
  const updL1 = useCallback((i, value) => dispatch({ type: "SET_L1_AT", i, value }), []);
  const setL1All = useCallback((values) => dispatch({ type: "SET_L1_ALL", values }), []);
  const resetL1 = useCallback(() => dispatch({ type: "RESET_L1" }), []);
  const setL2 = useCallback((value) => dispatch({ type: "SET_L2", value }), []);
  const resetL2 = useCallback(() => dispatch({ type: "RESET_L2" }), []);
  const resetReg = useCallback(() => dispatch({ type: "RESET_REG" }), []);
  const resetPtPct = useCallback(() => dispatch({ type: "RESET_PT_PCT" }), []);
  const resetSsPct = useCallback(() => dispatch({ type: "RESET_SS_PCT" }), []);
  const resetSsCost = useCallback(() => dispatch({ type: "RESET_SS_COST" }), []);
  const updRegDist = useCallback((i, value) => dispatch({ type: "SET_REGDIST_AT", i, value }), []);
  const setRegDistAll = useCallback((values) => dispatch({ type: "SET_REGDIST_ALL", values }), []);
  const scaleRegDist = useCallback((newTotal) => dispatch({ type: "SCALE_REGDIST", newTotal }), []);
  const handleMacroSync = useCallback((newPct) => dispatch({ type: "MACRO_SYNC", newPct }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      let sheetName = wb.SheetNames[0];
      // v7.5: 시트명 우선순위 — 시뮬레이터 업로드용 → 핵심표(NHIS-HCC v3.0 엑셀) → 첫 시트.
      const simIdx = wb.SheetNames.findIndex(n => n.includes("시뮬레이터"));
      if (simIdx >= 0) sheetName = wb.SheetNames[simIdx];
      else {
        const coreIdx = wb.SheetNames.findIndex(n => n.includes("핵심표") || n.includes("핵심 표"));
        if (coreIdx >= 0) sheetName = wb.SheetNames[coreIdx];
      }
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length < 4) {
        set("uploadBanner", { success: false, msg: "데이터 부족: 4개 환자군 행이 필요합니다.", details: `시트 "${sheetName}"에서 ${data.length}행만 발견` });
        return;
      }
      // v6.6 / v7.2.0: N·M1·L·HCC·CR + RR·RO 7 필드 인식.
      //   - base 갱신: N·M1·L
      //   - M1 fallback: M1 컬럼 누락 시 RO ÷ N 자동 산출 (NHIS-HCC v3.0 엑셀 호환).
      //   - HCC(=환자군 평균 의료비 A) × CR → B_suggested 자동 유도 (슬라이더 초기값, clamp [5만, 200만])
      //     ※ v3.0(2025)부터 입력 A는 'HCC 4분위 평균'이 아닌 환자군의 실제 평균 의료비.
      //       시뮬레이터 로직은 동일 (B = A × CR), 명칭만 'HCC 평균' → '환자군 평균 의료비 A'.
      //   - A 또는 CR이 0/누락이면 해당 군의 B는 기존 slider값(state.P[i]) 유지
      //   - RR (참여의원당 등록환자수) → state.regDist 자동 주입 (4군 모두 양수일 때).
      //   - F(state.F_g) 정책 슬라이더는 보존 — 엑셀 비반영 일관성 유지
      // v7.7.0: 상세 편집 테이블 수기 입력 열 라운드트립 — NT · RN(N) · A · CR · C1(→ L = 1 − C1) · F(%) 또는 PF(원) · 본인부담비(%).
      //   내보내기(handleExport)가 같은 헤더로 쓰므로 내보낸 파일을 그대로 올리면 테이블이 동일하게 복원된다.
      const prevBase = state.base;
      // v7.7.1: 내보내기 열 = A · CR · C1 · F · NT · RN · 본인부담비 (수기 입력 + 계산 사용 열만). 아래 N/M1/L/RR/RO 인식은 구 템플릿·NHIS 엑셀 호환용.
      const rows = data.slice(0, 4).map((row, i) => {
        let N = findCol(row, COL_ALIASES.N, 0);
        let M1 = findCol(row, COL_ALIASES.M1, 0);
        let L = findCol(row, COL_ALIASES.L, 0);
        const HCC = findCol(row, COL_ALIASES.HCC, 0);
        let CR = findCol(row, COL_ALIASES.CR, 0);
        const RR = findCol(row, COL_ALIASES.RR, 0);
        const RO = findCol(row, COL_ALIASES.RO, 0);
        const NT = findColExact(row, COL_ALIASES.NT, 0);
        let C1 = findColExact(row, COL_ALIASES.C1, NaN);
        // v7.7.2: F(%)·PF(원) 열은 더 이상 읽지 않음 — PF는 상단 PF 슬라이더로만 조정, 업로드 시 현재 F_g 보존.
        let copay = findColExact(row, COL_ALIASES.COPAY, NaN);
        if (L > 1) L = L / 100;
        if (L < 0 || L > 1) L = INIT_BASE[i].L;
        // C1(등록의원 외래 비중)이 있으면 L = 1 − C1 우선 (테이블 편집 규칙: C1 → L1·base.L 동시 갱신)
        if (isFinite(C1)) { if (C1 > 1) C1 = C1 / 100; if (C1 >= 0 && C1 <= 1) L = 1 - C1; }
        if (CR > 1) CR = CR / 100;   // 퍼센트 입력 방어
        if (CR < 0 || CR > 1) CR = 0;
        if (isFinite(copay)) { if (copay > 1) copay = copay / 100; if (copay < 0 || copay > 1) copay = NaN; }
        // M1 fallback: M1 누락 시 RO ÷ N (= R1 = RO/RN, NHIS-HCC v3.0 정의)
        if (!M1 && RO > 0 && N > 0) M1 = Math.round(RO / N);
        return {
          N: Math.round(N) || INIT_BASE[i].N,
          M1: M1 || prevBase?.[i]?.M1 || INIT_BASE[i].M1,   // v7.7.1: 엑셀에 M1 없으면 현재 값 보존 (계산 미사용 데이터 필드)
          L: L || INIT_BASE[i].L,
          HCC,
          CR,
          RR: RR > 0 ? RR : 0,          // v7.7.0: 0.1명 단위 보존 (reducer의 roundRegDist가 정리)
          NT: Math.round(NT) || 0,
          copay,
        };
      });
      // base: N·M1·L + reference 필드 A·CR·NT (엑셀에 없으면 이전 값 보존 → 테이블 A·CR 표시 유지)
      const newBase = rows.map((r, i) => {
        const b = { N: r.N, M1: r.M1, L: r.L };
        const A = r.HCC > 0 ? r.HCC : prevBase?.[i]?.A;
        const CRv = r.CR > 0 ? r.CR : prevBase?.[i]?.CR;
        const NTv = r.NT > 0 ? r.NT : prevBase?.[i]?.NT;
        if (typeof A === "number") b.A = A;
        if (typeof CRv === "number") b.CR = CRv;
        if (typeof NTv === "number") b.NT = NTv;
        return b;
      });
      // B 자동 유도: 환자군 평균 의료비(A) × 의원급 외래비중(CR), [B_MIN, B_MAX] clamp.
      // 둘 중 하나라도 0이면 기존 slider값 유지.
      const derivedCount = rows.reduce((s, r) => s + ((r.HCC > 0 && r.CR > 0) ? 1 : 0), 0);
      const newB = rows.map((r, i) => {
        if (r.HCC > 0 && r.CR > 0) {
          const raw = Math.round(r.HCC * r.CR);
          return Math.max(B_MIN, Math.min(B_MAX, raw));
        }
        return state.P[i];
      });
      // v7.2.0: RR (참여의원당 등록환자수) 4군 모두 양수면 state.regDist 자동 주입.
      //   엑셀 NHIS-HCC v3.0 RR 컬럼 = RD × 1,000명 (NC 비례 배분).
      //   하나라도 0이면 기존 regDist 보존 (사용자 슬라이더 조정값 보호).
      const RR_arr = rows.map(r => r.RR);
      const hasRR = RR_arr.every(v => v > 0);
      const newRegDist = hasRR ? RR_arr : null;
      // v7.7.2: PF(state.F_g)는 엑셀 비반영 — PF 슬라이더로만 조정. 업로드로 B(A×CR)가 바뀌면 테이블 A·CR 편집(v7.5.9)과 같이
      //   기존 비율(F_g / B_old)을 새 B에 곱해 재산출 → "B 기준 X%" 위치 보존. B가 그대로면 F_g 그대로.
      const newF = state.F_g.map((f, i) => {
        const oldB = state.P[i];
        if (!(oldB > 0) || newB[i] === oldB) return f;
        return Math.max(0, Math.round((f / oldB) * newB[i]));
      });
      const hasCopay = rows.every(r => isFinite(r.copay));
      const newCopay = hasCopay ? rows.map(r => r.copay) : null;
      const label = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      const SHL = ["1군", "2군", "3군", "4군"];
      const fmt = v => Math.round(v).toLocaleString("ko-KR");
      const det = rows.map((r, i) => {
        const base = `${SHL[i]}: N=${fmt(r.N)}, M1=${fmt(r.M1)}, L=${r.L.toFixed(4)}`;
        const bDet = (r.HCC > 0 && r.CR > 0)
          ? `, A=${fmt(r.HCC)}, CR=${r.CR.toFixed(3)} → B=${fmt(newB[i])}`
          : `  (B 유지: ${fmt(newB[i])})`;
        const rrDet = hasRR ? `, RR=${fmt(r.RR)}` : "";
        const extra = [
          r.NT > 0 ? `NT=${fmt(r.NT)}` : null,
          hasCopay ? `본인부담비=${(r.copay * 100).toFixed(1)}%` : null,
        ].filter(Boolean);
        return base + bDet + rrDet + (extra.length ? `, ${extra.join(", ")}` : "");
      }).join("\n");
      const bMsg = derivedCount > 0
        ? `B 권장값 ${derivedCount}/4군 자동 유도 (A × CR)`
        : `B 슬라이더 보존 (A·CR 없음)`;
      const rrMsg = hasRR ? ` · RR 컬럼 → 의원당 등록환자수 자동 주입` : ``;
      const tblMsg = [hasCopay ? "본인부담비" : null, rows.some(r => r.NT > 0) ? "NT" : null].filter(Boolean);
      const tblMsgS = tblMsg.length ? ` · 테이블 열 반영: ${tblMsg.join("·")}` : "";
      const bannerMsg = `"${sheetName}" 시트에서 4군 데이터 로딩 완료 — ${bMsg}${rrMsg}${tblMsgS}`;
      dispatch({
        type: "LOAD_DATA",
        base: newBase,
        P: newB,
        F_g: newF,
        copayRates: newCopay,
        regDist: newRegDist,
        preserveScale: true,
        dataLabel: label,
        uploadBanner: { success: true, msg: bannerMsg, details: det },
      });
      // v6.7: 엑셀 L 값을 L1 seed로도 제안. 사용자가 L1 카드의 "엑셀 L 복사" 버튼으로 명시 반영.
      // (자동 반영하면 L1 정책값을 덮어쓸 수 있어 UX 위험 — 버튼 경유 유지.)
    } catch (err) {
      set("uploadBanner", { success: false, msg: "파일 읽기 실패: " + err.message, details: null });
    }
  }, [set, state.P, state.F_g, state.base]);

  const handleExport = useCallback(async () => {
    try {
      const SH = ["1군", "2군", "3군", "4군"];
      // v7.7.1 (사용자 결정): 수기 입력 가능 + 계산에 쓰이는 열만. v7.7.2: F 보정율은 테이블에서 표시 전용이 되어 엑셀에서도 제외
      //   (PF는 상단 PF 슬라이더로만 조정 · 엑셀 라운드트립 시 현재 PF 보존). 열 순서 A · CR · C1 · NT · RN · 본인부담비.
      //   산출 열(B·PB·PF·P·분포비)과 미사용/파생 필드(M1·L·RR)는 내보내지 않음.
      //   업로드 시 L = 1 − C1, 분포비·regDist = RN 비율로 재산출, M1·PF는 현재 값 보존.
      const headers = ["환자군", "A", "CR", "C1", "NT", "RN", "본인부담비"];
      const ws = {};
      const put = (r, c, cell) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };
      headers.forEach((h, c) => put(0, c, { t: "s", v: h }));
      const num = v => ({ t: "n", v });
      const blank = { t: "s", v: "" };

      base.forEach((b, idx) => {
        const r = idx + 1;
        const A = typeof b.A === "number" ? b.A : null;
        const CR = typeof b.CR === "number" ? b.CR : null;
        const Bv = (A > 0 && CR > 0) ? Math.round(A * CR) : P[idx];
        const C1 = 1 - (L1[idx] ?? b.L);
        const cp = copayRates?.[idx] ?? INIT_COPAY_RATES[idx];
        put(r, 0, { t: "s", v: SH[idx] });
        put(r, 1, A !== null ? num(A) : blank);
        put(r, 2, CR !== null ? num(Number(CR.toFixed(6))) : blank);
        put(r, 3, num(Number((C1 * 100).toFixed(4))));
        put(r, 4, typeof b.NT === "number" ? num(b.NT) : blank);
        put(r, 5, num(b.N));
        put(r, 6, num(Number((cp * 100).toFixed(4))));
      });

      // 합계 행 (r=5): NT·RN 합계
      const SR = 5;
      put(SR, 0, { t: "s", v: "합계" });
      put(SR, 4, { t: "n", f: "SUM(E2:E5)", v: base.reduce((s, b) => s + (typeof b.NT === "number" ? b.NT : 0), 0) });
      put(SR, 5, { t: "n", f: "SUM(F2:F5)", v: base.reduce((s, b) => s + b.N, 0) });

      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: SR, c: headers.length - 1 } });
      ws["!cols"] = [{ wch: 8 }, { wch: 11 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 11 }];

      const wb_new = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb_new, ws, "시뮬레이터_업로드");
      XLSX.writeFile(wb_new, `simulator_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("내보내기 실패: " + err.message);
    }
  }, [base, P, L1, copayRates]);

  // v6.6: 관리자 "공식 baseline으로 등록" — /api/commit-baseline로 POST.
  // 서버리스 함수가 GitHub API로 src/data/presets/official_baseline.json 갱신 → Vercel 재배포.
  // env.GITHUB_PAT 미설정 시 서버리스 함수가 친절한 에러 반환.
  const handleCommitBaseline = useCallback(async () => {
    try {
      set("uploadBanner", { success: true, msg: "공식 baseline 등록 요청 중...", details: "GitHub API 호출 중 (수 초)" });
      // v6.9.4: M_clinics·dataLabel도 함께 전송 → 모든 사용자의 anchor가 새 데이터로 갱신됨.
      //   예: 3,000개 의원 데이터 등록 시, 신규 사용자의 환자군 패널 초기화 버튼이 그 값으로 복귀.
      const res = await fetch("/api/commit-baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: state.base,
          P: state.P,
          M_clinics: state.M_clinics,
          dataLabel: state.dataLabel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        set("uploadBanner", {
          success: false,
          msg: `공식 baseline 등록 실패 (HTTP ${res.status})`,
          details: data?.error || data?.message || "서버 응답 확인 필요. Vercel 환경변수 GITHUB_PAT 설정 여부 점검.",
        });
        return;
      }
      set("uploadBanner", {
        success: true,
        msg: data?.message || "✅ 공식 baseline 갱신 완료",
        details: [
          data?.commit_sha ? `commit: ${String(data.commit_sha).slice(0, 7)}` : null,
          data?.commit_url ? `url: ${data.commit_url}` : null,
          "Vercel 재배포 완료 후 모든 사용자에게 새 디폴트 반영 (1~2분)",
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      set("uploadBanner", { success: false, msg: "요청 실패: " + err.message, details: "네트워크 또는 서버리스 함수 미배포 상태일 수 있음." });
    }
  }, [set, state.base, state.P]);

  const loadPreset = useCallback((preset) => {
    dispatch({
      type: "LOAD_DATA",
      base: preset.base,
      P: preset.P,
      dataLabel: preset.label,
      M_clinics: preset.M_clinics,
      uploadBanner: { success: true, msg: `${preset.label} 프리셋 로딩 완료`, details: null },
    });
  }, []);

  return {
    state, set, updP, updBase, updF, setFAll, setPfRule,
    updBaseRatio, resetBaseRatios, setDistAll, updCopay,
    resetF, resetP, resetReg,
    // v6.7 L1·L2 (α 제거)
    updL1, setL1All, resetL1,
    setL2, resetL2,
    resetPtPct, resetSsPct, resetSsCost,
    updRegDist, setRegDistAll, scaleRegDist,
    reset,
    handleMacroSync, handleFile, handleExport, loadPreset, handleCommitBaseline,
    fileRef,
    G, T, SS, decomp, performance, tracks,
    ffsPct,
    incChg, nhiChg,
    // v6.6 legacy aliases (점진적 제거)
    incCurChg, incNewChg, nhiNewChg,
    tAchg, tBchg, tCchg, tSchg,
    reg, regRatios,
  };
}
