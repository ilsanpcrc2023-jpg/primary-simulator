import { memo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import NumBox from "./shared/NumBox";
import { SH } from "../constants";
import { f, pct, fMan, fAuto, diffMan } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabTrack({
  mode = "policy",
  state, set, G, T, SS, performance: perfMemo, tracks,
  resetPtPct, resetSsPct,
  setL2, resetL2,
}) {
  const { hccPct, L2, M_clinics, pt_base,
    ptPctA, ptPctB, ptPctC, ssPctA, ssPctB, ssPctC } = state;
  const L2_display = L2 ?? (perfMemo?.L1avg ?? 0.7);
  const ffsPct = 100 - hccPct;
  const M = Math.max(1, M_clinics);

  const perClinicBase = T.inc0 / M;

  // 표시용 보조 산출
  const ssPerClinicFull = (SS?.clinicFromItem ?? 0) / M;
  const ssEnabled = (SS?.clinicFromItem ?? 0) > 0;
  const perfTotal = perfMemo?.perf_total ?? 0;
  const perfPerClinicFull = perfTotal / M;
  const perfEnabled = perfTotal > 0;

  // 입력값 참고 박스 펼침 상태 — 정책 모드 기본 펼침 / 의원 모드 기본 접힘
  const [showInputs, setShowInputs] = useState(mode === "policy");
  useEffect(() => { setShowInputs(mode === "policy"); }, [mode]);

  // 활성 Track 찾기
  const activeTrack = tracks.find(t => t.hc === hccPct) || tracks[2];

  return (<>
    {/* ① Track 선택 */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-base text-gray-900">🎯 Track 선택</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { n: "Track A", d: "FFS 100%", c: "#22c55e", bg: "#f0fdf4", v: 0 },
          { n: "Track B", d: "혼합 50:50", c: "#3b82f6", bg: "#eff6ff", v: 50 },
          { n: "Track C", d: "환자군 100%", c: "#f97316", bg: "#fff7ed", v: 100 },
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

      {/* v7.0: 행위별·환자군 100% 미세조정 슬라이더 제거 */}
    </div>

    {/* ② 포괄관리 지표 (C) — 수가 시뮬레이션 탭과 동일 (state 공유, 양수 슬라이더) */}
    {(() => {
      const L1avg = perfMemo?.L1avg ?? 0.7;
      const C0 = 1 - L1avg;
      const Cnow = 1 - L2_display;
      const cDelta = Math.max(0, Math.min(25, (Cnow - C0) * 100));
      const sliderBg = `linear-gradient(to right, #7c3aed ${(cDelta / 25) * 100}%, #e5e7eb 0%)`;
      const setCdelta = (dPct) => {
        const d = Math.max(0, Math.min(25, dPct));
        setL2?.(Math.max(0, Math.min(1, L1avg - d / 100)));
      };
      return (
        <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
          <div className="flex items-center mb-2 gap-3 flex-wrap">
            <div className="flex flex-col">
              <h2 className="font-bold text-base leading-tight" style={{ color: "#6d28d9" }}>포괄관리 지표 (C)</h2>
              <div className="text-[11px] text-purple-700/70 leading-tight mt-0.5">등록의원의 외래 진료비 비중 (C = 1 − L2)</div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-purple-600 font-semibold">기존</span>
              <span className="text-sm font-bold text-purple-700/70">{(C0 * 100).toFixed(1)}%</span>
              <span className="text-purple-400">→</span>
              <span className="text-xs text-purple-600 font-semibold">후</span>
              <span className="text-lg font-extrabold text-purple-900">{(Cnow * 100).toFixed(1)}%</span>
              <NumBox value={parseFloat(cDelta.toFixed(1))} onChange={setCdelta} color="#7c3aed" suffix="%p" />
            </div>
            <button onClick={resetL2}
              className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
              ↩ 초기화
            </button>
          </div>
          <input type="range" min={0} max={25} step={0.5} value={cDelta}
            onChange={e => setCdelta(parseFloat(e.target.value))}
            aria-label="Track 탭 포괄관리 지표 C 슬라이더"
            className="w-full big-thumb"
            style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: sliderBg }} />
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
            <span>0%p</span><span>+5%p</span><span>+10%p</span><span>+15%p</span><span>+20%p</span><span>+25%p</span>
          </div>
        </div>
      );
    })()}

    {/* ③ Track 별 의원 수입 비교 — v7.0: 단일 변화액 한 줄 (포괄관리성과 포함, PT 미포함) */}
    <div className={card + " p-4"}>
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-gray-900">💰 Track 별 의원 수입 비교 <span className="text-xs font-normal text-gray-500">(참여 전 FFS 대비 · 의원당)</span></h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tracks.map(t => {
          const active = hccPct === t.hc;
          return (
            <button key={t.n} onClick={() => set("hccPct", t.hc)}
              aria-selected={active}
              className="rounded-xl p-4 text-center transition-all relative cursor-pointer w-full"
              style={{
                background: active ? "#fffbeb" : "#fff",
                border: active ? `3px solid ${t.c}` : `1.5px solid #e5e7eb`,
                boxShadow: active ? `0 0 0 3px ${t.c}22, 0 4px 14px ${t.c}33` : "0 1px 3px rgba(0,0,0,0.04)",
                transform: active ? "translateY(-2px)" : "none",
              }}>
              {active && (
                <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow"
                  style={{ background: t.c }}>
                  ✓ 현재 선택
                </div>
              )}
              <div className="text-sm font-extrabold" style={{ color: t.c }}>{t.n}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{t.d}</div>

              {/* 변화액 (지불체계 전환 효과 + 포괄관리성과, PT 별도) */}
              <div className="mt-4">
                <div className={`font-extrabold tabular-nums ${active ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
                  style={{ color: t.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
                  {diffMan(t.netChange)}
                </div>
                <div className="text-[11px] text-gray-500 font-normal mt-1">/ 년 · 참여 전 대비</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        · 변화액 = 지불체계 전환 효과 + 포괄관리성과 (매년 · 일차의료 전환지원금은 1년차 별도 지급)
        <br/>· <span className="text-gray-400">※ 본 사업 참여로 발생하는 수입 변화분만 표시. 의원 전체 수입(비급여·기타) 영향은 별도.</span>
      </div>
    </div>

    {/* ④ 입력 박스 — v7.0: 아코디언 토글 제거, 항상 노출 */}
    <div className="space-y-3">
          {/* PT 박스 — v7.0: cf 이모지 (참고/별도 지급 의미) */}
          <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" }}>
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-amber-900">📋 (cf) 일차의료 전환지원금 (PT) <span className="text-xs font-normal text-amber-700">· 1년차 1회 · 위 변화액 별도</span></h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 font-semibold">사업 투자액</span>
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
                    <div className="text-base font-extrabold text-amber-900 mt-0.5">{fMan(amt)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 포괄관리성과 박스 — v7.0: 위계/공식/L2 현재 등 모두 삭제, 배수 표기 삭제 */}
          <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)", borderColor: perfEnabled ? "#06b6d4" : "#d1d5db", opacity: perfEnabled ? 1 : 0.7 }}>
            <div className="mb-2">
              <h3 className="font-bold text-sm text-cyan-800">포괄관리성과 <span className="text-xs font-normal text-cyan-700">— 포괄관리지표(C) 근거 성과 가산</span></h3>
            </div>
            {!perfEnabled && (
              <div className="rounded-lg bg-white/70 border border-gray-300 px-3 py-2 text-xs text-gray-600 mb-2">
                💡 위 <b>포괄관리 지표(C) 슬라이더</b>를 우측으로 움직여 포괄관리성과 발생.
              </div>
            )}
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
                    <div className="text-base font-extrabold text-cyan-900 mt-0.5">{fMan(t.perfAmt)}</div>
                  </div>
                );
              })}
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

  </>);
})
