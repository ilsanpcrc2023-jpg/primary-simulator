import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL, ON } from "../constants";
import { f, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const H2 = "font-bold text-base text-gray-900";
const ACC_BTN = "w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition";
const R_MAX = 100000;

/* ─────────────────────────────────────────────
   R 설정 카드 — 슬라이더 + 환자군별 차등 (고급) + 공단 추가 지출
   ───────────────────────────────────────────── */
export const RCard = memo(function RCard({ state, set, setRUniform, updR, reg, regRatios }) {
  const { R_g, showAdvancedR } = state;
  const R_uniform = R_g[0] === R_g[1] && R_g[1] === R_g[2] && R_g[2] === R_g[3];
  const R_mean = (R_g[0] + R_g[1] + R_g[2] + R_g[3]) / 4;
  const R_display = R_uniform ? R_g[0] : Math.round(R_mean);
  const nhiAddFromR = R_g.reduce((s, r, i) => s + r * reg.n_reg_total * regRatios[i], 0);

  return (
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={H2}>주치의 등록관리비 (R)</h2>
        <div className="flex items-center gap-2">
          {!R_uniform && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              차등 모드
            </span>
          )}
          <NumBox value={R_display} onChange={v => setRUniform(Math.max(0, Math.round(v)))} color="#a855f7" suffix="원" />
        </div>
      </div>
      <input type="range" min={0} max={R_MAX} step={1000} value={R_display}
        onChange={e => setRUniform(parseInt(e.target.value))}
        aria-label="주치의 등록관리비 마스터 슬라이더"
        className="w-full big-thumb"
        style={{ '--thumb-bg': '#a855f7', accentColor: "#a855f7", background: `linear-gradient(to right, #a855f7 ${(R_display / R_MAX) * 100}%, #e5e7eb 0%)` }} />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>0원</span><span>2.5만원</span><span>5만원</span><span>7.5만원</span><span>10만원/년/환자</span>
      </div>
      {!R_uniform && (
        <div className="mt-1 text-[10px] text-amber-600 italic">
          슬라이더 조작 시 4개 환자군 모두 같은 값으로 재설정됩니다 (균등 복귀).
        </div>
      )}

      <div className="mt-2 bg-amber-50 rounded px-3 py-1.5 text-xs flex justify-between items-center">
        <span className="text-gray-600 text-[11px]">공단 추가 지출 (Σ R × 등록환자, 연)</span>
        <span className="font-bold text-amber-700">{nhiAddFromR > 0 ? "+" : ""}{fAuto(nhiAddFromR)}</span>
      </div>

      {/* 환자군별 차등 (고급) 아코디언 */}
      <div className="mt-3 border-t border-gray-100">
        <button onClick={() => set("showAdvancedR", !showAdvancedR)} className={ACC_BTN + " rounded"}>
          <span className="flex items-center gap-2">
            <span className="text-gray-400">{showAdvancedR ? "▼" : "▶"}</span>
            <span>환자군별 차등 (고급)</span>
            {R_uniform ? (
              <span className="text-[10px] font-normal text-gray-400">기본값: 균등</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                수정됨
              </span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{showAdvancedR ? "접기" : "펼치기"}</span>
        </button>
        {showAdvancedR && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
              4군(와상)은 등록관리 업무 부담이 1군(건강)보다 큽니다. 환자군별 차등 적용 시 값을 직접 입력하세요.
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="text-[11px] text-gray-500 mr-1 self-center">빠른 선택:</span>
              {[
                { label: "균등", v: [R_display, R_display, R_display, R_display] },
                { label: "선형증가", v: [5000, 10000, 15000, 20000] },
                { label: "중증 편중", v: [5000, 8000, 15000, 30000] },
              ].map(p => (
                <button key={p.label} onClick={() => p.v.forEach((val, i) => updR(i, val))}
                  className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                  {p.label}
                </button>
              ))}
              <button onClick={() => setRUniform(R_display)}
                className="text-[11px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 ml-auto">
                균등으로 초기화
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SH.map((g, i) => (
                <div key={i} className="rounded px-2 py-1.5 text-center" style={{ background: CL[i] + "10", border: `1px solid ${CL[i]}40` }}>
                  <div className="text-[10px] font-bold mb-1" style={{ color: CL[i] }}>{g}</div>
                  <input type="text" value={f(R_g[i])}
                    onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updR(i, v); }}
                    className="w-full text-center text-xs font-bold border rounded bg-white py-0.5"
                    style={{ borderColor: CL[i] + "60", color: CL[i] }} />
                  <div className="text-[9px] text-gray-400 mt-0.5">원/년</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   PP 결과 카드 — promoted (최종 일차의료수가)
   ───────────────────────────────────────────── */
export const PPCard = memo(function PPCard({ state, G }) {
  const { R_g } = state;
  const R_uniform = R_g[0] === R_g[1] && R_g[1] === R_g[2] && R_g[2] === R_g[3];

  return (
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", borderColor: "#a5b4fc" }}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-bold text-base" style={{ color: "#4338ca" }}>
          최종 일차의료수가 (PP = P + R)
        </h2>
        <span className="text-[11px] font-semibold" style={{ color: "#6366f1" }}>명목 청구수가</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SH.map((g, i) => (
          <div key={i} className="rounded-lg px-2 py-2 text-center bg-white/80" style={{ borderLeft: `4px solid ${CL[i]}` }}>
            <div className="text-[11px] font-bold mb-0.5" style={{ color: CL[i] }}>{g}</div>
            <div className="text-sm font-extrabold text-indigo-800">{f(G[i].p + R_g[i])}원</div>
            {!R_uniform && <div className="text-[9px] text-indigo-400 mt-0.5">R {f(R_g[i])}</div>}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-indigo-700 bg-white/60 rounded px-2 py-1.5 leading-relaxed">
        ※ PP는 <b>명목(청구) 수가</b>입니다. 공단 실지급 <code className="font-mono text-purple-700">A = P × (1 − L) + R</code> — R은 L과 무관하게 고정 지급 (타원이용비중 카드 참조).
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   등록환자 규모 카드 — 총 N + 의원수 + 의원당 등록 + 요약
   ───────────────────────────────────────────── */
export const RegScaleCard = memo(function RegScaleCard({ state, set, reg }) {
  const { totalN, M_clinics, n_reg_per_clinic, dataLabel } = state;
  const perClinic = Math.max(1, Math.round(totalN / Math.max(1, M_clinics)));

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
    <div className={card + " p-4"}>
      <h2 className={H2 + " mb-3"}>등록환자 규모</h2>

      {/* 의원당 실인원 (primary 입력) */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 shrink-0 w-28">의원당 실인원</span>
        <NumBox value={perClinic} onChange={setPerClinic} color="#1f2937" suffix="명" />
        <div className="flex flex-wrap gap-1 ml-2">
          {[3000, 5000, 10000, 20000].map(v => (
            <button key={v} onClick={() => setPerClinic(v)}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={perClinic === v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {f(v)}명
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 ml-auto">연인원 아님</span>
      </div>

      {/* 의원 수 M (per-clinic 보존) */}
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
        <span className="text-[10px] text-gray-400 ml-auto">파일럿 10 · 전국 ≈ 3,000</span>
      </div>

      {/* 전체 N 파생 표기 */}
      <div className="mb-3 px-2 py-1 bg-gray-50 rounded text-[11px] text-gray-600">
        전체 실인원 N = <b className="text-gray-800">{f(totalN)}명</b>
        <span className="text-gray-400"> = 의원당 {f(perClinic)} × M {f(M_clinics)}</span>
      </div>

      {/* 의원당 등록환자수 */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-700">의원당 등록환자수</span>
          <NumBox value={n_reg_per_clinic} onChange={v => set("n_reg_per_clinic", Math.max(0, Math.round(v)))} color="#2563eb" suffix="명" />
        </div>
        <input type="range" min={0} max={2000} step={50} value={Math.min(n_reg_per_clinic, 2000)}
          onChange={e => set("n_reg_per_clinic", parseInt(e.target.value))}
          aria-label="의원당 등록환자수 슬라이더"
          className="w-full big-thumb"
          style={{ '--thumb-bg': '#2563eb', accentColor: "#2563eb", background: `linear-gradient(to right, #2563eb ${(Math.min(n_reg_per_clinic, 2000) / 2000) * 100}%, #e5e7eb 0%)` }} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0</span><span>500</span><span>1,000</span><span>1,500</span><span>2,000명</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {[500, 1000, 1500, 2000].map(v => (
            <button key={v} onClick={() => set("n_reg_per_clinic", v)}
              className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
              style={n_reg_per_clinic === v
                ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                : { borderColor: "#e5e7eb", color: "#6b7280" }}>
              {f(v)}명
            </button>
          ))}
          {n_reg_per_clinic > 2000 && (
            <span className="text-[10px] text-blue-600 italic self-center ml-1">슬라이더 범위 초과 · 직접 입력값 적용 중</span>
          )}
        </div>
      </div>

      {/* 요약 — 의원당 단위 통일: 실인원 = 등록 + 비등록 */}
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

/* ─────────────────────────────────────────────
   등록환자 분포 조정 (고급) 아코디언
   ───────────────────────────────────────────── */
export const RegDistCard = memo(function RegDistCard({ state, set, updK, resetK, ratios, regRatios }) {
  const { k_g, showAdvancedDist } = state;
  const k_modified = k_g.some(v => Math.abs(v - 1) > 0.001);

  return (
    <div className={card + " overflow-hidden"}>
      <button onClick={() => set("showAdvancedDist", !showAdvancedDist)} className={ACC_BTN}>
        <span className="flex items-center gap-2">
          <span className="text-gray-400">{showAdvancedDist ? "▼" : "▶"}</span>
          <span>등록환자 분포 조정 (고급)</span>
          {k_modified ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              수정됨
            </span>
          ) : (
            <span className="text-[10px] font-normal text-gray-400">기본값: 이용환자 분포와 동일</span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{showAdvancedDist ? "접기" : "펼치기"}</span>
      </button>
      {showAdvancedDist && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            등록환자의 환자군 분포가 총 이용환자 분포와 다를 가능성(예: 4군 고위험 환자가 등록을 더 많이 하거나 반대)을 반영. 기본값 1.0 = 인구비와 동일. 전체 합은 자동 정규화.
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            <span className="text-[11px] text-gray-500 mr-1 self-center">빠른 선택:</span>
            {[
              { label: "균등", v: [1.0, 1.0, 1.0, 1.0] },
              { label: "고위험 편중", v: [0.7, 0.9, 1.1, 1.3] },
              { label: "건강 편중", v: [1.3, 1.1, 0.9, 0.7] },
            ].map(p => (
              <button key={p.label} onClick={() => p.v.forEach((val, i) => updK(i, val))}
                className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                {p.label}
              </button>
            ))}
            <button onClick={resetK}
              className="text-[11px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 ml-auto">
              초기화
            </button>
          </div>

          <div className="space-y-2">
            {SH.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold shrink-0 w-6" style={{ color: CL[i] }}>{g}</span>
                <input type="range" min={0.3} max={2.0} step={0.05} value={k_g[i]}
                  onChange={e => updK(i, parseFloat(e.target.value))}
                  aria-label={`${g} 등록률 조정계수`}
                  className="flex-1 big-thumb"
                  style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${((k_g[i] - 0.3) / 1.7) * 100}%, #e5e7eb 0%)` }} />
                <span className="text-xs font-bold w-12 text-right" style={{ color: CL[i] }}>×{k_g[i].toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="grid grid-cols-5 gap-1 text-[11px]">
              <div className="text-gray-500 font-semibold">분포</div>
              {SH.map((g, i) => (
                <div key={i} className="text-center font-bold" style={{ color: CL[i] }}>{g}</div>
              ))}
              <div className="text-gray-500">이용환자</div>
              {ratios.map((r, i) => (
                <div key={i} className="text-center text-gray-700">{(r * 100).toFixed(1)}%</div>
              ))}
              <div className="text-blue-600 font-semibold">등록환자</div>
              {regRatios.map((r, i) => {
                const diff = r - ratios[i];
                return (
                  <div key={i} className="text-center">
                    <div className="font-bold text-blue-700">{(r * 100).toFixed(1)}%</div>
                    {Math.abs(diff) > 0.001 && (
                      <div className={`text-[10px] ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
                        {diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}p
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// 기본 default export — 하위호환(현재 사용처 없음, 남겨둠)
export default RCard;
