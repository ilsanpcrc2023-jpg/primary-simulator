import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import NumBox from "./shared/NumBox";
import { SH } from "../constants";
import { f, pct, fMan, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabTrack({
  state, set, G, T, SS, performance: perfMemo,
  tAchg, tBchg, tCchg,
  resetPtPct, resetSsPct, setAlpha, resetAlpha,
}) {
  const { hccPct, M_clinics, pt_base, alpha,
    ptPctA, ptPctB, ptPctC, ssPctA, ssPctB, ssPctC } = state;
  const ffsPct = 100 - hccPct;
  const M = Math.max(1, M_clinics);

  const perClinicBase = T.inc0 / M;

  // 성과배분 재원 (N분의 1)
  const ssPerClinicFull = (SS?.clinicFromItem ?? 0) / M;
  const ssEnabled = (SS?.clinicFromItem ?? 0) > 0;

  // v6.7: L2 성과급 (Track A=0, B=0.5, C=1.0)
  const perfTotal = perfMemo?.perf_total ?? 0;       // α 반영, Track C 최대치
  const perfPerClinicFull = perfTotal / M;
  const perfEnabled = perfTotal > 0;

  // Track별 의원당 수입 · 변화량 · PT · SS · 성과급(L2)
  const tracks = [
    { n: "Track A", d: "FFS 100%",    hc: 0,   c: "#22c55e", bg: "#f0fdf4", bd: "#86efac",
      income: T.tA / M, chg: tAchg, ptPct: ptPctA, ssPct: ssPctA, perfMul: 0 },
    { n: "Track B", d: "혼합 50:50",   hc: 50,  c: "#3b82f6", bg: "#eff6ff", bd: "#93c5fd",
      income: T.tB / M, chg: tBchg, ptPct: ptPctB, ssPct: ssPctB, perfMul: 0.5 },
    { n: "Track C", d: "환자군 100%",  hc: 100, c: "#f97316", bg: "#fff7ed", bd: "#fdba74",
      income: T.tC / M, chg: tCchg, ptPct: ptPctC, ssPct: ssPctC, perfMul: 1.0 },
  ].map(t => {
    const ptAmt = pt_base * t.ptPct / 100;
    const ssAmt = ssPerClinicFull * t.ssPct / 100;
    const perfAmt = perfPerClinicFull * t.perfMul;   // v6.7 성과급 (L2 귀속)
    return { ...t, ptAmt, ssAmt, perfAmt,
      firstYear: t.income + ptAmt,
      ongoing:   t.income + ssAmt + perfAmt };
  });

  return (<>
    {/* ① Track 선택 */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-base text-gray-900">Track 선택</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", d: "FFS", c: "#22c55e", bg: "#f0fdf4", v: 0 },
          { n: "Track B", d: "혼합", c: "#3b82f6", bg: "#eff6ff", v: 50 },
          { n: "Track C", d: "환자군", c: "#f97316", bg: "#fff7ed", v: 100 },
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

    {/* ② PT (일차의료 전환지원금) — 1년차 1회 */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" }}>
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h3 className="font-bold text-base text-amber-900">일차의료 전환지원금 (PT) <span className="text-xs font-normal text-amber-700">· 1년차 1회</span></h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700 font-semibold">기준 금액</span>
          <NumBox value={pt_base} onChange={v => set("pt_base", Math.max(0, Math.round(v)))} color="#b45309" suffix="원" />
          <button onClick={resetPtPct}
            className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded px-2 py-1 transition"
            title="PT Track 지급률 10/50/100%로 복귀">↩ 초기화</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { n: "Track A", key: "ptPctA", pctVal: ptPctA, hc: 0, c: "#22c55e" },
          { n: "Track B", key: "ptPctB", pctVal: ptPctB, hc: 50, c: "#3b82f6" },
          { n: "Track C", key: "ptPctC", pctVal: ptPctC, hc: 100, c: "#f97316" },
        ].map(t => {
          const active = hccPct === t.hc;
          const amt = pt_base * t.pctVal / 100;
          return (
            <div key={t.n}
              className="rounded-lg p-2 text-center transition"
              style={{ background: active ? "#fef9c3" : "#fffbeb", border: `2px solid ${active ? "#f59e0b" : "#fde68a"}` }}>
              <button onClick={() => set("hccPct", t.hc)}
                aria-selected={active}
                className="block w-full text-xs font-bold cursor-pointer"
                style={{ color: t.c }}>{t.n}</button>
              <div className="flex items-center justify-center gap-1 mt-1">
                <NumBox value={t.pctVal}
                  onChange={v => set(t.key, Math.max(0, Math.min(500, v)))}
                  color="#b45309" suffix="%" />
              </div>
              <div className="text-base font-extrabold text-amber-900 mt-0.5">
                {fMan(amt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* ③ 참여의원 성과배분 (Shared Saving) — 2년차부터 매년 */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: ssEnabled ? "#86efac" : "#d1d5db", opacity: ssEnabled ? 1 : 0.7 }}>
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h3 className="font-bold text-base text-green-800">참여의원 성과배분 (SS) <span className="text-xs font-normal text-green-700">· 2년차부터 매년</span></h3>
        <button onClick={resetSsPct}
          className="text-xs text-green-700 hover:text-green-900 hover:bg-green-100 rounded px-2 py-1 transition"
          title="성과배분 Track 지급률 10/50/100%로 복귀">↩ 초기화</button>
      </div>

      {!ssEnabled && (
        <div className="rounded-lg bg-white/70 border border-gray-300 px-3 py-2 text-xs text-gray-600 mb-2">
          💡 Shared Saving 탭에서 <b>참여의원 성과배분 비율</b>을 0% 초과로 설정해야 활성화됩니다.
        </div>
      )}

      <div className="text-xs text-green-700/80 mb-2 leading-relaxed">
        <div>재원: Shared Saving 탭에서 산정된 <b className="text-green-800">사업대상 환자 의료비 절감배분액</b></div>
        <div className="mt-0.5">
          = <b>{fAuto(SS?.clinicFromItem ?? 0)}</b>
          <span className="text-green-600/60"> (성과배분 {Math.round((SS?.clinicPct ?? 0) * 100)}%)</span>
          <span className="text-green-500/70"> ÷ {f(M)}개 의원 = 의원당 <b>{fMan(ssPerClinicFull)}</b></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { n: "Track A", key: "ssPctA", pctVal: ssPctA, hc: 0, c: "#22c55e" },
          { n: "Track B", key: "ssPctB", pctVal: ssPctB, hc: 50, c: "#3b82f6" },
          { n: "Track C", key: "ssPctC", pctVal: ssPctC, hc: 100, c: "#f97316" },
        ].map(t => {
          const active = hccPct === t.hc;
          const amt = ssPerClinicFull * t.pctVal / 100;
          return (
            <div key={t.n}
              className="rounded-lg p-2 text-center transition"
              style={{ background: active ? "#dcfce7" : "#f0fdf4", border: `2px solid ${active ? "#22c55e" : "#bbf7d0"}` }}>
              <button onClick={() => set("hccPct", t.hc)}
                aria-selected={active}
                className="block w-full text-xs font-bold cursor-pointer"
                style={{ color: t.c }}>{t.n}</button>
              <div className="flex items-center justify-center gap-1 mt-1">
                <NumBox value={t.pctVal}
                  onChange={v => set(t.key, Math.max(0, Math.min(500, v)))}
                  color="#15803d" suffix="%" />
              </div>
              <div className="text-base font-extrabold text-green-900 mt-0.5">
                {fMan(amt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* ④ 성과급 L2 (v6.7 신규) — 2년차부터, 외래 집중도 성과 */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)", borderColor: perfEnabled ? "#06b6d4" : "#d1d5db", opacity: perfEnabled ? 1 : 0.7 }}>
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <h3 className="font-bold text-base text-cyan-800">성과급 L2 (타원이용 절감) <span className="text-xs font-normal text-cyan-700">· 2년차부터 매년</span></h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-cyan-700 font-semibold">공유율 α</span>
          <NumBox
            value={parseFloat((alpha * 100).toFixed(0))}
            onChange={v => setAlpha(v / 100)}
            color="#0891b2" suffix="%" />
          <button onClick={resetAlpha}
            className="text-xs text-cyan-700 hover:text-red-600 border border-cyan-200 hover:border-red-300 rounded px-2 py-1 bg-white/70">
            ↩
          </button>
        </div>
      </div>

      {!perfEnabled && (
        <div className="rounded-lg bg-white/70 border border-gray-300 px-3 py-2 text-xs text-gray-600 mb-2">
          💡 수가 시뮬레이션 탭에서 <b>L2 슬라이더</b>를 L1보다 낮게 설정해야 성과급 발생 (no-downside).
        </div>
      )}

      <div className="text-xs text-cyan-700/80 mb-2 leading-relaxed">
        <div>공식: Σ <code className="text-cyan-900 bg-cyan-100 px-1 rounded">max(0, L1 − L2) × B × n_reg × α</code> × Track 배수</div>
        <div className="mt-0.5">
          L2 현재 <b className="text-cyan-900">{((perfMemo?.L2eff ?? 0) * 100).toFixed(1)}%</b>
          <span className="text-cyan-600/60"> · L1 가중평균 {((perfMemo?.L1avg ?? 0) * 100).toFixed(1)}%</span>
          <span className="text-cyan-500/70"> · 전체 최대(Track C) = <b>{fAuto(perfTotal)}</b></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tracks.map(t => {
          const active = hccPct === t.hc;
          return (
            <div key={t.n}
              className="rounded-lg p-2 text-center transition"
              style={{ background: active ? "#cffafe" : "#ecfeff", border: `2px solid ${active ? "#06b6d4" : "#a5f3fc"}` }}>
              <button onClick={() => set("hccPct", t.hc)}
                aria-selected={active}
                className="block w-full text-xs font-bold cursor-pointer"
                style={{ color: t.c }}>{t.n}</button>
              <div className="text-[9px] text-gray-500 mt-0.5">배수 ×{t.perfMul.toFixed(1)}</div>
              <div className="text-base font-extrabold text-cyan-900 mt-0.5">
                {fMan(t.perfAmt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* ⑤ Track별 수입 비교 */}
    <div className={card + " p-4"}>
      <h3 className="font-bold text-base text-gray-900 mb-3">Track별 수입 비교 <span className="text-xs font-normal text-gray-500">(의원당/년)</span></h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-500 font-semibold pb-2 pr-2 w-28">&nbsp;</th>
              {tracks.map(t => (
                <th key={t.n} className="text-center pb-2 px-1">
                  <div className="font-extrabold" style={{ color: t.c }}>{t.n}</div>
                  <div className="text-[10px] text-gray-500">{t.d}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200">
              <td className="text-xs text-gray-600 py-2 pr-2">Track 수입 (선지급)</td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-bold text-gray-800 py-2">{fMan(t.income)}</td>
              ))}
            </tr>
            <tr className="border-t border-gray-100">
              <td className="text-xs text-gray-600 py-2 pr-2">변화 <span className="text-gray-400">(vs 기준 FFS)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center text-xs font-semibold py-2" style={{ color: t.chg >= 0 ? "#16a34a" : "#dc2626" }}>{pct(t.chg)}</td>
              ))}
            </tr>
            <tr className="border-t border-gray-200 bg-amber-50/60">
              <td className="text-xs text-amber-800 py-2 pr-2 font-semibold">PT <span className="font-normal text-amber-600">(1년차)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-bold text-amber-800 py-2">+{fMan(t.ptAmt)}</td>
              ))}
            </tr>
            <tr className="border-t border-amber-100 bg-green-50/70">
              <td className="text-xs text-green-800 py-2 pr-2 font-semibold">성과배분 SS <span className="font-normal text-green-600">(매년)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-bold text-green-800 py-2">+{fMan(t.ssAmt)}</td>
              ))}
            </tr>
            <tr className="border-t border-green-100 bg-cyan-50/70">
              <td className="text-xs text-cyan-800 py-2 pr-2 font-semibold">성과급 L2 <span className="font-normal text-cyan-600">(매년)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-bold text-cyan-800 py-2">+{fMan(t.perfAmt)}</td>
              ))}
            </tr>
            <tr className="border-t-2 border-gray-300 bg-yellow-50">
              <td className="text-xs text-yellow-900 py-2 pr-2 font-bold">1년차 합계 <span className="font-normal text-yellow-700">(Track+PT)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-extrabold text-yellow-900 py-2">{fMan(t.firstYear)}</td>
              ))}
            </tr>
            <tr className="border-t border-yellow-100 bg-yellow-50">
              <td className="text-xs text-yellow-900 py-2 pr-2 font-bold">2년차 이후 <span className="font-normal text-yellow-700">(Track+SS+L2)</span></td>
              {tracks.map(t => (
                <td key={t.n} className="text-center font-extrabold text-yellow-900 py-2">{fMan(t.ongoing)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        참고: 현행 FFS 진료 형태 사업 비참여 의원 수입 = <b className="text-gray-700">{fMan(perClinicBase)}/년</b>
      </div>
    </div>

    {/* ⑥ Track 차트 */}
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

  </>);
})
