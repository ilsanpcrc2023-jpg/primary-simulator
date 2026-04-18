import { memo } from "react";
import NumBox from "./shared/NumBox";
import { SH, CL } from "../constants";
import { f, fE } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function RegistrationPanel({ state, set, updK, resetK, reg, regRatios, ratios, G }) {
  const { R, M_clinics, n_reg_per_clinic, k_g, showAdvancedDist } = state;
  const k_modified = k_g.some(v => Math.abs(v - 1) > 0.001);

  // 공단 추가 지출 (R × 총 등록환자수, 연간)
  const nhiAddFromR = R * reg.n_reg_total;

  return (
    <>
      {/* 주치의 등록관리비 R */}
      <div className={card + " p-4"}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">주치의 등록관리비 (R)</h2>
            <p className="text-xs text-gray-500 mt-0.5">환자군 기본수가(P)에 구조적으로 내장되는 등록관리 지속 수가</p>
          </div>
          <NumBox value={R} onChange={v => set("R", Math.max(0, Math.min(100000, Math.round(v))))} color="#a855f7" suffix="원" />
        </div>
        <input type="range" min={0} max={100000} step={1000} value={R}
          onChange={e => set("R", parseInt(e.target.value))}
          aria-label="주치의 등록관리비 슬라이더"
          className="w-full big-thumb"
          style={{ '--thumb-bg': '#a855f7', accentColor: "#a855f7", background: `linear-gradient(to right, #a855f7 ${(R / 100000) * 100}%, #e5e7eb 0%)` }} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0원</span><span>5만원</span><span>10만원/년/환자</span>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-purple-50 rounded px-2 py-1.5">
            <div className="text-gray-500 text-[10px]">최종 일차의료수가 (PP=P+R)</div>
            <div className="font-bold text-purple-700">{f(G[0].p + R)} ~ {f(G[3].p + R)}원</div>
          </div>
          <div className="bg-amber-50 rounded px-2 py-1.5">
            <div className="text-gray-500 text-[10px]">공단 추가 지출 (연)</div>
            <div className="font-bold text-amber-700">{nhiAddFromR > 0 ? "+" : ""}{fE(nhiAddFromR)}억</div>
          </div>
        </div>
      </div>

      {/* 등록환자 규모 */}
      <div className={card + " p-4"}>
        <h2 className="font-bold text-gray-900 text-sm mb-2">등록환자 규모</h2>

        {/* 의원 수 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-600 shrink-0 w-20">의원 수 (M)</span>
          <input type="text" value={f(M_clinics)}
            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) set("M_clinics", v); }}
            className="w-28 text-sm font-bold text-gray-800 text-right border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
          <span className="text-xs text-gray-400">개</span>
          <span className="text-xs text-gray-400 ml-auto hidden sm:inline">파일럿 10 · 전국 ≈ 3,000</span>
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
            <span>0</span><span>500</span><span>1,000</span><span>2,000</span><span>5,000명</span>
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
            <div className="text-gray-500 text-[10px]">의원당 이용환자</div>
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
