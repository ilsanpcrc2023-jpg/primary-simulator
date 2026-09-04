import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { FCard, TCard, ClinicSummaryStrip, ClinicCountControls } from "./RegistrationPanel";
import { SH, CL, COPAY_RATE, OFFICIAL_BASELINE_META } from "../constants";
import presets from "../data/presets/index";
import { f, fE, pct, diffAuto, fMan, diffMan, calcPB, PBtoB, refRatiosFromBase } from "../utils";

const TRACK_LABELS = { 0: "Track A 유지", 50: "Track B 혼합", 100: "Track C 환자군" };

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

/* v7.5.2: DraftInput — 상세 편집 테이블용 자유 입력 셀.
   포커스 중에는 로컬 텍스트를 그대로 유지(소수점·부분 입력 허용), blur 또는 Enter 시에만 commit.
   이전 controlled input은 키 입력마다 parse→dispatch→toFixed 재포맷이 돌아 "."·부분 숫자 입력이 막히던 문제 해소.
   - value: 표시용 숫자 · decimals: 표시 소수 자릿수 · onCommit(num): 유효 숫자일 때만 호출
   - min/max: commit 시 clamp (입력 자체는 제한 없음) · grouping: 천 단위 콤마 표시 */
function DraftInput({ value, decimals = 2, onCommit, min = -Infinity, max = Infinity, grouping = false, className = "", placeholder = "" }) {
  const [draft, setDraft] = useState(null);   // null = 편집 중 아님
  const fmt = (v) => {
    if (typeof v !== "number" || !isFinite(v)) return "";
    return grouping
      ? v.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : v.toFixed(decimals);
  };
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(String(draft).replace(/,/g, ""));
    setDraft(null);
    if (!isNaN(v)) onCommit(Math.max(min, Math.min(max, v)));
  };
  return (
    <input type="text"
      value={draft === null ? fmt(value) : draft}
      placeholder={placeholder}
      className={"text-center text-[11px] border border-blue-200 rounded bg-blue-50 py-0.5 " + className}
      onFocus={e => { setDraft(fmt(value).replace(/,/g, "")); e.target.select(); }}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setDraft(null); }} />
  );
}

export default memo(function TabSimulation({
  mode = "policy", setMode,
  state, set, updP, updBase, updBaseRatio, resetBaseRatios, setDistAll, updCopay, updF, setFAll, setPfRule, resetF, resetP, resetReg,
  updL1, setL1All, resetL1, setL2, resetL2,
  updRegDist, setRegDistAll, scaleRegDist, reset, loadPreset,
  G, T, decomp, performance: perfMemo, tracks,
  incChg, nhiChg,
  fileRef, handleFile, handleExport, handleCommitBaseline,
  reg, regRatios,
}) {
  const { base, P, L1, L2, showDetail, uploadBanner, F_g, M_clinics } = state;
  const M = Math.max(1, M_clinics);
  const [policyExpanded, setPolicyExpanded] = useState(mode === "policy");
  // v6.10.0: 균형추 controlled accordion 제거. 고급 패널만 유지.
  // v7.1.3: 수가 산출 구조 박스 삭제 (formula 컬럼 헤더와 중복 · showFormula state 제거).
  const [showAdvanced, setShowAdvanced] = useState(false);

  // v6.9.3: PB = B × (1 − L1) — UI 표시값. 슬라이더 onChange는 PBtoB로 B 역산.
  const PB = calcPB(P, L1);

  // v7.5.1: 상세 편집 테이블 분포비 2종.
  //   ratio_i  = baseRatios[i] (수기 override) ?? N_i / ΣN (실측)
  //              → "기준 군별 분포비(%)" (v7.5.3: 자유 입력, 다른 군 불변, 합 100% 강제 없음 · ↩ 실측 복귀)
  //   regDist_i / 1000               → "등록 군별 분포비(%)" (= RR/1000, 자유 입력, 합 100% 강제 없음)
  //   등록 분포비 디폴트("데이터 비례" 프리셋) = ratio_i × 1000을 0.1명 단위로 반올림 (= INIT_REG_DIST)
  //   → 등록 분포비(%)가 기준 분포비(%)와 소수 2자리까지 동일 (v7.5.3 사용자 결정).
  // v7.5.5: 기준 분포비 = RN(일만시 참여의원 환자수) 기준 (v7.5.4 NT 기준은 사용자 결정으로 복귀).
  // v7.5.8: 분포비 단일화 — 등록 분포비 = 기준 분포비 (사용자 결정). 테이블은 "분포비" 열 하나만 노출,
  //   RR(등록환자수 명) 표기 제거. 내부 regDist = ratio_i × Σ regDist는 reducer가 자동 동기화 (합 1,000 강제 없음).
  const ratiosMeasured = refRatiosFromBase(base);
  const ratiosOverridden = Array.isArray(state.baseRatios) && state.baseRatios.length === base.length;
  const ratios = ratiosOverridden ? state.baseRatios : ratiosMeasured;

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

  // v7.1.2: 고급 설정 — B·L1 박스 삭제 (환자군별 상세 편집 테이블과 중복).
  //   대신 의원 수·의원당 등록환자수 선택 컨트롤 배치.
  //   B/L1 직접 편집은 데이터 관리 카드의 환자군별 상세 편집 테이블에서 수행.
  const advancedPanel = (
    <div className="rounded-xl border border-dashed shadow-sm overflow-hidden"
      style={{ background: "#fafafa", borderColor: "#cbd5e1" }}>
      <button onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-100 transition text-left">
        <span className="text-slate-400 text-xs">{showAdvanced ? "▲" : "▼"}</span>
        <span className="text-sm font-semibold text-slate-700">⚙️ 고급 설정</span>
        <span className="text-[10px] text-slate-400">의원 수 · 의원당 등록환자수</span>
      </button>
      {showAdvanced && (
        <div className="px-4 pb-4 pt-2 border-t border-dashed border-slate-300">
          <ClinicCountControls state={state} set={set} scaleRegDist={scaleRegDist} />
          <div className="mt-3 text-[10px] text-slate-400 leading-relaxed">
            ※ 환자군 기준의료비(B) · 평균 타원이용비중(L1)은 데이터 관리 카드의
            <b className="text-slate-500"> 환자군별 상세 편집 테이블</b>에서 직접 편집.
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
              <NumBox value={parseFloat(cDelta.toFixed(1))} onChange={setCdelta} color="#7c3aed" suffix="%p" decimals={1} />
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
            {diffAuto(T.nhi0, T.nhi + perfMemo.perf_nhi)}<span className="text-base text-gray-500 font-bold"> / 년</span>
          </div>
          <div className="text-[11px] text-gray-500 font-normal mt-1">사업 전체 공단 지출 변화액 · 참여 전 = 총 외래비 × (1 − 본인부담비) · 참여 후 = (PB + 타원비 + 비등록 + 포괄관리성과) × (1 − 본인부담비) + PF</div>
        </div>
      </div>
    </div>

    {/* v7.1.2: 참여 의원 수 + 의원당 등록환자수 — 슬림 1줄 요약만 (변경 컨트롤은 고급 설정으로 이동).
        정책 모드에서만 노출 (의원 모드는 의원 1개 시뮬 관점이라 불필요). */}
    {mode === "policy" && <ClinicSummaryStrip state={state} />}

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
        txt: `지출 ${diffAuto(T.nhi0, T.nhi + perfMemo.perf_nhi)}\n예측 가능성 향상\n*Shared Saving 효과 별도` },
    ]} />

    {/* v6.11.0: 고급 설정 — 위치를 수가 산출 구조 위로 이동 (정책 모드 전용) */}
    {mode === "policy" && advancedPanel}

    {/* v7.1.3: 수가 산출 구조 박스 삭제 — formula는 환자군별 상세 편집 테이블 컬럼 헤더(B=A×CR, PB=B×C1, P=PB+PF)에 이미 노출. */}

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
          {/* v7.5: 자료 분석 절차 (NHIS-HCC v3.0 2025 baseline · 의료비 0원 제외) — 엑셀 시트 텍스트 정합 */}
          <div className="mt-3 mb-3 rounded-lg border bg-slate-50 px-3 py-2.5"
            style={{ borderColor: "#cbd5e1" }}>
            <div className="text-xs font-bold text-slate-700 mb-1.5">📊 자료 분석 절차</div>
            <div className="text-[11px] text-slate-700 leading-relaxed space-y-1">
              <div><b className="text-slate-800">1단계 (건보공단 전수자료 HCC 분석)</b></div>
              <div className="pl-3">1) 2025년 건강보험 이용자 전수자료 <b>48,874,201명</b>으로 NHIS-HCC v3.0 구축 후 <span className="text-slate-500">(의료비 0원 제외)</span></div>
              <div className="pl-3">2) HCC 4분위(quartile)로 환자군 1~4군 분류</div>
              <div className="pt-1"><b className="text-slate-800">2단계 (일만시 참여의원 환자 중심 분석)</b></div>
              <div className="pl-3 text-[10px] text-slate-500 leading-tight">
                주분석 대상: 일차의료 만성질환관리 시범사업 참여의원 <b className="text-slate-700">2,923개 의원</b>
                · 환자 <b className="text-slate-700">12,411,152명</b> (의원당 환자수 <b className="text-slate-700">4,246명</b>)
              </div>
              <div className="pl-3">1) 환자군 평균 의료비 <b>A</b></div>
              <div className="pl-3">2) 환자군 기준 의료비(의원급외래) <b>B = A × CR</b></div>
              <div className="pl-3">3) 일차의료 기본수가 <b>PB = B × C1</b> <span className="text-slate-500">(C1 = 1 − L1)</span></div>
              <div className="pt-1 text-slate-500"><i>cf. 일차의료 정책 보정 후 일차의료수가</i></div>
              <div className="pl-3 text-slate-600">· 일차의료 기능보정 <b>PF</b> <span className="text-slate-500">(B 기준 N% 정책 슬라이더, 디폴트 5%)</span></div>
              <div className="pl-3 text-slate-600">· 일차의료수가 <b>P = PB + PF</b></div>
            </div>
          </div>

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
              onClick={() => {
                const msg = `초기화: 1차년도 시범사업 디폴트로 복귀합니다.\n\n· 의원 수: 100개\n· 의원당 환자수: 4,246명\n· 의원당 등록환자수: 약 1,000명 (분포비 = 일만시 실측 20.2/19.8/29.4/30.7%)\n· 사업 전체 등록: 약 100,000명\n\n환자군별 RN · L · 분포비만 복귀.\nPF · L1 · B · L2 등 정책 슬라이더는 보존됩니다.\n\n진행할까요?`;
                if (confirm(msg)) resetReg?.();
              }}>
              <div className="text-amber-500 text-xl mb-0.5">↩</div>
              <div className="text-xs font-semibold text-amber-700">초기화</div>
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
                <span className="text-[10px] font-normal text-gray-400">A → B = A×CR → PB = B×C1 → PF = B×F → P = PB+PF · 입력: A · CR · C1 · F · NT · RN · 본인부담비(공단 지출)</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-gray-500">분포비 프리셋:</span>
                {[
                  { label: "데이터 비례", r: ratiosMeasured, reset: true },
                  { label: "균등", r: [0.25, 0.25, 0.25, 0.25] },
                  { label: "건강편중", r: [0.40, 0.40, 0.15, 0.05] },
                  { label: "고위험편중", r: [0.05, 0.35, 0.30, 0.30] },
                ].map(p => {
                  const active = p.reset
                    ? !ratiosOverridden
                    : ratios.every((v, i) => Math.abs(v - p.r[i]) < 0.0005);
                  return (
                    <button key={p.label} onClick={() => (p.reset ? resetBaseRatios() : setDistAll(p.r))}
                      className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                      style={active ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                      {p.label}
                    </button>
                  );
                })}
                {ratiosOverridden && (
                  <button onClick={resetBaseRatios}
                    title="분포비 수기 입력값을 버리고 실측(RN_i ÷ ΣRN)으로 복귀"
                    className="ml-2 text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                    style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#b45309" }}>
                    ↩ 분포비 실측 복귀
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              {/* v7.5.1: 컬럼 재구성 (사용자 결정) —
                    A(=T/NT) | CR | B(=A×CR) | C1(=1−L1) | PB(=B×C1) | F(기능보정율) | PF(=B×F) | P(=PB+PF) | NT | RN | 분포비(표시 전용) | 본인부담비(v7.6.3 참여 전 공단 지출 × (1−본인부담비) · v7.6.5/v7.6.6 참여 후 PF 제외 전 항목 × (1−본인부담비))
                  편집: A, CR, C1(→ L1·base.L 동시 갱신), F(→ F_g = B×F), 등록 분포비(→ regDist = 비율 × Σ regDist).
                  산출: B, PB, PF, P. 표시만: 분포비(ratio_i, 프리셋으로만 변경).
                  NT·RN·M1·RR 절대값 컬럼은 제거 (데이터 anchor·엑셀 업로드로 관리). */}
              <table className="w-full text-[11px] tabular-nums" style={{ minWidth: 1140 }}>
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-2 py-1.5" title="HCC 4분위 환자군">환자군</th>
                    <th className="text-center px-1" title="1인당 평균 의료비 A = T ÷ NT (편집 가능)">A<br /><span className="font-normal text-[9px]">=T/NT · 1인당 평균 의료비</span></th>
                    <th className="text-center px-1" title="의원급 외래비중 CR (편집 가능)">CR<br /><span className="font-normal text-[9px]">외래비중</span></th>
                    <th className="text-center px-1" title="1인당 의원급 외래비 B = A × CR (산출)">B<br /><span className="font-normal text-[9px]">=A×CR · 1인당 의원급 외래비</span></th>
                    <th className="text-center px-1 text-emerald-700" title="등록의원 외래 의료비 비중 C1 = 1 − L1 (편집 가능 · L1 동시 갱신)">C1<br /><span className="font-normal text-[9px]">=1−L1 · 등록의원 외래 비중</span></th>
                    <th className="text-center px-1 text-slate-700" title="일차의료 기본수가 PB = B × C1 (산출)">PB<br /><span className="font-normal text-[9px]">=B×C1 · 일차의료 기본수가</span></th>
                    <th className="text-center px-1 text-purple-600" title="일차의료 기능보정율 F = PF ÷ B (편집 가능)">F<br /><span className="font-normal text-[9px]">기능보정율 %</span></th>
                    <th className="text-center px-1 text-purple-600" title="일차의료 기능보정 PF = B × F (산출)">PF<br /><span className="font-normal text-[9px]">=B×F · 기능보정</span></th>
                    <th className="text-center px-1 text-indigo-700" title="일차의료수가 P = PB + PF (산출)">P<br /><span className="font-normal text-[9px]">=PB+PF · 일차의료수가</span></th>
                    <th className="text-center px-1" title="환자군별 전체 환자수 NT (건보 전수 · 참고 · 편집 가능)">NT<br /><span className="font-normal text-[9px]">전체 환자수</span></th>
                    <th className="text-center px-1" title="참여의원(일만시) 환자수 RN (기준 분포비·엔진 환자 배분 재료 · 편집 가능)">RN<br /><span className="font-normal text-[9px]">일만시 환자수</span></th>
                    {/* v7.5.11: 분포비 열 표시 전용 (수기 입력 불가, 사용자 결정). 변경은 프리셋 버튼으로만. */}
                    <th className="text-center px-1 text-blue-700" title="환자군별 분포비 (기준 = 등록) · 디폴트 = 일만시 실측 RN_i ÷ ΣRN · 표시 전용 — 변경은 분포비 프리셋 버튼으로">분포비<br /><span className="font-normal text-[9px]">% · 기준 = 등록</span></th>
                    {/* v7.6.2: 본인부담비 열 복원 (맨 오른쪽). v7.6.3: 참여 전 공단 지출 baseline = 총 외래비 × (1 − 본인부담비)에 반영. 참여 후 산식에는 미반영(v7.6.1). */}
                    <th className="text-center px-1" title="환자 본인부담비 (디폴트 26.1% · 편집 가능) — 공단 지출: 참여 전 = 총 외래비 × (1 − 본인부담비) (v7.6.3), 참여 후 = PF 제외 전 항목(PB·타원비·비등록·포괄관리성과) × (1 − 본인부담비) + PF (v7.6.5/v7.6.6). 의원 수입(P = PB + PF)에는 미반영">본인부담비<br /><span className="font-normal text-[9px]">% · 공단 지출 (PF 제외)</span></th>
                  </tr>
                </thead>
                <tbody>
                  {G.map((r, i) => {
                    const Fi = F_g[i] ?? 0;
                    const L1_i = L1?.[i] ?? 0.7;
                    const C1_i = 1 - L1_i;
                    const A_i = base[i].A;
                    const CR_i = base[i].CR;
                    // B 표시: A·CR 모두 있을 때 A×CR 산출 (참고용), 그 외 P[i] (slider 값)
                    const B_calc = (typeof A_i === "number" && typeof CR_i === "number" && A_i > 0 && CR_i > 0)
                      ? Math.round(A_i * CR_i)
                      : null;
                    const B_display = B_calc ?? P[i];
                    const PB_display = Math.round(B_display * C1_i);
                    const F_rate = B_display > 0 ? (Fi / B_display) * 100 : 0;
                    // v7.5.2 → v7.5.7 표시 규칙: % → 소수 1자리, 비중(0.XXX) → 소수 3자리, 금액 → 정수 (state 정밀도는 그대로)
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                        <td className="text-center px-1">
                          <DraftInput value={typeof A_i === "number" ? A_i : undefined} decimals={0} grouping placeholder="—"
                            className="w-20" min={0}
                            onCommit={v => updBase(i, "A", Math.round(v))} />
                        </td>
                        <td className="text-center px-1">
                          <DraftInput value={typeof CR_i === "number" ? CR_i : undefined} decimals={3} placeholder="—"
                            className="w-16" min={0} max={1}
                            onCommit={v => updBase(i, "CR", v)} />
                        </td>
                        <td className="text-center px-1 text-gray-700">
                          {f(B_display)}
                          {B_calc !== null && Math.abs(B_calc - P[i]) > 1 && (
                            <span className="block text-[9px] text-amber-600" title={`현재 정책 슬라이더 B = ${f(P[i])}`}>⚠ 슬라이더 {f(P[i])}</span>
                          )}
                        </td>
                        <td className="text-center px-1">
                          <DraftInput value={C1_i * 100} decimals={1} className="w-16 text-emerald-700" min={0} max={100}
                            onCommit={v => { const newL = 1 - v / 100; updL1(i, newL); updBase(i, "L", newL); }} />
                        </td>
                        <td className="text-center px-1 text-slate-700">{f(PB_display)}</td>
                        <td className="text-center px-1">
                          <DraftInput value={F_rate} decimals={1} className="w-16 text-purple-600" min={0}
                            onCommit={v => updF(i, Math.round(B_display * v / 100))} />
                        </td>
                        <td className="text-center px-1 text-purple-600 font-semibold">{f(Fi)}</td>
                        <td className="text-center px-1 font-bold text-indigo-700">{f(PB_display + Fi)}</td>
                        <td className="text-center px-1">
                          <DraftInput value={typeof base[i].NT === "number" ? base[i].NT : undefined} decimals={0} grouping placeholder="—"
                            className="w-24 text-gray-700" min={0}
                            onCommit={v => updBase(i, "NT", Math.round(v))} />
                        </td>
                        <td className="text-center px-1">
                          <DraftInput value={base[i].N} decimals={0} grouping className="w-24 text-gray-700" min={1}
                            onCommit={v => updBase(i, "N", Math.round(v))} />
                        </td>
                        <td className="text-center px-1 text-blue-700 font-semibold">{(ratios[i] * 100).toFixed(1)}%</td>
                        <td className="text-center px-1">
                          <DraftInput value={((state.copayRates?.[i] ?? COPAY_RATE) * 100)} decimals={1} className="w-16 text-gray-500" min={0} max={100}
                            onCommit={v => updCopay(i, v / 100)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 text-[10px] text-gray-500">
                    <td className="px-2 py-1 font-semibold">합계</td>
                    <td colSpan={8}></td>
                    <td className="text-center px-1">{f(base.reduce((s, g) => s + (typeof g.NT === "number" ? g.NT : 0), 0))}</td>
                    <td className="text-center px-1">{f(base.reduce((s, g) => s + (g.N || 0), 0))}</td>
                    <td className="text-center px-1 text-blue-600">{(ratios.reduce((s, v) => s + v, 0) * 100).toFixed(1)}%{ratiosOverridden && <span className="block text-[9px] text-amber-600">프리셋</span>}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                ※ 직접 편집: A · CR · C1 · F · NT · RN · 본인부담비 (셀 클릭 후 입력, Enter 또는 포커스 이동 시 반영 · Esc 취소).
                C1 편집 시 L1(=1−C1)과 실측 L이 함께 갱신되어 PB에 즉시 반영. F 편집 시 PF = B × F로 재산출 (상단 PF 슬라이더와 연동).
                B는 A × CR 산출값 — A·CR 편집 시 엔진 B(상단 PB 카드·KPI)도 즉시 동기화되고 PF는 기존 비율(B의 X%)을 유지해 재산출. (PB 카드 "↩ 초기화" 등으로 B가 A×CR과 달라지면 노란색 ⚠ 안내.) 등록환자 1인당 의원수입 = P = PB + PF (v7.6.1: 참여 후 본인부담 항 제거). 본인부담비는 공단 지출에만 적용 — 참여 전 = 총 외래비 × (1 − 본인부담비) (v7.6.3), 참여 후 = PB·타원비(D1_L2)·비등록(C1)·포괄관리성과 모두 × (1 − 본인부담비), PF만 전액 공단 부담 (v7.6.5/v7.6.6) — v7.6.0부터 현행 외래비 M1은 계산에 쓰지 않음(baseline FFS·비등록·공단 외래비·Track A 모두 PB 기준).
                분포비(기준 = 등록)는 표시 전용 — 수기 입력 불가. 디폴트는 일만시 실측 비율(RN_i ÷ ΣRN)이며, 위의 분포비 프리셋(데이터 비례 · 균등 · 건강편중 · 고위험편중)으로만 변경 — 의원당 등록환자 배분에 그대로 적용.
                RN 편집 시 등록 분포는 RN 실측 비율로 재산출되고 엔진의 참여의원 환자 배분(N_g)에도 반영. NT(전체 환자수)는 참고 표시. M1은 데이터 필드로만 보존(엑셀 업로드·baseline), 계산 미사용.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
  </>);
})
