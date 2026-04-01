import { useState, useMemo, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ════════════════════════════════════════════════════════════════════
// 환자군(HCC) 기반 일차의료 지불모형 시뮬레이터 v5.0
// 수식: 엑셀 2B — 비용기반 Leakage + 본인부담 30% 별도 가산
// v5.0: Shared Saving (C축) 탭 — 항목별↔거시 연동, 공단/일차의료 배분
// ════════════════════════════════════════════════════════════════════

const SH = ["1군", "2군", "3군", "4군"];
const CL = ["#22c55e", "#6366f1", "#2563eb", "#f97316"];

const INIT_BASE = [
  { ref: 400538, cr: 0.701, N: 11956, M1: 62801, L: 0.7975 },
  { ref: 642819, cr: 0.655, N: 13778, M1: 84083, L: 0.7934 },
  { ref: 1246438, cr: 0.589, N: 18089, M1: 138152, L: 0.7943 },
  { ref: 3495599, cr: 0.299, N: 25781, M1: 233560, L: 0.7722 },
];

const INIT_P = [220000, 300000, 520000, 740000];
const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

const f = v => Math.round(v).toLocaleString("ko-KR");
const fE = v => (v / 1e8).toFixed(1);
const fSv = v => v >= 1e12 ? (v / 1e12).toFixed(2) + "조" : f(Math.round(v / 1e8)) + "억"; // smart saving format
const pct = (v, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
const diffE = (a, b) => `${b >= a ? "+" : ""}${fE(b - a)}억`;

// ── Custom slider CSS ──
const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;

function NumBox({ value, onChange, color = "#1d4ed8", suffix = "", style = {} }) {
  const [ed, setEd] = useState(false);
  const [tmp, setTmp] = useState("");
  const start = () => { setEd(true); setTmp(String(value)); };
  const end = () => { setEd(false); const v = parseFloat(tmp); if (!isNaN(v)) onChange(v); };
  if (ed) return (
    <input autoFocus value={tmp} onChange={e => setTmp(e.target.value)} onBlur={end} onKeyDown={e => e.key === "Enter" && end()}
      className="w-24 text-center text-sm font-bold border-2 rounded-md outline-none bg-white px-1 py-0.5"
      style={{ borderColor: color, color, ...style }} />
  );
  return (
    <button onClick={start}
      className="text-sm font-bold border border-gray-300 rounded-md px-2 py-0.5 hover:border-blue-400 transition bg-white cursor-text"
      style={{ color, ...style }}>
      {f(value)}{suffix}
    </button>
  );
}

export default function App() {
  const [base, setBase] = useState(INIT_BASE);
  const [P, setP] = useState(INIT_P);
  const [LC, setLC] = useState(-3);
  const [totalN, setTotalN] = useState(ON);
  const [tab, setTab] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showEditTable, setShowEditTable] = useState(false);
  const [hccPct, setHccPct] = useState(100);
  const [dataLabel, setDataLabel] = useState("10개 의원 파일럿 (2023)");
  const fileRef = useRef(null);
  const [uploadBanner, setUploadBanner] = useState(null); // { success, msg, details }

  // ══ Shared Saving (C축) state ══
  const NATIONAL_POP = 51_411_696;
  const [ssTotalCost, setSsTotalCost] = useState(110.8); // 총진료비 (조원)
  const [ssAcute, setSsAcute] = useState(29.9);     // 급성기입원비 총액 (조원)
  const [ssEmergency, setSsEmergency] = useState(3.5); // 응급의료비 총액 (조원)
  const [ssLtc, setSsLtc] = useState(10.0);         // 요양병원비 총액 (조원)
  const [ssAcutePct, setSsAcutePct] = useState(2);   // 급성기 절감률 %
  const [ssEmergencyPct, setSsEmergencyPct] = useState(3); // 응급 절감률 %
  const [ssLtcPct, setSsLtcPct] = useState(1);       // 요양병원 절감률 %
  const [ssMacroPct, setSsMacroPct] = useState(0.1);  // 거시 절감률 %
  const [ssClinicShare, setSsClinicShare] = useState(50); // 의원 배분비율 %

  const ffsPct = 100 - hccPct;
  const updP = useCallback((i, v) => setP(p => { const n = [...p]; n[i] = v; return n; }), []);
  const updBase = useCallback((i, key, v) => setBase(b => { const n = [...b]; n[i] = { ...n[i], [key]: v }; return n; }), []);
  const ratios = useMemo(() => { const t = base.reduce((s, g) => s + g.N, 0); return base.map(g => g.N / t); }, [base]);

  const reset = () => { setBase(INIT_BASE); setP(INIT_P); setLC(-3); setTotalN(ON); setDataLabel("10개 의원 파일럿 (2023)"); setUploadBanner(null); };

  // ══ CALCULATION ENGINE ══
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
      const inc0 = b.M1 * N;
      const inc1 = AB_cur * N;
      const inc2 = AB_new * N;
      const C1 = b.M1 / (1 - b.L); // approx total clinic cost per person
      const D1 = C1 - b.M1;
      const nhi0 = C1 * N;
      const nhi1 = AB_cur * N + D1 * N;
      const nhi2 = AB_new * N + D1 * (LL / b.L) * N;
      const tA = AB_cur;
      const tC = AB_new;
      const tB = (tA + tC) / 2;
      const tS = tA * (ffsPct / 100) + tC * (hccPct / 100);
      return { N, p, b, A_cur, A_new, AB_cur, AB_new, LL, B: b.M1 * 0.30, inc0, inc1, inc2, nhi0, nhi1, nhi2, tA, tB, tC, tS };
    });
  }, [base, P, LC, totalN, hccPct, ffsPct, ratios]);

  const T = useMemo(() => {
    const s = { inc0: 0, inc1: 0, inc2: 0, nhi0: 0, nhi1: 0, nhi2: 0, tA: 0, tB: 0, tC: 0, tS: 0 };
    G.forEach(r => {
      s.inc0 += r.inc0; s.inc1 += r.inc1; s.inc2 += r.inc2;
      s.nhi0 += r.nhi0; s.nhi1 += r.nhi1; s.nhi2 += r.nhi2;
      s.tA += r.tA * r.N; s.tB += r.tB * r.N; s.tC += r.tC * r.N; s.tS += r.tS * r.N;
    });
    return s;
  }, [G]);

  const incCurChg = T.inc0 > 0 ? (T.inc1 - T.inc0) / T.inc0 : 0;
  const incNewChg = T.inc0 > 0 ? (T.inc2 - T.inc0) / T.inc0 : 0;
  const nhiNewChg = T.nhi0 > 0 ? (T.nhi2 - T.nhi0) / T.nhi0 : 0;
  const tBchg = T.tA > 0 ? (T.tB - T.tA) / T.tA : 0;
  const tCchg = T.tA > 0 ? (T.tC - T.tA) / T.tA : 0;
  const tSchg = T.tA > 0 ? (T.tS - T.tA) / T.tA : 0;

  // ══ SHARED SAVING (C축) CALCULATION ══
  const SS = useMemo(() => {
    const totalMedCost = ssTotalCost * 1e12;
    // 항목별 절감 (조원 × 절감률)
    const acuteSaving = ssAcute * 1e12 * (ssAcutePct / 100);
    const emergencySaving = ssEmergency * 1e12 * (ssEmergencyPct / 100);
    const ltcSaving = ssLtc * 1e12 * (ssLtcPct / 100);
    const itemTotal = acuteSaving + emergencySaving + ltcSaving;
    const macroSaving = totalMedCost * (ssMacroPct / 100);
    const derivedMacroPct = totalMedCost > 0 ? (itemTotal / totalMedCost) * 100 : 0;
    const clinicPct = ssClinicShare / 100;
    const nhisPct = 1 - clinicPct;
    const poolTril = ssAcute + ssEmergency + ssLtc; // 조원
    return {
      acuteSaving, emergencySaving, ltcSaving, itemTotal,
      macroSaving, totalMedCost, derivedMacroPct, poolTril,
      clinicFromItem: itemTotal * clinicPct,
      nhisFromItem: itemTotal * nhisPct,
      clinicPct, nhisPct,
    };
  }, [ssTotalCost, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssMacroPct, ssClinicShare]);

  // 거시 → 항목 연동: 거시 절감률 변경 시 항목별 절감률을 비례 배분
  const handleMacroSync = useCallback((newPct) => {
    setSsMacroPct(newPct);
    const totalMedCost = ssTotalCost * 1e12;
    const targetSaving = totalMedCost * (newPct / 100);
    const pool = ssAcute + ssEmergency + ssLtc; // 조원
    if (pool <= 0) return;
    const distribute = (base) => {
      const share = base / pool;
      const itemSaving = targetSaving * share;
      const baseCost = base * 1e12;
      return Math.min(30, Math.max(0, (itemSaving / baseCost) * 100));
    };
    setSsAcutePct(parseFloat(distribute(ssAcute).toFixed(2)));
    setSsEmergencyPct(parseFloat(distribute(ssEmergency).toFixed(2)));
    setSsLtcPct(parseFloat(distribute(ssLtc).toFixed(2)));
  }, [ssTotalCost, ssAcute, ssEmergency, ssLtc]);

  // ── Column alias map (v3/v4 template + English + 원본 공표 엑셀 호환) ──
  const COL_ALIASES = {
    ref: ["기준의료비", "refCost", "환자군 기준의료비", "환자군\n기준의료비", "HCC평균"],
    cr:  ["의원비중", "clinicRatio", "의원급 외래비중", "의원급\n외래비중", "의원급비중"],
    N:   ["환자수", "N", "등록환자수", "등록환자수\n(N)"],
    M1:  ["현재외래비", "M1", "현행 M1", "1인당\n등록의원외래", "현행M1\n(1인당등록의원)"],
    L:   ["타원이용비중", "L", "비용기반 L", "비용기반 L\n(C−M)/C", "비용기반L"],
    P:   ["수가", "P", "일차의료수가", "일차의료수가\n(P)", "제시안 수가", "제시안 수가\n(P_제시안)"],
  };

  const findCol = (row, aliases, fb) => {
    // 1) Exact key match
    for (const a of aliases) {
      const v = row[a];
      if (v !== undefined && v !== null && v !== "") return Number(v);
    }
    // 2) Normalized partial match (strip newlines, trim)
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
  };

  // ── File upload handler (smart sheet, flexible columns, auto-format) ──
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);

      // Smart sheet detection: prefer "시뮬레이터_출력", fallback to first sheet
      let sheetName = wb.SheetNames[0];
      const simIdx = wb.SheetNames.findIndex(n => n.includes("시뮬레이터"));
      if (simIdx >= 0) sheetName = wb.SheetNames[simIdx];

      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws);

      if (data.length < 4) {
        setUploadBanner({ success: false, msg: "데이터 부족: 4개 환자군 행이 필요합니다.", details: `시트 "${sheetName}"에서 ${data.length}행만 발견` });
        return;
      }

      const newBase = data.slice(0, 4).map((row, i) => {
        let ref = findCol(row, COL_ALIASES.ref, 0);
        let cr  = findCol(row, COL_ALIASES.cr, 0);
        let N   = findCol(row, COL_ALIASES.N, 0);
        let M1  = findCol(row, COL_ALIASES.M1, 0);
        let L   = findCol(row, COL_ALIASES.L, 0);
        // Auto-detect: if cr > 1 (e.g., 70.1%), convert to decimal
        if (cr > 1) cr = cr / 100;
        if (L > 1) L = L / 100;
        // Validate ranges
        if (cr < 0 || cr > 1) cr = INIT_BASE[i].cr;
        if (L < 0 || L > 1) L = INIT_BASE[i].L;
        return {
          ref: ref || INIT_BASE[i].ref,
          cr:  cr || INIT_BASE[i].cr,
          N:   Math.round(N) || INIT_BASE[i].N,
          M1:  M1 || INIT_BASE[i].M1,
          L:   L || INIT_BASE[i].L,
        };
      });

      const newP = data.slice(0, 4).map((row, i) => {
        const v = findCol(row, COL_ALIASES.P, 0);
        return v || INIT_P[i];
      });

      setBase(newBase);
      setTotalN(newBase.reduce((s, g) => s + g.N, 0));
      setP(newP);
      const label = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      setDataLabel(label);

      // Build summary
      const det = newBase.map((b, i) =>
        `${SH[i]}: N=${f(b.N)}, ref=${f(b.ref)}, cr=${(b.cr*100).toFixed(1)}%, L=${(b.L*100).toFixed(1)}%, P=${f(newP[i])}`
      ).join("\n");
      setUploadBanner({ success: true, msg: `"${sheetName}" 시트에서 4군 데이터 로딩 완료`, details: det });
    } catch (err) {
      setUploadBanner({ success: false, msg: "파일 읽기 실패: " + err.message, details: null });
    }
  };

  // ── Export current state to Excel ──
  const handleExport = async () => {
    try {
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");
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
      // Column widths
      ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
      const wb_new = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb_new, ws, "시뮬레이터_출력");
      XLSX.writeFile(wb_new, `simulator_export_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      alert("내보내기 실패: " + err.message);
    }
  };

  const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

  // ── Tab style (folder) ──
  const tabStyle = (active) => ({
    background: active ? "#fff" : "#e8ecf1",
    color: active ? "#1e40af" : "#64748b",
    border: active ? "1px solid #d1d5db" : "1px solid #d1d5db",
    borderBottom: active ? "1px solid #fff" : "1px solid #d1d5db",
    borderRadius: "8px 8px 0 0",
    fontWeight: active ? 700 : 500,
    fontSize: "12px",
    padding: "10px 4px",
    marginBottom: "-1px",
    position: "relative",
    zIndex: active ? 2 : 1,
  });

  return (
    <div className="overflow-x-hidden" style={{ fontFamily: "'Pretendard','Noto Sans KR',-apple-system,sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{sliderCSS}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)" }} className="px-3 sm:px-5 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-gray-400 text-xs tracking-widest" style={{ fontSize: 10 }}>NHIS-HCC SIMULATOR v5.0</div>
            <h1 className="text-white font-bold mt-0.5 text-sm sm:text-base">환자군 기반 일차의료 지불모형 시뮬레이터</h1>
          </div>
          <div className="text-right text-xs shrink-0">
            <div><span className="text-blue-200">등록환자 </span><b className="text-white">{f(totalN)}</b><span className="text-blue-200">명</span></div>
            <div className="text-gray-400 mt-0.5">{dataLabel}</div>
          </div>
        </div>
      </div>

      {/* FOLDER TABS */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3" style={{ borderBottom: "1px solid #d1d5db" }}>
        <div className="flex gap-1">
          {["📋 수가 시뮬레이션", "📊 Track", "💰 Shared Saving"].map((t, i) => (
            <button key={i} onClick={() => setTab(i)} className="flex-1 text-center cursor-pointer transition-all" style={tabStyle(tab === i)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">

        {/* ═══ TAB 0: 시뮬레이션 ═══ */}
        {tab === 0 && (<>

          {/* 수가 설정 */}
          <div className={card + " p-4"}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-sm">일차의료수가 설정</h2>
              <div className="flex items-center gap-2">
                {totalN === ON && <span className="text-xs text-gray-400 hidden sm:inline">{dataLabel}</span>}
                <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-0.5">초기화</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {SH.map((g, i) => (
                <div key={i} className="space-y-1.5">
                  <span className="text-xs font-bold" style={{ color: CL[i] }}>{g} 수가</span>
                  <input type="range" min={50000} max={2000000} step={10000} value={P[i]}
                    onChange={e => updP(i, parseFloat(e.target.value))}
                    className="w-full big-thumb"
                    style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${((P[i] - 50000) / 1950000) * 100}%, #e5e7eb 0%)` }} />
                  <div className="text-center">
                    <NumBox value={P[i]} onChange={v => updP(i, Math.max(50000, Math.min(2000000, v)))} color={CL[i]} suffix="원" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-700">타원이용비중 변화율 (LC)</span>
                <span className="text-xs text-gray-400">진료건수 기준 · 등록 후 관리 강화 시 예상 감소폭</span>
                <div className="ml-auto">
                  <NumBox value={LC} onChange={v => setLC(Math.max(-10, Math.min(0, v)))} color="#7c3aed" suffix="%p" />
                </div>
              </div>
              <input type="range" min={-10} max={0} step={0.5} value={LC}
                onChange={e => setLC(parseFloat(e.target.value))}
                className="w-full big-thumb"
                style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((LC + 10) / 10) * 100}%, #e5e7eb 0%)` }} />
            </div>
          </div>

          {/* 등록환자 수 */}
          <div className={card + " px-3 py-2.5"}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-600 shrink-0">등록환자 수 (N)</span>
              <input type="text" value={totalN.toLocaleString()}
                onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) { setTotalN(v); if (v !== ON) setDataLabel("시뮬레이션 모드"); } }}
                className="w-28 text-sm font-bold text-gray-800 text-right border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
              <span className="text-xs text-gray-400">명</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-blue-600 font-semibold shrink-0">추정 환자수 예측</span>
              {[{ l: "10만", v: 100000 }, { l: "100만", v: 1000000 }, { l: "1000만", v: 10000000 }, { l: "5000만", v: 50000000 }].map(b => (
                <button key={b.v} onClick={() => { setTotalN(b.v); setDataLabel(`추정 ${b.l}명 시뮬레이션`); }}
                  className="text-xs px-2 py-1 rounded border font-medium transition"
                  style={totalN === b.v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {b.l}
                </button>
              ))}
              <span className="text-xs text-gray-400">명</span>
            </div>
          </div>

          {/* KPI 2열 */}
          <div className="grid grid-cols-2 gap-2">
            <div className={card + " p-3"}>
              <div className="text-xs text-gray-500 mb-1">의원 수입 변화 (LC {LC}%p)</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-green-600">{pct(incNewChg)}</div>
              <div className="text-sm font-bold text-green-600">{diffE(T.inc0, T.inc2)}원</div>
              <div className="text-xs text-gray-400 mt-1">{fE(T.inc0)}억 → {fE(T.inc2)}억</div>
            </div>
            <div className={card + " p-3"}>
              <div className="text-xs text-gray-500 mb-1">공단 총의료비 변화</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-700">{pct(nhiNewChg, 2)}</div>
              <div className="text-sm font-bold text-blue-600">{diffE(T.nhi0, T.nhi2)}원</div>
              <div className="text-xs text-gray-400 mt-1">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
            </div>
          </div>

          {/* 차트 2열 (먼저 배치) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={card + " p-3"}>
              <h3 className="text-xs font-bold text-gray-700 mb-2">의원 수입 비교 (환자군별, 억원)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={G.map((r, i) => ({ name: SH[i], "기존": r.inc0 / 1e8, "현의료행태": r.inc1 / 1e8, [`LC${LC}%p`]: r.inc2 / 1e8 }))} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => v.toFixed(0) + "억"} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="기존" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="현의료행태" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={`LC${LC}%p`} fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={card + " p-3"}>
              <h3 className="text-xs font-bold text-gray-700 mb-2">공단 총의료비 비교 (억원)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: "기존", v: T.nhi0 / 1e8 },
                  { name: "현의료행태", v: T.nhi1 / 1e8 },
                  { name: `LC${LC}%p`, v: T.nhi2 / 1e8 },
                ]} barSize={50}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                    <Cell fill="#d1d5db" /><Cell fill="#3b82f6" /><Cell fill="#f59e0b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Saving 주석 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <span className="text-amber-500 shrink-0 text-sm">⚠</span>
            <span className="text-xs text-amber-800 leading-relaxed">
              본 시뮬레이션은 의원급 외래 타원이용비중 변화만 반영하며, 일차의료 강화에 따른 입원·응급 이용 절감 효과(Saving)는 포함되지 않았습니다. 추가 분석 후 반영 필요.
            </span>
          </div>

          {/* Win-Win-Win (가로 3열, 모바일 세로) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
                txt: "추가 부담 없이 주치의 확보\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
              { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
                txt: `환자군 반영 공정 보상\n현 의료행태 수입 ${pct(incCurChg)}\nLC ${LC}%p 시 ${pct(incNewChg)}` },
              { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
                txt: `의원급 지출 ${pct(nhiNewChg, 2)}\n의료비 예측 가능성 향상\n*Saving 효과 별도` },
            ].map((w, i) => (
              <div key={i} className="rounded-xl px-3 py-2.5 text-center" style={{ background: w.bg, border: `1px solid ${w.bd}` }}>
                <div className="text-sm font-bold mb-1" style={{ color: w.c }}>{w.t}</div>
                <div className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{w.txt}</div>
              </div>
            ))}
          </div>

          {/* ⚙️ 데이터 관리 (맨 아래, 2단계 구조) */}
          <div className={card + " overflow-hidden"}>
            <button onClick={() => setShowDetail(!showDetail)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
              <span>⚙️ 데이터 관리</span>
              <span className="text-gray-400 text-xs">{showDetail ? "▲ 접기" : "▼ 펼치기"}</span>
            </button>
            {showDetail && (
              <div className="px-3 pb-3 border-t border-gray-100">

                {/* Level 1: 업로드·내보내기 + 4군 요약 */}
                {/* Upload banner */}
                {uploadBanner && (
                  <div className={`mt-2 mb-3 rounded-lg px-3 py-2.5 text-xs ${uploadBanner.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${uploadBanner.success ? "text-green-700" : "text-red-700"}`}>
                        {uploadBanner.success ? "✅ " : "❌ "}{uploadBanner.msg}
                      </span>
                      <button onClick={() => setUploadBanner(null)} className="text-gray-400 hover:text-gray-600 text-sm ml-2">✕</button>
                    </div>
                    {uploadBanner.details && (
                      <pre className={`mt-1.5 text-xs leading-relaxed whitespace-pre-wrap ${uploadBanner.success ? "text-green-600" : "text-red-600"}`}>
                        {uploadBanner.details}
                      </pre>
                    )}
                  </div>
                )}

                {/* 업로드·내보내기 버튼 */}
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer"
                    onClick={() => fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                    <div className="text-gray-400 text-xl mb-0.5">📤</div>
                    <div className="text-xs font-semibold text-gray-600">엑셀 업로드</div>
                    <div className="text-xs text-gray-400 mt-0.5">분석템플릿 v4 또는 호환 파일</div>
                  </div>
                  <div className="flex-1 border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer bg-blue-50/30"
                    onClick={handleExport}>
                    <div className="text-blue-400 text-xl mb-0.5">📥</div>
                    <div className="text-xs font-semibold text-blue-600">현재값 내보내기</div>
                    <div className="text-xs text-blue-400 mt-0.5">시뮬레이터 → 엑셀 Export</div>
                  </div>
                </div>

                {/* 4군 핵심값 요약 */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {G.map((r, i) => (
                    <div key={i} className="rounded-lg px-2.5 py-2 border" style={{ borderColor: CL[i] + "40", background: CL[i] + "08" }}>
                      <div className="text-xs font-bold mb-1" style={{ color: CL[i] }}>{SH[i]} <span className="font-normal text-gray-400">N={f(base[i].N)}</span></div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>수가(P) <b className="text-gray-900">{f(P[i])}</b></div>
                        <div>실수입 <b className="text-blue-700">{f(Math.round(r.AB_cur))}</b> → <b className="text-green-700">{f(Math.round(r.AB_new))}</b></div>
                        <div className="text-gray-400" style={{ fontSize: 10 }}>공단+본인부담, LC {LC}%p</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Level 2: 상세 편집 테이블 (추가 펼치기) */}
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setShowEditTable(!showEditTable)}
                    className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
                    <span>📋 환자군별 상세 편집 테이블</span>
                    <span className="text-gray-400">{showEditTable ? "▲ 접기" : "▼ 펼치기"}</span>
                  </button>
                  {showEditTable && (
                    <div className="mt-1">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" style={{ minWidth: 820 }}>
                          <thead>
                            {/* 그룹 헤더 */}
                            <tr>
                              <th className="px-2 py-1" />
                              <th colSpan={3} className="text-center text-xs font-bold text-purple-600 bg-purple-50 px-1 py-1 border-b border-purple-200" style={{ borderRadius: "6px 6px 0 0" }}>근거 (빅데이터)</th>
                              <th colSpan={2} className="text-center text-xs font-bold text-blue-600 bg-blue-50 px-1 py-1 border-b border-blue-200" style={{ borderRadius: "6px 6px 0 0" }}>판단 (정책)</th>
                              <th colSpan={3} className="text-center text-xs font-bold text-gray-500 bg-gray-50 px-1 py-1 border-b border-gray-200" style={{ borderRadius: "6px 6px 0 0" }}>실측 (편집)</th>
                              <th colSpan={3} className="text-center text-xs font-bold text-green-600 bg-green-50 px-1 py-1 border-b border-green-200" style={{ borderRadius: "6px 6px 0 0" }}>산출</th>
                            </tr>
                            <tr className="bg-gray-50 text-gray-500">
                              <th className="text-left px-2 py-1.5">환자군</th>
                              <th className="text-center px-1 py-1.5 bg-purple-50/50">기준의료비</th>
                              <th className="text-center px-1 py-1.5 bg-purple-50/50">의원비중</th>
                              <th className="text-center px-1 py-1.5 bg-purple-50/50">계산수가</th>
                              <th className="text-center px-1 py-1.5 bg-blue-50/50">수가(P)</th>
                              <th className="text-center px-1 py-1.5 bg-blue-50/50">조정폭</th>
                              <th className="text-center px-1 py-1.5">L비용</th>
                              <th className="text-center px-1 py-1.5">현재외래비</th>
                              <th className="text-center px-1 py-1.5">환자수</th>
                              <th className="text-right px-1 py-1.5 bg-green-50/50">A(공단)</th>
                              <th className="text-right px-1 py-1.5 bg-green-50/50">실수입</th>
                              <th className="text-right px-1 py-1.5 bg-green-50/50 text-green-600">실수입(LC후)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {G.map((r, i) => {
                              const calcP = Math.round(base[i].ref * base[i].cr);
                              const adj = P[i] - calcP;
                              return (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                                  {/* 근거 (읽기 전용) */}
                                  <td className="text-center px-1 bg-purple-50/20 text-gray-600">{f(base[i].ref)}</td>
                                  <td className="text-center px-1 bg-purple-50/20 text-gray-600">{(base[i].cr * 100).toFixed(1)}%</td>
                                  <td className="text-center px-1 bg-purple-50/20 font-semibold text-purple-700">{f(calcP)}</td>
                                  {/* 판단 (편집 가능) */}
                                  <td className="text-center px-1 bg-blue-50/20">
                                    <input type="text" value={f(P[i])} className="w-16 text-center text-xs font-bold border border-blue-300 rounded bg-blue-50 py-0.5 text-blue-800"
                                      onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v)) updP(i, v); }} />
                                  </td>
                                  <td className="text-center px-1 bg-blue-50/20">
                                    <span className={`text-xs font-semibold ${adj >= 0 ? "text-green-600" : "text-red-500"}`}>
                                      {adj >= 0 ? "+" : ""}{f(adj)}
                                    </span>
                                  </td>
                                  {/* 실측 (편집 가능) */}
                                  <td className="text-center px-1">
                                    <input type="text" value={(base[i].L * 100).toFixed(1)} className="w-12 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updBase(i, "L", v / 100); }} />%
                                  </td>
                                  <td className="text-center px-1">
                                    <input type="text" value={f(base[i].M1)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                      onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v)) updBase(i, "M1", v); }} />
                                  </td>
                                  <td className="text-center px-1">
                                    <input type="text" value={f(base[i].N)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                      onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v)) updBase(i, "N", v); }} />
                                  </td>
                                  {/* 산출 */}
                                  <td className="text-right px-1 bg-green-50/20 text-gray-600">{f(Math.round(r.A_cur))}</td>
                                  <td className="text-right px-1 bg-green-50/20 font-semibold text-blue-700">{f(Math.round(r.AB_cur))}</td>
                                  <td className="text-right px-1 bg-green-50/20 font-bold text-green-700">{f(Math.round(r.AB_new))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
                        <span><span className="inline-block w-3 h-3 bg-purple-50 border border-purple-200 rounded mr-1 align-middle"></span>근거 = 빅데이터 (읽기전용)</span>
                        <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-300 rounded mr-1 align-middle"></span>판단·실측 = 편집 가능</span>
                        <span>계산수가 = 기준의료비 × 의원비중 · A = P×(1−L) · 실수입 = A + M1×30%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* ═══ TAB 1: Track ═══ */}
        {tab === 1 && (<>
          <div className={card + " p-4"}>
            <h2 className="font-bold text-gray-900 mb-3 text-sm">Track 선택권</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { n: "Track A", d: "행위별", c: "#22c55e", bg: "#f0fdf4", v: 0 },
                { n: "Track B", d: "혼합형 50:50", c: "#3b82f6", bg: "#eff6ff", v: 50 },
                { n: "Track C", d: "환자군 기반", c: "#f97316", bg: "#fff7ed", v: 100 },
              ].map((t, i) => (
                <button key={i} onClick={() => setHccPct(t.v)}
                  className="rounded-lg p-2.5 sm:p-3 text-center cursor-pointer transition-all relative"
                  style={{ background: hccPct === t.v ? t.bg : "#fff", border: `2px solid ${hccPct === t.v ? t.c : "#e5e7eb"}` }}>
                  {hccPct === t.v && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: t.c }}>✓</div>}
                  <div className="text-xs sm:text-sm font-extrabold" style={{ color: t.c }}>{t.n}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.d}</div>
                </button>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-700">행위별 ↔ 환자군 혼합 비율</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green-600 shrink-0">행위별 {ffsPct}%</span>
                <input type="range" min={0} max={100} step={5} value={hccPct}
                  onChange={e => setHccPct(parseInt(e.target.value))}
                  className="flex-1 big-thumb"
                  style={{ '--thumb-bg': '#f97316', accentColor: "#f97316", background: `linear-gradient(to right, #22c55e 0%, #22c55e ${ffsPct}%, #f97316 ${ffsPct}%, #f97316 100%)` }} />
                <span className="text-xs font-bold text-orange-600 shrink-0">환자군 {hccPct}%</span>
              </div>
              <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
                {ffsPct > 0 && <div style={{ width: `${ffsPct}%`, background: "#22c55e" }} className="flex items-center justify-center transition-all">행위별</div>}
                {hccPct > 0 && <div style={{ width: `${hccPct}%`, background: "#f97316" }} className="flex items-center justify-center transition-all">환자군</div>}
              </div>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600 shrink-0">타원이용비중 변화율</span>
                <div className="flex-1 min-w-0">
                  <input type="range" min={-10} max={0} step={0.5} value={LC}
                    onChange={e => setLC(parseFloat(e.target.value))}
                    className="w-full big-thumb"
                    style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((LC + 10) / 10) * 100}%, #e5e7eb 0%)` }} />
                </div>
                <NumBox value={LC} onChange={v => setLC(Math.max(-10, Math.min(0, v)))} color="#7c3aed" suffix="%p" />
              </div>
            </div>
          </div>

          {/* Track KPI */}
          <div className="grid grid-cols-2 gap-2">
            <div className={card + " p-3"}>
              <div className="text-xs text-gray-500 mb-1">현 선택: 행위별 {ffsPct}% / 환자군 {hccPct}%</div>
              <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(tSchg)}</div>
              <div className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffE(T.tA, T.tS)}원</div>
              <div className="text-xs text-gray-400 mt-0.5">{fE(T.tA)}억 → {fE(T.tS)}억</div>
            </div>
            <div className="rounded-xl border p-3 shadow-sm" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
              <div className="text-xs text-gray-500 mb-1">공단 의원급 지출 변화</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-700">{pct(nhiNewChg, 2)}</div>
              <div className="text-xs sm:text-sm font-bold text-blue-600 mt-0.5">{diffE(T.nhi0, T.nhi2)}원</div>
              <div className="text-xs text-gray-400 mt-0.5">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
            </div>
          </div>

          {/* Track 차트 먼저 */}
          <div className={card + " p-3"}>
            <h3 className="text-xs font-bold text-gray-700 mb-2">Track별 환자군 1인당 실지불액</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={G.map((r, i) => ({
                name: SH[i], "Track A": Math.round(r.tA), "Track B": Math.round(r.tB), "Track C": Math.round(r.tC),
              }))} barGap={1} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => (v / 10000).toFixed(0) + "만"} tick={{ fontSize: 10 }} width={36} />
                <Tooltip formatter={v => f(v) + "원"} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Track A" fill="#86efac" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Track B" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Track C" fill="#fdba74" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Track 안내 문구 */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
            Track A(행위별)를 선택해도 현재와 차이가 없으며, Track B·C로 전환 시 타원이용비중 관리에 따라 추가 수입이 발생합니다.
            {hccPct > 0 && <> 현재 선택(행위별 {ffsPct}% : 환자군 {hccPct}%) 기준 <b className="text-green-700">{pct(tSchg)}</b> 수입 변화가 예상됩니다.</>}
            {" "}의원별 상황에 맞는 Track을 자율 선택할 수 있습니다.
          </div>

          {/* Track 테이블 아래 */}
          <div className={card + " overflow-hidden"}>
            <div className="px-3 py-2.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">
                Track별 1인당 실지불액 비교 <span className="text-gray-400 font-normal text-xs">(타원이용 {LC}%p)</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 460 }}>
                <thead><tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-2 py-2">환자군</th>
                  <th className="text-right px-2">Track A</th>
                  <th className="text-right px-2">Track B</th>
                  <th className="text-right px-2 font-bold">Track C</th>
                  <th className="text-right px-2 text-purple-600">선택</th>
                  <th className="text-right px-2">변화율</th>
                </tr></thead>
                <tbody>
                  {G.map((r, i) => {
                    const chg = r.tA > 0 ? (r.tS - r.tA) / r.tA : 0;
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-2 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                        <td className="text-right px-2">{f(Math.round(r.tA))}</td>
                        <td className="text-right px-2">{f(Math.round(r.tB))}</td>
                        <td className="text-right px-2 font-bold">{f(Math.round(r.tC))}</td>
                        <td className="text-right px-2 font-bold text-purple-700">{f(Math.round(r.tS))}</td>
                        <td className="text-right px-2 font-bold" style={{ color: chg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(chg)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-2 py-2 text-sm">총수입</td>
                    <td className="text-right px-2">{fE(T.tA)}억</td>
                    <td className="text-right px-2"><div>{fE(T.tB)}억</div><div className="text-green-600 font-normal text-xs">{pct(tBchg)}</div></td>
                    <td className="text-right px-2"><div>{fE(T.tC)}억</div><div className="text-green-600 font-normal text-xs">{pct(tCchg)}</div></td>
                    <td className="text-right px-2 text-purple-700">{fE(T.tS)}억</td>
                    <td className="text-right px-2" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(tSchg)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* ═══ TAB 2: Shared Saving (C축) ═══ */}
        {tab === 2 && (<>

          {/* 거시 총괄 — 항목별에서 연동 */}
          <div className={card + " p-4"}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-sm">Shared Saving 총괄</h2>
              <span className="text-xs text-gray-400">C] 성과기반 조정</span>
            </div>
            <div className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-1">
              건강보험 총진료비
              <input type="text" value={ssTotalCost}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setSsTotalCost(v); }}
                className="w-16 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-red-50 text-red-700" />
              <span>조원 기준</span>
            </div>
            {/* 거시 절감률 슬라이더 — 항목과 양방향 연동 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-700 shrink-0">총의료비 절감률</span>
              <input type="range" min={0} max={15} step={0.001} value={SS.derivedMacroPct}
                onChange={e => handleMacroSync(parseFloat(e.target.value))}
                className="flex-1 big-thumb"
                style={{ '--thumb-bg': '#dc2626', accentColor: "#dc2626", background: `linear-gradient(to right, #dc2626 ${Math.min(SS.derivedMacroPct / 15 * 100, 100)}%, #e5e7eb 0%)` }} />
              <input type="text" value={SS.derivedMacroPct.toFixed(3)}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleMacroSync(Math.max(0, Math.min(15, v))); }}
                className="w-20 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-white text-red-700" />
              <span className="text-xs text-gray-500">%</span>
            </div>
            {/* 총 절감액 KPI */}
            <div className="rounded-lg p-3 text-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <div className="text-xs text-gray-500 mb-1">총 절감액</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-red-600">
                {fSv(SS.itemTotal)}원
              </div>
            </div>
          </div>

          {/* 항목별 절감 시뮬레이션 */}
          <div className={card + " p-4"}>
            <h2 className="font-bold text-gray-900 text-sm mb-3">항목별 절감 시뮬레이션</h2>
            <div className="text-xs text-gray-400 mb-3">
              금액·절감률 수정 시 상단 총괄에 자동 반영
            </div>

            {/* 3개 항목 — 총액(조원) 편집 가능, 절감률 0~30% */}
            {[
              { label: "급성기 입원비", icon: "🏥", color: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
                base: ssAcute, setBase: setSsAcute, pctVal: ssAcutePct, setPct: setSsAcutePct, saving: SS.acuteSaving },
              { label: "응급의료비", icon: "🚑", color: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
                base: ssEmergency, setBase: setSsEmergency, pctVal: ssEmergencyPct, setPct: setSsEmergencyPct, saving: SS.emergencySaving },
              { label: "요양병원비", icon: "🏨", color: "#7c3aed", bg: "#f5f3ff", bd: "#ddd6fe",
                base: ssLtc, setBase: setSsLtc, pctVal: ssLtcPct, setPct: setSsLtcPct, saving: SS.ltcSaving },
            ].map((item, idx) => (
              <div key={idx} className="rounded-lg p-3 mb-2" style={{ background: item.bg, border: `1px solid ${item.bd}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold" style={{ color: item.color }}>{item.icon} {item.label}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-0.5">
                    <input type="text" value={item.base}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) item.setBase(v); }}
                      className="w-16 text-center text-xs font-bold border rounded px-1 py-0.5 bg-white"
                      style={{ borderColor: item.bd, color: item.color }} />조원
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold shrink-0" style={{ color: item.color }}>절감률</span>
                  <input type="range" min={0} max={30} step={0.01} value={item.pctVal}
                    onChange={e => item.setPct(parseFloat(e.target.value))}
                    className="flex-1 big-thumb"
                    style={{ '--thumb-bg': item.color, accentColor: item.color, background: `linear-gradient(to right, ${item.color} ${item.pctVal / 30 * 100}%, #e5e7eb 0%)` }} />
                  <input type="text" value={item.pctVal.toFixed(2)}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) item.setPct(Math.max(0, Math.min(30, v))); }}
                    className="w-14 text-center text-xs font-bold border rounded px-1 py-0.5 bg-white"
                    style={{ borderColor: item.bd, color: item.color }} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">절감액</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>
                    {item.saving >= 1e12 ? (item.saving/1e12).toFixed(2) + "조원" : fE(item.saving) + "억원"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 배분 비율: 좌=공단, 우=일차의료 */}
          <div className={card + " p-4"}>
            <h2 className="font-bold text-gray-900 text-sm mb-3">절감액 배분 비율</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { n: "공단 100%", v: 0, c: "#dc2626", bg: "#fef2f2" },
                { n: "50 : 50", v: 50, c: "#7c3aed", bg: "#f5f3ff" },
                { n: "일차의료 100%", v: 100, c: "#16a34a", bg: "#f0fdf4" },
              ].map((b, i) => (
                <button key={i} onClick={() => setSsClinicShare(b.v)}
                  className="rounded-lg p-2 text-center cursor-pointer transition-all relative"
                  style={{ background: ssClinicShare === b.v ? b.bg : "#fff", border: `2px solid ${ssClinicShare === b.v ? b.c : "#e5e7eb"}` }}>
                  {ssClinicShare === b.v && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: b.c }}>✓</div>}
                  <div className="text-xs font-bold" style={{ color: b.c }}>{b.n}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-red-600 shrink-0">공단 {100 - ssClinicShare}%</span>
              <input type="range" min={0} max={100} step={5} value={ssClinicShare}
                onChange={e => setSsClinicShare(parseInt(e.target.value))}
                className="flex-1 big-thumb"
                style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${100 - ssClinicShare}%, #16a34a ${100 - ssClinicShare}%, #16a34a 100%)` }} />
              <span className="text-xs font-bold text-green-600 shrink-0">일차의료 {ssClinicShare}%</span>
            </div>
            <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
              {ssClinicShare < 100 && <div style={{ width: `${100 - ssClinicShare}%`, background: "#dc2626" }} className="flex items-center justify-center transition-all">{(100 - ssClinicShare) > 15 ? "공단" : ""}</div>}
              {ssClinicShare > 0 && <div style={{ width: `${ssClinicShare}%`, background: "#16a34a" }} className="flex items-center justify-center transition-all">{ssClinicShare > 15 ? "일차의료" : ""}</div>}
            </div>
          </div>

          {/* 배분 결과 파이 차트 — 좌:공단 / 우:일차의료 */}
          <div className={card + " p-3"}>
            <h3 className="text-xs font-bold text-gray-700 mb-1 text-center">절감액 배분</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={[
                    { name: "공단 적립", value: Math.round(SS.nhisFromItem / 1e8 * 10) / 10, raw: SS.nhisFromItem, color: "#ef4444" },
                    { name: "일차의료 지원", value: Math.round(SS.clinicFromItem / 1e8 * 10) / 10, raw: SS.clinicFromItem, color: "#22c55e" },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={85}
                  startAngle={90} endAngle={450}
                  paddingAngle={3} dataKey="value"
                  label={({ name, raw }) => `${name} ${fSv(raw || 0)}원`}
                  labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                >
                  {[
                    { value: Math.round(SS.nhisFromItem / 1e8 * 10) / 10, color: "#ef4444" },
                    { value: Math.round(SS.clinicFromItem / 1e8 * 10) / 10, color: "#22c55e" },
                  ].filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={v => v >= 10000 ? (v/10000).toFixed(2) + "조원" : v + "억원"} contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs mt-1">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ef4444" }}></span>공단 적립 <b className="text-red-600">{fSv(SS.nhisFromItem)}원</b></span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22c55e" }}></span>일차의료 지원 <b className="text-green-600">{fSv(SS.clinicFromItem)}원</b></span>
              <span className="text-gray-400">합계 <b>{fSv(SS.itemTotal)}원</b></span>
            </div>
          </div>

          {/* 3자 Win-Win-Win (C축 관점) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
                txt: "불필요한 입원·응급 감소\n의료의 질 향상\n주치의 연속 진료" },
              { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
                txt: `B]축 수입 + C]축 인센티브\n절감 성과의 ${ssClinicShare}% 배분\n${fSv(SS.clinicFromItem)}원 추가` },
              { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
                txt: `절감분의 ${100 - ssClinicShare}% 환수\n${fSv(SS.nhisFromItem)}원 절감\n의료비 예측가능성 향상` },
            ].map((w, i) => (
              <div key={i} className="rounded-xl px-3 py-2.5 text-center" style={{ background: w.bg, border: `1px solid ${w.bd}` }}>
                <div className="text-sm font-bold mb-1" style={{ color: w.c }}>{w.t}</div>
                <div className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{w.txt}</div>
              </div>
            ))}
          </div>

          {/* 안내 문구 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <span className="text-amber-500 shrink-0 text-sm">⚠</span>
            <span className="text-xs text-amber-800 leading-relaxed">
              기본값은 2023 건강보험통계연보 전국 평균 기준이며 자유롭게 수정 가능합니다.
              B]축(환자군 수가)과 독립된 C]축(성과기반 조정) 시뮬레이션입니다.
            </span>
          </div>
        </>)}
      </div>

      {/* FOOTER */}
      <div className="text-center py-3 px-3 text-xs text-gray-400 border-t border-gray-200 bg-white mt-4">
        환자군(HCC) 기반 일차의료 지불모형 시뮬레이터 v5.0 · 일산병원 일차의료개발센터 · © 2026
      </div>
    </div>
  );
}
