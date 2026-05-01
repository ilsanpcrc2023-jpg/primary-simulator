import { memo, useState, useMemo, useRef, useEffect } from "react";
import { f, fAuto, fMan, diffMan } from "../utils";
import { SH, CL } from "../constants";

// v6.9.2: F 균형추 보정 모듈 (정책 모드 전용)
// - 추 위치(0~10%) = 현재 공단 의원급 외래 지출(T.nhi) 대비 추가 투입 강도
// - ΔF_total = T.nhi × (pct/100) → 분배 규칙(HCC비례·균등·역비례)으로 4군에 분배
// - 좌측 윈윈: 포괄관리 성과가산 잠재 (L2 5%p 추가 개선 가정 시 의원당 추가 가산)
// - 우측 윈윈: F 가산 효과 (의원당 ΔF × 등록환자수)
// - Shared Saving은 이 모듈에 포함하지 않음 (별도 풀, 일차의료수가 아님)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 분배 함수 (테스트 가능하도록 export)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function distribute(deltaTotal, rule, B, n_total_g) {
  const N = n_total_g.reduce((s, n) => s + n, 0);
  if (N <= 0 || deltaTotal <= 0 || B.length === 0) {
    return B.map(() => 0);
  }
  if (rule === "equal") {
    const dF = deltaTotal / N;
    return B.map(() => dF);
  }
  if (rule === "hcc") {
    const w = B.map((b, i) => b * n_total_g[i]);
    const W = w.reduce((s, x) => s + x, 0);
    if (W <= 0) return B.map(() => 0);
    return B.map((_, i) => (deltaTotal * w[i] / W) / Math.max(1, n_total_g[i]));
  }
  // inverse: 1/B 가중
  const w = B.map((b, i) => (b > 0 ? (1 / b) * n_total_g[i] : 0));
  const W = w.reduce((s, x) => s + x, 0);
  if (W <= 0) return B.map(() => 0);
  return B.map((_, i) => (deltaTotal * w[i] / W) / Math.max(1, n_total_g[i]));
}

// 신호등 임계값 — 시각적 가이드 (정책 근거 없음, v6.9.2)
export function signalLevel(pct) {
  if (pct <= 2) return { cls: "green", txt: "🟢 재정중립", color: "#16a34a", bg: "rgba(34,197,94,0.12)", bd: "rgba(34,197,94,0.4)" };
  if (pct <= 5) return { cls: "yellow", txt: "🟡 적극 투자", color: "#b45309", bg: "rgba(245,158,11,0.12)", bd: "rgba(245,158,11,0.5)" };
  if (pct <= 8) return { cls: "orange", txt: "🟠 고투자", color: "#c2410c", bg: "rgba(249,115,22,0.12)", bd: "rgba(249,115,22,0.5)" };
  return { cls: "red", txt: "🔴 협상 한계", color: "#b91c1c", bg: "rgba(239,68,68,0.12)", bd: "rgba(239,68,68,0.5)" };
}

const RULE_OPTS = [
  { id: "hcc", name: "📊 HCC 비례", desc: "위험도 높을수록 두텁게 (4군 강화)" },
  { id: "equal", name: "⚖️ 균등", desc: "등록환자 1인당 동일 ΔF" },
  { id: "inverse", name: "🌱 역비례", desc: "경증 등록 진입 인센티브" },
];

const PRESETS = [
  { v: 0, label: "0%", sub: "자동균형" },
  { v: 1, label: "+1%", sub: "최소투입" },
  { v: 3, label: "+3%", sub: "표준투입" },
  { v: 5, label: "+5%", sub: "적극투입" },
];

// v6.9.2: 사업 참여 의원 수 미러 프리셋 (환자군 패널 M 컨트롤과 동일 state 공유).
// 균형추의 분모(T.nhi)·분자(Σ n_reg) 모두 M에 비례하므로, 균형추 헤더에서 직접 조정 가능하도록 노출.
const M_PRESETS = [10, 100, 1000, 3000];

export default memo(function FBalanceCorrection({
  state, set, G, T, performance: perfMemo, setFAll
}) {
  const [pct, setPct] = useState(3.0);
  const [rule, setRule] = useState("hcc");
  const [appliedSnapshot, setAppliedSnapshot] = useState(null); // 적용 직전 F 백업

  // ── 도메인 매핑 ─────────────────────────────────────────────
  // 분모: 현재 공단 의원급 외래 지출 (사업 후, L2 반영)
  const baseNHI = T.nhi;
  const deltaTotal = baseNHI * (pct / 100);

  // 환자군별 사업 참여 등록환자 합계 (전체 = M_clinics × regDist)
  const B = state.P;
  const n_total_g = G.map(r => r.n_reg);
  const N_reg_total = n_total_g.reduce((s, n) => s + n, 0);
  const M = Math.max(1, state.M_clinics);

  // ── ΔF 분배 ─────────────────────────────────────────────────
  const dF_array = useMemo(
    () => distribute(deltaTotal, rule, B, n_total_g),
    [deltaTotal, rule, B, n_total_g]
  );
  const F_new = state.F_g.map((fv, i) => Math.max(0, Math.round(fv + dF_array[i])));

  // ── 의원당 효과 ──────────────────────────────────────────────
  // 우측 윈윈: 의원당 F 가산분 = Σ ΔF[i] × regDist[i]
  const extraPerClinic = state.regDist.reduce(
    (s, n_pc, i) => s + (dF_array[i] || 0) * n_pc, 0
  );

  // 좌측 윈윈: 포괄관리 성과가산 잠재 (L2 5%p 추가 개선 가정)
  // 추가 가산 = Σ 0.05 × B × n_reg × trackMul (현재 Track 반영)
  const trackMul = Math.max(0, Math.min(1, state.hccPct / 100));
  const additionalPerf_5pp_total = G.reduce(
    (s, r) => s + 0.05 * r.p * r.n_reg * trackMul, 0
  );
  const additionalPerf_5pp_perClinic = additionalPerf_5pp_total / M;

  // ── 신호등 + 추 위치 ─────────────────────────────────────────
  const sig = signalLevel(pct);
  const trackPos = Math.max(0, Math.min(100, pct * 10));

  // 직접입력 동기화
  const onPctChange = (v) => {
    if (Number.isNaN(v)) return;
    setPct(Math.max(0, Math.min(20, v)));
  };
  const onAmtChange = (amtEok) => {
    if (Number.isNaN(amtEok) || baseNHI <= 0) return;
    const newPct = (amtEok * 1e8 / baseNHI) * 100;
    setPct(Math.max(0, Math.min(20, newPct)));
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
    setPct(3.0);
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
            <span>F 균형추 보정 <span className="text-[11px] font-medium text-violet-700/80">· 정책 모드 전용</span></span>
          </h2>
          <div className="text-[11px] text-slate-600 mt-1 leading-relaxed">
            추를 좌우로 옮겨 추가 투입할 재정 강도를 정하면 환자군별 F가 자동 산출됩니다. <b>Shared Saving은 별도 풀</b>로 본 모듈과 무관.
          </div>
        </div>
        <button onClick={handleResetSlider}
          className="text-xs text-violet-700 hover:text-red-600 border border-violet-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
          ↩ 초기화
        </button>
      </div>

      {/* v6.9.2: 사업 참여 의원 수 미러 프리셋 — 환자군 패널 M과 동일 state 공유.
          M은 분모(T.nhi)·분자(Σ n_reg) 양쪽을 동시에 흔드는 1차 변수이므로 균형추에서 직접 조정 가능. */}
      <div className="flex items-center gap-2 flex-wrap bg-violet-50/70 border border-violet-200 rounded-lg px-3 py-2">
        <span className="text-[11px] font-bold text-violet-800">🏢 사업 참여 의원 수</span>
        <div className="flex gap-1 flex-wrap">
          {M_PRESETS.map(m => {
            const active = state.M_clinics === m;
            return (
              <button key={m} onClick={() => set("M_clinics", m)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition border ${
                  active
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-white text-slate-700 border-violet-200 hover:border-violet-400 hover:text-violet-700"
                }`}>
                {m.toLocaleString()}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-violet-700/70 ml-auto">
          현재 <b className="font-semibold tabular-nums">{state.M_clinics.toLocaleString()}</b>개 (환자군 패널과 동기화)
        </span>
      </div>

      {/* ━━━━━━━━ 슬라이더 영역 ━━━━━━━━ */}
      <div className="bg-white rounded-xl border border-violet-100 p-4 sm:p-5 space-y-4">
        {/* 헤더 + 신호등 배지 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">1</span>
            목표 공단 지출 영향 <span className="text-[11px] font-normal text-slate-500">(현 시뮬 결과 대비)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ background: sig.bg, color: sig.color, borderColor: sig.bd }}
            title="시각적 가이드 (정책 근거 없음)">
            <span>{sig.txt}</span>
          </div>
        </div>

        {/* 슬라이더 본체 — 신호등 그라디언트 + 큰 thumb (수평 균형추 비주얼) */}
        <div className="relative pt-2 pb-7">
          <input type="range" min={0} max={100} step={1} value={trackPos}
            onChange={e => setPct(parseFloat(e.target.value) / 10)}
            aria-label="목표 공단 지출 영향 비율"
            className="balance-thumb w-full"
            style={{
              background: "linear-gradient(to right, #d1fae5 0%, #d1fae5 20%, #fde68a 20%, #fde68a 50%, #fed7aa 50%, #fed7aa 80%, #fecaca 80%, #fecaca 100%)",
              ['--thumb-bg']: sig.color,
              ['--thumb-pct']: `+${pct.toFixed(1)}%`,
            }} />

          {/* 눈금 표기 */}
          <div className="absolute left-0 right-0 top-7 flex pointer-events-none">
            {[0, 2, 3, 5, 8, 10].map(v => (
              <div key={v} className="absolute text-[10px] text-slate-400 font-mono"
                style={{ left: `${v * 10}%`, transform: "translateX(-50%)" }}>{v}%</div>
            ))}
          </div>
        </div>

        {/* 영역 라벨 */}
        <div className="flex text-[10px] font-semibold uppercase tracking-wider -mt-2">
          <div className="text-center text-emerald-700" style={{ width: "20%" }}>재정중립</div>
          <div className="text-center text-amber-700" style={{ width: "30%" }}>적극 투자</div>
          <div className="text-center text-orange-700" style={{ width: "30%" }}>고투자</div>
          <div className="text-center text-red-700" style={{ width: "20%" }}>협상한계</div>
        </div>

        {/* 프리셋 + 추 표시 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {PRESETS.map(p => {
              const active = Math.abs(p.v - pct) < 0.05;
              return (
                <button key={p.v} onClick={() => setPct(p.v)}
                  className={`flex-1 min-w-[64px] px-2 py-1.5 rounded-lg border font-semibold text-xs transition ${
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
            <div className="text-base font-extrabold text-violet-700 tabular-nums">+{pct.toFixed(1)}%</div>
          </div>
        </div>

        {/* 직접입력 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 h-9 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
            <span className="text-[10px] text-slate-400 mr-2 font-medium">비율</span>
            <input type="number" value={pct.toFixed(1)} step={0.1} min={0} max={20}
              onChange={e => onPctChange(parseFloat(e.target.value))}
              className="flex-1 outline-none text-sm font-semibold tabular-nums text-right bg-transparent" />
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">%</span>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 h-9 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
            <span className="text-[10px] text-slate-400 mr-2 font-medium">금액</span>
            <input type="number" value={(deltaTotal / 1e8).toFixed(0)} step={1} min={0}
              onChange={e => onAmtChange(parseFloat(e.target.value))}
              className="flex-1 outline-none text-sm font-semibold tabular-nums text-right bg-transparent" />
            <span className="text-[10px] text-slate-500 ml-1 font-semibold">억원</span>
          </div>
        </div>

        {/* 윈윈 카드 */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${pct < 0.5 ? "opacity-60" : ""}`}>
          {/* 좌: 포괄관리 성과가산 잠재 (보조 표시) */}
          <div className="rounded-xl p-3 border" style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", borderColor: "#86efac" }}>
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">🟢 포괄관리 성과가산 잠재</div>
            <div className="text-xl font-extrabold tabular-nums text-emerald-800">
              +{fMan(additionalPerf_5pp_perClinic)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">/의원·년 (L2 5%p 추가 개선 시)</div>
            <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              주치의 포괄·지속 진료가 닥터쇼핑·중복검사를 줄여 의료비 자체가 감소 → 시스템 선순환
            </div>
          </div>
          {/* 우: 의원 수입 강화 (F 가산 효과 — 본 모듈 직접 효과) */}
          <div className="rounded-xl p-3 border" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">🔵 의원 수입 강화 (F 가산)</div>
            <div className="text-xl font-extrabold tabular-nums text-blue-800">
              +{fMan(extraPerClinic)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">/의원·년 · 사업 전체 +{fAuto(extraPerClinic * M)}</div>
            <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              F 추가 가산분이 의원당 등록환자({state.regDist.reduce((s,n)=>s+n,0).toLocaleString()}명)에 직접 분배됩니다.
            </div>
          </div>
        </div>
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

      {/* ━━━━━━━━ AI 산출 결과 ━━━━━━━━ */}
      <div className="rounded-xl p-4 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
        <div className="flex items-center gap-2 mb-1 opacity-90">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-300"
            style={{ boxShadow: "0 0 10px #a78bfa", animation: "pulse 1.5s ease-in-out infinite" }} />
          <span className="text-xs font-semibold">AI 산출 결과</span>
        </div>
        <div className="text-sm font-bold mb-3">제안 F (환자군별 · ΔF 가산 후)</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SH.map((g, i) => {
            const dF = dF_array[i] || 0;
            return (
              <div key={i} className="rounded-lg p-2.5 text-center border"
                style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: CL[i] }}>{g}</div>
                <div className="text-base font-extrabold tabular-nums">{f(F_new[i])}<span className="text-[10px] opacity-60 ml-0.5">원</span></div>
                <div className="text-[11px] font-semibold tabular-nums mt-0.5" style={{ color: "#c4b5fd" }}>
                  {dF >= 0 ? "+" : ""}{f(Math.round(dF))}원
                </div>
              </div>
            );
          })}
        </div>

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
          <b className="text-slate-700">규모 기준</b>: 사업 참여 의원 수 <b className="font-mono text-violet-700">M = {M.toLocaleString()}개</b>. M을 바꾸면 분모·분자가 함께 변해 자릿수가 통째로 달라집니다.
        </div>
        <div className="mt-1"><b className="text-slate-700">분모</b>: 현재 공단 의원급 외래 지출 = <b className="font-mono">{fAuto(baseNHI)}</b> (사업 후·L2 반영). 추 위치 ×%만큼 추가 투입.</div>
        <div className="mt-1"><b className="text-slate-700">분자</b>: 사업 참여 등록환자 = <b className="font-mono">{N_reg_total.toLocaleString()}명</b> · 의원당 평균 <b className="font-mono">{(N_reg_total / M).toLocaleString()}명</b>.</div>
        <div className="mt-1"><b className="text-slate-700">신호등 임계값</b>: 시각적 가이드 (정책 근거 없음, v6.9.2).</div>
      </div>
    </div>
  );
});
