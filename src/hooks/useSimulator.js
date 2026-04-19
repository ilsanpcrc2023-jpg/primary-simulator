import { useReducer, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { INIT_BASE, INIT_P, INIT_F, INIT_REG_DIST, ON, COL_ALIASES } from "../constants";

const initialState = {
  base: INIT_BASE,
  P: INIT_P,
  LC: -3,
  totalN: ON,
  dataLabel: "10개 의원 파일럿 (2023)",
  tab: 0,
  showDetail: false,
  showEditTable: false,
  hccPct: 100,
  uploadBanner: null,
  ssTotalCost: 110.8,
  ssAcute: 29.9,
  ssEmergency: 3.5,
  ssLtc: 10.0,
  ssAcutePct: 2,
  ssEmergencyPct: 3,
  ssLtcPct: 1,
  ssMacroPct: 0.1,
  ssClinicShare: 50,
  // v2.7: 일차의료 기능수가 F (환자군별 차등, 복지부 공식안 준용)
  F_g: [...INIT_F],
  M_clinics: 10,
  // 의원당 환자군별 등록환자수 (부록 기준 100/600/200/100)
  regDist: [...INIT_REG_DIST],
};

function reducer(state, action) {
  switch (action.type) {
    case "SET":
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
      const F_g = [...state.F_g];
      F_g[action.i] = Math.max(0, Math.round(action.value));
      return { ...state, F_g };
    }
    case "SET_F_ALL":
      return { ...state, F_g: action.values.map(v => Math.max(0, Math.round(v))) };
    case "RESET_F":
      return { ...state, F_g: [...INIT_F] };
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
    case "LOAD_DATA":
      return {
        ...state,
        base: action.base,
        P: action.P,
        totalN: action.base.reduce((s, g) => s + g.N, 0),
        dataLabel: action.dataLabel,
        uploadBanner: action.uploadBanner,
        M_clinics: action.M_clinics ?? state.M_clinics,
      };
    case "MACRO_SYNC": {
      const { newPct } = action;
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
    base, P, LC, totalN, hccPct,
    ssTotalCost, ssAcute, ssEmergency, ssLtc,
    ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare,
    F_g, M_clinics, regDist,
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

  const G = useMemo(() => {
    const lc = LC / 100;
    return base.map((b, i) => {
      const N = Math.round(totalN * ratios[i]);
      const p = P[i];
      const A_cur = p * (1 - b.L);
      const AB_cur = A_cur + b.M1 * 0.30;
      const LL = b.L + lc;
      const A_new = p * (1 - LL);
      const AB_new = A_new + b.M1 * 0.30;
      const C1 = b.M1 / (1 - b.L);
      const D1 = C1 - b.M1;

      // v2.7: 등록/비등록 분리
      const n_reg_g = reg.n_reg_total * regRatios[i];
      const n_unreg_g = Math.max(0, N - n_reg_g);

      // 환자군별 일차의료 기능수가 F (L 우회, 환자군별 차등)
      const F_i = F_g[i] ?? 0;
      const ab_reg_cur = A_cur + F_i + b.M1 * 0.30;
      const ab_reg_new = A_new + F_i + b.M1 * 0.30;

      // 의원 총수입: 등록=환자군 모형, 비등록=FFS(M1)
      const inc0 = b.M1 * N;                                    // baseline: 전원 FFS
      const inc1 = ab_reg_cur * n_reg_g + b.M1 * n_unreg_g;     // 현 의료행태
      const inc2 = ab_reg_new * n_reg_g + b.M1 * n_unreg_g;     // LC 적용 후

      // 공단 총의료비 (의원급 외래 전체)
      const nhi0 = C1 * N;
      const nhi1 = (ab_reg_cur + D1) * n_reg_g + C1 * n_unreg_g;
      const nhi2 = (ab_reg_new + D1 * (b.L > 0 ? LL / b.L : 1)) * n_reg_g + C1 * n_unreg_g;

      // Track (1인당 등록환자 실지불액, 모든 Track에 F 가산)
      //   A: FFS + F
      //   C: 환자군 모형 (LC 적용) + F
      //   B: A와 C의 hccPct 가중평균
      const tA = b.M1 + F_i;
      const tC = ab_reg_new;
      const tB = (tA + tC) / 2;
      const tS = tA * (ffsPct / 100) + tC * (hccPct / 100);

      return {
        N, p, b,
        A_cur, A_new, AB_cur, AB_new, LL,
        B: b.M1 * 0.30,
        F_per_pt: F_i,
        n_reg: n_reg_g, n_unreg: n_unreg_g,
        ab_reg_cur, ab_reg_new,
        inc0, inc1, inc2, nhi0, nhi1, nhi2,
        tA, tB, tC, tS,
      };
    });
  }, [base, P, LC, totalN, hccPct, ffsPct, ratios, regRatios, reg, F_g]);

  const T = useMemo(() => {
    const s = { inc0: 0, inc1: 0, inc2: 0, nhi0: 0, nhi1: 0, nhi2: 0, tA: 0, tB: 0, tC: 0, tS: 0 };
    G.forEach(r => {
      s.inc0 += r.inc0; s.inc1 += r.inc1; s.inc2 += r.inc2;
      s.nhi0 += r.nhi0; s.nhi1 += r.nhi1; s.nhi2 += r.nhi2;
      // Track 총액: 등록환자 Track별 + 비등록환자 FFS 고정
      const unregFFS = r.b.M1 * r.n_unreg;
      s.tA += r.tA * r.n_reg + unregFFS;
      s.tB += r.tB * r.n_reg + unregFFS;
      s.tC += r.tC * r.n_reg + unregFFS;
      s.tS += r.tS * r.n_reg + unregFFS;
    });
    return s;
  }, [G]);

  const incCurChg = T.inc0 > 0 ? (T.inc1 - T.inc0) / T.inc0 : 0;
  const incNewChg = T.inc0 > 0 ? (T.inc2 - T.inc0) / T.inc0 : 0;
  const nhiNewChg = T.nhi0 > 0 ? (T.nhi2 - T.nhi0) / T.nhi0 : 0;
  // Track 변화율 기준 = 순수 FFS (inc0, 사업 미시행·R=0 기준선).
  // Track A에서도 R>0이면 양(+) 변화가 나와야 한다는 노션 Q6 정합.
  const tAchg = T.inc0 > 0 ? (T.tA - T.inc0) / T.inc0 : 0;
  const tBchg = T.inc0 > 0 ? (T.tB - T.inc0) / T.inc0 : 0;
  const tCchg = T.inc0 > 0 ? (T.tC - T.inc0) / T.inc0 : 0;
  const tSchg = T.inc0 > 0 ? (T.tS - T.inc0) / T.inc0 : 0;

  const SS = useMemo(() => {
    const totalMedCost = ssTotalCost * 1e12;
    const acuteSaving = ssAcute * 1e12 * (ssAcutePct / 100);
    const emergencySaving = ssEmergency * 1e12 * (ssEmergencyPct / 100);
    const ltcSaving = ssLtc * 1e12 * (ssLtcPct / 100);
    const itemTotal = acuteSaving + emergencySaving + ltcSaving;
    const derivedMacroPct = totalMedCost > 0 ? (itemTotal / totalMedCost) * 100 : 0;
    const clinicPct = ssClinicShare / 100;
    const nhisPct = 1 - clinicPct;
    return {
      acuteSaving, emergencySaving, ltcSaving, itemTotal,
      totalMedCost, derivedMacroPct,
      clinicFromItem: itemTotal * clinicPct,
      nhisFromItem: itemTotal * nhisPct,
      clinicPct, nhisPct,
    };
  }, [ssTotalCost, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare]);

  const set = useCallback((key, value) => dispatch({ type: "SET", key, value }), []);
  const updP = useCallback((i, value) => dispatch({ type: "SET_P", i, value }), []);
  const updBase = useCallback((i, key, value) => dispatch({ type: "SET_BASE", i, key, value }), []);
  const updF = useCallback((i, value) => dispatch({ type: "SET_F_AT", i, value }), []);
  const setFAll = useCallback((values) => dispatch({ type: "SET_F_ALL", values }), []);
  const resetF = useCallback(() => dispatch({ type: "RESET_F" }), []);
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
      const simIdx = wb.SheetNames.findIndex(n => n.includes("시뮬레이터"));
      if (simIdx >= 0) sheetName = wb.SheetNames[simIdx];
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length < 4) {
        set("uploadBanner", { success: false, msg: "데이터 부족: 4개 환자군 행이 필요합니다.", details: `시트 "${sheetName}"에서 ${data.length}행만 발견` });
        return;
      }
      const newBase = data.slice(0, 4).map((row, i) => {
        let ref = findCol(row, COL_ALIASES.ref, 0);
        let cr = findCol(row, COL_ALIASES.cr, 0);
        let N = findCol(row, COL_ALIASES.N, 0);
        let M1 = findCol(row, COL_ALIASES.M1, 0);
        let L = findCol(row, COL_ALIASES.L, 0);
        if (cr > 1) cr = cr / 100;
        if (L > 1) L = L / 100;
        if (cr < 0 || cr > 1) cr = INIT_BASE[i].cr;
        if (L < 0 || L > 1) L = INIT_BASE[i].L;
        return {
          ref: ref || INIT_BASE[i].ref,
          cr: cr || INIT_BASE[i].cr,
          N: Math.round(N) || INIT_BASE[i].N,
          M1: M1 || INIT_BASE[i].M1,
          L: L || INIT_BASE[i].L,
        };
      });
      const newP = data.slice(0, 4).map((row, i) => {
        const v = findCol(row, COL_ALIASES.P, 0);
        return v || INIT_P[i];
      });
      const label = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      const det = newBase.map((b, i) => {
        const SH = ["1군", "2군", "3군", "4군"];
        const fmt = v => Math.round(v).toLocaleString("ko-KR");
        return `${SH[i]}: N=${fmt(b.N)}, ref=${fmt(b.ref)}, cr=${(b.cr * 100).toFixed(1)}%, L=${(b.L * 100).toFixed(1)}%, P=${fmt(newP[i])}`;
      }).join("\n");
      dispatch({
        type: "LOAD_DATA",
        base: newBase,
        P: newP,
        dataLabel: label,
        uploadBanner: { success: true, msg: `"${sheetName}" 시트에서 4군 데이터 로딩 완료`, details: det },
      });
    } catch (err) {
      set("uploadBanner", { success: false, msg: "파일 읽기 실패: " + err.message, details: null });
    }
  }, [set]);

  const handleExport = useCallback(async () => {
    try {
      const SH = ["1군", "2군", "3군", "4군"];
      const rows = base.map((b, i) => ({
        "환자군": SH[i],
        "기준의료비": b.ref,
        "의원비중": b.cr,
        "환자수": b.N,
        "현재외래비": b.M1,
        "타원이용비중": b.L,
        "수가": P[i],
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
      const wb_new = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb_new, ws, "시뮬레이터_출력");
      XLSX.writeFile(wb_new, `simulator_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("내보내기 실패: " + err.message);
    }
  }, [base, P]);

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
    state, set, updP, updBase, updF, setFAll, resetF,
    updRegDist, setRegDistAll, scaleRegDist,
    reset,
    handleMacroSync, handleFile, handleExport, loadPreset,
    fileRef,
    G, T, SS,
    ffsPct,
    incCurChg, incNewChg, nhiNewChg,
    tAchg, tBchg, tCchg, tSchg,
    reg, regRatios,
  };
}
