import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import NumBox from "./shared/NumBox";
import { SH, CL } from "../constants";
import { f, fE, pct, diffAuto } from "../utils";



const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabTrack({ state, set, G, T, nhiNewChg, tAchg, tBchg, tCchg, tSchg }) {
  const { base, hccPct, LC, F_g, M_clinics } = state;
  const ffsPct = 100 - hccPct;
  const M = Math.max(1, M_clinics);
  const ratios = base.map(g => g.N / base.reduce((s, x) => s + x.N, 0));
  const F_uniform = F_g[0] === F_g[1] && F_g[1] === F_g[2] && F_g[2] === F_g[3];
  const F_mean = Math.round((F_g[0] + F_g[1] + F_g[2] + F_g[3]) / 4);
  const F_label = F_uniform ? F_g[0].toLocaleString() + "원" : `환자군별 차등 (평균 ${F_mean.toLocaleString()}원)`;

  return (<>
    <div className={card + " p-4"}>
      <h2 className="font-bold text-gray-900 mb-3 text-sm">Track 선택권</h2>
      <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
        Track은 <b>등록환자</b>에게만 적용됩니다. 비등록환자는 항상 FFS로 진료합니다. 일차의료 기능수가(F)는 <b>모든 Track</b>에서 등록환자에게 가산됩니다.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", d: "FFS + F", c: "#22c55e", bg: "#f0fdf4", v: 0 },
          { n: "Track B", d: "혼합 50:50 + F", c: "#3b82f6", bg: "#eff6ff", v: 50 },
          { n: "Track C", d: "환자군 모형 + F", c: "#f97316", bg: "#fff7ed", v: 100 },
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
      </div>
    </div>

    {/* 타원이용비중 (L) 변화율 — 핵심 인센티브 (promoted, 수가 탭과 동일) */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>타원이용비중 (L) 변화율</h2>
          <p className="text-xs mt-0.5" style={{ color: "#7c3aed" }}>
            ⭐ Track과 독립적 · 주치의 관리 강화로 L ↓ → 수입 ↑ · 모델의 핵심 인센티브
          </p>
        </div>
        <NumBox value={LC} onChange={v => set("LC", v)} color="#7c3aed" suffix="%p" />
      </div>
      <input type="range" min={-30} max={0} step={0.5} value={Math.max(-30, Math.min(0, LC))}
        onChange={e => set("LC", parseFloat(e.target.value))}
        aria-label="Track 탭 타원이용비중 변화율 슬라이더"
        className="w-full big-thumb"
        style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((Math.max(-30, Math.min(0, LC)) + 30) / 30) * 100}%, #e5e7eb 0%)` }} />
      <div className="flex justify-between text-[10px] mt-1" style={{ color: "#8b5cf6" }}>
        <span>-30%p</span><span>-20%p</span><span>-10%p</span><span>0%p (변화 없음)</span>
      </div>

      {/* 현재 L → 변화 후 L */}
      {(() => {
        const Lavg = ratios.reduce((s, r, i) => s + r * base[i].L, 0);
        const LavgAfter = Math.max(0, Math.min(1, Lavg + LC / 100));
        return (
          <div className="mt-3 bg-white/70 rounded-lg px-3 py-2">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-semibold text-purple-700">타원이용비중 L (현재 → 변화 후)</span>
              <span className="text-[10px] text-purple-500">이용환자 분포 가중평균</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-bold text-purple-700/70">{(Lavg * 100).toFixed(1)}%</span>
              <span className="text-purple-400 text-base">→</span>
              <span className="text-2xl font-extrabold text-purple-900">{(LavgAfter * 100).toFixed(1)}%</span>
              <span className="text-sm font-bold text-purple-600">({LC > 0 ? "+" : ""}{LC}%p)</span>
            </div>
          </div>
        );
      })()}
    </div>

    {/* Track KPI (promoted, 수가 탭과 동일 포맷) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-green-800">Track 현선택 수입 변화</h3>
          <span className="text-[11px] font-semibold text-green-600">행위별 {ffsPct}% / 환자군 {hccPct}% · vs 순수 FFS</span>
        </div>
        <div className="text-xs sm:text-sm text-green-700/80 font-semibold">전체 변화액</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(T.inc0, T.tS)}</span>
          <span className="text-lg sm:text-xl font-bold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626", opacity: 0.85 }}>{pct(tSchg)}</span>
        </div>
        <div className="text-[11px] text-green-700/60 mt-0.5">{fE(T.inc0)}억 → {fE(T.tS)}억</div>
        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="text-xs sm:text-sm text-green-700/80 font-semibold">의원당 평균 <span className="font-normal text-green-600/60">(M={f(M)})</span></div>
          <div className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(0, (T.tS - T.inc0) / M)}</div>
        </div>
        <div className="mt-2 text-[10.5px] text-green-800/70 bg-white/50 rounded px-2 py-1 leading-snug">
          등록환자 = Track 선택(행위별 {ffsPct}% + 환자군 {hccPct}% + F) · 비등록환자 = FFS M1 유지
        </div>
      </div>
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단의 의원급 외래 의료비 지출 변화</h3>
          <span className="text-[11px] font-semibold text-blue-600">Track 무관 · L에 따라 변동</span>
        </div>
        <div className="text-xs sm:text-sm text-blue-700/80 font-semibold">전체 변화액</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 leading-tight">{diffAuto(T.nhi0, T.nhi2)}</span>
          <span className="text-lg sm:text-xl font-bold text-blue-700/80 leading-tight">{pct(nhiNewChg, 2)}</span>
        </div>
        <div className="text-[11px] text-blue-700/60 mt-0.5">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
        <div className="mt-2 text-[10.5px] text-blue-800/70 bg-white/50 rounded px-2 py-1 leading-snug">
          기준선 = 전원 FFS 의원급 외래 총액 (입원·약국·병원급 제외)
        </div>
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
      Track A(행위별)를 선택해도 등록환자당 일차의료 기능수가 F({F_label})가 가산되어 추가 수입이 발생합니다. Track B·C로 전환 시 환자군 모형과 타원이용비중 관리에 따라 수입이 증가합니다.
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
