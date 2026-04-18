import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL } from "../constants";
import { f, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function RegistrationPanel({ state, set, updK, resetK, updR, setRUniform, reg, regRatios, ratios, G }) {
  const { R_g, M_clinics, n_reg_per_clinic, k_g, showAdvancedDist, showAdvancedR } = state;
  const k_modified = k_g.some(v => Math.abs(v - 1) > 0.001);

  // R 균등 여부 판단 — 4개 값이 모두 같으면 균등, 아니면 차등
  const R_uniform = R_g[0] === R_g[1] && R_g[1] === R_g[2] && R_g[2] === R_g[3];
  const R_mean = (R_g[0] + R_g[1] + R_g[2] + R_g[3]) / 4;
  const R_display = R_uniform ? R_g[0] : Math.round(R_mean);

  // 공단 추가 지출 (Σ R_g × n_reg_g, 연간) — 환자군별 가중 합
  const nhiAddFromR = R_g.reduce((s, r, i) => s + r * reg.n_reg_total * regRatios[i], 0);

  const R_MAX = 200000;

  return (
    <>
      {/* 주치의 등록관리비 R */}
      <div className={card + " p-4"}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">주치의 등록관리비 (R)</h2>
            <p className="text-xs text-gray-500 mt-0.5">환자군 기본수가(P)에 구조적으로 내장되는 등록관리 지속 수가</p>
          </div>
          <div className="flex items-center gap-2">
            {!R_uniform && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                차등 모드
              </span>
            )}
            <NumBox value={R_display} onChange={v => setRUniform(Math.max(0, Math.min(R_MAX, Math.round(v))))} color="#a855f7" suffix="원" />
          </div>
        </div>
        <input type="range" min={0} max={R_MAX} step={1000} value={R_display}
          onChange={e => setRUniform(parseInt(e.target.value))}
          aria-label="주치의 등록관리비 마스터 슬라이더"
          className="w-full big-thumb"
          style={{ '--thumb-bg': '#a855f7', accentColor: "#a855f7", background: `linear-gradient(to right, #a855f7 ${(R_display / R_MAX) * 100}%, #e5e7eb 0%)` }} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0원</span><span>5만원</span><span>10만원</span><span>15만원</span><span>20만원/년/환자</span>
        </div>
        {!R_uniform && (
          <div className="mt-1 text-[10px] text-amber-600 italic">
            슬라이더 조작 시 4개 환자군 모두 같은 값으로 재설정됩니다 (균등 복귀).
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[11px] font-semibold text-gray-700">최종 일차의료수가 <span className="text-purple-700">(PP = P + R)</span></div>
            <span className="text-[10px] text-gray-400">명목 청구수가</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {SH.map((g, i) => (
              <div key={i} className="rounded px-1.5 py-1 text-center" style={{ background: CL[i] + "12", borderLeft: `3px solid ${CL[i]}` }}>
                <div className="text-[10px] font-semibold" style={{ color: CL[i] }}>{g}</div>
                <div className="text-xs font-bold text-purple-700">{f(G[i].p + R_g[i])}원</div>
                {!R_uniform && <div className="text-[9px] text-purple-400">R {f(R_g[i])}</div>}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-gray-500 bg-gray-50 rounded px-2 py-1 leading-relaxed">
            ※ PP는 <b>명목(청구) 수가</b>. 공단 실지급은 <code className="font-mono text-purple-700">A = P × (1 − L) + R</code> (R은 L 우회, 타원이용비중 카드 참조).
          </div>
          <div className="mt-2 bg-amber-50 rounded px-2 py-1.5 text-xs flex justify-between items-center">
            <span className="text-gray-600 text-[11px]">공단 추가 지출 (Σ R × 등록환자, 연)</span>
            <span className="font-bold text-amber-700">{nhiAddFromR > 0 ? "+" : ""}{fAuto(nhiAddFromR)}</span>
          </div>
        </div>

        {/* 환자군별 R 차등 (고급) */}
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button onClick={() => set("showAdvancedR", !showAdvancedR)}
            className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition rounded">
            <span className="flex items-center gap-2">
              <span>{showAdvancedR ? "▼" : "▶"}</span>
              <span>환자군별 차등 (고급)</span>
              {R_uniform ? (
                <span className="text-[10px] text-gray-400">(기본값: 균등)</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  수정됨
                </span>
              )}
            </span>
            <span className="text-gray-400 text-[11px]">{showAdvancedR ? "접기" : "펼치기"}</span>
          </button>
          {showAdvancedR && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                4군(와상)은 등록관리 업무 부담이 1군(건강)보다 큽니다. 정책 요구가 있을 경우 환자군별 차등 적용 가능. 값을 직접 입력하세요.
              </p>
              {/* 프리셋 */}
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
              {/* 환자군별 입력 */}
              <div className="grid grid-cols-4 gap-2">
                {SH.map((g, i) => (
                  <div key={i} className="rounded px-2 py-1.5 text-center" style={{ background: CL[i] + "10", border: `1px solid ${CL[i]}40` }}>
                    <div className="text-[10px] font-bold mb-1" style={{ color: CL[i] }}>{g}</div>
                    <input type="text" value={f(R_g[i])}
                      onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0 && v <= R_MAX) updR(i, v); }}
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

      {/* 등록환자 규모 */}
      <div className={card + " p-4"}>
        <h2 className="font-bold text-gray-900 text-sm mb-2">등록환자 규모</h2>

        {/* 의원 수 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-600 shrink-0 w-20">의원 수 (M)</span>
          <NumBox value={M_clinics} onChange={v => set("M_clinics", Math.max(1, Math.round(v)))} color="#1f2937" suffix="개" />
          <div className="flex flex-wrap gap-1 ml-2">
            {[10, 100, 1000, 3000].map(v => (
              <button key={v} onClick={() => set("M_clinics", v)}
                className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
                style={M_clinics === v
                  ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                  : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                {f(v)}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto hidden lg:inline">파일럿 10 · 전국 ≈ 3,000</span>
        </div>

        {/* 의원당 등록환자수 슬라이더 */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">의원당 등록환자수</span>
            <NumBox value={n_reg_per_clinic} onChange={v => set("n_reg_per_clinic", Math.max(0, Math.min(5000, Math.round(v))))} color="#2563eb" suffix="명" />
          </div>
          <input type="range" min={0} max={5000} step={50} value={n_reg_per_clinic}
            onChange={e => set("n_reg_per_clinic", parseInt(e.target.value))}
            aria-label="의원당 등록환자수 슬라이더"
            className="w-full big-thumb"
            style={{ '--thumb-bg': '#2563eb', accentColor: "#2563eb", background: `linear-gradient(to right, #2563eb ${(n_reg_per_clinic / 5000) * 100}%, #e5e7eb 0%)` }} />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0</span><span>1,000</span><span>2,000</span><span>3,000</span><span>4,000</span><span>5,000명</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {[500, 1000, 1500, 2000, 3000].map(v => (
              <button key={v} onClick={() => set("n_reg_per_clinic", v)}
                className="text-[11px] px-2 py-0.5 rounded border font-medium transition"
                style={n_reg_per_clinic === v
                  ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                  : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                {f(v)}명
              </button>
            ))}
          </div>
        </div>

        {/* 파생 요약 */}
        <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-50 rounded px-2 py-1.5">
            <div className="text-gray-500 text-[10px]">의원당 실인원 환자수</div>
            <div className="font-bold text-gray-800">{f(Math.round(reg.n_total_per_clinic))}명</div>
          </div>
          <div className="bg-blue-50 rounded px-2 py-1.5">
            <div className="text-blue-600 text-[10px]">총 등록환자</div>
            <div className="font-bold text-blue-700">{f(Math.round(reg.n_reg_total))}명</div>
            <div className="text-[10px] text-blue-500">등록률 {(reg.regRate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-50 rounded px-2 py-1.5">
            <div className="text-slate-500 text-[10px]">비등록 (FFS)</div>
            <div className="font-bold text-slate-700">{f(Math.round(reg.n_unreg_total))}명</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-400 italic">
          ※ 실인원 = 1년간 방문횟수와 무관하게 환자 1명 = 1로 집계. 연인원(방문건수) 아님.
        </div>
      </div>

      {/* 환자군별 등록률 조정 (고급) */}
      <div className={card + " overflow-hidden"}>
        <button onClick={() => set("showAdvancedDist", !showAdvancedDist)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
          <span className="flex items-center gap-2">
            <span>{showAdvancedDist ? "▼" : "▶"}</span>
            <span>등록환자 분포 조정 (고급)</span>
            {k_modified ? (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                수정됨
              </span>
            ) : (
              <span className="text-[10px] text-gray-400">(기본값: 이용환자 분포와 동일)</span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{showAdvancedDist ? "접기" : "펼치기"}</span>
        </button>
        {showAdvancedDist && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              등록환자의 환자군 분포가 총 이용환자 분포와 다를 가능성(예: 4군 고위험 환자가 등록을 더 많이 하거나, 반대로 건강한 1군이 많이 등록)을 반영합니다.
              기본값 1.0 = 인구비와 동일. 전체 합은 자동 정규화됩니다.
            </p>

            {/* 프리셋 */}
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

            {/* 환자군별 슬라이더 */}
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

            {/* 분포 비교 */}
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
    </>
  );
});
