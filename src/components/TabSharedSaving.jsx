import { memo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fAuto, fMan, fChangeAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSharedSaving({ mode = "policy", state, set, handleMacroSync, SS, resetSsCost, tracks }) {
  const { ssTotalCost, ssAcute, ssEmergency, ssLtc, ssAcutePct, ssEmergencyPct, ssLtcPct, ssClinicShare,
    ssCostBase, ssProjectCost, M_clinics, hccPct } = state;
  const isProject = ssCostBase === "project";
  const readOnly = mode === "clinic";
  const M = Math.max(1, M_clinics);

  // 의원 모드 Hero 박스용 — 현재 Track 기준 의원당 성과배분
  const activeTrack = tracks?.find(t => t.hc === hccPct) || tracks?.[2] || null;
  const trackName = hccPct === 0 ? "A (FFS)" : hccPct === 100 ? "C (환자군)" : `B (혼합 ${hccPct}%)`;
  const myClinicSsAmt = activeTrack?.ssAmt ?? 0;
  const ssPerClinicFull = (SS?.clinicFromItem ?? 0) / M;

  return (<>
    {/* ★ 의원 모드 Hero — 우리 의원 예상 연간 성과배분 (v6.9) */}
    {mode === "clinic" && (
      <div className="rounded-2xl border-2 shadow-md p-5 text-center" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", borderColor: "#86efac" }}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">🏥 우리 의원 예상 연간 성과배분</span>
          <span className="text-[10px] text-emerald-700/70 font-semibold">
            현재 Track: <b className="text-emerald-800">{trackName}</b>
            <span className="mx-1 text-emerald-400">·</span>
            2년차부터 매년
          </span>
        </div>

        <div className="text-3xl sm:text-4xl font-extrabold tabular-nums leading-tight"
          style={{ color: myClinicSsAmt > 0 ? "#047857" : "#9ca3af" }}>
          {fMan(myClinicSsAmt)}<span className="text-base text-gray-500 font-bold"> / 년</span>
        </div>

        <div className="mt-4 bg-white rounded-xl px-4 py-3 text-left text-xs leading-relaxed border border-emerald-100 shadow-sm">
          <div className="text-[11px] text-gray-500 font-semibold mb-1.5">📐 산출 공식</div>
          <div className="space-y-1 text-gray-700">
            <div>= 사업대상 성과배분 재원 <b className="text-emerald-800">{fAuto(SS?.clinicFromItem ?? 0)}</b> <span className="text-gray-400">(성과배분 {ssClinicShare}%)</span></div>
            <div>÷ 참여 의원 <b className="text-emerald-800">{M.toLocaleString()}개</b> = 의원당 기준 <b className="text-emerald-800">{fMan(ssPerClinicFull)}</b></div>
            <div>× Track {hccPct === 0 ? "A" : hccPct === 100 ? "C" : "B"} 지급률 <b className="text-emerald-800">{Math.round((myClinicSsAmt / Math.max(1, ssPerClinicFull)) * 100)}%</b></div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-emerald-700/80 leading-relaxed">
          ※ 변화율 · 배분율은 정책 가정값입니다 — <b>정책 모드</b>에서 조정 가능 ·
          Track 변경은 <b>Track 선택</b> 탭에서 가능
        </div>
      </div>
    )}

    {/* 의원 모드 — 변화율 슬라이더 영역 안내 */}
    {readOnly && (
      <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed">
        💡 아래 변화율·배분율 슬라이더는 <b>정책 가정값</b>입니다. 의원 모드에서는 읽기 전용으로 표시되며,
        조정은 정책 모드에서 가능합니다. 의원 입장에서 의미 있는 결과는 위의 <b>"우리 의원 성과배분"</b>입니다.
      </div>
    )}

    <fieldset disabled={readOnly} className={readOnly ? "opacity-70 space-y-3" : "contents"}>
    {/* ① 항목별 의료비 변화 추정 — 실제 입력 (위로) */}
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 text-sm mb-1">
        항목별 의료비 변화 추정
        {readOnly && <span className="text-[11px] font-normal text-gray-400 ml-1">(정책 가정값 · 읽기 전용)</span>}
      </h2>
      <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        이용 감소 가정 — 양수 입력 시 음(−) 효과로 표기됩니다.
      </div>

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
            <span className="text-xs font-semibold shrink-0" style={{ color: item.color }}>변화율</span>
            <input type="range" min={0} max={30} step={0.01} value={item.pctVal}
              onChange={e => set(item.pctKey, parseFloat(e.target.value))}
              aria-label={`${item.label} 변화율 슬라이더`}
              className="flex-1 big-thumb"
              style={{ '--thumb-bg': item.color, accentColor: item.color, background: `linear-gradient(to right, ${item.color} ${item.pctVal / 30 * 100}%, #e5e7eb 0%)` }} />
            <span className="text-xs font-bold w-3 text-right" style={{ color: item.pctVal > 0 ? item.color : "#9ca3af" }}>
              {item.pctVal > 0 ? "−" : ""}
            </span>
            <input type="text" value={item.pctVal.toFixed(2)}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set(item.pctKey, Math.max(0, Math.min(30, v))); }}
              className="w-14 text-center text-xs font-bold border rounded px-1 py-0.5 bg-white"
              style={{ borderColor: item.bd, color: item.color }} />
            <span className="text-xs text-gray-400">%</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-500">변화액</span>
            <span className="text-sm font-bold" style={{ color: item.color }}>
              {fChangeAuto(item.saving)}
            </span>
          </div>
        </div>
      ))}
    </div>

    {/* ② 거시 총괄 — 종합 결과 (아래로) */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-gray-900 text-sm">총 의료비 영향</h2>
      </div>
      <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        이용 감소 가정 — 양수 입력 시 음(−) 효과로 표기됩니다.
      </div>
      {/* v6.5: 분모 선택 — 건강보험 전체 vs 사업대상 환자 */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50/60 p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700 shrink-0">기준</span>
          <label className={`flex items-center gap-1 text-xs font-semibold cursor-pointer px-2 py-1 rounded-md border transition ${!isProject ? "bg-white border-slate-400 text-slate-700" : "bg-transparent border-gray-200 text-gray-400"}`}>
            <input type="radio" name="ssCostBase" value="total"
              checked={!isProject}
              onChange={() => set("ssCostBase", "total")}
              className="accent-slate-600" />
            건강보험 전체
            <input type="text" value={ssTotalCost}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) set("ssTotalCost", v); }}
              disabled={isProject}
              className="w-14 text-center text-xs font-bold border border-gray-300 rounded px-1 py-0.5 bg-white text-slate-700 disabled:opacity-40" />
            <span className="text-[10px] text-gray-500">조원</span>
          </label>
          <span className="text-gray-300 text-xs">/</span>
          <label className={`flex items-center gap-1 text-xs font-semibold cursor-pointer px-2 py-1 rounded-md border transition ${isProject ? "bg-white border-slate-400 text-slate-700" : "bg-transparent border-gray-200 text-gray-400"}`}>
            <input type="radio" name="ssCostBase" value="project"
              checked={isProject}
              onChange={() => set("ssCostBase", "project")}
              className="accent-slate-600" />
            사업대상 환자 의료비
            <input type="text" value={ssProjectCost}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) set("ssProjectCost", v); }}
              disabled={!isProject}
              className="w-20 text-center text-xs font-bold border border-gray-300 rounded px-1 py-0.5 bg-white text-slate-700 disabled:opacity-40" />
            <span className="text-[10px] text-gray-500">억원</span>
          </label>
          <button onClick={resetSsCost}
            className="ml-auto text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-1 transition"
            title="건강보험 전체 · 110.8조원으로 복귀">↩ 초기화</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-700 shrink-0">총 의료비 변화율</span>
        <input type="range" min={0} max={15} step={0.001} value={SS.derivedMacroPct}
          onChange={e => handleMacroSync(parseFloat(e.target.value))}
          aria-label="총 의료비 변화율 슬라이더"
          className="flex-1 big-thumb"
          style={{ '--thumb-bg': '#475569', accentColor: "#475569", background: `linear-gradient(to right, #475569 ${Math.min(SS.derivedMacroPct / 15 * 100, 100)}%, #e5e7eb 0%)` }} />
        <span className="text-xs font-bold w-3 text-right" style={{ color: SS.derivedMacroPct > 0 ? "#475569" : "#9ca3af" }}>
          {SS.derivedMacroPct > 0 ? "−" : ""}
        </span>
        <input type="text" value={SS.derivedMacroPct.toFixed(3)}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleMacroSync(Math.max(0, Math.min(15, v))); }}
          className="w-20 text-center text-xs font-bold border border-gray-300 rounded px-1 py-0.5 bg-white text-slate-700" />
        <span className="text-xs text-gray-500">%</span>
      </div>
      <div className="rounded-lg p-3 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div className="text-xs text-gray-500 mb-1">총 변화액 <span className="text-gray-400">({isProject ? `사업대상 환자 의료비 ${SS.costBaseValue.toLocaleString()}억원` : `건강보험 전체 ${SS.costBaseValue}조원`} 기준)</span></div>
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-700">
          {fChangeAuto(SS.itemTotal)}
        </div>
      </div>
    </div>

    {/* 성과 배분 비율 */}
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 text-sm mb-3">성과 배분 비율</h2>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "체계 지원 100%", v: 0, c: "#2563eb", bg: "#eff6ff" },
          { n: "50 : 50", v: 50, c: "#7c3aed", bg: "#f5f3ff" },
          { n: "성과 배분 100%", v: 100, c: "#16a34a", bg: "#f0fdf4" },
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
        <span className="text-xs font-bold text-blue-600 shrink-0">일차의료 체계 지원 {100 - ssClinicShare}%</span>
        <input type="range" min={0} max={100} step={5} value={ssClinicShare}
          onChange={e => set("ssClinicShare", parseInt(e.target.value))}
          aria-label="성과 배분 비율 슬라이더"
          className="flex-1 big-thumb"
          style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${100 - ssClinicShare}%, #16a34a ${100 - ssClinicShare}%, #16a34a 100%)` }} />
        <span className="text-xs font-bold text-green-600 shrink-0">참여의원 성과배분 {ssClinicShare}%</span>
      </div>
      <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
        {ssClinicShare < 100 && <div style={{ width: `${100 - ssClinicShare}%`, background: "#3b82f6" }} className="flex items-center justify-center transition-all">{(100 - ssClinicShare) > 15 ? "체계 지원" : ""}</div>}
        {ssClinicShare > 0 && <div style={{ width: `${ssClinicShare}%`, background: "#16a34a" }} className="flex items-center justify-center transition-all">{ssClinicShare > 15 ? "성과 배분" : ""}</div>}
      </div>
    </div>
    </fieldset>

    {/* 배분 결과 파이 차트 */}
    <div className={card + " p-3"}>
      <h3 className="text-xs font-bold text-gray-700 mb-1 text-center">성과 배분</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={[
              { name: "일차의료 체계 지원", value: SS.nhisFromItem, color: "#3b82f6" },
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
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#3b82f6" }}></span>일차의료 체계 지원 <b className="text-blue-600">{fAuto(SS.nhisFromItem)}</b></span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#22c55e" }}></span>참여의원 성과배분 <b className="text-green-600">{fAuto(SS.clinicFromItem)}</b></span>
      </div>
    </div>

    {/* 성과 배분 구성 — 파이 차트 뒤 */}
    <div className={card + " p-4"}>
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
        <div className="text-xs font-bold text-amber-900 mb-2">💡 성과 배분 구성</div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="font-bold text-green-700 mb-0.5">🟢 참여의원 성과배분</div>
            <div className="text-gray-700 leading-relaxed pl-4">
              사업 참여 의원에게 직접 지급되는 성과보상금.<br />
              환자군 관리 성과(입원·응급·요양병원 이용 감소)에 대한 성과 배분.
            </div>
          </div>
          <div>
            <div className="font-bold text-blue-700 mb-0.5">🔵 일차의료 체계 지원</div>
            <div className="text-gray-700 leading-relaxed pl-4">
              다음해 사업 유지·확장을 위한 재투자 재원.<br />
              ① 신규 참여 의원 전환지원금(PT, Primary care Transformation grant)<br />
              ② 일차의료지원센터 구축·운영비<br />
              ③ IT 인프라·교육·질 관리 시스템 투자
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-500 leading-relaxed">
          ※ 보고서·논문에서는 「일차의료 확산기금」과 동의어 (통합참조 v6.0 Part 3D.3)
        </div>
      </div>
    </div>
  </>);
})
