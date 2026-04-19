import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import NumBox from "./shared/NumBox";
import { SH, CL } from "../constants";
import { f, fE, pct, diffAuto, fMan, diffMan } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabTrack({ state, set, G, T, nhiNewChg, tAchg, tBchg, tCchg, tSchg }) {
  const { base, hccPct, LC, M_clinics } = state;
  const ffsPct = 100 - hccPct;
  const M = Math.max(1, M_clinics);
  const ratios = base.map(g => g.N / base.reduce((s, x) => s + x.N, 0));

  const Lavg = ratios.reduce((s, r, i) => s + r * base[i].L, 0);
  const LavgAfter = Math.max(0, Math.min(1, Lavg + LC / 100));

  const perClinicBase = T.inc0 / M;
  const perClinicTrack = T.tS / M;
  const perClinicGain = perClinicTrack - perClinicBase;

  // PT (일차의료 전환지원금) — 1회성 첫해. Track A=0, B=1,500만, C=3,000만, 선형 보간
  const PT_MAX = 30_000_000;
  const PT = (hccPct / 100) * PT_MAX;
  const perClinicFirstYear = perClinicGain + PT;

  return (<>
    {/* ① Track 선택 */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-base text-gray-900">Track 선택</h2>
        <span className="text-[11px] text-gray-500">모든 Track에 F 가산 · 비등록환자는 항상 FFS</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", d: "FFS + F", c: "#22c55e", bg: "#f0fdf4", v: 0 },
          { n: "Track B", d: "혼합 + F", c: "#3b82f6", bg: "#eff6ff", v: 50 },
          { n: "Track C", d: "환자군 + F", c: "#f97316", bg: "#fff7ed", v: 100 },
        ].map((t, i) => (
          <button key={i} onClick={() => set("hccPct", t.v)}
            aria-selected={hccPct === t.v}
            className="rounded-lg p-2.5 sm:p-3 text-center cursor-pointer transition-all relative"
            style={{ background: hccPct === t.v ? t.bg : "#fff", border: `2px solid ${hccPct === t.v ? t.c : "#e5e7eb"}` }}>
            {hccPct === t.v && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: t.c }}>✓</div>}
            <div className="text-xs sm:text-sm font-extrabold" style={{ color: t.c }}>{t.n}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{t.d}</div>
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-green-600 shrink-0">행위별 {ffsPct}%</span>
          <input type="range" min={0} max={100} step={5} value={hccPct}
            onChange={e => set("hccPct", parseInt(e.target.value))}
            aria-label="행위별 환자군 혼합 비율 슬라이더"
            className="flex-1 big-thumb"
            style={{ '--thumb-bg': '#f97316', accentColor: "#f97316", background: `linear-gradient(to right, #22c55e 0%, #22c55e ${ffsPct}%, #f97316 ${ffsPct}%, #f97316 100%)` }} />
          <span className="text-xs font-bold text-orange-600 shrink-0">환자군 {hccPct}%</span>
        </div>
      </div>
    </div>

    {/* ② 타원이용비중 L 변화율 — 슬림 (수가 탭과 동일) */}
    <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>타원이용비중 (L) 변화율</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-purple-700/70">{(Lavg * 100).toFixed(1)}%</span>
          <span className="text-purple-400">→</span>
          <span className="text-lg font-extrabold text-purple-900">{(LavgAfter * 100).toFixed(1)}%</span>
          <NumBox value={LC} onChange={v => set("LC", v)} color="#7c3aed" suffix="%p" />
        </div>
      </div>
      <input type="range" min={-30} max={0} step={0.5} value={Math.max(-30, Math.min(0, LC))}
        onChange={e => set("LC", parseFloat(e.target.value))}
        aria-label="Track 탭 타원이용비중 변화율 슬라이더"
        className="w-full big-thumb"
        style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((Math.max(-30, Math.min(0, LC)) + 30) / 30) * 100}%, #e5e7eb 0%)` }} />
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
        <span>-30%p</span><span>-20%p</span><span>-10%p</span><span>0%p</span>
      </div>
    </div>

    {/* ③ KPI 2카드 — 상시 표시, 의원당 수입 확대 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-green-800">Track 수입 변화</h3>
          <span className="text-[11px] font-semibold text-green-600">행위별 {ffsPct}% / 환자군 {hccPct}%</span>
        </div>
        <div className="text-[11px] text-green-700/80 font-semibold">전체 변화액</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffAuto(T.inc0, T.tS)}</span>
          <span className="text-base sm:text-lg font-bold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626", opacity: 0.85 }}>{pct(tSchg)}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="text-[11px] text-green-700/80 font-semibold">의원당 평균 변화 <span className="font-normal text-green-600/60">(M={f(M)})</span></div>
          <div className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{diffMan(perClinicGain)}</div>
        </div>

        <div className="mt-2 pt-2 border-t border-green-200/70 space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-green-700/70">기준선 의원당 수입</span>
            <span className="text-base font-bold text-green-800/80">{fMan(perClinicBase)}/년</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-green-700 font-semibold">Track 후 의원당 수입</span>
            <span className="text-lg font-extrabold text-green-900">{fMan(perClinicTrack)}/년</span>
          </div>
        </div>
        <div className="mt-1.5 text-[9.5px] text-green-700/60 italic leading-tight">
          ※ 등록·비등록 환자 모두 포함한 외래 수입 추정치. 의사 1인 소득 ≠ 의원 외래 수입.
        </div>
      </div>

      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단 의원급 외래 지출 변화</h3>
          <span className="text-[11px] font-semibold text-blue-600">Track 무관 · L에 따라</span>
        </div>
        <div className="text-[11px] text-blue-700/80 font-semibold">전체 변화액</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 leading-tight">{diffAuto(T.nhi0, T.nhi2)}</span>
          <span className="text-base sm:text-lg font-bold text-blue-700/80 leading-tight">{pct(nhiNewChg, 2)}</span>
        </div>
        <div className="text-[11px] text-blue-700/60 mt-0.5">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
        <div className="mt-2 pt-2 border-t border-blue-200/70">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-blue-700/80 font-semibold">의원당 평균 변화</span>
            <span className="text-lg font-bold text-blue-700">{diffMan((T.nhi2 - T.nhi0) / M)}</span>
          </div>
        </div>
      </div>
    </div>

    {/* ④ PT (일차의료 전환지원금) */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-bold text-base text-amber-900">일차의료 전환지원금 (PT)</h3>
        <span className="text-[11px] font-semibold text-amber-700">1회성 · 첫해만</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", amt: 0, hc: 0, c: "#22c55e" },
          { n: "Track B", amt: 15_000_000, hc: 50, c: "#3b82f6" },
          { n: "Track C", amt: 30_000_000, hc: 100, c: "#f97316" },
        ].map(t => {
          const active = hccPct === t.hc;
          return (
            <div key={t.n} className="rounded-lg p-2 text-center transition"
              style={{ background: active ? "#fef9c3" : "#fffbeb", border: `2px solid ${active ? "#f59e0b" : "#fde68a"}` }}>
              <div className="text-xs font-bold" style={{ color: t.c }}>{t.n}</div>
              <div className="text-base font-extrabold text-amber-900 mt-0.5">
                {t.amt === 0 ? "미지급" : fMan(t.amt)}
              </div>
              <div className="text-[9px] text-amber-600 mt-0.5">의원당 · 1회</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/70 rounded-lg px-3 py-2.5">
        <div className="text-[11px] text-amber-800 font-semibold mb-1">
          의원당 1년차 합계 <span className="font-normal text-amber-600/80">(Track 수입 + PT)</span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-sm text-amber-800">{diffMan(perClinicGain)}</span>
          <span className="text-amber-500 font-bold">+</span>
          <span className="font-mono text-sm text-amber-800">{PT === 0 ? "0원" : "+" + fMan(PT)}</span>
          <span className="text-amber-500 font-bold">=</span>
          <span className="text-xl sm:text-2xl font-extrabold text-amber-900">{diffMan(perClinicFirstYear)}</span>
        </div>
      </div>
    </div>

    {/* ⑤ Track 차트 */}
    <div className={card + " p-3"}>
      <h3 className="text-xs font-bold text-gray-700 mb-2">Track별 환자군 1인당 실지불액</h3>
      <ResponsiveContainer width="100%" height={220}>
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

    {/* ⑥ Track 테이블 */}
    <div className={card + " overflow-hidden"}>
      <div className="px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Track별 1인당 실지불액 비교 <span className="text-gray-400 font-normal text-xs">(LC {LC}%p)</span></h3>
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
              const chg = r.b.M1 > 0 ? (r.tS - r.b.M1) / r.b.M1 : 0;
              return (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                  <td className="text-right px-2">{f(Math.round(r.tA))}</td>
                  <td className="text-right px-2">{f(Math.round(r.tB))}</td>
                  <td className="text-right px-2 font-bold">{f(Math.round(r.tC))}</td>
                  <td className="text-right px-2 font-bold text-purple-700">{f(Math.round(r.tS))}</td>
                  <td className="text-right px-2 font-bold" style={{ color: chg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(chg)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="px-2 py-1.5 text-sm">총수입</td>
              <td className="text-right px-2"><div>{fE(T.tA)}억</div><div className="text-green-600 font-normal text-xs">{pct(tAchg)}</div></td>
              <td className="text-right px-2"><div>{fE(T.tB)}억</div><div className="text-green-600 font-normal text-xs">{pct(tBchg)}</div></td>
              <td className="text-right px-2"><div>{fE(T.tC)}억</div><div className="text-green-600 font-normal text-xs">{pct(tCchg)}</div></td>
              <td className="text-right px-2 text-purple-700">{fE(T.tS)}억</td>
              <td className="text-right px-2" style={{ color: tSchg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(tSchg)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </>);
})
