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

      {/* 정책 모드만 미세조정용 슬라이더 노출 */}
      {mode === "policy" && (
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
          <div className="text-[10px] text-gray-500 mt-1">중간값(예: 30·70)으로 미세 조정 가능 — 정책 협의 시뮬레이션용</div>
        </div>
      )}
    </div>

    {/* ② L2 슬라이더 (위로 승격) — 수가 시뮬레이션 탭과 state 공유 (v6.10.0: 범위 -25~0%p, 5%p 간격 표기) */}
    {(() => {
      const L1avg = perfMemo?.L1avg ?? 0.7;
      const L2delta = Math.max(-25, Math.min(0, (L2_display - L1avg) * 100));
      const sliderBg = `linear-gradient(to right, #7c3aed ${((L2delta + 25) / 25) * 100}%, #e5e7eb 0%)`;
      const setL2FromDelta = (dPct) => {
        const d = Math.max(-25, Math.min(0, dPct));
        setL2?.(Math.max(0, Math.min(1, L1avg + d / 100)));
      };
      return (
        <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
          <div className="flex items-center mb-2 gap-3 flex-wrap">
            <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>🎯 포괄관리 지표 (L2) 변화율</h2>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-purple-600 font-semibold">전</span>
              <span className="text-sm font-bold text-purple-700/70">{(L1avg * 100).toFixed(1)}%</span>
              <span className="text-purple-400">→</span>
              <span className="text-xs text-purple-600 font-semibold">후</span>
              <span className="text-lg font-extrabold text-purple-900">{(L2_display * 100).toFixed(1)}%</span>
              <NumBox value={parseFloat(L2delta.toFixed(1))} onChange={setL2FromDelta} color="#7c3aed" suffix="%p" />
            </div>
            <button onClick={resetL2}
              className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
              ↩ 초기화
            </button>
          </div>
          <input type="range" min={-25} max={0} step={0.5} value={L2delta}
            onChange={e => setL2FromDelta(parseFloat(e.target.value))}
            aria-label="Track 탭 포괄관리 지표 L2 변화율 슬라이더"
            className="w-full big-thumb"
            style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: sliderBg }} />
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
            <span>-25%p</span><span>-20%p</span><span>-15%p</span><span>-10%p</span><span>-5%p</span><span>0%p</span>
          </div>
          <div className="mt-1 text-[10px] text-purple-700/70 leading-relaxed">
            ※ L2가 작아질수록(개선) 포괄관리성과 발생 (no-downside) · 수가 시뮬레이션 탭과 값 공유
          </div>
        </div>
      );
    })()}

    {/* ③ ★ 메인 결과: Track별 우리 의원 연수입 변화 — v6.11.0: 절대값·% 차단, 변화액 단독 */}
    <div className={card + " p-4"}>
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-gray-900">💰 Track별 의원 연수입 변화 <span className="text-xs font-normal text-gray-500">(참여 전 FFS 대비 · 의원당 · 선택한 L2 기준)</span></h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tracks.map(t => {
          const active = hccPct === t.hc;
          const firstChange = t.firstYear - perClinicBase;
          const ongoingChange = t.ongoing - perClinicBase;
          return (
            <div key={t.n}
              className="rounded-xl p-4 text-center transition-all relative"
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

              {/* 1년차 변화액 */}
              <div className="mt-3 pb-3 border-b border-dashed border-gray-200">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">1년차 변화액</div>
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums mt-1"
                  style={{ color: firstChange >= 0 ? "#16a34a" : "#dc2626" }}>
                  {diffMan(firstChange)}
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">/ 년</div>
              </div>

              {/* 2년차~ 변화액 */}
              <div className="mt-3">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">2년차~ 변화액</div>
                <div className={`font-extrabold tabular-nums mt-1 ${active ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}
                  style={{ color: ongoingChange >= 0 ? "#16a34a" : "#dc2626" }}>
                  {diffMan(ongoingChange)}
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">/ 년</div>
              </div>

              {/* 활성 Track만 분해 자동 펼침 — 가산 항목만 (선지급 베이스값 노출 차단) */}
              {active && (
                <div className="mt-3 pt-3 border-t border-dashed" style={{ borderColor: t.c + "55" }}>
                  <div className="text-[10px] text-gray-500 font-semibold mb-1.5">📊 가산 항목</div>
                  <div className="space-y-0.5 text-[11px] text-left">
                    <div className="flex justify-between"><span className="text-amber-700">+ PT (1년차만)</span><span className="font-bold tabular-nums text-amber-800">+{fMan(t.ptAmt)}</span></div>
                    <div className="flex justify-between"><span className="text-cyan-700">+ 포괄관리성과 (매년)</span><span className="font-bold tabular-nums text-cyan-800">+{fMan(t.perfAmt)}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        · <b>1년차 변화액</b> = 지불체계 전환 효과 + PT(일회성 전환지원금) · <b>2년차~ 변화액</b> = 지불체계 전환 효과 + 포괄관리성과
        <br/>· 카드를 클릭해 Track을 변경하면 수가 시뮬레이션 탭의 KPI도 함께 업데이트됩니다.
        <br/>· <span className="text-gray-400">※ 본 사업 참여로 발생하는 수입 변화분만 표시. 의원 전체 수입(비급여·기타) 영향은 별도.</span>
      </div>
    </div>

    {/* ④ 입력값 참고 박스 (접힘 아코디언) — PT · 포괄관리성과 편집 UI (v6.11.0: SS 분리) */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => setShowInputs(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">{showInputs ? "▲" : "▼"}</span>
          <span>📎 적용된 입력값 (PT · 포괄관리성과)</span>
        </div>
        <span className="text-[11px] text-gray-400 font-normal">{mode === "policy" ? "정책 협의 시 편집" : "정책 가정값"}</span>
      </button>

      {/* 접힌 상태에서도 1줄 요약 표시 — v6.11.0: SS 행 제거 (Track 가산에서 분리) */}
      {!showInputs && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 text-[11px] text-gray-600 leading-relaxed space-y-0.5">
          <div>· <b className="text-amber-700">PT</b>: 1년차 1회 · A {fMan(tracks[0].ptAmt)} / B {fMan(tracks[1].ptAmt)} / C {fMan(tracks[2].ptAmt)}</div>
          <div>· <b className="text-cyan-700">포괄관리성과</b>: 매년 · L2={(L2_display * 100).toFixed(1)}% → A {fMan(tracks[0].perfAmt)} / B {fMan(tracks[1].perfAmt)} / C {fMan(tracks[2].perfAmt)}</div>
        </div>
      )}

      {showInputs && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {/* PT 박스 */}
          <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" }}>
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-amber-900">일차의료 전환지원금 (PT) <span className="text-xs font-normal text-amber-700">· 1년차 1회</span></h3>
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
                    <div className="text-base font-extrabold text-amber-900 mt-0.5">{fMan(amt)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 포괄관리성과 박스 — v6.11.0: 라벨 단순화 */}
          <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)", borderColor: perfEnabled ? "#06b6d4" : "#d1d5db", opacity: perfEnabled ? 1 : 0.7 }}>
            <div className="mb-2">
              <h3 className="font-bold text-sm text-cyan-800">포괄관리성과 (L2 기반) <span className="text-xs font-normal text-cyan-700">· 2년차부터 매년</span></h3>
            </div>
            {!perfEnabled && (
              <div className="rounded-lg bg-white/70 border border-gray-300 px-3 py-2 text-xs text-gray-600 mb-2">
                💡 위 <b>L2 슬라이더</b>를 L1보다 낮게 설정해야 포괄관리성과 발생 (no-downside).
              </div>
            )}
            <div className="text-xs text-cyan-700/80 mb-2 leading-relaxed">
              <div className="text-[10px] text-cyan-600/80 mb-1">
                위계: <b>포괄관리 지표(L2)</b> → <b>포괄관리성과 = max(0, L1 − L2)</b> → <b>지급액 = 포괄관리성과 × B × n_reg × TrackMul</b>
              </div>
              <div>공식: Σ <code className="text-cyan-900 bg-cyan-100 px-1 rounded">max(0, L1 − L2) × B × n_reg</code> × Track 배수</div>
              <div className="text-[10px] text-cyan-600/70 mt-0.5">
                n_reg = 의원당 환자군별 등록환자수 · 이용 감소분은 의원 100% 환원 (Shared Saving과 달리 공유율 없음)
              </div>
              <div className="mt-1">
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
                    <div className="text-base font-extrabold text-cyan-900 mt-0.5">{fMan(t.perfAmt)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* v6.11.0: Shared Saving 분리 — Track 가산에서 제외, SS 탭으로 이동 */}
          <div className="rounded-xl border border-dashed shadow-sm p-3 text-xs leading-relaxed"
            style={{ background: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" }}>
            <div className="font-semibold text-slate-700 mb-1">📌 Shared Saving은 Track 가산에서 분리되었습니다</div>
            <div className="text-[11px] text-slate-500">
              입원·응급·요양병원 절감 기반 분배(SS)는 시범사업 1~2년 종단 데이터로 검증 후 도입을 별도 검토합니다. 현재 Track 비교·의원 수입 변화(KPI)에는 반영되지 않습니다 — 시연용 추정 로직과 Track 지급률 편집은 <b>성과 배분 (Shared Saving) 탭</b>에서 확인 가능합니다.
            </div>
          </div>
        </div>
      )}
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
