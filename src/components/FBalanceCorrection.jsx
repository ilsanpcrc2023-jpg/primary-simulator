import { memo, useState, useMemo } from "react";
import { f, fAuto, fMan, diffAuto, fChangeAuto } from "../utils";
import { SH, CL } from "../constants";
import NumBox from "./shared/NumBox";

// v6.9.2-bidir: F 균형추 보정 모듈 (정책 모드 전용 · 양방향 + 절대 재정중립)
// - 추 위치(−5%~+10%) = baseline(T.nhi0) 대비 공단 외래 지출 목표 변화율
// - 0% = baseline 대비 공단 외래 지출 변화 0원 (절대 재정중립)
// - F 4군 절대값을 자동 산출 (ΔF 누적이 아님)
//   targetNHI = T.nhi0 × (1 + pct/100)
//   NHI_withoutF = T.nhi − Σ F_g[i] × n_reg_g[i]   (현 NHI에서 F 기여분만 제거)
//   F_total_target = targetNHI − NHI_withoutF      (음수 가능)
// - F 음수: 환자군 기본수가에서 차감되는 시나리오 (재정 보수·협상 하한선 탐색)
// - Shared Saving은 이 모듈에 포함하지 않음 (별도 풀, 일차의료수가 아님)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 분배 함수 (테스트 가능하도록 export) — 음수 totalTarget 허용 (v6.9.2-bidir)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function distribute(totalTarget, rule, B, n_g) {
  const N = n_g.reduce((s, n) => s + n, 0);
  if (N <= 0 || B.length === 0 || totalTarget === 0) {
    return B.map(() => 0);
  }
  if (rule === "equal") {
    const v = totalTarget / N;
    return B.map(() => v);
  }
  if (rule === "hcc") {
    const w = B.map((b, i) => b * n_g[i]);
    const W = w.reduce((s, x) => s + x, 0);
    if (W <= 0) return B.map(() => 0);
    return B.map((_, i) => (totalTarget * w[i] / W) / Math.max(1, n_g[i]));
  }
  // inverse: 1/B 가중
  const w = B.map((b, i) => (b > 0 ? (1 / b) * n_g[i] : 0));
  const W = w.reduce((s, x) => s + x, 0);
  if (W <= 0) return B.map(() => 0);
  return B.map((_, i) => (totalTarget * w[i] / W) / Math.max(1, n_g[i]));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// F 절대값 자동 산출 (v6.9.2-bidir 신규 핵심 함수)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// @param targetPct  — 균형추 위치 (−5 ~ +10), %
// @param rule       — "hcc" | "equal" | "inverse"
// @param T_nhi0     — baseline 공단 외래 지출 (참여 전 전원 FFS)
// @param T_nhi      — 현재 시뮬 공단 외래 지출 (사업 후·L2 반영, F 포함)
// @param F_current  — 환자군별 현재 F 값 (4-array, F 기여분 제거용)
// @param B_g        — 환자군별 B (분배 가중)
// @param n_reg_g    — 환자군별 등록환자 합계 (전체 사업 단위, 4-array)
// @returns          — F_g_new[4] (1인당 F 절대값, 음수 가능)
export function calcF_fromBalance(targetPct, rule, T_nhi0, T_nhi, F_current, B_g, n_reg_g) {
  const targetNHI = T_nhi0 * (1 + targetPct / 100);
  const F_contribution = F_current.reduce(
    (acc, Fv, i) => acc + (Fv || 0) * (n_reg_g[i] || 0), 0
  );
  const NHI_withoutF = T_nhi - F_contribution;
  const F_total_target = targetNHI - NHI_withoutF;
  return distribute(F_total_target, rule, B_g, n_reg_g);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 신호등 임계값 — 시각적 가이드 (정책 근거 없음, v6.9.2-bidir 7단계)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function signalLevel(pct) {
  if (pct <= -3)  return { cls: "deep-blue",  txt: "🔵 강한 절감",  color: "#1d4ed8", bg: "rgba(37,99,235,0.12)",  bd: "rgba(37,99,235,0.45)" };
  if (pct <= -1)  return { cls: "blue",       txt: "🟦 절감",       color: "#2563eb", bg: "rgba(59,130,246,0.12)", bd: "rgba(59,130,246,0.45)" };
  if (pct <= 0)   return { cls: "green-pale", txt: "🟢 미세조정",   color: "#059669", bg: "rgba(16,185,129,0.10)", bd: "rgba(16,185,129,0.40)" };
  if (pct <= 2)   return { cls: "green",      txt: "🟢 재정중립",   color: "#16a34a", bg: "rgba(34,197,94,0.14)",  bd: "rgba(34,197,94,0.45)" };
  if (pct <= 5)   return { cls: "yellow",     txt: "🟡 적극 투자",  color: "#b45309", bg: "rgba(245,158,11,0.12)", bd: "rgba(245,158,11,0.5)" };
  if (pct <= 8)   return { cls: "orange",     txt: "🟠 고투자",     color: "#c2410c", bg: "rgba(249,115,22,0.12)", bd: "rgba(249,115,22,0.5)" };
  return            { cls: "red",        txt: "🔴 협상 한계",  color: "#b91c1c", bg: "rgba(239,68,68,0.12)",  bd: "rgba(239,68,68,0.5)" };
}

const RULE_OPTS = [
  { id: "hcc", name: "📊 HCC 비례", desc: "위험도 높을수록 두텁게 (4군 강화)" },
  { id: "equal", name: "⚖️ 균등", desc: "등록환자 1인당 동일 F" },
  { id: "inverse", name: "🌱 역비례", desc: "경증 등록 진입 인센티브" },
];

// v6.9.2-bidir: 6 프리셋 (절감 ~ 적극투입)
const PRESETS = [
  { v: -3, label: "−3%", sub: "강한 절감" },
  { v: -1, label: "−1%", sub: "절감" },
  { v: 0,  label: "0%",  sub: "재정중립" },
  { v: 1,  label: "+1%", sub: "최소투입" },
  { v: 3,  label: "+3%", sub: "표준투입" },
  { v: 5,  label: "+5%", sub: "적극투입" },
];

// 양방향 슬라이더: pct ∈ [-5, +10] → 위치 % ∈ [0, 100]
const PCT_MIN = -5;
const PCT_MAX = 10;
const pctToLeft = (pct) => ((pct - PCT_MIN) / (PCT_MAX - PCT_MIN)) * 100;

// 추 색상 zone 클래스 (CSS 미사용 시 inline-style 보조)
function zoneClass(pct) {
  return signalLevel(pct).cls;
}

export default memo(function FBalanceCorrection({
  state, set, G, T, performance: perfMemo, setFAll
}) {
  const [pct, setPct] = useState(0);                  // v6.9.2-bidir: 디폴트 0% (재정중립)
  const [rule, setRule] = useState("hcc");
  const [appliedSnapshot, setAppliedSnapshot] = useState(null); // 적용 직전 F 백업

  // ── 도메인 매핑 ─────────────────────────────────────────────
  const T_nhi0 = T.nhi0;                              // baseline (참여 전 전원 FFS)
  const T_nhi  = T.nhi;                               // 현재 시뮬 (사업 후·L2 반영)
  const B = state.P;                                  // 환자군 기본수가 (state.P = B)
  const n_reg_g = G.map(r => r.n_reg);                // 환자군별 등록 합계
  const N_reg_total = n_reg_g.reduce((s, n) => s + n, 0);
  const M = Math.max(1, state.M_clinics);

  // ── F 절대값 자동 산출 ───────────────────────────────────────
  const F_new_raw = useMemo(
    () => calcF_fromBalance(pct, rule, T_nhi0, T_nhi, state.F_g, B, n_reg_g),
    [pct, rule, T_nhi0, T_nhi, state.F_g, B, n_reg_g]
  );
  const F_new = F_new_raw.map(v => Math.round(v));    // 1원 단위, 음수 보존
  const dF_array = F_new.map((v, i) => v - (state.F_g[i] || 0));

  // ── 산출 검증 메모 ───────────────────────────────────────────
  // F_total_target = Σ F_new × n_reg_g (분배 합산 보존 → targetNHI − NHI_withoutF)
  const F_total_target = F_new.reduce((s, v, i) => s + v * (n_reg_g[i] || 0), 0);
  const targetNHI = T_nhi0 * (1 + pct / 100);
  const nhiAfterApply = targetNHI;                    // 적용 후 NHI = baseline + pct
  const changeAfterApply = nhiAfterApply - T_nhi0;    // = T_nhi0 × pct/100

  // ── 의원당 효과 (참고 표시) ─────────────────────────────────
  // F 가산분 의원당 = Σ ΔF[i] × regDist[i] (의원당 등록환자에 분배)
  const extraPerClinic = state.regDist.reduce(
    (s, n_pc, i) => s + (dF_array[i] || 0) * n_pc, 0
  );

  // ── 신호등 + 추 위치 ─────────────────────────────────────────
  const sig = signalLevel(pct);
  const trackPos = pctToLeft(pct);                    // 0~100% (좌→우)
  const hasNegative = F_new.some(v => v < 0);
  const isExactZero = Math.abs(pct) < 0.05;
  const isNegative = pct < -0.05;

  // 직접입력 동기화
  const onPctChange = (v) => {
    if (Number.isNaN(v)) return;
    setPct(Math.max(PCT_MIN, Math.min(PCT_MAX, v)));
  };
  const onAmtChange = (amtEok) => {
    if (Number.isNaN(amtEok) || T_nhi0 <= 0) return;
    const newPct = (amtEok * 1e8 / T_nhi0) * 100;
    setPct(Math.max(PCT_MIN, Math.min(PCT_MAX, newPct)));
  };

  // 적용/되돌리기
  const handleApply = () => {
    setAppliedSnapshot([...state.F_g]);
    setFAll(F_new);
  };
  const handleRevert = () => {
    if (appliedSnapshot) {
      setFAll(appliedSnapshot);
      setAppliedSnapshot(null);
    }
  };
  const handleResetSlider = () => {
    setPct(0);
    setRule("hcc");
  };

  // ── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border-2 shadow-md p-4 sm:p-5 space-y-4"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)", borderColor: "#a78bfa" }}>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-bold text-base text-violet-900 flex items-center gap-2">
            <span className="inline-grid place-items-center w-7 h-7 rounded-lg text-white text-sm"
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>⚖️</span>
            <span>F 균형추 보정 <span className="text-[11px] font-medium text-violet-700/80">· 정책 모드 전용 · 양방향</span></span>
          </h2>
          <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
            추 위치 = <b className="text-violet-700">baseline 대비 공단 외래 지출 목표 변화율</b>. <b>0% = 절대 재정중립</b> (baseline 대비 변화 0원). 좌측은 절감, 우측은 투자. <b>Shared Saving은 별도 풀</b>로 본 모듈과 무관.
          </div>
        </div>
        <button onClick={handleResetSlider}
          className="text-xs text-violet-700 hover:text-red-600 border border-violet-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
          ↩ 초기화
        </button>
      </div>

      {/* 등록환자 규모 NumBox */}
      {(() => {
        const nRegPerClinic = Math.max(1, state.regDist.reduce((s, n) => s + n, 0));
        const totalRegistered = state.M_clinics * nRegPerClinic;
        const onScaleChange = (v) => {
          const newM = Math.max(1, Math.round(v / nRegPerClinic));
          set("M_clinics", newM);
        };
        return (
          <div className="flex items-center gap-3 flex-wrap bg-violet-50/70 border border-violet-200 rounded-lg px-3 py-2">
            <span className="text-[11px] font-bold text-violet-800 shrink-0">🏢 등록환자 규모</span>
            <NumBox value={totalRegistered} onChange={onScaleChange} color="#7c3aed" suffix="명" />
            <span className="text-[10px] text-violet-700/70 leading-relaxed">
              = 의원당 <b className="font-semibold">{nRegPerClinic.toLocaleString()}명</b> × 의원 <b className="font-semibold tabular-nums">{state.M_clinics.toLocaleString()}개</b>
              <span className="text-violet-400 mx-1">·</span>의원당 등록환자는 환자군 패널에서 조정
            </span>
          </div>
        );
      })()}

      {/* ━━━━━━━━ 슬라이더 영역 ━━━━━━━━ */}
      <div className="bg-white rounded-xl border border-violet-100 p-4 sm:p-5 space-y-4">
        {/* 헤더 + 신호등 배지 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">1</span>
            목표 공단 지출 영향 <span className="text-[11px] font-normal text-slate-500">(참여 전 baseline 대비)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ background: sig.bg, color: sig.color, borderColor: sig.bd }}
            title="시각적 가이드 (정책 근거 없음)">
            <span>{sig.txt}</span>
          </div>
        </div>

        {/* 슬라이더 본체 — 6단계 그라디언트 + 0% 중심선 + 양방향 thumb */}
        <div className="relative pt-2 pb-7">
          {/* 0% 중심선 (33.33%) — 절대 재정중립 시각적 강조 */}
          <div className="absolute pointer-events-none"
            style={{
              left: `${pctToLeft(0)}%`, top: 8, bottom: 28, width: 2,
              background: "rgba(16,185,129,0.65)",
              transform: "translateX(-50%)",
              zIndex: 1,
            }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-700 whitespace-nowrap"
              style={{ textShadow: "0 0 4px rgba(255,255,255,0.9)" }}>
              재정중립
            </div>
          </div>

          {/* 슬라이더 — pct ∈ [-5, +10] → value ∈ [-50, +100], step=1 (0.1% 정밀도) */}
          <input type="range" min={-50} max={100} step={1}
            value={Math.round(pct * 10)}
            onChange={e => setPct(parseFloat(e.target.value) / 10)}
            aria-label="목표 공단 지출 영향 비율 (음수 절감, 양수 투자)"
            aria-valuemin={PCT_MIN}
            aria-valuemax={PCT_MAX}
            aria-valuenow={pct}
            className="balance-thumb w-full"
            style={{
              // 6단계 그라디언트 (좌→우):
              //  −5%~−3% deep-blue / −3%~−1% blue / −1%~0% green-pale /
              //  0%~+2% green / +2%~+5% yellow / +5%~+8% orange / +8%~+10% red
              //  위치 매핑: 13.33 / 26.67 / 33.33 / 46.67 / 66.67 / 86.67 / 100
              background: "linear-gradient(to right, " +
                "#bfdbfe 0%, #bfdbfe 13.33%, " +
                "#dbeafe 13.33%, #dbeafe 26.67%, " +
                "#d1fae5 26.67%, #d1fae5 33.33%, " +
                "#a7f3d0 33.33%, #a7f3d0 46.67%, " +
                "#fde68a 46.67%, #fde68a 66.67%, " +
                "#fed7aa 66.67%, #fed7aa 86.67%, " +
                "#fecaca 86.67%, #fecaca 100%)",
              ['--thumb-bg']: sig.color,
            }} />

          {/* 눈금 표기 */}
          <div className="absolute left-0 right-0 top-7 pointer-events-none">
            {[-5, -3, -1, 0, 1, 3, 5, 8, 10].map(v => (
              <div key={v} className="absolute text-[10px] font-mono"
                style={{
                  left: `${pctToLeft(v)}%`,
                  transform: "translateX(-50%)",
                  color: v === 0 ? "#059669" : "#94a3b8",
                  fontWeight: v === 0 ? 700 : 400,
                }}>
                {v > 0 ? `+${v}` : v}%
              </div>
            ))}
          </div>
        </div>

        {/* 영역 라벨 (7개 zone) */}
        <div className="flex text-[10px] font-semibold uppercase tracking-wider -mt-2">
          <div className="text-center text-blue-700"     style={{ width: "13.33%" }}>강한 절감</div>
          <div className="text-center text-blue-500"     style={{ width: "13.33%" }}>절감</div>
          <div className="text-center text-emerald-600"  style={{ width: "6.67%" }}>미세</div>
          <div className="text-center text-emerald-700"  style={{ width: "13.33%" }}>재정중립</div>
          <div className="text-center text-amber-700"    style={{ width: "20%" }}>적극 투자</div>
          <div className="text-center text-orange-700"   style={{ width: "20%" }}>고투자</div>
          <div className="text-center text-red-700"      style={{ width: "13.33%" }}>협상한계</div>
        </div>

        {/* 프리셋 6개 + 추 표시 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap flex-1">
            {PRESETS.map(p => {
              const active = Math.abs(p.v - pct) < 0.05;
              return (
                <button key={p.v} onClick={() => setPct(p.v)}
                  className={`flex-1 min-w-[52px] px-1.5 py-1.5 rounded-lg border font-semibold text-xs transition ${
                    active
                      ? "bg-violet-600 text-white border-violet-600 shadow"
                      : "bg-white text-slate-700 border-slate-200 hover:border-violet-400 hover:text-violet-700"
                  }`}>
                  <div>{p.label}</div>
                  <div className={`text-[10px] font-medium ${active ? "text-violet-100" : "text-slate-400"}`}>{p.sub}</div>
                </button>
              );
            })}
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 text-center min-w-[88px]">
            <div className="text-[10px] text-violet-600 font-semibold">현재 추 위치</div>
            <div className="text-base font-extrabold text-violet-700 tabular-nums">
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 직접입력 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 h-9 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
            <span className="text-[10px] text-slate-400 mr-2 font-medium">비율</span>
            <input type="number" value={pct.toFixed(1)} step={0.1} min={PCT_MIN} max={PCT_MAX}
              onChange={e => onPctChange(parseFloat(e.target.value))}
              className="flex-1 outline-none text-sm font-semibold tabular-nums text-right bg-transparent" />
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">%</span>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 h-9 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
            <span className="text-[10px] text-slate-400 mr-2 font-medium">금액</span>
            <input type="number" value={(changeAfterApply / 1e8).toFixed(0)} step={1}
              onChange={e => onAmtChange(parseFloat(e.target.value))}
              className="flex-1 outline-none text-sm font-semibold tabular-nums text-right bg-transparent" />
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">억원</span>
          </div>
        </div>

        {/* ━━━━ 윈윈 카드 — 3-mode 분기 (양수 / 음수 / 0%) ━━━━ */}
        <WinWinGrid
          pct={pct}
          isExactZero={isExactZero}
          isNegative={isNegative}
          changeAfterApply={changeAfterApply}
          T_nhi0={T_nhi0}
          extraPerClinic={extraPerClinic}
          regDistTotal={state.regDist.reduce((s,n)=>s+n,0)}
          M={M}
        />
      </div>

      {/* ━━━━━━━━ 분배 규칙 ━━━━━━━━ */}
      <div className="bg-white/70 rounded-xl border border-violet-100 p-3 sm:p-4">
        <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
          <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">2</span>
          F 분배 규칙
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {RULE_OPTS.map(r => {
            const active = rule === r.id;
            return (
              <button key={r.id} onClick={() => setRule(r.id)}
                className={`text-left p-2.5 rounded-lg border transition ${
                  active
                    ? "bg-violet-50 border-violet-500"
                    : "bg-white border-slate-200 hover:border-violet-400"
                }`}>
                <div className={`text-sm font-bold ${active ? "text-violet-700" : "text-slate-800"}`}>{r.name}</div>
                <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{r.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━━━━━━━ 음수 F 시나리오 안내 (음수 영역 진입 시) ━━━━━━━━ */}
      {isNegative && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900 leading-relaxed">
          <span className="font-bold">⚠️ 음수 F 시나리오</span> — 환자군 기본수가에서 일부를 차감하는 시나리오입니다.
          정책 협상 하한선 탐색 또는 재정 보수적 시나리오에 사용하며, 실제 시범사업 적용 시 음수 F는 권장되지 않습니다.
        </div>
      )}

      {/* ━━━━━━━━ AI 산출 결과 ━━━━━━━━ */}
      <div className="rounded-xl p-4 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
        <div className="flex items-center gap-2 mb-1 opacity-90 flex-wrap">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-300"
            style={{ boxShadow: "0 0 10px #a78bfa", animation: "pulse 1.5s ease-in-out infinite" }} />
          <span className="text-xs font-semibold">AI 산출 결과</span>
          {hasNegative && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.25)", color: "#fecaca", border: "1px solid rgba(252,165,165,0.5)" }}>
              ⚠️ 음수 F 포함
            </span>
          )}
        </div>
        <div className="text-sm font-bold mb-3">
          제안 F (환자군별 절대값 · {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% 시나리오)
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SH.map((g, i) => {
            const F_val = F_new[i] || 0;
            const dF = dF_array[i] || 0;
            const isNeg = F_val < 0;
            return (
              <div key={i} className="rounded-lg p-2.5 text-center border"
                style={{
                  background: isNeg ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.08)",
                  borderColor: isNeg ? "rgba(252,165,165,0.6)" : "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)"
                }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: CL[i] }}>{g}</div>
                <div className="text-base font-extrabold tabular-nums"
                  style={{ color: isNeg ? "#fecaca" : "white" }}>
                  {isNeg && <span className="mr-0.5">⚠</span>}
                  {f(F_val)}<span className="text-[10px] opacity-60 ml-0.5">원</span>
                </div>
                <div className="text-[11px] font-semibold tabular-nums mt-0.5"
                  style={{ color: isNeg ? "#fca5a5" : "#c4b5fd" }}>
                  {dF >= 0 ? "+" : ""}{f(Math.round(dF))}원
                </div>
              </div>
            );
          })}
        </div>

        {hasNegative && (
          <div className="mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(252,165,165,0.4)", color: "#fee2e2" }}>
            ⚠️ 일부 환자군의 F가 음수입니다. 환자군 기본수가에서 차감되는 시나리오로,
            실제 시범사업 적용 시 권장되지 않습니다. 정책 협상 하한선 탐색용으로만 활용하세요.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <button onClick={handleApply}
            className="sm:col-span-2 px-3 py-2.5 rounded-lg font-bold text-sm transition shadow"
            style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "white" }}>
            ✓ 위 F 값을 슬라이더에 적용
          </button>
          {appliedSnapshot ? (
            <button onClick={handleRevert}
              className="px-3 py-2.5 rounded-lg font-semibold text-sm border transition"
              style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.25)", color: "white" }}>
              ↩ 직전 F로 되돌리기
            </button>
          ) : (
            <div className="px-3 py-2.5 rounded-lg text-xs text-violet-200 leading-snug border opacity-70"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.15)" }}>
              ※ 적용 후 직전 F 백업 활성화
            </div>
          )}
        </div>

        <div className="text-[10px] text-violet-200/80 mt-2.5 leading-relaxed">
          ※ 적용 시 위쪽 F 슬라이더 4개가 즉시 갱신됩니다. 적용 후 균형추를 다시 움직여도 F는 자동 갱신되지 않으며, 다시 적용 버튼을 눌러야 반영됩니다.
        </div>
      </div>

      {/* 메모 */}
      <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50/60 rounded-lg p-2.5 border-l-2 border-slate-300">
        <div>
          <b className="text-slate-700">규모 기준</b>: 사업 참여 의원 수 <b className="font-mono text-violet-700">M = {M.toLocaleString()}개</b>. M을 바꾸면 baseline·등록환자수가 함께 변해 자릿수가 통째로 달라집니다.
        </div>
        <div className="mt-1">
          <b className="text-slate-700">기준 (분모)</b>: <b>baseline T<sub>nhi0</sub></b> = <b className="font-mono">{fAuto(T_nhi0)}</b> (참여 전 전원 FFS) — 추 위치 ×%만큼 변화시키는 것이 목표.
        </div>
        <div className="mt-1">
          <b className="text-slate-700">F 절대값 산출</b>: F<sub>total</sub> = baseline×(1+pct/100) − (현 NHI − 현 F 기여분) → 분배 규칙으로 4군 1인당 F 산출 (음수 가능).
        </div>
        <div className="mt-1">
          <b className="text-slate-700">분자</b>: 사업 참여 등록환자 = <b className="font-mono">{N_reg_total.toLocaleString()}명</b> · 의원당 평균 <b className="font-mono">{(N_reg_total / M).toLocaleString()}명</b>.
        </div>
        <div className="mt-1"><b className="text-slate-700">신호등 임계값</b>: 시각적 가이드 (정책 근거 없음, v6.9.2-bidir 7단계).</div>
      </div>
    </div>
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 윈윈 카드 — 3-mode 분기 (양수 / 음수 / 0%)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function WinWinGrid({ pct, isExactZero, isNegative, changeAfterApply, T_nhi0, extraPerClinic, regDistTotal, M }) {
  // 공통: 우측은 "F 가산 효과" (적용 시 의원당 F 가산분 변화 = ΔF × regDist)
  const isExtraPositive = extraPerClinic > 0;
  const isExtraNegative = extraPerClinic < 0;

  // 좌측: 공단 외래 지출 변화 (현재 vs 적용 후) — 항상 baseline 대비
  const pctAfter = T_nhi0 > 0 ? (changeAfterApply / T_nhi0) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {/* 좌: 공단 외래 지출 영향 (단일 표시 · A안 — 현재 시뮬 비교 칸 제거. 본 모듈 위 KPI 박스에서 이미 노출) */}
      <div className="rounded-xl p-3 border"
        style={{
          background: isExactZero
            ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
            : isNegative
            ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
            : "linear-gradient(135deg, #f0f9ff 0%, #cffafe 100%)",
          borderColor: isExactZero ? "#34d399" : isNegative ? "#93c5fd" : "#7dd3fc",
          boxShadow: isExactZero ? "0 4px 12px rgba(16,185,129,0.15)" : "none",
        }}>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
          style={{ color: isExactZero ? "#047857" : isNegative ? "#1d4ed8" : "#0e7490" }}>
          {isExactZero ? "🟢 재정 중립 달성" : isNegative ? "🟦 공단 외래 지출 절감" : "🔵 공단 외래 지출 변화"}
        </div>
        <div className="text-[11px] font-semibold mb-0.5"
          style={{ color: isExactZero ? "#047857" : "#7c3aed" }}>
          균형추 {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% 적용 시 <span className="font-normal text-slate-500">· baseline 대비</span>
        </div>
        <div className="text-2xl font-extrabold tabular-nums leading-tight"
          style={{ color: isExactZero ? "#059669" : changeAfterApply < 0 ? "#0e7490" : changeAfterApply > 0 ? "#dc2626" : "#475569" }}>
          {isExactZero ? "±0원" : diffAuto(0, changeAfterApply)}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{pctAfter >= 0 ? "+" : ""}{pctAfter.toFixed(2)}% · baseline {fAuto(T_nhi0)}</div>
        <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
          {isExactZero
            ? "✓ 공단 외래 지출이 baseline과 정확히 일치. 건정심 협상 시 가장 친화적 영역 (재정중립)."
            : isNegative
            ? <>F를 음수로 설정하여 baseline 대비 <b className="text-blue-700">{fChangeAuto(Math.abs(changeAfterApply))}</b> 절감 — 재정 보수 시나리오. 단, 의원 수입 영향 검토 필요.</>
            : <>F 추가 투입으로 baseline 대비 <b className="text-rose-700">+{fAuto(changeAfterApply)}</b> 증가.</>
          }
        </div>
      </div>

      {/* 우: 의원 수입 영향 (F 가산 효과 — 양수/음수 색상 분기) */}
      <div className="rounded-xl p-3 border"
        style={{
          background: isExtraNegative
            ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
            : isExactZero
            ? "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)"
            : "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
          borderColor: isExtraNegative ? "#fbbf24" : isExactZero ? "#cbd5e1" : "#93c5fd",
        }}>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
          style={{ color: isExtraNegative ? "#b45309" : isExactZero ? "#475569" : "#1d4ed8" }}>
          {isExtraNegative ? "🟡 의원 수입 영향 (F 차감)" : isExactZero ? "🔵 의원 수입 영향" : "🔵 의원 수입 강화 (F 가산)"}
        </div>
        <div className="text-xl font-extrabold tabular-nums"
          style={{ color: isExtraNegative ? "#b45309" : isExactZero ? "#475569" : "#1d4ed8" }}>
          {isExtraNegative ? fMan(extraPerClinic) : `+${fMan(Math.abs(extraPerClinic))}`}
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          /의원·년 · 사업 전체 {extraPerClinic >= 0 ? "+" : ""}{fAuto(extraPerClinic * M)}
        </div>
        <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
          {isExtraNegative
            ? "⚠ F 차감 시나리오 — 환자군 기본수가에서 차감 적용. 의원 선지급 수입 감소. 의료계 수용성 검토 필요."
            : isExactZero && Math.abs(extraPerClinic) < 1e3
            ? <>현재 F와 동일 — F 변화 없음. 적용 후 슬라이더 4개 값 유지 (의원당 등록환자 {regDistTotal.toLocaleString()}명).</>
            : <>F 변화분이 의원당 등록환자({regDistTotal.toLocaleString()}명)에 직접 적용됩니다. ΔF × 의원당 등록 합계.</>
          }
        </div>
      </div>
    </div>
  );
}
