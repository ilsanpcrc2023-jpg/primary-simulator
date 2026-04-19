import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL, ON, INIT_F, INIT_REG_DIST } from "../constants";
import { f, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const H2 = "font-bold text-base text-gray-900";

/* ─────────────────────────────────────────────
   FCard — 일차의료 기능수가 (F)
   환자군별 4개 NumBox 메인, 슬라이더 없음, 프리셋 버튼
   ───────────────────────────────────────────── */
export const FCard = memo(function FCard({ state, setFAll, updF, resetF, reg, regRatios }) {
  const { F_g } = state;
  const nhiAddFromF = F_g.reduce((s, r, i) => s + r * reg.n_reg_total * regRatios[i], 0);
  const F_mean = Math.round((F_g[0] + F_g[1] + F_g[2] + F_g[3]) / 4);
  const isDefault = F_g.every((v, i) => v === INIT_F[i]);

  const presets = [
    { label: "공식안(차등)", desc: "복지부 공식안 준용", v: INIT_F },
    { label: "균등 1만원", desc: "v6 기본", v: [10000, 10000, 10000, 10000] },
    { label: "중증 편중", desc: "고위험 집중", v: [50000, 150000, 350000, 500000] },
  ];

  return (
    <div className={card + " p-4"}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className={H2}>일차의료 기능수가 (F)</h2>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            주치의 등록관리 + 저평가된 일차의료 본연 기능(만성질환 포괄관리·재택의료·건강상담)의 상대가치 보정
          </p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-[10px] text-gray-400">평균 1인당</div>
          <div className="text-sm font-bold text-purple-700">{f(F_mean)}원/년</div>
        </div>
      </div>

      {/* 프리셋 */}
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="text-[11px] text-gray-500 mr-1 self-center">프리셋:</span>
        {presets.map(p => {
          const active = F_g.every((v, i) => v === p.v[i]);
          return (
            <button key={p.label} onClick={() => setFAll(p.v)} title={p.desc}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={active ? { background: "#f5f3ff", borderColor: "#c4b5fd", color: "#6d28d9" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {p.label}
            </button>
          );
        })}
        {!isDefault && (
          <button onClick={resetF}
            className="text-[11px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 ml-auto">
            공식안으로 초기화
          </button>
        )}
      </div>

      {/* 환자군별 F 입력 — 메인 */}
      <div className="grid grid-cols-4 gap-2">
        {SH.map((g, i) => (
          <div key={i} className="rounded-lg px-2 py-2 text-center" style={{ background: CL[i] + "10", border: `1px solid ${CL[i]}40` }}>
            <div className="text-[11px] font-bold mb-1" style={{ color: CL[i] }}>{g}</div>
            <NumBox value={F_g[i]} onChange={v => updF(i, v)} color={CL[i]} suffix="원" />
            <div className="text-[9px] text-gray-400 mt-0.5">원/년/환자</div>
          </div>
        ))}
      </div>

      {/* 공단 추가 지출 요약 */}
      <div className="mt-3 bg-amber-50 rounded px-3 py-1.5 text-xs flex justify-between items-center">
        <span className="text-gray-600 text-[11px]">공단 추가 지출 (Σ F × 등록환자, 연)</span>
        <span className="font-bold text-amber-700">{nhiAddFromF > 0 ? "+" : ""}{fAuto(nhiAddFromF)}</span>
      </div>

      <div className="mt-2 text-[10.5px] text-gray-600 bg-gray-50 rounded px-2 py-1.5 leading-relaxed">
        ※ F는 행위별 수가에 얹는 add-on이 아니라, <b>환자군 기반 지불 구조 내부에 내장된 기능 상대가치 재조정 항목</b>입니다.
        모든 Track(A/B/C)에서 등록환자에게 가산되며, 타원이용비중(L)과 무관하게 고정 지급됩니다.
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   TCard — 통합 수가 (T = P + F) promoted
   ───────────────────────────────────────────── */
export const TCard = memo(function TCard({ state, G }) {
  const { F_g } = state;

  return (
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", borderColor: "#a5b4fc" }}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-bold text-base" style={{ color: "#4338ca" }}>
          통합 수가 (T = P + F)
        </h2>
        <span className="text-[11px] font-semibold" style={{ color: "#6366f1" }}>명목 청구수가</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SH.map((g, i) => (
          <div key={i} className="rounded-lg px-2 py-2 text-center bg-white/80" style={{ borderLeft: `4px solid ${CL[i]}` }}>
            <div className="text-[11px] font-bold mb-0.5" style={{ color: CL[i] }}>{g}</div>
            <div className="text-sm font-extrabold text-indigo-800">{f(G[i].p + F_g[i])}원</div>
            <div className="text-[9px] text-indigo-400 mt-0.5">P {f(G[i].p)} + F {f(F_g[i])}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-indigo-700 bg-white/60 rounded px-2 py-1.5 leading-relaxed">
        ※ T는 <b>명목(청구) 수가</b>입니다. 공단 실지급 <code className="font-mono text-purple-700">A = P × (1 − L) + F</code> — F는 L과 무관하게 고정 지급 (타원이용비중 카드 참조).
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   RegScaleCard — 등록환자 규모 + 환자군별 분포 (명·%)
   ───────────────────────────────────────────── */
export const RegScaleCard = memo(function RegScaleCard({ state, set, reg, updRegDist, setRegDistAll, scaleRegDist }) {
  const { totalN, M_clinics, regDist, dataLabel } = state;
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));
  const n_reg_sum = regDist.reduce((s, v) => s + v, 0);
  const regPct = regDist.map(v => n_reg_sum > 0 ? (v / n_reg_sum) * 100 : 0);

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

  // % 직접 편집: 다른 3군 합을 유지한 채 해당 군만 목표 %로 맞추기 위해 총합 재계산
  const setPctAt = (i, newPct) => {
    const pct = Math.max(0, Math.min(100, newPct));
    if (pct >= 100) return;
    const others = regDist.reduce((s, v, j) => s + (j === i ? 0 : v), 0);
    const newSum = others / (1 - pct / 100);
    const newVal = Math.round(newSum * pct / 100);
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
    <div className={card + " p-4"}>
      <h2 className={H2 + " mb-3"}>등록환자 규모</h2>

      {/* 의원당 실인원 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">의원당 실인원</span>
        <NumBox value={perClinic} onChange={setPerClinic} color="#1f2937" suffix="명" />
        <div className="flex flex-wrap gap-1 ml-2">
          {[1000, 1500, 2000, 3000, 5000, 7000].map(v => (
            <button key={v} onClick={() => setPerClinic(v)}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={perClinic === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {f(v)}명
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 ml-auto">연인원 아님</span>
      </div>

      {/* 의원 수 M */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">의원 수 (M)</span>
        <NumBox value={M_clinics} onChange={setMPreservingPerClinic} color="#1f2937" suffix="개" />
        <div className="flex flex-wrap gap-1 ml-2">
          {[10, 100, 1000, 3000].map(v => (
            <button key={v} onClick={() => setMPreservingPerClinic(v)}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={M_clinics === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {f(v)}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 ml-auto">파일럿 10 · 시범사업 100 · 전국 ≈ 3,000</span>
      </div>

      <div className="mb-3 px-2 py-1 bg-gray-50 rounded text-[11px] text-gray-600">
        전체 실인원 N = <b className="text-gray-800">{f(totalN)}명</b>
        <span className="text-gray-400"> = 의원당 {f(perClinic)} × M {f(M_clinics)}</span>
      </div>

      {/* 의원당 등록환자수 (합계) */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">의원당 등록환자수</span>
        <NumBox value={n_reg_sum} onChange={v => scaleRegDist(Math.max(0, Math.round(v)))} color="#2563eb" suffix="명" />
        <div className="flex flex-wrap gap-1 ml-2">
          {[500, 1000, 1500, 2000].map(v => (
            <button key={v} onClick={() => scaleRegDist(v)}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={n_reg_sum === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {f(v)}명
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 ml-auto">= Σ 환자군별</span>
      </div>

      {/* 환자군별 등록 분포 (명 + %) */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">환자군별 등록 분포</span>
          <span className="text-[10px] text-gray-400">명·%를 직접 입력하여 편집</span>
        </div>

        {/* 분포 프리셋 */}
        <div className="flex flex-wrap gap-1 mb-2">
          {distPresets.map(p => {
            const active = regDist.every((v, i) => v === p.v[i]);
            return (
              <button key={p.label} onClick={() => setRegDistAll(p.v)}
                className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
                style={active ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {SH.map((g, i) => (
            <div key={i} className="rounded-lg px-2 py-2 text-center" style={{ background: CL[i] + "08", border: `1px solid ${CL[i]}30` }}>
              <div className="text-[11px] font-bold mb-1" style={{ color: CL[i] }}>{g}</div>
              <NumBox value={regDist[i]} onChange={v => updRegDist(i, v)} color={CL[i]} suffix="명" />
              <div className="mt-1 flex items-center justify-center gap-1">
                <input type="number" value={regPct[i].toFixed(1)}
                  onChange={e => setPctAt(i, parseFloat(e.target.value))}
                  step={0.1} min={0} max={100}
                  className="w-12 text-center text-[11px] font-bold border rounded bg-white py-0.5"
                  style={{ borderColor: CL[i] + "60", color: CL[i] }} />
                <span className="text-[10px] text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-gray-500 italic">
          ※ 환자군별 등록 분포 실측 자료는 아직 없습니다. 기본 10/60/20/10은 <b>보고서 부록의 추정치</b>이며, 다른 가정으로 얼마든지 변경 가능합니다. 명 입력 시 %가 자동 계산되고, % 입력 시 다른 군 비율을 유지한 채 해당 군만 조정됩니다.
        </div>
      </div>

      {/* 요약 */}
      <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 rounded px-2 py-1.5">
          <div className="text-gray-500 text-[10px]">의원당 실인원</div>
          <div className="font-bold text-gray-800">{f(Math.round(reg.n_total_per_clinic))}명</div>
        </div>
        <div className="bg-blue-50 rounded px-2 py-1.5">
          <div className="text-blue-600 text-[10px]">의원당 등록환자</div>
          <div className="font-bold text-blue-700">{f(Math.round(reg.n_reg_pc))}명</div>
          <div className="text-[10px] text-blue-500">등록률 {(reg.regRate * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-slate-50 rounded px-2 py-1.5">
          <div className="text-slate-500 text-[10px]">의원당 비등록 (FFS)</div>
          <div className="font-bold text-slate-700">{f(Math.round(reg.n_total_per_clinic - reg.n_reg_pc))}명</div>
        </div>
      </div>
      <div className="mt-2 bg-gray-50/70 rounded px-2 py-1 text-[11px] text-gray-600 leading-snug">
        <span className="font-mono">의원당 실인원 {f(Math.round(reg.n_total_per_clinic))} = 등록 {f(Math.round(reg.n_reg_pc))} + 비등록 {f(Math.round(reg.n_total_per_clinic - reg.n_reg_pc))}</span>
        <span className="text-gray-400"> · 전체 N = {f(Math.round(reg.n_reg_total + reg.n_unreg_total))}명 ({f(Math.round(reg.n_reg_total))} + {f(Math.round(reg.n_unreg_total))})</span>
      </div>
      <div className="mt-1 text-[10px] text-gray-400 italic">
        ※ 실인원 = 1년간 방문횟수와 무관하게 환자 1명 = 1로 집계. 연인원(방문건수) 아님.
      </div>
    </div>
  );
});

export default FCard;
