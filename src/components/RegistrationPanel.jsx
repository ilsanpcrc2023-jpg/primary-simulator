import { memo, useState, useEffect } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL, ON, INIT_F, INIT_REG_DIST } from "../constants";
import { f, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const H2 = "font-bold text-base text-gray-900";
const F_MAX = 600000;

/* % 입력 — 편집 중엔 로컬 state, blur/Enter 시 commit (NumBox와 동일 패턴) */
function PctInput({ value, onChange, color }) {
  const [local, setLocal] = useState(value.toFixed(1));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setLocal(value.toFixed(1)); }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseFloat(local);
    if (!isNaN(v)) onChange(v);
    else setLocal(value.toFixed(1));
  };
  return (
    <input type="text" inputMode="decimal" value={local}
      onFocus={() => setEditing(true)}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="w-12 text-center text-[11px] font-bold border rounded bg-white py-0.5"
      style={{ borderColor: color + "60", color }} />
  );
}

/* FCard — P와 동일한 4 슬라이더+NumBox 구조, 프리셋만 */
export const FCard = memo(function FCard({ state, setFAll, updF, reg, regRatios }) {
  const { F_g } = state;
  const nhiAddFromF = F_g.reduce((s, r, i) => s + r * reg.n_reg_total * regRatios[i], 0);
  const F_mean = Math.round((F_g[0] + F_g[1] + F_g[2] + F_g[3]) / 4);

  const presets = [
    { label: "공식안", v: INIT_F },
    { label: "균등 1만원", v: [10000, 10000, 10000, 10000] },
    { label: "중증 편중", v: [50000, 150000, 350000, 500000] },
  ];

  return (
    <div className={card + " p-4"}>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className={H2}>일차의료 기능수가 (F)</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">평균 {f(F_mean)}원 · 공단 +{fAuto(nhiAddFromF)}</span>
          <div className="flex gap-1">
            {presets.map(p => {
              const active = F_g.every((v, i) => v === p.v[i]);
              return (
                <button key={p.label} onClick={() => setFAll(p.v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={active ? { background: "#f5f3ff", borderColor: "#c4b5fd", color: "#6d28d9" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {SH.map((g, i) => (
          <div key={i} className="space-y-1.5">
            <span className="text-xs font-bold" style={{ color: CL[i] }}>{g} 기능수가</span>
            <input type="range" min={0} max={F_MAX} step={1000} value={Math.min(F_g[i], F_MAX)}
              onChange={e => updF(i, parseFloat(e.target.value))}
              aria-label={`${g} 기능수가 슬라이더`}
              className="w-full big-thumb"
              style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${(Math.min(F_g[i], F_MAX) / F_MAX) * 100}%, #e5e7eb 0%)` }} />
            <div className="text-center">
              <NumBox value={F_g[i]} onChange={v => updF(i, v)} color={CL[i]} suffix="원" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* TCard — 접힘 아코디언 지원 */
export const TCard = memo(function TCard({ state, G }) {
  const { F_g } = state;
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", borderColor: "#c7d2fe" }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/30 transition">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-sm" style={{ color: "#4338ca" }}>통합 수가 (T = P + F)</span>
          <span className="text-[10px] text-indigo-500">명목 청구수가 · 환자군별</span>
        </div>
        <span className="text-indigo-500 text-xs">{open ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1">
          <div className="grid grid-cols-4 gap-2">
            {SH.map((g, i) => (
              <div key={i} className="rounded-lg px-2 py-1.5 text-center bg-white/80" style={{ borderLeft: `4px solid ${CL[i]}` }}>
                <div className="text-[10px] font-bold" style={{ color: CL[i] }}>{g}</div>
                <div className="text-sm font-extrabold text-indigo-800">{f(G[i].p + F_g[i])}원</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* RegScaleCard — 접힘 아코디언, 요약 한 줄 상시, 펼치면 세부 편집 */
export const RegScaleCard = memo(function RegScaleCard({ state, set, reg, updRegDist, setRegDistAll, scaleRegDist, reset, defaultOpen = false }) {
  const { totalN, M_clinics, regDist, baseN_per_clinic } = state;
  const [open, setOpen] = useState(defaultOpen);
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));
  const n_reg_sum = regDist.reduce((s, v) => s + v, 0);
  const regPct = regDist.map(v => n_reg_sum > 0 ? (v / n_reg_sum) * 100 : 0);
  const setBaseN = (v) => set("baseN_per_clinic", Math.max(0, Math.round(v)));

  const setPerClinic = (v) => {
    const n = Math.max(1, Math.round(v));
    const newTotal = Math.max(1, n * Math.max(1, M_clinics));
    set("totalN", newTotal);
    if (newTotal !== ON) set("dataLabel", "시뮬레이션 모드");
  };
  const setMPreservingPerClinic = (m) => {
    const newM = Math.max(1, Math.round(m));
    const newTotal = Math.max(1, perClinic * newM);
    set("M_clinics", newM);
    set("totalN", newTotal);
    if (newTotal !== ON) set("dataLabel", "시뮬레이션 모드");
  };
  const setPctAt = (i, newPct) => {
    const p = Math.max(0, Math.min(100, newPct));
    if (p >= 100) return;
    const others = regDist.reduce((s, v, j) => s + (j === i ? 0 : v), 0);
    const newSum = others / (1 - p / 100);
    const newVal = Math.round(newSum * p / 100);
    const newDist = [...regDist];
    newDist[i] = newVal;
    setRegDistAll(newDist);
  };

  const distPresets = [
    { label: "부록(10/60/20/10)", v: INIT_REG_DIST },
    { label: "균등(25×4)", v: [250, 250, 250, 250] },
    { label: "건강 편중", v: [400, 400, 150, 50] },
    { label: "고위험 편중", v: [50, 350, 300, 300] },
  ];

  return (
    <div className={card + " overflow-hidden"}>
      <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-sm text-gray-900">의원당 환자 규모</span>
          <span className="text-[11px] text-gray-500">
            M {f(M_clinics)} · 환자수 {f(perClinic)} · 등록 {f(n_reg_sum)} (
            {regDist.map((v, i) => (regPct[i]).toFixed(0) + "%").join("/")}
            )
          </span>
        </div>
        <div className="flex items-center gap-2">
          {reset && (
            <button
              onClick={e => {
                e.stopPropagation();
                if (confirm("모든 설정을 기본값(복지부 시범사업안)으로 되돌립니다. 진행할까요?")) reset();
              }}
              className="text-[11px] text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
              ↩ 전체 초기화
            </button>
          )}
          <span className="text-gray-400 text-xs">{open ? "▲ 접기" : "▼ 펼치기"}</span>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100 space-y-2">
          {/* 참여 전 환자수 (기준) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">참여 전 환자수 (기준)</span>
            <NumBox value={baseN_per_clinic} onChange={setBaseN} color="#64748b" suffix="명" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[1000, 1500, 2000, 3000, 5000, 7000, 10000].map(v => (
                <button key={v} onClick={() => setBaseN(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={baseN_per_clinic === v ? { background: "#f1f5f9", borderColor: "#94a3b8", color: "#334155" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
          </div>

          {/* 참여 후 환자수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">참여 후 환자수</span>
            <NumBox value={perClinic} onChange={setPerClinic} color="#1f2937" suffix="명" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[1000, 1500, 2000, 3000, 5000, 7000, 10000].map(v => (
                <button key={v} onClick={() => setPerClinic(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={perClinic === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
          </div>

          {/* 등록 환자 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">등록 환자</span>
            <NumBox value={n_reg_sum} onChange={v => scaleRegDist(Math.max(0, Math.round(v)))} color="#2563eb" suffix="명" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[500, 1000, 1500, 2000].map(v => (
                <button key={v} onClick={() => scaleRegDist(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={n_reg_sum === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
          </div>

          {/* 환자군별 분포 — 컴팩트 (명·% 인라인) */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700">환자군별 분포</span>
              <div className="flex gap-1">
                {distPresets.map(p => {
                  const active = regDist.every((v, i) => v === p.v[i]);
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
            <div className="grid grid-cols-4 gap-1.5">
              {SH.map((g, i) => (
                <div key={i} className="rounded px-1.5 py-1 flex items-center justify-between gap-1"
                  style={{ background: CL[i] + "08", border: `1px solid ${CL[i]}30` }}>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: CL[i] }}>{g}</span>
                  <NumBox value={regDist[i]} onChange={v => updRegDist(i, v)} color={CL[i]} suffix="명" />
                  <PctInput value={regPct[i]} onChange={v => setPctAt(i, v)} color={CL[i]} />
                  <span className="text-[9px] text-gray-500">%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 요약 한 줄 */}
          <div className="pt-1.5 border-t border-gray-100 text-[11px] text-gray-700 font-mono leading-snug">
            의원당 환자수 <b>{f(Math.round(reg.n_total_per_clinic))}</b> = 등록 <b className="text-blue-700">{f(Math.round(reg.n_reg_pc))}</b> ({(reg.regRate * 100).toFixed(1)}%) + 비등록 <b>{f(Math.round(reg.n_total_per_clinic - reg.n_reg_pc))}</b> ({((1 - reg.regRate) * 100).toFixed(1)}%)
          </div>

          {/* 사업 참여 의원 수 — 맨 아래 */}
          <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">사업 참여 의원 수</span>
            <NumBox value={M_clinics} onChange={setMPreservingPerClinic} color="#1f2937" suffix="개" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[10, 100, 1000, 3000].map(v => (
                <button key={v} onClick={() => setMPreservingPerClinic(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={M_clinics === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">전체 N = {f(totalN)}명</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default FCard;
