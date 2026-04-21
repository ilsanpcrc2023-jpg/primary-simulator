import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSharedSaving({ state, set, handleMacroSync, SS, resetSsCost }) {
  const { ssTotalCost, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare,
    ssCostBase, ssProjectCost } = state;
  const isProject = ssCostBase === "project";

  return (<>
    {/* ① 항목별 절감 — 실제 입력 (위로) */}
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 text-sm mb-3">항목별 절감 시뮬레이션</h2>

      {[
        { label: "급성기 입원비", icon: "🏥", color: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
          baseKey: "ssAcute", base: ssAcute, pctKey: "ssAcutePct", pctVal: ssAcutePct, saving: SS.acuteSaving },
        { label: "응급의료비", icon: "🚑", color: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
          baseKey: "ssEmergency", base: ssEmergency, pctKey: "ssEmergencyPct", pctVal: ssEmergencyPct, saving: SS.emergencySaving },
        { label: "요양병원비", icon: "🏨", color: "#7c3aed", bg: "#f5f3ff", bd: "#ddd6fe",
          baseKey: "ssLtc", base: ssLtc, pctKey: "ssLtcPct", pctVal: ssLtcPct, saving: SS.ltcSaving },
      ].map((item, idx) => (
        <div key={idx} className="rounded-lg p-3 mb-2" style={{ background: item.bg, border: `1px solid ${item.bd}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold" style={{ color: item.color }}>{item.icon} {item.label}</span>
            <span className="text-xs text-gray-500 flex items-center gap-0.5">
              <input type="text" value={item.base}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) set(item.baseKey, v); }}
                className="w-16 text-center text-xs font-bold border rounded px-1 py-0.5 bg-white"
                style={{ borderColor: item.bd, color: item.color }} />조원
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold shrink-0" style={{ color: item.color }}>절감률</span>
            <input type="range" min={0} max={30} step={0.01} value={item.pctVal}
              onChange={e => set(item.pctKey, parseFloat(e.target.value))}
              aria-label={`${item.label} 절감률 슬라이더`}
              className="flex-1 big-thumb"
              style={{ '--thumb-bg': item.color, accentColor: item.color, background: `linear-gradient(to right, ${item.color} ${item.pctVal / 30 * 100}%, #e5e7eb 0%)` }} />
            <input type="text" value={item.pctVal.toFixed(2)}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set(item.pctKey, Math.max(0, Math.min(30, v))); }}
              className="w-14 text-center text-xs font-bold border rounded px-1 py-0.5 bg-white"
              style={{ borderColor: item.bd, color: item.color }} />
            <span className="text-xs text-gray-400">%</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-500">절감액</span>
            <span className="text-sm font-bold" style={{ color: item.color }}>
              {fAuto(item.saving)}
            </span>
          </div>
        </div>
      ))}
    </div>

    {/* ② 거시 총괄 — 종합 결과 (아래로) */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 text-sm">Shared Saving 총괄</h2>
      </div>
      {/* v6.5: 절감률 분모 선택 — 건강보험 전체 vs 사업대상 환자 */}
      <div className="mb-3 rounded-lg border border-red-200 bg-red-50/40 p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-red-700 shrink-0">기준</span>
          <label className={`flex items-center gap-1 text-xs font-semibold cursor-pointer px-2 py-1 rounded-md border transition ${!isProject ? "bg-white border-red-400 text-red-700" : "bg-transparent border-red-100 text-red-400"}`}>
            <input type="radio" name="ssCostBase" value="total"
              checked={!isProject}
              onChange={() => set("ssCostBase", "total")}
              className="accent-red-600" />
            건강보험 전체
            <input type="text" value={ssTotalCost}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) set("ssTotalCost", v); }}
              disabled={isProject}
              className="w-14 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-white text-red-700 disabled:opacity-40" />
            <span className="text-[10px] text-red-500">조원</span>
          </label>
          <span className="text-red-300 text-xs">/</span>
          <label className={`flex items-center gap-1 text-xs font-semibold cursor-pointer px-2 py-1 rounded-md border transition ${isProject ? "bg-white border-red-400 text-red-700" : "bg-transparent border-red-100 text-red-400"}`}>
            <input type="radio" name="ssCostBase" value="project"
              checked={isProject}
              onChange={() => set("ssCostBase", "project")}
              className="accent-red-600" />
            사업대상 환자
            <input type="text" value={ssProjectCost}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) set("ssProjectCost", v); }}
              disabled={!isProject}
              className="w-14 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-white text-red-700 disabled:opacity-40" />
            <span className="text-[10px] text-red-500">조원</span>
          </label>
          <button onClick={resetSsCost}
            className="ml-auto text-xs text-red-600 hover:text-red-800 hover:bg-red-100 rounded px-2 py-1 transition"
            title="건강보험 전체 · 110.8조원으로 복귀">↩ 초기화</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-700 shrink-0">총의료비 절감률</span>
        <input type="range" min={0} max={15} step={0.001} value={SS.derivedMacroPct}
          onChange={e => handleMacroSync(parseFloat(e.target.value))}
          aria-label="총의료비 절감률 슬라이더"
          className="flex-1 big-thumb"
          style={{ '--thumb-bg': '#dc2626', accentColor: "#dc2626", background: `linear-gradient(to right, #dc2626 ${Math.min(SS.derivedMacroPct / 15 * 100, 100)}%, #e5e7eb 0%)` }} />
        <input type="text" value={SS.derivedMacroPct.toFixed(3)}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleMacroSync(Math.max(0, Math.min(15, v))); }}
          className="w-20 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-white text-red-700" />
        <span className="text-xs text-gray-500">%</span>
      </div>
      <div className="rounded-lg p-3 text-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
        <div className="text-xs text-gray-500 mb-1">총 절감액 <span className="text-gray-400">({isProject ? "사업대상" : "건강보험 전체"} {SS.costBaseValue}조원 기준)</span></div>
        <div className="text-2xl sm:text-3xl font-extrabold text-red-600">
          {fAuto(SS.itemTotal)}
        </div>
      </div>
    </div>

    {/* 배분 비율 */}
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 text-sm mb-3">절감액 배분 비율</h2>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "전환지원 100%", v: 0, c: "#2563eb", bg: "#eff6ff" },
          { n: "50 : 50", v: 50, c: "#7c3aed", bg: "#f5f3ff" },
          { n: "성과배분 100%", v: 100, c: "#16a34a", bg: "#f0fdf4" },
        ].map((b, i) => (
          <button key={i} onClick={() => set("ssClinicShare", b.v)}
            aria-selected={ssClinicShare === b.v}
            className="rounded-lg p-2 text-center cursor-pointer transition-all relative"
            style={{ background: ssClinicShare === b.v ? b.bg : "#fff", border: `2px solid ${ssClinicShare === b.v ? b.c : "#e5e7eb"}` }}>
            {ssClinicShare === b.v && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: b.c }}>✓</div>}
            <div className="text-xs font-bold" style={{ color: b.c }}>{b.n}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-blue-600 shrink-0">일차의료 전환 지원 {100 - ssClinicShare}%</span>
        <input type="range" min={0} max={100} step={5} value={ssClinicShare}
          onChange={e => set("ssClinicShare", parseInt(e.target.value))}
          aria-label="절감액 배분 비율 슬라이더"
          className="flex-1 big-thumb"
          style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${100 - ssClinicShare}%, #16a34a ${100 - ssClinicShare}%, #16a34a 100%)` }} />
        <span className="text-xs font-bold text-green-600 shrink-0">참여의원 성과배분 {ssClinicShare}%</span>
      </div>
      <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
        {ssClinicShare < 100 && <div style={{ width: `${100 - ssClinicShare}%`, background: "#3b82f6" }} className="flex items-center justify-center transition-all">{(100 - ssClinicShare) > 15 ? "전환 지원" : ""}</div>}
        {ssClinicShare > 0 && <div style={{ width: `${ssClinicShare}%`, background: "#16a34a" }} className="flex items-center justify-center transition-all">{ssClinicShare > 15 ? "성과배분" : ""}</div>}
      </div>

      {/* v6.5: 배분 용도 설명 — 슬라이더 바로 아래 */}
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
        <div className="text-xs font-bold text-amber-900 mb-2">💡 Shared Saving 배분 용도</div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="font-bold text-green-700 mb-0.5">🟢 참여의원 성과배분</div>
            <div className="text-gray-700 leading-relaxed pl-4">
              사업 참여 의원에게 직접 지급되는 성과보상금.<br />
              환자군 관리 성과(입원·응급·요양병원 이용 감소)에 대한 성과 배분.
            </div>
          </div>
          <div>
            <div className="font-bold text-blue-700 mb-0.5">🔵 일차의료 전환 지원</div>
            <div className="text-gray-700 leading-relaxed pl-4">
              다음해 사업 유지·확장을 위한 재투자 재원.<br />
              ① 신규 참여 의원 전환지원금(PT, Transformation Payment)<br />
              ② 일차의료지원센터 구축·운영비<br />
              ③ IT 인프라·교육·질 관리 시스템 투자
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 배분 결과 파이 차트 */}
    <div className={card + " p-3"}>
      <h3 className="text-xs font-bold text-gray-700 mb-1 text-center">절감액 배분</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={[
              { name: "일차의료 전환 지원", value: SS.nhisFromItem, color: "#3b82f6" },
              { name: "참여의원 성과배분", value: SS.clinicFromItem, color: "#22c55e" },
            ].filter(d => d.value > 0)}
            cx="50%" cy="50%" innerRadius={48} outerRadius={88}
            startAngle={90} endAngle={450}
            paddingAngle={3} dataKey="value"
            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
            labelLine={false}
          >
            {[
              { value: SS.nhisFromItem, color: "#3b82f6" },
              { value: SS.clinicFromItem, color: "#22c55e" },
            ].filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={v => fAuto(v)} contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#3b82f6" }}></span>일차의료 전환 지원 <b className="text-blue-600">{fAuto(SS.nhisFromItem)}</b></span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#22c55e" }}></span>참여의원 성과배분 <b className="text-green-600">{fAuto(SS.clinicFromItem)}</b></span>
      </div>
    </div>
  </>);
})
