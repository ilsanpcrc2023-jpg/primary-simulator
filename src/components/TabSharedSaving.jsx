import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import WinWinWin from "./WinWinWin";
import { fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSharedSaving({ state, set, handleMacroSync, SS }) {
  const { ssTotalCost, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare } = state;

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
        <span className="text-xs text-gray-400">C] 성과기반 조정</span>
      </div>
      <div className="text-xs text-gray-500 mb-3 flex flex-wrap items-center gap-1">
        건강보험 총진료비
        <input type="text" value={ssTotalCost}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) set("ssTotalCost", v); }}
          className="w-16 text-center text-xs font-bold border border-red-300 rounded px-1 py-0.5 bg-red-50 text-red-700" />
        <span>조원 기준</span>
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
        <div className="text-xs text-gray-500 mb-1">총 절감액</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-red-600">
          {fAuto(SS.itemTotal)}
        </div>
      </div>
    </div>

    {/* 배분 비율 */}
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 text-sm mb-3">Shared Saving 성과 배분 비율</h2>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "공단 적립 100%", v: 0, c: "#dc2626", bg: "#fef2f2" },
          { n: "50 : 50", v: 50, c: "#7c3aed", bg: "#f5f3ff" },
          { n: "일차의료 100%", v: 100, c: "#16a34a", bg: "#f0fdf4" },
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
        <span className="text-xs font-bold text-red-600 shrink-0">공단 적립 {100 - ssClinicShare}%</span>
        <input type="range" min={0} max={100} step={5} value={ssClinicShare}
          onChange={e => set("ssClinicShare", parseInt(e.target.value))}
          aria-label="절감액 배분 비율 슬라이더"
          className="flex-1 big-thumb"
          style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${100 - ssClinicShare}%, #16a34a ${100 - ssClinicShare}%, #16a34a 100%)` }} />
        <span className="text-xs font-bold text-green-600 shrink-0">일차의료 {ssClinicShare}%</span>
      </div>
      <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
        {ssClinicShare < 100 && <div style={{ width: `${100 - ssClinicShare}%`, background: "#dc2626" }} className="flex items-center justify-center transition-all">{(100 - ssClinicShare) > 15 ? "공단 적립" : ""}</div>}
        {ssClinicShare > 0 && <div style={{ width: `${ssClinicShare}%`, background: "#16a34a" }} className="flex items-center justify-center transition-all">{ssClinicShare > 15 ? "일차의료" : ""}</div>}
      </div>
    </div>

    {/* 배분 결과 파이 차트 */}
    <div className={card + " p-3"}>
      <h3 className="text-xs font-bold text-gray-700 mb-1 text-center">절감액 배분</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={[
              { name: "공단 적립", value: SS.nhisFromItem, color: "#ef4444" },
              { name: "일차의료 지원", value: SS.clinicFromItem, color: "#22c55e" },
            ].filter(d => d.value > 0)}
            cx="50%" cy="50%" innerRadius={45} outerRadius={85}
            startAngle={90} endAngle={450}
            paddingAngle={3} dataKey="value"
            label={({ name, value }) => `${name} ${fAuto(value || 0)}`}
            labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
          >
            {[
              { value: SS.nhisFromItem, color: "#ef4444" },
              { value: SS.clinicFromItem, color: "#22c55e" },
            ].filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={v => fAuto(v)} contentStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 text-xs mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ef4444" }}></span>공단 적립 <b className="text-red-600">{fAuto(SS.nhisFromItem)}</b></span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22c55e" }}></span>일차의료 지원 <b className="text-green-600">{fAuto(SS.clinicFromItem)}</b></span>
      </div>
    </div>

    {/* Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "불필요한 입원·응급 감소\n의료의 질 향상\n주치의 진료" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `절감 성과의 ${ssClinicShare}% 배분\n${fAuto(SS.clinicFromItem)} 추가 지원` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `절감성과 ${100 - ssClinicShare}% 적립\n${fAuto(SS.nhisFromItem)} 절감\n의료비 예측가능성 향상` },
    ]} />
  </>);
})
