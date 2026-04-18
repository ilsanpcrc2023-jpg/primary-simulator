import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import NumBox from "./shared/NumBox";
import { SH, CL } from "../constants";
import { f, fE, pct, diffAuto } from "../utils";



const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabTrack({ state, set, G, T, nhiNewChg, tAchg, tBchg, tCchg, tSchg }) {
  const { hccPct, LC, R_g, M_clinics } = state;
  const ffsPct = 100 - hccPct;
  const M = Math.max(1, M_clinics);
  const R_uniform = R_g[0] === R_g[1] && R_g[1] === R_g[2] && R_g[2] === R_g[3];
  const R_mean = Math.round((R_g[0] + R_g[1] + R_g[2] + R_g[3]) / 4);
  const R_label = R_uniform ? R_g[0].toLocaleString() + "원" : `환자군별 차등 (평균 ${R_mean.toLocaleString()}원)`;

  return (<>
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 mb-3 text-sm">Track 선택권</h2>
      <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
        Track은 <b>등록환자</b>에게만 적용됩니다. 비등록환자는 항상 FFS로 진료합니다. R(등록관리비)은 모든 Track에서 등록환자에게 지급됩니다.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", d: "FFS + R", c: "#22c55e", bg: "#f0fdf4", v: 0 },
          { n: "Track B", d: "혼합 50:50 + R", c: "#3b82f6", bg: "#eff6ff", v: 50 },
          { n: "Track C", d: "환자군 모형 + R", c: "#f97316", bg: "#fff7ed", v: 100 },
        ].map((t, i) => (
          <button key={i} onClick={() => set("hccPct", t.v)}
            aria-selected={hccPct === t.v}
            className="rounded-lg p-2.5 sm:p-3 text-center cursor-pointer transition-all relative"
            style={{ background: hccPct === t.v ? t.bg : "#fff", border: `2px solid ${hccPct === t.v ? t.c : "#e5e7eb"}` }}>
            {hccPct === t.v && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: t.c }}>✓</div>}
            <div className="text-xs sm:text-sm font-extrabold" style={{ color: t.c }}>{t.n}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t.d}</div>
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-gray-700">행위별 ↔ 환자군 혼합 비율</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-green-600 shrink-0">행위별 {ffsPct}%</span>
          <input type="range" min={0} max={100} step={5} value={hccPct}
            onChange={e => set("hccPct", parseInt(e.target.value))}
            aria-label="행위별 환자군 혼합 비율 슬라이더"
            className="flex-1 big-thumb"
            style={{ '--thumb-bg': '#f97316', accentColor: "#f97316", background: `linear-gradient(to right, #22c55e 0%, #22c55e ${ffsPct}%, #f97316 ${ffsPct}%, #f97316 100%)` }} />
          <span className="text-xs font-bold text-orange-600 shrink-0">환자군 {hccPct}%</span>
        </div>
        <div className="flex rounded-md overflow-hidden h-5 text-xs font-bold text-white">
          {ffsPct > 0 && <div style={{ width: `${ffsPct}%`, background: "#22c55e" }} className="flex items-center justify-center transition-all">행위별</div>}
          {hccPct > 0 && <div style={{ width: `${hccPct}%`, background: "#f97316" }} className="flex items-center justify-center transition-all">환자군</div>}
        </div>
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600 shrink-0">타원이용비중 변화율</span>
          <div className="flex-1 min-w-0">
            <input type="range" min={-10} max={0} step={0.5} value={LC}
              onChange={e => set("LC", parseFloat(e.target.value))}
              aria-label="타원이용비중 변화율 슬라이더"
              className="w-full big-thumb"
              style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((LC + 10) / 10) * 100}%, #e5e7eb 0%)` }} />
          </div>
          <NumBox value={LC} onChange={v => set("LC", Math.max(-10, Math.min(0, v)))} color="#7c3aed" suffix="%p" />
        </div>
      </div>
    </div>

    {/* Track KPI */}
    <div className="grid grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <div className="text-xs text-gray-500 mb-1">현 선택: 행위별 {ffsPct}% / 환자군 {hccPct}% <span className="text-gray-400">· vs 순수 FFS</span></div>
        <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(tSchg)}</div>
        <div className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(T.inc0, T.tS)}</div>
        <div className="text-xs text-gray-400 mt-0.5">{fE(T.inc0)}억 → {fE(T.tS)}억 · 전체</div>
        <div className="mt-1 pt-1 border-t border-gray-100 text-xs">
          <span className="text-gray-500">의원당 평균 </span>
          <span className="font-bold" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tS - T.inc0) / M)}</span>
          <span className="text-gray-400"> (M={f(M)})</span>
        </div>
      </div>
      <div className="rounded-xl border p-3 shadow-sm" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
        <div className="text-xs text-gray-500 mb-1">공단 의원급 지출 변화</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-blue-700">{pct(nhiNewChg, 2)}</div>
        <div className="text-xs sm:text-sm font-bold text-blue-600 mt-0.5">{diffAuto(T.nhi0, T.nhi2)}</div>
        <div className="text-xs text-gray-400 mt-0.5">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
      </div>
    </div>

    {/* Track 차트 */}
    <div className={card + " p-3"}>
      <h3 className="text-xs font-bold text-gray-700 mb-2">Track별 환자군 1인당 실지불액</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={G.map((r, i) => ({
          name: SH[i], "Track A": Math.round(r.tA), "Track B": Math.round(r.tB), "Track C": Math.round(r.tC),
        }))} barGap={1} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={v => (v / 10000).toFixed(0) + "만"} tick={{ fontSize: 10 }} width={36} />
          <Tooltip formatter={v => f(v) + "원"} contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="Track A" fill="#86efac" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Track B" fill="#93c5fd" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Track C" fill="#fdba74" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {/* Track 안내 */}
    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
      Track A(행위별)를 선택해도 등록환자당 R({R_label})만큼 추가 수입이 발생합니다. Track B·C로 전환 시 환자군 모형과 타원이용비중 관리에 따라 수입이 증가합니다.
      {hccPct > 0 && <> 현재 선택(행위별 {ffsPct}% : 환자군 {hccPct}%) 기준 <b className="text-green-700">{pct(tSchg)}</b> 수입 변화가 예상됩니다.</>}
      {" "}의원별 상황에 맞는 Track을 자율 선택할 수 있습니다.
    </div>

    {/* Track 테이블 */}
    <div className={card + " overflow-hidden"}>
      <div className="px-3 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">
          Track별 1인당 실지불액 비교 <span className="text-gray-400 font-normal text-xs">(타원이용 {LC}%p · 변화율 기준 = 순수 FFS)</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 460 }}>
          <thead><tr className="bg-gray-50 text-gray-500">
            <th className="text-left px-2 py-2">환자군</th>
            <th className="text-right px-2">Track A</th>
            <th className="text-right px-2">Track B</th>
            <th className="text-right px-2 font-bold">Track C</th>
            <th className="text-right px-2 text-purple-600">선택</th>
            <th className="text-right px-2">변화율</th>
          </tr></thead>
          <tbody>
            {G.map((r, i) => {
              // 기준 = 순수 FFS (M1, 사업 미시행)
              const chg = r.b.M1 > 0 ? (r.tS - r.b.M1) / r.b.M1 : 0;
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                  <td className="text-right px-2">{f(Math.round(r.tA))}</td>
                  <td className="text-right px-2">{f(Math.round(r.tB))}</td>
                  <td className="text-right px-2 font-bold">{f(Math.round(r.tC))}</td>
                  <td className="text-right px-2 font-bold text-purple-700">{f(Math.round(r.tS))}</td>
                  <td className="text-right px-2 font-bold" style={{ color: chg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(chg)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="px-2 py-2 text-sm">총수입<div className="text-[10px] text-gray-400 font-normal">(전체)</div></td>
              <td className="text-right px-2"><div>{fE(T.tA)}억</div><div className="text-green-600 font-normal text-xs">{pct(tAchg)}</div></td>
              <td className="text-right px-2"><div>{fE(T.tB)}억</div><div className="text-green-600 font-normal text-xs">{pct(tBchg)}</div></td>
              <td className="text-right px-2"><div>{fE(T.tC)}억</div><div className="text-green-600 font-normal text-xs">{pct(tCchg)}</div></td>
              <td className="text-right px-2 text-purple-700">{fE(T.tS)}억</td>
              <td className="text-right px-2" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(tSchg)}</td>
            </tr>
            <tr className="bg-blue-50/40 font-semibold">
              <td className="px-2 py-2 text-xs text-blue-700">의원당 평균<div className="text-[10px] text-blue-400 font-normal">(순수 FFS 대비 변화)</div></td>
              <td className="text-right px-2 text-xs" style={{ color: tAchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tA - T.inc0) / M)}</td>
              <td className="text-right px-2 text-xs" style={{ color: tBchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tB - T.inc0) / M)}</td>
              <td className="text-right px-2 text-xs" style={{ color: tCchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tC - T.inc0) / M)}</td>
              <td className="text-right px-2 text-xs font-bold" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tS - T.inc0) / M)}</td>
              <td className="text-right px-2 text-[10px] text-blue-400">M={f(M)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </>);
})
