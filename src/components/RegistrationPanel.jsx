import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL, ON, INIT_F, CLINIC_PRESETS, POLICY_SCENARIOS } from "../constants";
import { f, fE, calcPFfromPct, inferPFpct } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const H2 = "font-bold text-base text-gray-900";
const F_MAX = 600000;
const PF_PCT_MAX = 20;       // v6.10.0: 통합 슬라이더 상한 (PB ≈ PF 동수선이 자연스러운 한계)

// v6.11.0: 역비례 옵션 삭제 (정책 근거 약함)
const PF_RULES = [
  { id: "hcc",     label: "📊 HCC 비례", desc: "위험도 높을수록 두텁게 (디폴트)" },
  { id: "equal",   label: "⚖️ 균등",     desc: "등록환자 1인당 동일 PF" },
];

/* FCard (일차의료 기능보정 PF) — v6.10.0: 통합 슬라이더 (B의 X%) + 분배 규칙 + 환자군별 4 슬라이더 + mini display */
export const FCard = memo(function FCard({ state, setFAll, updF, setPfRule, resetF, bare = false }) {
  const { F_g, P: B_g, regDist, M_clinics, pfRule = "hcc" } = state;
  const M = Math.max(1, M_clinics);

  // v6.10.0: 사업 전체 등록환자수 (환자군별) = regDist × M_clinics
  const n_reg_g = regDist.map(v => v * M);

  // 통합 슬라이더 % — 현재 F_g에서 역산 (개별 슬라이더 조정 후 표시 정합)
  const pfPctImplied = inferPFpct(F_g, B_g, n_reg_g);

  // 동적 baseline — Σ regDist × M1 × M_clinics (등록환자 의원급 외래 FFS, 동적)
  const pfBaseline = state.base.reduce((s, b, i) => s + (regDist[i] || 0) * b.M1 * M, 0);
  // 현재 PF로 인한 공단지출 추가 = Σ F_g × n_reg_g
  const pfExpenditure = F_g.reduce((s, v, i) => s + (v || 0) * (n_reg_g[i] || 0), 0);
  const pfPctOfBaseline = pfBaseline > 0 ? (pfExpenditure / pfBaseline) * 100 : 0;

  // 통합 슬라이더 onChange — 분배 규칙으로 4군 자동 산출
  const setPfPct = (newPct) => {
    const clamped = Math.max(0, Math.min(PF_PCT_MAX, newPct));
    const newF = calcPFfromPct(clamped, pfRule, B_g, n_reg_g);
    setFAll(newF);
  };
  // 분배 규칙 변경 — 통합 슬라이더 위치 유지 (현재 implied %로 재산출)
  const changeRule = (newRule) => {
    if (setPfRule) setPfRule(newRule);
    const newF = calcPFfromPct(pfPctImplied, newRule, B_g, n_reg_g);
    setFAll(newF);
  };

  return (
    <div className={bare ? "" : card + " p-4"}>
      {!bare && (
        <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
          <h2 className={H2}>2. 일차의료 기능보정 (PF)</h2>
          {resetF && (
            <button onClick={resetF}
              className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white shrink-0">
              ↩ 초기화
            </button>
          )}
        </div>
      )}

      {/* ① 통합 슬라이더 (B의 X%, 0~20%, 디폴트 10%) — v6.11.0: PF=X%×B 라벨 삭제, 공단지출 % 삭제 */}
      <div className="rounded-lg border bg-white px-3 py-2.5"
        style={{ borderColor: "#bfdbfe", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)" }}>
        <div className="flex items-baseline justify-end gap-2 flex-wrap mb-1">
          <div className="text-xs font-semibold tabular-nums" style={{ color: pfExpenditure >= 0 ? "#0369a1" : "#dc2626" }}>
            공단지출 {pfExpenditure >= 0 ? "+" : "−"}{fE(Math.abs(pfExpenditure))}억
          </div>
        </div>
        <input type="range" min={0} max={PF_PCT_MAX} step={0.5}
          value={Math.max(0, Math.min(PF_PCT_MAX, pfPctImplied))}
          onChange={e => setPfPct(parseFloat(e.target.value))}
          aria-label="PF 통합 슬라이더 (B의 X%)"
          className="w-full big-thumb"
          style={{ '--thumb-bg': "#2563eb", accentColor: "#2563eb" }} />
        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
          <span>0%</span><span>5%</span><span>10%</span><span>15%</span><span>20%</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-500 leading-relaxed">
          ※ 환자군 기준의료비(B) 기준
        </div>
      </div>

      {/* ② 분배 규칙 토글 — v6.11.0: 라벨 "환자군별", 역비례 삭제, 우측 초기화 버튼 */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-700 shrink-0">환자군별</span>
        <div className="flex flex-wrap gap-1">
          {PF_RULES.map(r => {
            const active = pfRule === r.id;
            return (
              <button key={r.id} onClick={() => changeRule(r.id)} title={r.desc}
                className="text-xs px-2 py-0.5 rounded border font-medium transition"
                style={active
                  ? { background: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
                  : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
                {r.label}
              </button>
            );
          })}
        </div>
        {resetF && (
          <button onClick={resetF}
            className="ml-auto text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
            ↩ 초기화
          </button>
        )}
      </div>

      {/* ③ 환자군별 슬라이더 4개 — v6.11.0: "B의 X%" 라벨 삭제 */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
        {SH.map((g, i) => {
          const F_clamped = Math.max(0, Math.min(F_g[i], F_MAX));
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold" style={{ color: CL[i] }}>{g}</span>
                <NumBox value={F_g[i]} onChange={v => updF(i, v)} color={CL[i]} suffix="원" />
              </div>
              <input type="range" min={0} max={F_MAX} step={1000} value={F_clamped}
                onChange={e => updF(i, parseFloat(e.target.value))}
                aria-label={`${g} 일차의료 기능보정 PF 슬라이더`}
                className="w-full big-thumb"
                style={{ '--thumb-bg': CL[i], accentColor: CL[i] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* TCard — v6.11.0: 새 헤더 (일차의료수가(P) 크게, 부제 작게) · P=공단지급/L1_g% 삭제 */
export const TCard = memo(function TCard({ state, G, mode = "policy" }) {
  const simple = mode === "clinic";

  return (
    <div className="rounded-xl border-2 shadow-md overflow-hidden" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", borderColor: "#4f46e5" }}>
      <div className="px-4 pt-3 pb-1">
        <h2 className="font-extrabold text-lg tracking-tight leading-tight" style={{ color: "#3730a3" }}>
          일차의료수가(P)
        </h2>
        <div className="text-xs font-semibold text-indigo-700/80 mt-0.5">
          일차의료 기본수가(PB) + 일차의료 기능보정(PF)
        </div>
      </div>
      <div className="px-4 pb-3 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SH.map((g, i) => {
            const pay_gov = G[i].pay_gov;
            return (
              <div key={i} className="rounded-lg px-2 py-2 bg-white/90 shadow-sm min-w-0" style={{ borderLeft: `5px solid ${CL[i]}` }}>
                <div className="text-[11px] font-bold text-center" style={{ color: CL[i] }}>{g}</div>
                <div className="mt-1">
                  <div className="text-sm sm:text-base font-extrabold text-indigo-900 tabular-nums text-center whitespace-nowrap">{f(Math.round(pay_gov))}<span className="text-[10px] font-bold ml-0.5">원</span></div>
                </div>
              </div>
            );
          })}
        </div>
        {simple && (
          <div className="mt-2 text-[11px] sm:text-xs font-semibold text-indigo-800/80 leading-relaxed">
            💡 의원 수입 = <span className="text-indigo-900 font-bold">일차의료수가</span>(공단지급) + <span className="text-indigo-900 font-bold">환자 본인부담</span>(현행 외래비의 30%)
          </div>
        )}
      </div>
    </div>
  );
});

/* v6.11.0: ClinicCountCard — 환자군 패널 대체 컴팩트 카드.
   참여 의원 수만 노출. 디폴트 = 업로드 데이터 의원수 (state.datasetM, state.M_clinics 동기화).
   프리셋 [100, 1000, 3000]. perClinic 보존하며 totalN 자동 동기화. */
export const ClinicCountCard = memo(function ClinicCountCard({ state, set }) {
  const { M_clinics, totalN, datasetM, datasetLabel } = state;
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));
  const presets = [100, 1000, 3000];

  const setM = (m) => {
    const newM = Math.max(1, Math.round(m));
    set("M_clinics", newM);
  };
  const resetToDataset = () => {
    if (datasetM) setM(datasetM);
  };
  return (
    <div className={card + " p-3"}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-gray-900 shrink-0">사업 참여 의원 수</span>
        <NumBox value={M_clinics} onChange={setM} color="#1f2937" suffix="개" />
        <div className="flex flex-wrap gap-1">
          {presets.map(p => {
            const active = M_clinics === p;
            return (
              <button key={p} onClick={() => setM(p)}
                className="text-xs px-2 py-0.5 rounded border font-medium transition"
                style={active
                  ? { background: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
                  : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
                {p.toLocaleString()}
              </button>
            );
          })}
        </div>
        {datasetM && datasetM !== M_clinics && (
          <button onClick={resetToDataset}
            className="ml-auto text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white"
            title={`업로드된 데이터 (${datasetLabel || ""})의 의원 수로 복귀`}>
            ↩ {datasetM.toLocaleString()}개로
          </button>
        )}
      </div>
      <div className="mt-1.5 text-[10px] text-gray-500 leading-relaxed">
        의원당 등록환자수 {perClinic.toLocaleString()}명 · 사업 전체 등록환자 {(M_clinics * perClinic).toLocaleString()}명
      </div>
    </div>
  );
});

/* RegScaleCard — v6.11.0: 사용 안 함 (legacy, 추후 제거 예정).
   v6.8.2: 의원 모드(mode="clinic")일 때 상단에 환자군 구성 프리셋 3버튼 노출 (CLINIC_PRESETS). */
export const RegScaleCard = memo(function RegScaleCard({ state, set, reg, scaleRegDist, setRegDistAll, resetReg, mode = "policy" }) {
  const { totalN, M_clinics, regDist, baseN_per_clinic } = state;
  const activePresetKey = (() => {
    const match = CLINIC_PRESETS.find(p => p.regDist && regDist.every((v, i) => v === p.regDist[i]));
    return match ? match.key : "custom";
  })();
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));
  const n_reg_sum = regDist.reduce((s, v) => s + v, 0);
  const n_unreg_per_clinic = Math.max(0, perClinic - Math.min(n_reg_sum, perClinic));
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

  return (
    <div className={card + " overflow-hidden"}>
      <div className="w-full flex items-center justify-between px-4 py-2.5">
        <h2 className="font-bold text-base text-gray-900">환자군 패널 <span className="text-xs font-normal text-gray-500">(의원당 환자수)</span></h2>
        {resetReg && (
          <button
            onClick={resetReg}
            className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
            ↩ 초기화
          </button>
        )}
      </div>
      <div className="px-4 pb-3 pt-2 border-t border-gray-100 space-y-2">
          {/* v6.10.0: 정책 모드 전용 시나리오 프리셋 (파일럿/시범사업/NHS/네덜란드) */}
          {mode === "policy" && (
            <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-dashed border-gray-200">
              <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">정책 시나리오</span>
              <div className="flex flex-wrap gap-1">
                {POLICY_SCENARIOS.map(p => {
                  const active = perClinic === p.perClinic;
                  return (
                    <button key={p.key}
                      onClick={() => setPerClinic(p.perClinic)}
                      title={`${p.label} (${p.sub}) — 의원당 ${f(p.perClinic)}명`}
                      className="text-xs px-2 py-0.5 rounded border font-medium transition"
                      style={active
                        ? { background: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
                        : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
                      {p.label} <span className="text-[10px] opacity-70">{f(p.perClinic)}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-gray-400 ml-auto">파일럿(2023 실측) · 시범사업(복지부안) · NHS(영국) · 네덜란드(GP 평균)</span>
            </div>
          )}

          {/* v6.8.2: 의원 모드 전용 환자군 구성 프리셋 (일반/노인 집중/사용자 지정) */}
          {mode === "clinic" && setRegDistAll && (
            <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-dashed border-gray-200">
              <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">의원 유형</span>
              <div className="flex flex-wrap gap-1">
                {CLINIC_PRESETS.map(p => {
                  const active = activePresetKey === p.key;
                  const isCustom = p.key === "custom";
                  return (
                    <button key={p.key}
                      onClick={() => { if (p.regDist) setRegDistAll(p.regDist); }}
                      disabled={isCustom}
                      title={p.regDist ? `1군:2군:3군:4군 = ${p.regDist.join(":")}` : "현재 분포 (어떤 프리셋과도 불일치 시 자동 활성)"}
                      className="text-xs px-2 py-0.5 rounded border font-medium transition"
                      style={active
                        ? { background: "#ecfdf5", borderColor: "#34d399", color: "#047857" }
                        : { background: "#fff", borderColor: "#e5e7eb", color: isCustom ? "#9ca3af" : "#374151", cursor: isCustom ? "default" : "pointer" }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 참여 전 환자수 (기준) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">참여 전 환자수 (기준)</span>
            <NumBox value={baseN_per_clinic} onChange={setBaseN} color="#64748b" suffix="명" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[2000, 3000, 5000, 7000].map(v => (
                <button key={v} onClick={() => setBaseN(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={baseN_per_clinic === v ? { background: "#f1f5f9", borderColor: "#94a3b8", color: "#334155" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
          </div>

          {/* 참여 후 전체 환자수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">참여 후 전체 환자수</span>
            <NumBox value={perClinic} onChange={setPerClinic} color="#1f2937" suffix="명" />
            <div className="flex flex-wrap gap-1 ml-1">
              {[2000, 3000, 5000, 7000].map(v => (
                <button key={v} onClick={() => setPerClinic(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={perClinic === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">등록 + 비등록</span>
          </div>

          {/* 등록 환자 · 비등록 환자 (나란히 표시) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">등록 환자</span>
            <NumBox value={n_reg_sum} onChange={v => scaleRegDist(Math.max(0, Math.round(v)))} color="#2563eb" suffix="명" />
            <span className="text-xs text-gray-600 ml-1">
              · 비등록 <b className="text-slate-700">{f(n_unreg_per_clinic)}명</b>
            </span>
            <div className="flex flex-wrap gap-1 ml-2">
              {[500, 1000, 1500, 2000].map(v => (
                <button key={v} onClick={() => scaleRegDist(v)}
                  className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                  style={n_reg_sum === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  {f(v)}
                </button>
              ))}
            </div>
          </div>

          {/* 요약 한 줄 — 핵심 정보 강조 */}
          <div className="pt-2 border-t border-gray-100 text-sm font-semibold text-gray-800 leading-snug">
            의원당 환자수 <b className="text-base">{f(Math.round(reg.n_total_per_clinic))}명</b> = 등록 <b className="text-base text-blue-700">{f(Math.round(reg.n_reg_pc))}명</b> ({(reg.regRate * 100).toFixed(1)}%) + 비등록 <b className="text-base">{f(Math.round(reg.n_total_per_clinic - reg.n_reg_pc))}명</b> ({((1 - reg.regRate) * 100).toFixed(1)}%)
          </div>

          {/* 사업 참여 의원 수 — 시스템 규모 (맥락 전환: 의원당 → 전체) */}
          <div className="mt-3 pt-3 border-t-2 border-dashed border-gray-300">
            <div className="text-sm font-bold text-gray-800 mb-2">
              사업 전체 등록 환자 규모: N = <span className="text-gray-900">{f(totalN)}명</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-800 shrink-0">사업 참여 의원 수</span>
              <NumBox value={M_clinics} onChange={setMPreservingPerClinic} color="#1f2937" suffix="개" />
              <span className="text-xs text-gray-600 -ml-1">의원</span>
              <div className="flex flex-wrap gap-1 ml-1 items-center">
                {[10, 100, 1000, 3000].map(v => (
                  <button key={v} onClick={() => setMPreservingPerClinic(v)}
                    className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                    style={M_clinics === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                    {f(v)}
                  </button>
                ))}
                <span className="text-[10px] text-gray-500 ml-0.5">개 의원</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
});

export default FCard;
