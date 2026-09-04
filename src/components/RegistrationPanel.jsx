import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL, ON, INIT_F, CLINIC_PRESETS, POLICY_SCENARIOS, CLINIC_COUNT_PRESETS, REG_PER_CLINIC_PRESETS } from "../constants";
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

      {/* ① 통합 슬라이더 (B의 X%, 0~20%, 디폴트 10%) — v7.2.1: 현재 슬라이더 % 표기 추가 (B 기준 N.N%) */}
      <div className="rounded-lg border bg-white px-3 py-2.5"
        style={{ borderColor: "#bfdbfe", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)" }}>
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
          <div className="text-xs text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-700">B 기준</span>
            <span className="ml-1 text-base font-extrabold text-blue-700">{Math.max(0, Math.min(PF_PCT_MAX, pfPctImplied)).toFixed(1)}%</span>
          </div>
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
        {/* v7.2.3: TCard 안내 문구 삭제 — "의원 수입 = 일차의료수가(공단지급) + 본인부담" 표기가
           시뮬 산식과 정책 시멘틱(본인부담 변화 없음 + 의원 수입 변화 = PF만) 사이에서
           해석 혼동을 일으킴. v7.3.0에서 산식 정정 후 별도 안내 문구 재검토 (사용자 결정). */}
      </div>
    </div>
  );
});

/* v7.1.2: ClinicSummaryStrip — 슬림 1줄 요약 카드 (탭 상단 노출).
   의원 수 · 의원당 환자수 · 등록/비등록 breakdown · 사업 전체 breakdown.
   변경 컨트롤은 고급설정의 ClinicCountControls에 별도 배치. */
export const ClinicSummaryStrip = memo(function ClinicSummaryStrip({ state }) {
  const { M_clinics, totalN, regDist } = state;
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));
  // v7.5.8: regDist는 0.1명 단위(분포비 × 등록 총량)라 합이 999.9 등 소수가 될 수 있음 → 표시는 정수(명)로 반올림.
  const regSum = Math.round(regDist.reduce((s, v) => s + v, 0));
  const regPerClinic = Math.min(regSum, perClinic);
  const unregPerClinic = Math.max(0, perClinic - regPerClinic);
  const totalReg = M_clinics * regPerClinic;
  const totalUnreg = M_clinics * unregPerClinic;
  return (
    <div className={card + " px-3 py-2"}>
      <div className="text-[12px] sm:text-[13px] text-gray-700 leading-relaxed">
        <span className="font-bold text-gray-900">🏥 {M_clinics.toLocaleString()}개 의원</span>
        <span className="text-gray-300 mx-2">|</span>
        의원당 <b className="text-gray-900">{perClinic.toLocaleString()}명</b>
        {" = 등록 "}<b className="text-blue-700">{regPerClinic.toLocaleString()}명</b>
        {" + 비등록 "}<b className="text-slate-700">{unregPerClinic.toLocaleString()}명</b>
        <span className="text-gray-300 mx-2">|</span>
        사업 전체 <b className="text-gray-900">{(M_clinics * perClinic).toLocaleString()}명</b>
        {" = 등록 "}<b className="text-blue-700">{totalReg.toLocaleString()}명</b>
        {" + 비등록 "}<b className="text-slate-700">{totalUnreg.toLocaleString()}명</b>
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        ⚙️ 고급 설정 → 의원 수 · 의원당 등록환자수 변경
      </div>
    </div>
  );
});

/* v7.1.2: ClinicCountControls — 고급설정 안에 들어가는 의원 수 + 의원당 등록환자수 컨트롤.
   기본 프리셋 [100, 1000, 3000, 2923(일만시)]. 등록환자수 프리셋 [1000, 1500, 2000, 3000, 4000]. */
export const ClinicCountControls = memo(function ClinicCountControls({ state, set, scaleRegDist }) {
  const { M_clinics, datasetM, datasetLabel, regDist } = state;
  const regSum = regDist.reduce((s, v) => s + v, 0);

  const setM = (m) => {
    const newM = Math.max(1, Math.round(m));
    set("M_clinics", newM);
  };
  const resetToDataset = () => {
    if (datasetM) setM(datasetM);
  };
  return (
    <div className="space-y-2">
      {/* 의원 수 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-700 shrink-0 w-32">사업 참여 의원 수</span>
        <NumBox value={M_clinics} onChange={setM} color="#1f2937" suffix="개" />
        <div className="flex flex-wrap gap-1">
          {CLINIC_COUNT_PRESETS.map(p => {
            const active = M_clinics === p.value;
            return (
              <button key={p.value} onClick={() => setM(p.value)}
                title={p.title}
                className="text-xs px-2 py-0.5 rounded border font-medium transition"
                style={active
                  ? { background: "#dbeafe", borderColor: "#60a5fa", color: "#1d4ed8" }
                  : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
                {p.label}
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

      {/* 의원당 등록환자수 (regDist 합 비례 스케일) */}
      {scaleRegDist && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 shrink-0 w-32">의원당 등록환자수</span>
          <NumBox value={Math.round(regSum)} onChange={v => scaleRegDist(Math.max(0, Math.round(v)))} color="#2563eb" suffix="명" />
          <div className="flex flex-wrap gap-1">
            {REG_PER_CLINIC_PRESETS.map(v => {
              const active = Math.abs(regSum - v) < 0.5;
              return (
                <button key={v} onClick={() => scaleRegDist(v)}
                  className="text-xs px-2 py-0.5 rounded border font-medium transition"
                  style={active
                    ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                    : { background: "#fff", borderColor: "#e5e7eb", color: "#374151" }}>
                  {v.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

/* v7.1.1 (deprecated v7.1.2): ClinicCountCard — 통합 카드. 분리됨 (ClinicSummaryStrip + ClinicCountControls).
   기존 import 호환을 위해 유지 (=ClinicSummaryStrip + ClinicCountControls 합성). */
export const ClinicCountCard = memo(function ClinicCountCard({ state, set, scaleRegDist }) {
  return (
    <div className={card + " p-3 space-y-2"}>
      <ClinicCountControls state={state} set={set} scaleRegDist={scaleRegDist} />
      <div className="pt-1.5 border-t border-dashed border-gray-200">
        <ClinicSummaryStrip state={state} />
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
