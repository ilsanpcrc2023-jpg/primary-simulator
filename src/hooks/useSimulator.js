import { useReducer, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { INIT_BASE, INIT_P, INIT_F, INIT_REG_DIST, INIT_M_CLINICS, INIT_BASE_PER_CLINIC, INIT_TOTAL_N, INIT_DATA_LABEL, INIT_PT_BASE, INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C, INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C, INIT_SS_COST_BASE, INIT_SS_PROJECT_COST, INIT_L1, INIT_PF_PCT, INIT_PF_RULE, INIT_DEFAULT_M, INIT_DEFAULT_TOTAL_N, INIT_PER_CLINIC, ON, COL_ALIASES, B_MIN, B_MAX } from "../constants";

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
      return { ...state, base };
    }
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
    case "SET_REGDIST_AT": {
      const regDist = [...state.regDist];
      regDist[action.i] = Math.max(0, Math.round(action.value));
      return { ...state, regDist };
    }
    case "SET_REGDIST_ALL":
      return { ...state, regDist: action.values.map(v => Math.max(0, Math.round(v))) };
    case "SCALE_REGDIST": {
      // 총합을 newTotal로 맞추되 비율 유지
      const sum = state.regDist.reduce((s, v) => s + v, 0);
      if (sum <= 0) {
        const even = Math.max(0, Math.round(action.newTotal / 4));
        return { ...state, regDist: [even, even, even, even] };
      }
      const scale = action.newTotal / sum;
      const scaled = state.regDist.map(v => Math.max(0, Math.round(v * scale)));
      return { ...state, regDist: scaled };
    }
    case "LOAD_DATA": {
      const newTotalN = action.base.reduce((s, g) => s + g.N, 0);
      const newM = action.M_clinics ?? state.M_clinics;
      const perClinic = Math.max(1, Math.round(newTotalN / Math.max(1, newM)));
      // v6.9.4: 데이터 anchor 갱신.
      //   action.M_clinics가 있으면 (프리셋 로드 / 공식 baseline) → datasetM 함께 갱신.
      //   없으면 (엑셀 업로드 등) → datasetM은 그대로, datasetTotalN/datasetLabel만 갱신.
      const newDatasetM = action.M_clinics ?? state.datasetM ?? INIT_M_CLINICS;
      // v6.9.5: L1을 새 데이터의 실측 L로 자동 동기화 (옵션 A · 사용자 결정).
      //   L1은 협상 변수가 아니라 "과거 평균 타원이용비중" 데이터 실측 그 자체.
      //   사용자가 임의 조정한 L1은 새 데이터 LOAD 시 덮어써짐.
      const newL1 = action.base.map(b => (typeof b?.L === "number" ? b.L : 0.7));
      // v7.2.0: action.regDist (엑셀 RR 컬럼)가 4군 모두 양수면 자동 주입.
      //   없으면 기존 state.regDist 보존 (사용자 슬라이더 조정값 보호).
      const newRegDist = (Array.isArray(action.regDist) && action.regDist.length === 4 && action.regDist.every(v => v > 0))
        ? action.regDist.map(v => Math.max(0, Math.round(v)))
        : state.regDist;
      return {
        ...state,
        base: action.base,
        P: action.P,
        F_g: action.F_g ?? state.F_g,
        L1: newL1,
        regDist: newRegDist,
        totalN: newTotalN,
        dataLabel: action.dataLabel,
        uploadBanner: action.uploadBanner,
        M_clinics: newM,
        // 프리셋 로드 시 참여 전 기준 실인원을 해당 프리셋 의원당 실인원으로 자동 설정
        baseN_per_clinic: perClinic,
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
  } = state;

  const ffsPct = 100 - hccPct;

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

  // v6.7 → v7.3.0: 모형 효과 = PF만 (PB 정의 정정).
  //   PB = M1 × 0.70 (공단지급분), 본인부담 = M1 × 0.30 (양쪽 상쇄)
  //   ab_reg = PB + F_i + 본인부담 = M1 + F_i → baseline(M1) 대비 delta = PF만.
  //   이전 PB = B(1−L1)는 reference로 강등 (B는 NT 베이스, M1은 NC 베이스 — 코호트 불일치로 PB ≠ M1×0.7).
  //   사용자 정책 의도: "환자 본인부담 변화 없음, 의원 받는 돈 변화 없음, 변화는 PF만". (handoff_v7.3.0)
  //   공단 외래 지출은 등록환자 타원비를 L2 기반으로 반영 (L2 슬라이더 연동).
  const G = useMemo(() => {
    const safeL2 = Math.max(0, Math.min(0.999, L2eff));
    return base.map((b, i) => {
      const N = Math.round(totalN * ratios[i]);
      const p = P[i];                                    // B value (reference, 시뮬 미사용)
      const L1_g = L1[i] ?? 0.7;                         // 성과급 산식(L1−L2)에서 사용
      const F_i = F_g[i] ?? 0;
      const pay_gov = b.M1 * 0.70 + F_i;                 // PB = M1 × 0.7 + PF (공단지급)
      const ab_reg = pay_gov + b.M1 * 0.30;              // = M1 + PF (의원 수입 1인당)

      // 외래비 상수
      const C1 = b.M1 / (1 - b.L);                       // 기존 L 기반 총 외래비 (비등록·baseline)
      const D1_base = C1 - b.M1;                         // 비등록환자 타원 외래비 (기존 L)
      const D1_L2 = b.M1 * safeL2 / (1 - safeL2);        // 등록환자 타원 외래비 (L2 반영 · L2 슬라이더 연동)

      // 등록/비등록 (등록 ⊆ 이용 clamp)
      const n_reg_g_raw = reg.n_reg_total * regRatios[i];
      const n_reg_g = Math.min(n_reg_g_raw, N);
      const n_unreg_g = Math.max(0, N - n_reg_g);

      // 의원 수입 (선지급만 · 성과급은 T 레벨에서 합산)
      const inc0 = b.M1 * N;                              // baseline: 전원 FFS
      const inc = ab_reg * n_reg_g + b.M1 * n_unreg_g;    // 참여 후 선지급 수입

      // 공단 의원급 외래 지출 — 등록환자는 L2 기반 타원비, 비등록은 기존 L 유지
      const nhi0 = C1 * N;                                // baseline
      const nhi = (ab_reg + D1_L2) * n_reg_g + C1 * n_unreg_g;

      // Track (1인당 등록환자 실지불액 · 선지급만, 성과급은 T 레벨)
      const tA = b.M1 + F_i;
      const tC = ab_reg;
      const tB = 0.5 * tA + 0.5 * tC;
      const tS = tA * (ffsPct / 100) + tC * (hccPct / 100);

      return {
        N, p, b, L1_g,
        pay_gov, ab_reg,
        B: b.M1 * 0.30,
        F_per_pt: F_i,
        n_reg: n_reg_g, n_unreg: n_unreg_g,
        inc0, inc, nhi0, nhi,
        tA, tB, tC, tS,
      };
    });
  }, [base, P, L1, L2eff, totalN, hccPct, ffsPct, ratios, regRatios, reg, F_g]);

  const T = useMemo(() => {
    const s = { inc0: 0, inc: 0, nhi0: 0, nhi: 0, tA: 0, tB: 0, tC: 0, tS: 0 };
    G.forEach(r => {
      s.inc0 += r.inc0; s.inc += r.inc;
      s.nhi0 += r.nhi0; s.nhi += r.nhi;
      const unregFFS = r.b.M1 * r.n_unreg;
      s.tA += r.tA * r.n_reg + unregFFS;
      s.tB += r.tB * r.n_reg + unregFFS;
      s.tC += r.tC * r.n_reg + unregFFS;
      s.tS += r.tS * r.n_reg + unregFFS;
    });
    return s;
  }, [G]);

  // v6.7 → v7.3.0: 성과급 베이스 B → M1 (사용자 결정).
  //   성과급 = Σ max(0, L1_g − L2) × M1 × n_reg × TrackMul
  //   의미: 등록환자가 등록의원 외래로 더 집중(L2 < L1, 즉 C2 > C1)할 때 그 절감분을 의원에 환원.
  //   베이스 M1 = 등록의원 외래 1인당 — 시뮬 핵심 산식 정합(PB·ab_reg가 M1 베이스).
  //   no-downside 비대칭, 의원 100% 환원(공유율 α 없음, SS와 상이).
  //   Track 배수(A=0/B=0.5/C=1.0) 선형 보간 (hccPct/100)
  const performance = useMemo(() => {
    let perf_raw_total = 0;
    G.forEach((r, i) => {
      const diff = Math.max(0, (L1[i] ?? 0.7) - L2eff);
      perf_raw_total += diff * r.b.M1 * r.n_reg;
    });
    const perf_total = perf_raw_total;                    // Track C 최대치 = 전체 절감액 100% 환원
    const perfByTrack = {
      A: 0,
      B: perf_total * 0.5,
      C: perf_total * 1.0,
    };
    const trackMul = Math.max(0, Math.min(1, hccPct / 100));   // hccPct 0→A, 50→B, 100→C
    const perf_blended = perf_total * trackMul;
    return {
      L2eff, L1avg,
      perf_raw_total, perf_total, perfByTrack,
      trackMul, perf_blended,
    };
  }, [G, L1, L2eff, L1avg, hccPct]);

  // v6.7: KPI 변화율 — L2 연동
  //   의원 수입  = 선지급 inc + 성과급 perf_blended
  //   공단 지출 = L2 반영 nhi + 성과급 지급 perf_blended
  const incTotal = T.inc + performance.perf_blended;
  const nhiTotal = T.nhi + performance.perf_blended;
  const incChg = T.inc0 > 0 ? (incTotal - T.inc0) / T.inc0 : 0;
  const nhiChg = T.nhi0 > 0 ? (nhiTotal - T.nhi0) / T.nhi0 : 0;
  // 하위 호환 alias (v6.6까지 쓰던 이름 — 추후 제거 가능)
  const incCurChg = incChg;
  const incNewChg = incChg;
  const nhiNewChg = nhiChg;

  // v7.3.0 패널 분해 (PF-only · 본인부담 양쪽 상쇄):
  //   baselineIncome = baseN × ffsPerPerson × M       (참여 전 전원 FFS)
  //   panelEffect    = Σ M1 × (N_after − baseN)       (패널 변화 · FFS 유지)
  //   modelEffect    = Σ n_reg × (ab_reg − M1) = Σ n_reg × PF   (지불방식 전환 = PF 가산만)
  //   performanceEffect = perf_blended                 (L2 성과급 · Track 배수, 베이스 M1)
  //   afterIncome = 선지급 + 성과급 (의원 수입 KPI)
  //   ※ PF=0%이면 modelEffect = 0 → 구조 전환만으로는 의원 수입 변동 없음
  //     (정책 발표 시 "왜 의원 수입이 늘어나는가?" → "PF 가산만"으로 명확하게 답변).
  const decomp = useMemo(() => {
    const M = Math.max(1, M_clinics);
    const baseN_total = Math.max(0, baseN_per_clinic) * M;
    const ffsPerPerson = base.reduce((s, b, i) => s + b.M1 * ratios[i], 0);
    const baselineIncome = baseN_total * ffsPerPerson;
    const baseN_g = base.map((_, i) => baseN_total * ratios[i]);
    const panelEffect = G.reduce((s, r, i) => s + r.b.M1 * (r.N - baseN_g[i]), 0);
    const modelEffect = G.reduce((s, r) => s + r.n_reg * (r.ab_reg - r.b.M1), 0);
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
      // v7.3.0: 시트명 우선순위 — 시뮬레이터 업로드용 → 핵심표(NHIS-HCC v3.0 엑셀) → 첫 시트.
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
      const rows = data.slice(0, 4).map((row, i) => {
        let N = findCol(row, COL_ALIASES.N, 0);
        let M1 = findCol(row, COL_ALIASES.M1, 0);
        let L = findCol(row, COL_ALIASES.L, 0);
        const HCC = findCol(row, COL_ALIASES.HCC, 0);
        let CR = findCol(row, COL_ALIASES.CR, 0);
        const RR = findCol(row, COL_ALIASES.RR, 0);
        const RO = findCol(row, COL_ALIASES.RO, 0);
        if (L > 1) L = L / 100;
        if (L < 0 || L > 1) L = INIT_BASE[i].L;
        if (CR > 1) CR = CR / 100;   // 퍼센트 입력 방어
        if (CR < 0 || CR > 1) CR = 0;
        // M1 fallback: M1 누락 시 RO ÷ N (= R1 = RO/RN, NHIS-HCC v3.0 정의)
        if (!M1 && RO > 0 && N > 0) M1 = Math.round(RO / N);
        return {
          N: Math.round(N) || INIT_BASE[i].N,
          M1: M1 || INIT_BASE[i].M1,
          L: L || INIT_BASE[i].L,
          HCC,
          CR,
          RR: Math.round(RR) || 0,
        };
      });
      const newBase = rows.map(r => ({ N: r.N, M1: r.M1, L: r.L }));
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
      const label = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      const SHL = ["1군", "2군", "3군", "4군"];
      const fmt = v => Math.round(v).toLocaleString("ko-KR");
      const det = rows.map((r, i) => {
        const base = `${SHL[i]}: N=${fmt(r.N)}, M1=${fmt(r.M1)}, L=${r.L.toFixed(4)}`;
        const bDet = (r.HCC > 0 && r.CR > 0)
          ? `, A=${fmt(r.HCC)}, CR=${r.CR.toFixed(3)} → B=${fmt(newB[i])}`
          : `  (B 유지: ${fmt(newB[i])})`;
        const rrDet = hasRR ? `, RR=${fmt(r.RR)}` : "";
        return base + bDet + rrDet;
      }).join("\n");
      const bMsg = derivedCount > 0
        ? `B 권장값 ${derivedCount}/4군 자동 유도 (A × CR)`
        : `B 슬라이더 보존 (A·CR 없음)`;
      const rrMsg = hasRR ? ` · RR 컬럼 → 의원당 등록환자수 자동 주입` : ``;
      const bannerMsg = `"${sheetName}" 시트에서 4군 데이터 로딩 완료 — ${bMsg}${rrMsg}`;
      dispatch({
        type: "LOAD_DATA",
        base: newBase,
        P: newB,
        F_g: state.F_g,
        regDist: newRegDist,
        dataLabel: label,
        uploadBanner: { success: true, msg: bannerMsg, details: det },
      });
      // v6.7: 엑셀 L 값을 L1 seed로도 제안. 사용자가 L1 카드의 "엑셀 L 복사" 버튼으로 명시 반영.
      // (자동 반영하면 L1 정책값을 덮어쓸 수 있어 UX 위험 — 버튼 경유 유지.)
    } catch (err) {
      set("uploadBanner", { success: false, msg: "파일 읽기 실패: " + err.message, details: null });
    }
  }, [set, state.P, state.F_g]);

  const handleExport = useCallback(async () => {
    try {
      const SH = ["1군", "2군", "3군", "4군"];
      // v6.4: 4열 (환자군 + N + M1 + L) — 업로드 템플릿과 동일 구조.
      // B/F 정책 슬라이더는 엑셀 비반영 → 라운드트립 시 슬라이더 보존됨.
      const headers = ["환자군", "N", "M1", "L"];
      const ws = {};
      headers.forEach((h, c) => {
        ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: "s", v: h };
      });

      base.forEach((b, idx) => {
        const r = idx + 1;
        ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: "s", v: SH[idx] };
        ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: "n", v: b.N };
        ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: "n", v: b.M1 };
        ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: "n", v: b.L };
      });

      // 합계/가중평균 행 (r=5)
      const sumN = base.reduce((s, b) => s + b.N, 0);
      const wM1 = sumN > 0 ? base.reduce((s, b) => s + b.M1 * b.N, 0) / sumN : 0;
      const wL = sumN > 0 ? base.reduce((s, b) => s + b.L * b.N, 0) / sumN : 0;
      const SR = 5, SER = 6;
      ws[XLSX.utils.encode_cell({ r: SR, c: 0 })] = { t: "s", v: "합계/가중평균" };
      ws[XLSX.utils.encode_cell({ r: SR, c: 1 })] = { t: "n", f: "SUM(B2:B5)", v: sumN };
      ws[XLSX.utils.encode_cell({ r: SR, c: 2 })] = { t: "n", f: `SUMPRODUCT(B2:B5,C2:C5)/B${SER}`, v: wM1 };
      ws[XLSX.utils.encode_cell({ r: SR, c: 3 })] = { t: "n", f: `SUMPRODUCT(B2:B5,D2:D5)/B${SER}`, v: wL };

      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5, c: 3 } });
      ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];

      const wb_new = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb_new, ws, "시뮬레이터_업로드");
      XLSX.writeFile(wb_new, `simulator_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("내보내기 실패: " + err.message);
    }
  }, [base]);

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
