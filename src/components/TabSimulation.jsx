import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { FCard, TCard, RegScaleCard } from "./RegistrationPanel";
import FBalanceCorrection from "./FBalanceCorrection";
import { SH, CL, INIT_REG_DIST, OFFICIAL_BASELINE_META } from "../constants";
import presets from "../data/presets/index";
import { f, fE, pct, diffAuto, fMan, diffMan, calcPB, PBtoB } from "../utils";

const TRACK_LABELS = { 0: "Track A 유지", 50: "Track B 혼합", 100: "Track C 환자군" };

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({
  mode = "policy",
  state, set, updP, updBase, updF, setFAll, resetF, resetP, resetReg,
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
  // v6.9.3: 균형추 도구 + 고급 패널 controlled accordion (둘 다 기본 접힘)
  const [showBalance, setShowBalance] = useState(false);
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

  // ① PB 카드 (연회색 · 데이터 기반 배지)
  const PBcard = (
    <div className="rounded-xl border shadow-sm p-4"
      style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
          <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-slate-200 text-slate-700 text-xs font-extrabold">1</span>
          일차의료 기본수가 (PB)
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">데이터 기반</span>
        </h2>
        <button onClick={resetP}
          className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
          ↩ 초기화
        </button>
      </div>
      <div className="text-[11px] text-slate-500 mb-3 px-2 py-1 bg-white rounded font-mono inline-block">
        PB = 환자군 기준의료비(B) × (1 − L1)
        <span className="text-slate-400 ml-1">· L1은 디폴트 0.70 (고급 패널에서 조정)</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {SH.map((g, i) => {
          const PB_val = PB[i];
          const L1_g = L1?.[i] ?? 0.7;
          // 슬라이더 range: 현재 PB의 ±50% (B 기반 절대 clamp는 PBtoB에서 적용)
          const sliderMin = Math.max(1000, Math.round(PB_val * 0.5));
          const sliderMax = Math.max(sliderMin + 1000, Math.round(PB_val * 1.5));
          const valuePct = sliderMax > sliderMin ? ((PB_val - sliderMin) / (sliderMax - sliderMin)) * 100 : 0;
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold" style={{ color: CL[i] }}>{g}</span>
                <NumBox value={PB_val} onChange={v => {
                  const newB = Math.max(50000, Math.min(2000000, PBtoB(Math.max(0, Math.round(v)), L1_g)));
                  updP(i, newB);
                }} color={CL[i]} suffix="원" />
              </div>
              <input type="range" min={sliderMin} max={sliderMax} step={1000} value={PB_val}
                onChange={e => {
                  const newPB = parseFloat(e.target.value);
                  const newB = Math.max(50000, Math.min(2000000, PBtoB(newPB, L1_g)));
                  updP(i, newB);
                }}
                aria-label={`${g} 일차의료 기본수가 PB 슬라이더`}
                className="w-full big-thumb"
                style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${valuePct}%, #e5e7eb 0%)` }} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ② PF 카드 (연파랑 · 정책 협상 배지) + 균형추 종속 아코디언
  const PFcard = (
    <div className="rounded-xl border shadow-sm p-4"
      style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#bfdbfe" }}>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
          <span className="inline-grid place-items-center w-6 h-6 rounded-md bg-blue-200 text-blue-800 text-xs font-extrabold">2</span>
          일차의료 기능보정 (PF)
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">정책 협상</span>
        </h2>
      </div>
      <div className="text-[11px] text-slate-600 mb-3 leading-relaxed">
        등록관리 업무 대가 + 저평가 일차의료 본연 기능 보정. 환자군별 차등 가능. 코디네이터·간호사·영양사 등 일차의료 기능 강화 자원으로 활용.
      </div>
      {/* 기존 FCard 재사용 — bare로 카드 외피만 제거. 라벨은 FCard 내에서 PF로 표시. */}
      <FCard state={state} setFAll={setFAll} updF={updF} resetF={resetF} bare />

      {/* 균형추 controlled accordion — 기본 접힘 */}
      <div className="mt-3 pt-3 border-t border-dashed border-blue-300/60">
        <button onClick={() => setShowBalance(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 border border-blue-200 hover:bg-white transition text-left">
          <span className="text-blue-400 text-xs">{showBalance ? "▲" : "▶"}</span>
          <span className="text-base">⚖️</span>
          <span className="text-sm font-bold text-blue-800">PF 자동 산출 도구</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">— baseline 대비 공단 지출 영향에서 PF 4군 절대값을 자동 산출</span>
        </button>
        {showBalance && (
          <div className="mt-2">
            <FBalanceCorrection
              state={state} set={set} G={G} T={T} performance={perfMemo} setFAll={setFAll} />
          </div>
        )}
      </div>
    </div>
  );

  // 고급 패널 — B 직접 조정 + L1 환자군별 차등
  const advancedPanel = (
    <div className="rounded-xl border border-dashed shadow-sm overflow-hidden"
      style={{ background: "#fafafa", borderColor: "#cbd5e1" }}>
      <button onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-100 transition text-left">
        <span className="text-slate-400 text-xs">{showAdvanced ? "▲" : "▼"}</span>
        <span className="text-sm font-semibold text-slate-700">⚙️ 고급 설정</span>
        <span className="text-[11px] text-slate-500 hidden sm:inline">— 환자군 기준의료비(B) · 타원이용비중(L1) 직접 조정</span>
      </button>
      {showAdvanced && (
        <div className="px-4 pb-4 pt-1 border-t border-dashed border-slate-300 space-y-4">
          {/* B 직접 조정 — 슬라이더 없이 NumBox만 (HCC×CR 산출값, 소소한 수정 용도만) */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-700 flex items-baseline gap-2 flex-wrap">
                환자군 기준의료비 (B)
                <span className="text-[11px] font-normal text-slate-400">B = HCC 평균 × 의원급 외래 비중 (분석 산출값)</span>
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
            <div className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
              ※ 통상 엑셀 업로드(HCC×CR 자동 산출)로 설정되며, 미세 수정만 권장. 변경 시 위 PB 카드가 자동 재계산됩니다.
            </div>
          </div>

          {/* L1 환자군별 차등 */}
          <div className="rounded-lg border-2 px-3 py-2.5"
            style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)", borderColor: "#5eead4" }}>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-sm font-bold" style={{ color: "#0f766e" }}>
                  선지급 기준 타원이용비중 (L1)
                </h3>
                <span className="text-[11px] text-teal-700/80">가중평균 {(perfMemo.L1avg * 100).toFixed(1)}% · 디폴트 0.70</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setL1All(base.map(b => b.L))}
                  title="엑셀에서 로딩된 실측 L 값을 L1 초기값으로 복사"
                  className="text-xs px-2 py-0.5 rounded border border-teal-300 bg-white text-teal-700 hover:bg-teal-50 font-medium">
                  엑셀 L → L1 복사
                </button>
                <button onClick={resetL1}
                  className="text-xs text-teal-700 hover:text-red-600 border border-teal-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
                  ↩ 초기화
                </button>
              </div>
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

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
            ℹ️ 고급 설정 변경 시 위쪽 PB 카드 값이 자동 재계산됩니다 (PB = B × (1 − L1)). 산출 근거 항목이므로 일반적으로 디폴트 값 유지를 권장합니다.
          </div>
        </div>
      )}
    </div>
  );

  return (<>
    {/* v6.9.3: 정책 모드 — 상단 공식 박스 → PB 카드 → PF 카드(균형추 종속) → 고급 패널(B·L1).
        의원 모드는 완전 숨김 (수가 산출 근거는 의원이 다룰 영역 아님). */}
    {mode === "policy" && formulaBox}
    {mode === "policy" && PBcard}
    {mode === "policy" && PFcard}
    {mode === "policy" && advancedPanel}

    {/* ④ 일차의료수가 — 의원 모드에서는 "환자군별 공단지급 수가" 라벨, 공식·L1 개별 표시 숨김 */}
    <TCard state={state} G={G} mode={mode} />

    {/* ⑤ 타원이용비중 (L2) 변화율 — 0%p=L1, 음수=개선 → 성과급 */}
    {(() => {
      const L1avg = perfMemo.L1avg;
      const L2delta = Math.max(-50, Math.min(0, (L2_display - L1avg) * 100));
      const sliderBg = `linear-gradient(to right, #7c3aed ${((L2delta + 50) / 50) * 100}%, #e5e7eb 0%)`;
      const setL2FromDelta = (dPct) => {
        const d = Math.max(-50, Math.min(0, dPct));
        setL2(Math.max(0, Math.min(1, L1avg + d / 100)));
      };
      return (
        <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
          <div className="flex items-center mb-2 gap-3 flex-wrap">
            <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>5. 포괄관리 지표 (L2) 변화율</h2>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-purple-600 font-semibold">전</span>
              <span className="text-sm font-bold text-purple-700/70">{(L1avg * 100).toFixed(1)}%</span>
              <span className="text-purple-400">→</span>
              <span className="text-xs text-purple-600 font-semibold">후</span>
              <span className="text-lg font-extrabold text-purple-900">{(L2_display * 100).toFixed(1)}%</span>
              <NumBox value={parseFloat(L2delta.toFixed(1))} onChange={setL2FromDelta} color="#7c3aed" suffix="%p" />
            </div>
            <button onClick={resetL2}
              className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
              ↩ 초기화
            </button>
          </div>
          <input type="range" min={-50} max={0} step={0.5} value={L2delta}
            onChange={e => setL2FromDelta(parseFloat(e.target.value))}
            aria-label="포괄관리 지표 L2 변화율 슬라이더"
            className="w-full big-thumb"
            style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: sliderBg }} />
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
            <span>-50%p</span><span>-40%p</span><span>-30%p</span><span>-20%p</span><span>-10%p</span><span>0%p</span>
          </div>
          <div className="mt-1.5 text-[10px] text-purple-700/70 leading-relaxed space-y-0.5">
            <div>※ 0%p = L1 수준(가산 0 기준점) · 음수로 갈수록 포괄관리 지표 개선 → 포괄관리 성과가산 발생 (no-downside)</div>
            <div>※ 주치의의 포괄적·지속적 진료로 닥터쇼핑·중복검사가 감소한 성과를 수가에 반영</div>
          </div>
        </div>
      );
    })()}

    {/* ⑥ KPI 2카드 — L2 연동
         · 의원 모드: Hero Before/After (단일 비교, 결론 우선)
         · 정책 모드: ①②③ 세부 분해 (정책 협의용 진단)
         공단 박스(우측)는 양쪽 모드 공통 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {mode === "clinic" ? (
        /* Hero Before/After — 의원 모드 전용 */
        <div className="rounded-2xl border-2 shadow-md p-5" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", borderColor: "#86efac" }}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">우리 의원 연간 수입 변화</span>
            <span className="text-[10px] text-emerald-700/70 font-semibold">
              현재 Track: <b className="text-emerald-800">{state.hccPct === 0 ? "A (FFS)" : state.hccPct === 100 ? "C (환자군)" : `B (혼합 ${state.hccPct}%)`}</b>
              <span className="mx-1 text-emerald-400">·</span>
              L2 {(L2_display * 100).toFixed(1)}%
            </span>
          </div>

          <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
            <div className="text-center">
              <div className="text-[11px] text-gray-500 font-semibold mb-1">현재 (FFS)</div>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-gray-700 leading-tight">
                {fMan(perClinicBaseline)}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl text-emerald-600 font-bold">→</div>
            <div className="text-center">
              <div className="text-[11px] text-emerald-700 font-semibold mb-1">참여 후</div>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-tight"
                style={{ color: decomp.netChange >= 0 ? "#047857" : "#dc2626" }}>
                {fMan(perClinicAfter)}
              </div>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-xl px-3 py-2.5 text-center shadow-sm border border-emerald-100">
            <div className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-tight"
              style={{ color: decomp.netChange >= 0 ? "#059669" : "#dc2626" }}>
              {diffMan(perClinicNet)}<span className="text-base text-gray-500 font-bold"> / 년</span>
            </div>
            <div className="text-sm font-bold mt-0.5"
              style={{ color: decomp.netChgPct >= 0 ? "#059669" : "#dc2626" }}>
              {pct(decomp.netChgPct)}
              <span className="text-[11px] text-gray-500 font-normal ml-1">vs 현재 FFS</span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-emerald-700/80 text-center leading-relaxed">
            {perClinicPerf >= 5000 ? (
              <>※ 위 금액에 <b className="text-emerald-800">포괄관리 성과가산 {fMan(perClinicPerf)}/년</b>이 이미 포함되어 있습니다 (L2 슬라이더로 조정).</>
            ) : (
              <>※ <b className="text-emerald-800">L2 슬라이더</b>를 L1보다 낮추면 포괄관리 성과가산이 추가되어 금액이 더 커집니다.</>
            )}
          </div>
          <div className="mt-1.5 text-[10px] text-gray-500 text-center">
            전체 사업 합계: <b>{diffAuto(0, decomp.netChange)}</b> ({M.toLocaleString()}개 의원)
          </div>
        </div>
      ) : (
        /* ①②③ 세부 분해 — 정책 모드 전용 */
        <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="font-bold text-base text-green-800">의원 수입 변화 <span className="text-[11px] font-normal text-green-700/70">(세부 분해)</span></h3>
            <span className="text-xs font-semibold text-green-600">L1 {(perfMemo.L1avg * 100).toFixed(1)}% · L2 {(L2_display * 100).toFixed(1)}%</span>
          </div>

          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs text-green-700/80 font-semibold">기준 수입 (참여 전, 전원 FFS)</span>
            <span className="text-sm font-bold text-green-800/80">{fMan(perClinicBaseline)}/의원·년</span>
          </div>

          <div className="mt-2 bg-white/60 rounded px-2 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-600">① 환자군 패널 변화 효과</span>
              <span className="text-sm font-bold" style={{ color: decomp.panelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
                {diffMan(perClinicPanel)}/의원
              </span>
            </div>
          </div>

          <div className="mt-1.5 bg-white/60 rounded px-2 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-indigo-700 font-semibold">② 지불방식 전환 효과 (선지급)</span>
              <span className="text-sm font-bold" style={{ color: decomp.modelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
                {diffMan(perClinicModel)}/의원
              </span>
            </div>
          </div>

          <div className="mt-1.5 bg-white/60 rounded px-2 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-amber-700 font-semibold">③ 포괄관리 성과가산 (L2 기반)</span>
              <span className="text-sm font-bold" style={{ color: decomp.performanceEffect > 0 ? "#16a34a" : "#6b7280" }}>
                {diffMan(perClinicPerf)}/의원
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-green-200/70">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-xs text-green-700 font-semibold">순 변화 (① + ② + ③)</span>
              <span className="text-xs font-bold" style={{ color: decomp.netChgPct >= 0 ? "#16a34a" : "#dc2626" }}>
                {pct(decomp.netChgPct)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-green-700/70">의원당</span>
              <span className="text-2xl font-extrabold leading-tight" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
                {diffMan(perClinicNet)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-green-700/70">전체</span>
              <span className="text-base font-bold" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
                {diffAuto(0, decomp.netChange)}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-green-200/70">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-green-700 font-semibold">참여 후 의원당 수입</span>
              <span className="text-lg font-extrabold text-green-900">{fMan(perClinicAfter)}/년</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단 의원급 외래 지출 변화</h3>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl sm:text-4xl font-extrabold text-blue-700 leading-tight">{diffAuto(T.nhi0, T.nhi + perfMemo.perf_blended)}</span>
          <span className="text-base sm:text-lg font-bold text-blue-700/80 leading-tight">{pct(nhiChg, 2)}</span>
        </div>
        <div className="text-sm sm:text-base text-blue-700/70 font-semibold mt-1">{fE(T.nhi0)}억 → <b className="text-blue-800">{fE(T.nhi + perfMemo.perf_blended)}억</b></div>
        <div className="mt-2 pt-2 border-t border-blue-200/70 text-xs text-blue-700/70 leading-relaxed">
          <div>· 등록환자 공단지급 + L2 기반 타원 외래비 반영</div>
          <div>· 포괄관리 성과가산 {fE(perfMemo.perf_blended)}억 (현재 Track 반영) 포함</div>
        </div>
      </div>
    </div>

    {/* ⑧ 의원당 환자 규모 — 의원 모드에서는 상단에 환자군 구성 프리셋(일반/노인 집중/사용자 지정) 노출 */}
    <RegScaleCard state={state} set={set} reg={reg}
      scaleRegDist={scaleRegDist} setRegDistAll={setRegDistAll}
      resetReg={resetReg} mode={mode} />

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

    {/* ⑨-b Track 비교 요약 3카드 — 의원 모드 전용 (v6.8.2)
         계산 소스: useSimulator의 tracks 메모 → Track 탭 비교 테이블과 숫자 일치 보장 */}
    {mode === "clinic" && tracks && (
      <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)", borderColor: "#c7d2fe" }}>
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-bold text-base text-indigo-900">📊 Track별 2년차 이후 연간 수입 <span className="text-xs font-normal text-indigo-700">(의원당 · 단일 선택 시나리오)</span></h3>
          <span className="text-[11px] text-indigo-600/80">→ Track을 변경하려면 Track 탭에서 선택</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tracks.map(t => {
            const active = state.hccPct === t.hc;
            const baseInc = T.inc0 / Math.max(1, M);
            const chgPct = baseInc > 0 ? ((t.ongoing - baseInc) / baseInc) * 100 : 0;
            return (
              <div key={t.n}
                className="rounded-lg p-3 text-center transition relative"
                style={{
                  background: active ? "#ffffff" : t.bg,
                  border: active ? `2px solid ${t.c}` : `2px solid ${t.bd}`,
                  boxShadow: active ? "0 2px 8px rgba(79, 70, 229, 0.15)" : "none",
                }}>
                {active && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white" style={{ background: t.c }}>
                    ✓ 현재 선택
                  </div>
                )}
                <div className="text-xs font-extrabold" style={{ color: t.c }}>{TRACK_LABELS[t.hc] ?? t.n}</div>
                <div className="mt-1.5 text-lg sm:text-xl font-extrabold tabular-nums" style={{ color: active ? "#312e81" : "#374151" }}>
                  {fMan(t.ongoing)}
                </div>
                <div className="text-[10px] text-gray-500">/년</div>
                <div className="mt-1 text-xs font-bold" style={{ color: chgPct >= 0 ? "#16a34a" : "#dc2626" }}>
                  ({chgPct >= 0 ? "+" : ""}{chgPct.toFixed(1)}%)
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-indigo-700/70 leading-relaxed">
          ※ 표시 금액 = Track 선지급 + 성과배분(SS) + 포괄관리 성과가산(L2). 1년차 PT 제외 · 변화율은 참여 전 FFS 대비.
        </div>
      </div>
    )}

    {/* ⑩ Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "주치의 환자관리\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `환자군 기반 적절 보상\n의원당 ${diffMan(perClinicNet)}\n포괄관리 성과가산 ${fMan(perClinicPerf)}/년` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `지출 ${pct(nhiChg, 2)}\n예측 가능성 향상\n*Saving 효과 별도` },
    ]} />

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
            <div><b className="text-indigo-700">P_g = PB_g + PF_g</b>  (환자군별 선지급, v6.9.3 단순합)</div>
            <div className="text-gray-500 pl-2">where  PB_g = B_g × (1 − L1_g) · PF_g = F_g (내부 변수)</div>
            <div><b className="text-indigo-700">공단지급 = P</b>  (단일화)</div>
            <div><b className="text-indigo-700">본인부담 = M1 × 30%</b>  (고정)</div>
            <div className="pt-1 mt-1 border-t border-gray-300">
              <b className="text-amber-700">포괄관리_성과가산 = Σ max(0, L1_g − L2) × B_g × n_reg_g × TrackMul</b>
            </div>
            <div className="text-gray-500">n_reg_g = 의원당 환자군별 등록환자수 · TrackMul: A=0 / B=0.5 / C=1.0</div>
            <div className="text-gray-500">no-downside: L2 &gt; L1이면 가산 0 (환수 없음) · 의원 100% 환원 (공유율 없음)</div>
          </div>
        </div>
      )}
    </div>
    )}

    {/* ⑫ 데이터 관리 */}
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
                const msg = `⚠️ 현재 값을 모든 사용자의 공식 baseline으로 등록합니다.\n\n${preview}\n\nVercel 재배포 후 (약 1~2분) 모든 사용자의 디폴트가 갱신됩니다.\n진행하시겠습니까?`;
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
  </>);
})
