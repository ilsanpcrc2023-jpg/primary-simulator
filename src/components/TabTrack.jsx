import { memo, useState, useEffect } from "react";
import NumBox from "./shared/NumBox";
import { SH, C_DELTA_MAX, PF_PCT_MAX } from "../constants";
import { f, pct, fMan, fAuto, diffMan } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

// v7.9.12/v7.9.13: Track 카드 부제(FFS 100% · 혼합 50:50 · 환자군 100%) 공용 배지 — Track 선택·수입 비교·PF 박스 3곳 동일 스타일
const TRACK_TINT = { 0: "#f0fdf4", 50: "#eff6ff", 100: "#fff7ed" };
// v7.10.11: 수가 시뮬 탭 PB/PF 카드(웜 베이지)·P 카드(indigo)와 동일 스타일
const INPUT_CARD = { background: "#f4efe4", borderColor: "#b9a98a" };
const NUM_BADGE = "inline-grid place-items-center w-6 h-6 rounded-md bg-stone-700 text-white text-xs font-extrabold shadow-sm";
const PILL = "text-xs sm:text-sm font-bold bg-white border border-stone-400 rounded-full px-2.5 py-0.5 text-stone-700";
function TrackSubBadge({ text, color, tint, active }) {
  return (
    <div className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-bold leading-tight"
      style={{ color, background: active ? "#fff" : tint, border: `1px solid ${color}` }}>{text}</div>
  );
}

export default memo(function TabTrack({
  mode = "policy",
  state, set, G, T, SS, performance: perfMemo, tracks,
  resetPtPct, resetTrackPfPct, resetSsPct,
  setL2, resetL2,
}) {
  const { hccPct, L2_track, M_clinics, regDist,
    trackPfPctA, trackPfPctB, trackPfPctC } = state;
  // v7.9.10: 의원당 시범사업 참여 환자 수 (= Σ regDist) · v7.9.11: 의원당 환자수(totalN/M) 표시 삭제
  const perClinicReg = Math.round((regDist || []).reduce((a, b) => a + (b || 0), 0));
  const L2_display = L2_track ?? (perfMemo?.L2default ?? perfMemo?.L1avg ?? 0.7);   // v7.9.5: Track 탭 전용 · v7.10.6: 디폴트 ΔC 3.0%p
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
            {/* v7.9.12: 부제(FFS 100% · 혼합 · 환자군) 가시성 강화 — 회색 10px → Track 색 배지(굵게·11~12px) */}
            <TrackSubBadge text={t.d} color={t.c} tint={t.bg} active={hccPct === t.v} />
          </button>
        ))}
      </div>

      {/* v7.0: 행위별·환자군 100% 미세조정 슬라이더 제거 */}
    </div>

    {/* ② 포괄관리 지표 (C) — v7.9.5: Track 탭 전용 state(L2_track), 수가 시뮬레이션 탭과 미연동 */}
    {(() => {
      const L1avg = perfMemo?.L1avg ?? 0.7;
      const C0 = 1 - L1avg;
      const Cnow = 1 - L2_display;
      // v7.9.9: ΔC를 0.5%p 단위로 표시·입력 (NumBox 수기 입력도 0.5 단위로 반올림)
      const cDelta = Math.round(Math.max(0, Math.min(C_DELTA_MAX, (Cnow - C0) * 100)) * 2) / 2;
      const sliderBg = `linear-gradient(to right, #7c3aed ${(cDelta / C_DELTA_MAX) * 100}%, #e5e7eb 0%)`;
      const setCdelta = (dPct) => {
        const d = Math.round(Math.max(0, Math.min(C_DELTA_MAX, dPct)) * 2) / 2;
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
              <NumBox value={cDelta} decimals={1} onChange={setCdelta} color="#7c3aed" suffix="%p" />
            </div>
            <button onClick={resetL2}
              className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
              ↩ 초기화
            </button>
          </div>
          <input type="range" min={0} max={C_DELTA_MAX} step={0.5} value={cDelta}
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

    {/* ③ Track 별 의원 수입 비교 — v7.0: 단일 변화액 한 줄 (포괄관리성과 포함, PT 미포함)
        v7.10.11: 수가 시뮬 탭 ① PB 카드와 동일 스타일 · 타이틀 "일차의료 기본수가(PB)에 의한 의원 수입" */}
    <div className="rounded-xl border shadow-sm p-4" style={INPUT_CARD}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2 flex-wrap">
          <span className={NUM_BADGE}>1</span>
          일차의료 기본수가(PB)
          <span className={PILL}>의원당 연간 수입액</span>   {/* v7.10.12: 배지 1개로 통일 */}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tracks.map(t => {
          const active = hccPct === t.hc;
          return (
            <button key={t.n} onClick={() => set("hccPct", t.hc)}
              aria-selected={active}
              className="rounded-xl p-4 text-center transition-all relative cursor-pointer w-full"
              style={{
                background: active ? TRACK_TINT[t.hc] : "#fff",
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
              {/* v7.9.13: 부제 배지 (Track 선택 카드와 동일) */}
              <TrackSubBadge text={t.d} color={t.c} tint={TRACK_TINT[t.hc]} active={active} />

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

      <div className="mt-3 text-[11px] text-stone-600 leading-relaxed">
        ※ 의원당 시범사업 참여 환자 수 = <b>{f(perClinicReg)}명</b>
        <br/>※ 일차의료기능 보정 (PF) 제외, 운영지원금(단독모형) 제외
        <br/><span className="text-stone-500">※ 본 사업 참여로 발생하는 수입 변화분만 표시. 의원 전체 수입(비급여·기타) 영향은 별도.</span>
      </div>
    </div>

    {/* ④ 입력 박스 — v7.0: 아코디언 토글 제거, 항상 노출 */}
    <div className="space-y-3">
          {/* v7.9.8: PT 박스 → 일차의료 기능 보정(PF) 박스 (박스 틀 유지). Track별 PF %(B 기준, 디폴트 A 5 / B 7.5 / C 10) 입력 → PF 수입액(의원당 연간) 표시.
              수가 시뮬레이션 탭 PF 슬라이더와 미연동 · Track 카드 변화액에는 미포함(PF 제외 원칙 유지). PT state(pt_base·ptPct*)는 엔진에 보존, 화면 미표시. */}
          {/* v7.10.11: 수가 시뮬 탭 ② PF 카드와 동일 스타일(웜 베이지) · 타이틀 "일차의료 기능보정(PF)에 의한 의원 수입" */}
          <div className="rounded-xl border shadow-sm p-4" style={INPUT_CARD}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="font-bold text-base text-slate-800 flex items-center gap-2 flex-wrap">
                <span className={NUM_BADGE}>2</span>
                일차의료 기능보정(PF)
                <span className={PILL}>의원당 연간 수입액</span>   {/* v7.10.12: 배지 1개로 통일 */}
              </h2>
              <button onClick={resetTrackPfPct}
                className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white"
                title="PF % A 5 / B 7.5 / C 10%로 복귀">↩ 초기화</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: "Track A", d: "FFS 100%", key: "trackPfPctA", pctVal: trackPfPctA, hc: 0, c: "#22c55e" },
                { n: "Track B", d: "혼합 50:50", key: "trackPfPctB", pctVal: trackPfPctB, hc: 50, c: "#3b82f6" },
                { n: "Track C", d: "환자군 100%", key: "trackPfPctC", pctVal: trackPfPctC, hc: 100, c: "#f97316" },
              ].map(t => {
                const active = hccPct === t.hc;
                const amt = tracks.find(x => x.hc === t.hc)?.pfAmt ?? 0;
                return (
                  <div key={t.n}
                    className="rounded-lg p-2 text-center transition bg-white/90 shadow-sm"
                    style={{ borderLeft: `5px solid ${t.c}`, outline: active ? `2px solid ${t.c}` : "none", outlineOffset: -2 }}>
                    <button onClick={() => set("hccPct", t.hc)}
                      aria-selected={active}
                      className="block w-full text-xs font-bold cursor-pointer"
                      style={{ color: t.c }}>{t.n}</button>
                    {/* v7.9.13: "일차의료 기능보정 (PF)" 라벨 삭제 → 부제 배지 (Track 선택 카드와 동일) */}
                    <TrackSubBadge text={t.d} color={t.c} tint={TRACK_TINT[t.hc]} active={active} />
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="text-[10px] text-stone-500">B ×</span>
                      <NumBox value={t.pctVal} decimals={1}
                        onChange={v => set(t.key, Math.max(0, Math.min(PF_PCT_MAX, Math.round(v * 10) / 10)))}
                        color="#b45309" suffix="%" />
                    </div>
                    <div className="text-base font-extrabold mt-0.5" style={{ color: t.c }}>{fMan(amt)}</div>
                    <div className="text-[10px] text-stone-500">PF 수입액 / 년</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-[11px] text-stone-600 leading-relaxed">
              ※ 의원당 시범사업 참여 환자 수 = <b>{f(perClinicReg)}명</b>
              <br/>※ PF %는 환자군 기준의료비(B) 기준
              <br/>※ PF 수입액 = Σ 환자군별 B × PF% × 의원당 등록환자수
            </div>
          </div>

          {/* v7.0: 포괄관리성과 박스 삭제 — Track 비교 카드의 변화액에 이미 반영됨 */}
    </div>

    {/* ⑤ v7.10.11: "Track별 환자군 1인당 실지불액" 차트 삭제 → 일차의료수가(P)에 의한 의원 수입 박스 (수가 시뮬 탭 P 카드 스타일)
        합계 = ① PB에 의한 수입 변화액(포괄관리성과 × Track 배수) + ② PF 수입액(Track별 PF %) */}
    <div className="rounded-xl border-2 shadow-md overflow-hidden" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)", borderColor: "#4f46e5" }}>
      <div className="px-4 pt-3 pb-1">
        <h2 className="font-extrabold text-lg tracking-tight leading-tight flex items-center gap-2 flex-wrap" style={{ color: "#3730a3" }}>
          일차의료수가(P)
          {/* v7.10.12: 배지 "의원당 연간 수입액" + "P = PB + PF" */}
          <span className="text-xs sm:text-sm font-bold bg-white border border-indigo-300 rounded-full px-2.5 py-0.5 text-indigo-700">의원당 연간 수입액</span>
          <span className="text-xs sm:text-sm font-bold tabular-nums bg-white border border-indigo-300 rounded-full px-2.5 py-0.5 text-indigo-700">P = PB + PF</span>
        </h2>
      </div>
      <div className="px-4 pb-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tracks.map(t => {
            const active = hccPct === t.hc;
            const total = (t.netChange || 0) + (t.pfAmt || 0);
            return (
              <button key={t.n} onClick={() => set("hccPct", t.hc)} aria-selected={active}
                className="rounded-lg px-2 py-2 bg-white/90 shadow-sm min-w-0 text-center cursor-pointer transition"
                style={{ borderLeft: `5px solid ${t.c}`, outline: active ? `2px solid ${t.c}` : "none", outlineOffset: -2 }}>
                <div className="text-sm font-extrabold" style={{ color: t.c }}>{t.n}</div>
                <TrackSubBadge text={t.d} color={t.c} tint={TRACK_TINT[t.hc]} active={active} />
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums text-indigo-900 whitespace-nowrap">{diffMan(total)}</div>
                <div className="text-[11px] text-indigo-700/80 mt-0.5">/ 년 · 참여 전 대비</div>
                <div className="mt-1.5 text-[10px] text-indigo-700/70 tabular-nums">
                  PB {diffMan(t.netChange)} + PF {fMan(t.pfAmt)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] text-indigo-800/70 leading-relaxed">
          ※ 의원당 시범사업 참여 환자 수 = <b>{f(perClinicReg)}명</b>
          <br/>※ 운영지원금(단독모형) 제외 · 의원 전체 수입(비급여·기타) 영향은 별도
        </div>
      </div>
    </div>

  </>);
})
