import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { FCard, TCard, ClinicCountCard } from "./RegistrationPanel";
import { SH, CL, INIT_REG_DIST, OFFICIAL_BASELINE_META } from "../constants";
import presets from "../data/presets/index";
import { f, fE, pct, diffAuto, fMan, diffMan, calcPB, PBtoB } from "../utils";

const TRACK_LABELS = { 0: "Track A 유지", 50: "Track B 혼합", 100: "Track C 환자군" };

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({
  mode = "policy", setMode,
  state, set, updP, updBase, updF, setFAll, setPfRule, resetF, resetP, resetReg,
  updL1, setL1All, resetL1, setL2, resetL2,
  updRegDist, setRegDistAll, scaleRegDist, reset, loadPreset,
  G, T, decomp, performance: perfMemo, tracks,
  incChg, nhiChg,
  fileRef, handleFile, handleExport, handleCommitBaseline,
  reg, regRatios,
}) {
  const { base, P, L1, L2, showDetail, uploadBanner, F_g, M_clinics } = state;
  const M = Math.max(1, M_clinics);
  const [showFormula, setShowFormula] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(mode === "policy");
  // v6.10.0: 균형추 controlled accordion 제거. 고급 패널만 유지.
  const [showAdvanced, setShowAdvanced] = useState(false);

  // v6.9.3: PB = B × (1 − L1) — UI 표시값. 슬라이더 onChange는 PBtoB로 B 역산.
  const PB = calcPB(P, L1);

  // L2 기본값 · 표시값 (null이면 L1 가중평균)
  const L2_display = L2 ?? perfMemo.L1avg;

  // 의원당 수입 절대값 (L2 반응 · 성과급 포함)
  const perClinicBaseline = decomp.baselineIncome / M;
  const perClinicAfter = decomp.afterIncome / M;
  const perClinicPanel = decomp.panelEffect / M;
  const perClinicModel = decomp.modelEffect / M;
  const perClinicPerf = decomp.performanceEffect / M;   // L2 성과급 (현재 선택 Track 반영)
  const perClinicNet = decomp.netChange / M;

  // v6.9.3: 의원 공단지급분 변화 KPI (정책 모드) — modelEffect의 PB drift 제거, PF 가산만 노출.
  // pfEffect = Σ_g n_reg_g × PF_g (현재 PF로 계산되는 절대 가산 효과)
  // 설계 의도: PB는 L1을 흡수해 구조적으로 중립이어야 함. 데이터 캘리브레이션 drift는 KPI에서 숨김.
  const pfEffect = G.reduce((s, g, i) => s + g.n_reg * (F_g[i] ?? 0), 0);
  const perClinicPF = pfEffect / M;
  const govNetChange = decomp.panelEffect + pfEffect + decomp.performanceEffect; // 공단지급분 관점 순 변화
  const perClinicGovNet = govNetChange / M;
  const govNetChgPct = decomp.baselineIncome > 0 ? (govNetChange / decomp.baselineIncome) * 100 : 0;
  const govAfterIncome = decomp.baselineIncome + govNetChange;
  const perClinicGovAfter = govAfterIncome / M;

  // v6.9.3: 정책 모드 첫 화면 — P = PB + PF 단순합 노출.
  //  · 상단 공식 박스 → ① PB 카드 (연회색·데이터 기반) → ② PF 카드 (연파랑·정책 협상)
  //    └ ②에 균형추 controlled accordion 종속 (기본 접힘)
  //  · B(환자군 기준의료비) 직접 조정 + L1 환자군별 차등은 별도 고급 패널 아코디언으로 후퇴.
  //  · 의원 모드는 변경 없음.

  const formulaBox = (
    <div className="rounded-xl border-2 shadow-sm px-4 py-3 sm:px-5 sm:py-4"
      style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)", borderColor: "#c7d2fe" }}>
      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <span className="text-sm sm:text-base font-semibold text-slate-700">일차의료수가</span>
        <span className="text-xl sm:text-2xl font-extrabold text-indigo-700">P</span>
        <span className="text-lg sm:text-xl text-slate-400 font-bold">=</span>
        <span className="text-xl sm:text-2xl font-extrabold text-slate-500">PB</span>
        <span className="text-lg sm:text-xl text-slate-400 font-bold">+</span>
        <span className="text-xl sm:text-2xl font-extrabold text-blue-600">PF</span>
      </div>
      <div className="mt-2 pt-2 border-t border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="font-bold text-slate-600 px-2 py-0.5 rounded bg-white border border-slate-200">PB</span>
          <span className="font-semibold text-slate-700">일차의료 기본수가</span>
          <span className="text-slate-500">— 환자군 위험도 반영</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="font-bold text-blue-700 px-2 py-0.5 rounded bg-white border border-blue-200">PF</span>
          <span className="font-semibold text-slate-700">일차의료 기능보정</span>
          <span className="text-slate-500">— 등록관리·포괄진료 가치</span>
        </div>
      </div>
      <div className="mt-1.5 text-center text-[10px] text-slate-500">
        환자군별로 산정되는 단일 연간 수가. 공단지급 = P (선지급).
      </div>
    </div>
  );

  // ① PB 카드 (연회색) — v6.11.0: 배지 "환자군 위험도(HCC) 기반" · 안내문 삭제
  const PBcard = (
    <div className="rounded-xl border shadow-sm p-4"
      style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
          <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-slate-200 text-slate-700 text-xs font-extrabold">1</span>
          일차의료 기본수가 (PB)
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">환자군 위험도(HCC) 기반</span>
        </h2>
        <button onClick={resetP}
          className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
          ↩ 초기화
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SH.map((g, i) => {
          const PB_val = PB[i];
          const L1_g = L1?.[i] ?? 0.7;
          return (
            <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-slate-200">
              <span className="text-[11px] font-bold shrink-0" style={{ color: CL[i] }}>{g}</span>
              <NumBox value={PB_val} onChange={v => {
                const newB = Math.max(50000, Math.min(2000000, PBtoB(Math.max(0, Math.round(v)), L1_g)));
                updP(i, newB);
              }} color={CL[i]} suffix="원" />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ② PF 카드 (연파랑) — v6.11.0: 배지 2종(일차의료 기능강화·환자등록관리) · 설명문 삭제
  const PFcard = (
    <div className="rounded-xl border shadow-sm p-4"
      style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#bfdbfe" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2 flex-wrap">
          <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-blue-200 text-blue-800 text-xs font-extrabold">2</span>
          일차의료 기능보정 (PF)
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">일차의료 기능강화</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">환자등록관리</span>
        </h2>
      </div>
      <FCard state={state} setFAll={setFAll} updF={updF} setPfRule={setPfRule} resetF={resetF} bare />
    </div>
  );

  // 고급 패널 — v6.11.0: 부제·B 안내문·amber 박스 삭제 · L1 헤더 "평균 타원이용비중(L1)" · 버튼 통합 (RESET_L1이 base.L 복귀)
  const advancedPanel = (
    <div className="rounded-xl border border-dashed shadow-sm overflow-hidden"
      style={{ background: "#fafafa", borderColor: "#cbd5e1" }}>
      <button onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-100 transition text-left">
        <span className="text-slate-400 text-xs">{showAdvanced ? "▲" : "▼"}</span>
        <span className="text-sm font-semibold text-slate-700">⚙️ 고급 설정</span>
      </button>
      {showAdvanced && (
        <div className="px-4 pb-4 pt-1 border-t border-dashed border-slate-300 space-y-4">
          {/* B 직접 조정 */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-700 flex items-baseline gap-2 flex-wrap">
                환자군 기준의료비 (B)
                <span className="text-[11px] font-normal text-slate-400">B = 환자군 평균 의료비(A) × 의원급 외래 비중(CR)</span>
              </div>
              <button onClick={resetP}
                className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
                ↩ 초기화
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SH.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border border-slate-200">
                  <span className="text-[11px] font-bold shrink-0" style={{ color: CL[i] }}>{g}</span>
                  <NumBox value={P[i]} onChange={v => updP(i, Math.max(0, Math.round(v)))} color={CL[i]} suffix="원" />
                </div>
              ))}
            </div>
          </div>

          {/* L1 환자군별 차등 — v6.11.0: 헤더 "평균 타원이용비중(L1)", 단일 초기화 버튼 (base.L 복귀) */}
          <div className="rounded-lg border-2 px-3 py-2.5"
            style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)", borderColor: "#5eead4" }}>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="text-sm font-bold" style={{ color: "#0f766e" }}>
                평균 타원이용비중 (L1)
              </h3>
              <button onClick={resetL1}
                className="text-xs text-teal-700 hover:text-red-600 border border-teal-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
                ↩ 초기화
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SH.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1.5 border border-teal-200">
                  <span className="text-[11px] font-bold shrink-0" style={{ color: CL[i] }}>{g}</span>
                  <input type="number" min={0} max={1} step={0.01}
                    value={(L1?.[i] ?? 0.7).toFixed(2)}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) updL1(i, v);
                    }}
                    className="w-full text-sm text-center border border-teal-300 rounded px-1 py-0.5 tabular-nums"
                    style={{ color: "#0f766e" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (<>
    {/* v7.0: 관점 선택 — 헤더에서 이동, 수가 시뮬레이션 탭 전용 */}
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-gray-700 shrink-0">관점 선택</span>
      <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5 border border-gray-200 bg-white">
        {[
          { id: "policy", label: "🏛 정책 모드", activeBg: "#1E3A8A" },
          { id: "clinic", label: "🏥 의원 모드", activeBg: "#10B981" },
        ].map(o => {
          const active = mode === o.id;
          return (
            <button key={o.id} type="button" onClick={() => setMode?.(o.id)}
              aria-pressed={active}
              className="text-xs sm:text-sm font-semibold px-3 py-1 rounded-md transition"
              style={{
                background: active ? o.activeBg : "transparent",
                color: active ? "#fff" : "#475569",
                fontWeight: active ? 700 : 600,
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>

    {/* v6.11.0: 정책 모드 — PB 카드 → PF 카드 → TCard → C 슬라이더 → KPI → 차트 → 고급 설정 → 수가 산출 구조.
        공식 박스 삭제, advanced panel 위치는 하단(formula box 위)으로 이동. */}
    {mode === "policy" && PBcard}
    {mode === "policy" && PFcard}

    {/* ④ 일차의료수가 — 의원 모드에서는 "환자군별 공단지급 수가" 라벨, 공식·L1 개별 표시 숨김 */}
    <TCard state={state} G={G} mode={mode} />

    {/* ⑤ 타원이용비중 (L2) 변화율 — 0%p=L1, 음수=개선 → 성과급 (v6.10.0: 범위 -25~0%p, 5%p 간격 표기) */}
    {(() => {
      const L1avg = perfMemo.L1avg;
      // v6.11.0: C = 1 − L2 (포괄관리 지표). 슬라이더는 양수 방향 (포괄관리 개선).
      // 내부 상태는 L1·L2 그대로. C는 표시 파생.
      //   기준 C0 = 1 − L1 (환자군 구조상 기대 집중도)
      //   현재 C  = 1 − L2_display
      //   ΔC = C − C0 = L1 − L2_display (양수일 때만 가산 발생)
      //   슬라이더 0 ~ +25%p (ΔC, 우측 갈수록 개선)
      const C0 = 1 - L1avg;
      const Cnow = 1 - L2_display;
      const cDelta = Math.max(0, Math.min(25, (Cnow - C0) * 100));
      const sliderBg = `linear-gradient(to right, #7c3aed ${(cDelta / 25) * 100}%, #e5e7eb 0%)`;
      const setCdelta = (dPct) => {
        const d = Math.max(0, Math.min(25, dPct));
        setL2(Math.max(0, Math.min(1, L1avg - d / 100)));    // L2 = L1 − ΔC (절대값 유지)
      };
      return (
        <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
          <div className="flex items-center mb-2 gap-3 flex-wrap">
            <div className="flex flex-col">
              <h2 className="font-bold text-base leading-tight" style={{ color: "#6d28d9" }}>포괄관리 지표 (C)</h2>
              <div className="text-[11px] text-purple-700/70 leading-tight mt-0.5">등록의원의 외래 진료비 비중 (C = 1 − L2)</div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-purple-600 font-semibold">기존</span>
              <span className="text-sm font-bold text-purple-700/70">{(C0 * 100).toFixed(1)}%</span>
              <span className="text-purple-400">→</span>
              <span className="text-xs text-purple-600 font-semibold">후</span>
              <span className="text-lg font-extrabold text-purple-900">{(Cnow * 100).toFixed(1)}%</span>
              <NumBox value={parseFloat(cDelta.toFixed(1))} onChange={setCdelta} color="#7c3aed" suffix="%p" />
            </div>
            <button onClick={resetL2}
              className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
              ↩ 초기화
            </button>
          </div>
          <input type="range" min={0} max={25} step={0.5} value={cDelta}
            onChange={e => setCdelta(parseFloat(e.target.value))}
            aria-label="포괄관리 지표 C 슬라이더 (ΔC, %p)"
            className="w-full big-thumb"
            style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: sliderBg }} />
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
            <span>0%p</span><span>+5%p</span><span>+10%p</span><span>+15%p</span><span>+20%p</span><span>+25%p</span>
          </div>
        </div>
      );
    })()}

    {/* ⑥ KPI 2카드 — v6.11.0: 양 모드 모두 변화액 단독 hero (분해/% 모두 삭제) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-2xl border-2 shadow-md p-5" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", borderColor: "#86efac" }}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">의원 수입 변화</span>
          {mode === "clinic" && (
            <span className="text-[10px] text-emerald-700/70 font-semibold">
              현재 Track: <b className="text-emerald-800">{state.hccPct === 0 ? "A (FFS)" : state.hccPct === 100 ? "C (환자군)" : `B (혼합 ${state.hccPct}%)`}</b>
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl px-4 py-5 text-center shadow-sm border border-emerald-100">
          <div className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-tight"
            style={{ color: decomp.netChange >= 0 ? "#059669" : "#dc2626" }}>
            {diffMan(perClinicNet)}<span className="text-base text-gray-500 font-bold"> / 년</span>
          </div>
          <div className="text-[11px] text-gray-500 font-normal mt-1">참여 전 대비 의원당 수입 변화액</div>
        </div>
        <div className="mt-2 pt-2 border-t border-dashed border-emerald-200/70 text-[10px] text-emerald-700/70 text-center leading-relaxed">
          ※ 본 사업 참여로 발생하는 수입 변화분만 표시. 의원 전체 수입(비급여·기타) 영향은 별도.
        </div>
      </div>

      <div className="rounded-2xl border-2 shadow-md p-5" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-center mb-3 gap-2">
          <span className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">공단 지출 변화</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-5 text-center shadow-sm border border-blue-100">
          <div className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-tight text-blue-700">
            {diffAuto(T.nhi0, T.nhi + perfMemo.perf_blended)}<span className="text-base text-gray-500 font-bold"> / 년</span>
          </div>
          <div className="text-[11px] text-gray-500 font-normal mt-1">사업 전체 공단 지출 변화액</div>
        </div>
      </div>
    </div>

    {/* v6.11.0: 참여 의원 수 — 정책 모드에서만 노출 (의원 모드는 의원 1개 시뮬 관점이라 불필요) */}
    {mode === "policy" && <ClinicCountCard state={state} set={set} />}

    {/* ⑨ 차트 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">의원 수입 비교 (환자군별, 억원 · 선지급)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={G.map((r, i) => ({ name: SH[i], "기존": r.inc0 / 1e8, "참여 후": r.inc / 1e8 }))} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(0) + "억"} tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="기존" fill="#d1d5db" radius={[3, 3, 0, 0]} />
            <Bar dataKey="참여 후" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">공단 지출 비교 (억원)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { name: "기존", v: T.nhi0 / 1e8 },
            { name: "참여 후", v: T.nhi / 1e8 },
          ]} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10 }} width={40} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]}>
              <Cell fill="#d1d5db" /><Cell fill="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* v7.0: 의원 모드 Track 비교 요약 박스 삭제 (Track 탭에 동일 정보, 중복 제거) */}

    {/* ⑩ Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "주치의 환자관리\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `환자군 기반 적절 보상\n의원당 ${diffMan(perClinicNet)}\n포괄관리성과 ${diffMan(perClinicPerf)}/년` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `지출 ${diffAuto(T.nhi0, T.nhi + perfMemo.perf_blended)}\n예측 가능성 향상\n*Shared Saving 효과 별도` },
    ]} />

    {/* v6.11.0: 고급 설정 — 위치를 수가 산출 구조 위로 이동 (정책 모드 전용) */}
    {mode === "policy" && advancedPanel}

    {/* ⑪ 공식 구조 — v6.8.1: 의원 모드에서는 숨김 (정책 모드 전용) */}
    {mode === "policy" && (
    <div className={card + " overflow-hidden"}>
      <button onClick={() => setShowFormula(v => !v)}
        className="w-full flex items-center justify-start gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <span className="text-gray-400 text-xs">{showFormula ? "▲" : "▼"}</span>
        <span>📐 수가 산출 구조 (v6.9.3 PB·PF 단순합)</span>
      </button>
      {showFormula && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700 leading-relaxed font-mono space-y-1">
            <div><b className="text-indigo-700">P_g = PB_g + PF_g</b>  (환자군별 선지급)</div>
            <div className="text-gray-500 pl-2">where  PB_g = B_g × (1 − L1_g) · PF_g = F_g</div>
            <div><b className="text-indigo-700">공단지급 = P</b>  (단일화)</div>
            <div><b className="text-indigo-700">본인부담 = M1 × 30%</b>  (고정)</div>
            <div className="pt-1 mt-1 border-t border-gray-300">
              <b className="text-amber-700">포괄관리 지표 C = 1 − L2 · 기대 집중도 = 1 − L1</b>
            </div>
            <div><b className="text-amber-700">포괄관리성과 = max(0, C − (1 − L1)) = max(0, L1 − L2)</b></div>
            <div><b className="text-amber-700">지급액 = Σ 포괄관리성과 × B_g × n_reg_g × TrackMul</b></div>
            <div className="text-gray-500">n_reg_g = 의원당 환자군별 등록환자수 · TrackMul: A=0 / B=0.5 / C=1.0</div>
            <div className="text-gray-500">no-downside: C ≤ (1−L1)이면 가산 0 (환수 없음) · 의원 100% 환원 (공유율 없음)</div>
          </div>
        </div>
      )}
    </div>
    )}

    {/* ⑫ 데이터 관리 — v7.0: 정책 모드 전용 (의원 모드 미표시) */}
    {mode === "policy" && (
    <div className={card + " overflow-hidden"}>
      <button onClick={() => set("showDetail", !showDetail)}
        className="w-full flex items-center justify-start gap-2 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <span className="text-gray-400 text-xs">{showDetail ? "▲" : "▼"}</span>
        <span>⚙️ 데이터 관리</span>
      </button>
      {showDetail && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {uploadBanner && (
            <div className={`mt-2 mb-3 rounded-lg px-3 py-2.5 text-xs ${uploadBanner.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${uploadBanner.success ? "text-green-700" : "text-red-700"}`}>
                  {uploadBanner.success ? "✅ " : "❌ "}{uploadBanner.msg}
                </span>
                <button onClick={() => set("uploadBanner", null)} className="text-gray-400 hover:text-gray-600 text-sm ml-2">✕</button>
              </div>
              {uploadBanner.details && (
                <pre className={`mt-1.5 text-xs leading-relaxed whitespace-pre-wrap ${uploadBanner.success ? "text-green-600" : "text-red-600"}`}>
                  {uploadBanner.details}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              <div className="text-gray-400 text-xl mb-0.5">📤</div>
              <div className="text-xs font-semibold text-gray-600">엑셀 업로드</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer bg-blue-50/30"
              onClick={handleExport}>
              <div className="text-blue-400 text-xl mb-0.5">📥</div>
              <div className="text-xs font-semibold text-blue-600">내보내기</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-amber-200 rounded-lg p-3 text-center hover:border-amber-400 transition cursor-pointer bg-amber-50/30"
              onClick={() => { if (confirm(`파일럿 데이터(10개 의원, 69,604명, 2023)로 전환합니다. 진행할까요?`)) loadPreset(presets[0]); }}>
              <div className="text-amber-500 text-xl mb-0.5">↩</div>
              <div className="text-xs font-semibold text-amber-700">파일럿 로드</div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="text-xs text-gray-500">
                현재 공식 baseline:
                {OFFICIAL_BASELINE_META.source === "official_baseline.json" ? (
                  <span className="ml-1 text-gray-700">
                    <b>v{OFFICIAL_BASELINE_META.version}</b>
                    {OFFICIAL_BASELINE_META.updated_at ? ` · ${OFFICIAL_BASELINE_META.updated_at}` : ""}
                    {OFFICIAL_BASELINE_META.updated_by ? ` · ${OFFICIAL_BASELINE_META.updated_by}` : ""}
                  </span>
                ) : (
                  <span className="ml-1 text-amber-700">fallback (official_baseline.json 없음/불완전)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (!handleCommitBaseline) return;
                const SHL = ["1군", "2군", "3군", "4군"];
                const fmt = v => Math.round(v).toLocaleString("ko-KR");
                const preview = state.base.map((b, i) =>
                  `${SHL[i]}: N=${fmt(b.N)}, M1=${fmt(b.M1)}, L=${b.L.toFixed(4)}, B=${fmt(state.P[i])}`).join("\n");
                const sumN = state.base.reduce((s, b) => s + b.N, 0);
                const meta = `의원 수: ${fmt(state.M_clinics)}기관 · 합계 N: ${fmt(sumN)}명 · 라벨: "${state.dataLabel}"`;
                const msg = `⚠️ 현재 값을 모든 사용자의 공식 baseline으로 등록합니다.\n\n${meta}\n\n${preview}\n\nVercel 재배포 후 (약 1~2분) 모든 사용자의 디폴트가 갱신됩니다.\n환자군 패널 "초기화" 버튼이 위 의원 수·N으로 복귀합니다.\n진행하시겠습니까?`;
                if (confirm(msg)) handleCommitBaseline();
              }}
              className="w-full border-2 border-dashed border-rose-300 rounded-lg py-2.5 text-center hover:border-rose-500 hover:bg-rose-50 transition cursor-pointer bg-rose-50/30">
              <span className="text-rose-500 text-base mr-1.5">🏛️</span>
              <span className="text-xs font-bold text-rose-700">현재 값을 공식 baseline으로 등록 (전역 · 관리자)</span>
            </button>
            <div className="mt-1 text-[10px] text-gray-400 leading-relaxed">
              ※ 이 버튼을 누르면 <code>src/data/presets/official_baseline.json</code>이 GitHub에 커밋되고 Vercel이 재배포됩니다.
              슬라이더 조정·엑셀 업로드만으로는 다른 세션에 영향 없음. 버튼 클릭 시에만 전역 디폴트로 고정.
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 py-1.5 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-600">📋 환자군별 상세 편집 테이블</span>
                <span className="text-[10px] font-normal text-gray-400">입력 셀: N · M1 · L · 등록 (B·F·L1은 정책 슬라이더)</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-gray-500">등록 분포 프리셋:</span>
                {[
                  { label: "부록", v: INIT_REG_DIST },
                  { label: "균등", v: [250, 250, 250, 250] },
                  { label: "건강편중", v: [400, 400, 150, 50] },
                  { label: "고위험편중", v: [50, 350, 300, 300] },
                ].map(p => {
                  const active = state.regDist.every((v, i) => v === p.v[i]);
                  return (
                    <button key={p.label} onClick={() => setRegDistAll(p.v)}
                      className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                      style={active ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 780 }}>
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-2 py-1.5">환자군</th>
                    <th className="text-center px-1">N</th>
                    <th className="text-center px-1">M1</th>
                    <th className="text-center px-1">L (실측)</th>
                    <th className="text-center px-1">B</th>
                    <th className="text-center px-1">L1</th>
                    <th className="text-center px-1">PF</th>
                    <th className="text-center px-1 text-indigo-700">P = PB + PF</th>
                    <th className="text-center px-1 text-blue-700">등록</th>
                  </tr>
                </thead>
                <tbody>
                  {G.map((r, i) => {
                    const Fi = F_g[i] ?? 0;
                    const L1_i = L1?.[i] ?? 0.7;
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                        <td className="text-center px-1">
                          <input type="text" value={f(base[i].N)} className="w-20 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) updBase(i, "N", v); }} />
                        </td>
                        <td className="text-center px-1">
                          <input type="text" value={f(base[i].M1)} className="w-20 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updBase(i, "M1", v); }} />
                        </td>
                        <td className="text-center px-1">
                          <input type="text" value={base[i].L.toFixed(4)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 1) updBase(i, "L", v); }} />
                        </td>
                        <td className="text-center px-1 text-gray-700">{f(P[i])}</td>
                        <td className="text-center px-1 text-teal-700 tabular-nums">{L1_i.toFixed(2)}</td>
                        <td className="text-center px-1 text-purple-600 font-semibold">{f(Fi)}</td>
                        <td className="text-center px-1 font-bold text-indigo-700 tabular-nums">{f(Math.round(P[i] * (1 - L1_i) + Fi))}</td>
                        <td className="text-center px-1">
                          <input type="text" value={f(state.regDist[i])} className="w-14 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5 text-blue-700"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updRegDist(i, v); }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 text-xs text-gray-500 leading-relaxed">
                ※ N·M1·L·등록만 직접 편집. PB(=B(1−L1))·PF·B·L1은 위쪽 정책 슬라이더 또는 고급 패널에서 설정. L1 시드는 &quot;엑셀 L → L1 복사&quot; 버튼.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
  </>);
})
