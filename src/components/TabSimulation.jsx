import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { RCard, PPCard, RegScaleCard, RegDistCard } from "./RegistrationPanel";
import { SH, CL, ON } from "../constants";
import { f, fE, pct, diffAuto, fAuto } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({ state, set, updP, updBase, updK, resetK, updR, setRUniform, reset, G, T, incCurChg, incNewChg, nhiNewChg, fileRef, handleFile, handleExport, reg, regRatios }) {
  const { base, P, LC, totalN, showDetail, showEditTable, uploadBanner, dataLabel, R_g, M_clinics } = state;
  const M = Math.max(1, M_clinics);
  const ratios = base.map(g => g.N / base.reduce((s, x) => s + x.N, 0));
  const [showBaseline, setShowBaseline] = useState(false);

  return (<>
    {/* ① 환자군 기본수가 (P) 설정 */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-base text-gray-900">환자군 기본수가 (P) 설정</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">P = 환자군 기준의료비 × 의원급 외래비중</p>
        </div>
        <div className="flex items-center gap-2">
          {totalN === ON && <span className="text-xs text-gray-400 hidden sm:inline">{dataLabel}</span>}
          <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-0.5">초기화</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {SH.map((g, i) => (
          <div key={i} className="space-y-1.5">
            <span className="text-xs font-bold" style={{ color: CL[i] }}>{g} 수가</span>
            <input type="range" min={50000} max={2000000} step={10000} value={P[i]}
              onChange={e => updP(i, parseFloat(e.target.value))}
              aria-label={`${g} 수가 슬라이더`}
              className="w-full big-thumb"
              style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${((P[i] - 50000) / 1950000) * 100}%, #e5e7eb 0%)` }} />
            <div className="text-center">
              <NumBox value={P[i]} onChange={v => updP(i, Math.max(0, Math.round(v)))} color={CL[i]} suffix="원" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* ② 주치의 등록관리비 (R) 설정 */}
    <RCard state={state} set={set} setRUniform={setRUniform} updR={updR} reg={reg} regRatios={regRatios} />

    {/* ③ 최종 일차의료수가 (PP) — 결과 (promoted) */}
    <PPCard state={state} G={G} />

    {/* ④ 타원이용비중 (L) 변화율 — 핵심 인센티브 (promoted) */}
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>타원이용비중 (L) 변화율</h2>
          <p className="text-xs mt-0.5" style={{ color: "#7c3aed" }}>
            ⭐ 주치의 관리 강화 → L ↓ → 의원 수입 ↑ · 모델의 핵심 인센티브
          </p>
        </div>
        <NumBox value={LC} onChange={v => set("LC", v)} color="#7c3aed" suffix="%p" />
      </div>
      <input type="range" min={-30} max={0} step={0.5} value={Math.max(-30, Math.min(0, LC))}
        onChange={e => set("LC", parseFloat(e.target.value))}
        aria-label="타원이용비중 변화율 슬라이더"
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
            <div className="mt-1.5 grid grid-cols-4 gap-1 text-[10px]">
              {SH.map((g, i) => {
                const before = base[i].L * 100;
                const after = Math.max(0, Math.min(100, before + LC));
                return (
                  <div key={i} className="text-center rounded px-1 py-0.5" style={{ background: CL[i] + "12" }}>
                    <div className="font-bold" style={{ color: CL[i] }}>{g}</div>
                    <div className="text-purple-700/70">{before.toFixed(1)}% → <b className="text-purple-900">{after.toFixed(1)}%</b></div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 수식 요약 */}
      <div className="mt-3 pt-3 border-t border-purple-200/70 space-y-1 text-[11px]">
        <div className="flex items-start gap-2">
          <span className="font-bold text-purple-700 shrink-0 w-16">공단 지급</span>
          <code className="font-mono text-purple-900 bg-white/60 rounded px-1.5 py-0.5">A = P × (1 − L) + R</code>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-purple-700 shrink-0 w-16">본인부담</span>
          <code className="font-mono text-purple-900 bg-white/60 rounded px-1.5 py-0.5">B = M1 × 30%</code>
          <span className="text-purple-500 text-[10px]">(고정)</span>
        </div>
        <div className="text-[10px] text-purple-700 bg-purple-100/60 rounded px-2 py-1 mt-2 leading-relaxed">
          ※ 등록관리비(R)는 타원이용비중(L)과 무관하게 고정 지급됩니다.
        </div>
      </div>
    </div>

    {/* ⑤ 등록환자 규모 */}
    <RegScaleCard state={state} set={set} reg={reg} />

    {/* ⑥ 등록환자 분포 조정 (고급) */}
    <RegDistCard state={state} set={set} updK={updK} resetK={resetK} ratios={ratios} regRatios={regRatios} />

    {/* KPI 2열 — 핵심 결과 (promoted) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-green-800">의원 수입 변화</h3>
          <span className="text-[11px] font-semibold text-green-600">LC {LC}%p · 기준선 대비</span>
        </div>
        <div className="text-xs sm:text-sm text-green-700/80 font-semibold">전체 변화액</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-green-600 leading-tight">{diffAuto(T.inc0, T.inc2)}</span>
          <span className="text-lg sm:text-xl font-bold text-green-700/80 leading-tight">{pct(incNewChg)}</span>
        </div>
        <div className="text-[11px] text-green-700/60 mt-0.5">{fE(T.inc0)}억 → {fE(T.inc2)}억</div>
        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="text-xs sm:text-sm text-green-700/80 font-semibold">의원당 평균 <span className="font-normal text-green-600/60">(M={f(M)})</span></div>
          <div className="text-xl sm:text-2xl font-extrabold text-green-700 leading-tight">{diffAuto(0, (T.inc2 - T.inc0) / M)}</div>
        </div>
        <div className="mt-2 text-[10.5px] text-green-800/70 bg-white/50 rounded px-2 py-1 leading-snug">
          의원 수입 = <b>등록환자</b>(환자군 모형 A + 본인부담 + R) + <b>비등록환자</b>(FFS M1 유지)
        </div>
        <button onClick={() => setShowBaseline(v => !v)}
          className="mt-1.5 text-[10px] text-green-700/50 hover:text-green-800 transition flex items-center gap-0.5">
          <span>{showBaseline ? "▲" : "▼"}</span>
          <span>의원당 수입 절대값 {showBaseline ? "접기" : "보기"}</span>
        </button>
        {showBaseline && (
          <div className="mt-1 bg-white/70 rounded px-2 py-1.5 text-[10.5px] text-green-900 leading-snug space-y-0.5">
            <div>기존 의원당 수입 <b>{fAuto(T.inc0 / M)}</b> / 년 (LC=0, 기준선)</div>
            <div>LC {LC}%p 후 의원당 수입 <b>{fAuto(T.inc2 / M)}</b> / 년</div>
            <div className="text-[9.5px] text-green-600/70 italic pt-0.5">※ 등록·비등록 환자 모두 포함한 외래 수입 추정치. 의사 1인 소득과는 다른 개념 (의원 운영비·직원급여·재료비 공제 전).</div>
          </div>
        )}
      </div>
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단의 의원급 외래 의료비 지출 변화</h3>
          <span className="text-[11px] font-semibold text-blue-600">입원·약국·병원급 제외</span>
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

    {/* 차트 2열 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">의원 수입 비교 (환자군별, 억원)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={G.map((r, i) => ({ name: SH[i], "기존": r.inc0 / 1e8, "현의료행태": r.inc1 / 1e8, [`LC${LC}%p`]: r.inc2 / 1e8 }))} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(0) + "억"} tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="기존" fill="#d1d5db" radius={[3, 3, 0, 0]} />
            <Bar dataKey="현의료행태" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey={`LC${LC}%p`} fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">공단 총의료비 비교 (억원)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={[
            { name: "기존", v: T.nhi0 / 1e8 },
            { name: "현의료행태", v: T.nhi1 / 1e8 },
            { name: `LC${LC}%p`, v: T.nhi2 / 1e8 },
          ]} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10 }} width={40} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]}>
              <Cell fill="#d1d5db" /><Cell fill="#3b82f6" /><Cell fill="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Saving 주석 */}
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <span className="text-amber-500 shrink-0 text-sm">⚠</span>
      <span className="text-xs text-amber-800 leading-relaxed">
        본 시뮬레이션은 의원급 외래 타원이용비중 변화만 반영하며, 일차의료 강화에 따른 입원·응급 이용 절감 효과(Saving)는 포함되지 않았습니다. 추가 분석 후 반영 필요.
      </span>
    </div>

    {/* Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "추가 부담 없이 주치의 확보\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `환자군 반영 공정 보상\n현 의료행태 수입 ${pct(incCurChg)}\nLC ${LC}%p 시 ${pct(incNewChg)}` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `의원급 지출 ${pct(nhiNewChg, 2)}\n의료비 예측 가능성 향상\n*Saving 효과 별도` },
    ]} />

    {/* 데이터 관리 */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => set("showDetail", !showDetail)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
        <span>⚙️ 데이터 관리</span>
        <span className="text-gray-400 text-xs">{showDetail ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {showDetail && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {uploadBanner && (
            <div className={`mt-2 mb-3 rounded-lg px-3 py-2.5 text-xs ${uploadBanner.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${uploadBanner.success ? "text-green-700" : "text-red-700"}`}>
                  {uploadBanner.success ? "✅ " : "❌ "}{uploadBanner.msg}
                </span>
                <button onClick={() => set("uploadBanner", null)} className="text-gray-400 hover:text-gray-600 text-sm ml-2">✕</button>
              </div>
              {uploadBanner.details && (
                <pre className={`mt-1.5 text-xs leading-relaxed whitespace-pre-wrap ${uploadBanner.success ? "text-green-600" : "text-red-600"}`}>
                  {uploadBanner.details}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              <div className="text-gray-400 text-xl mb-0.5">📤</div>
              <div className="text-xs font-semibold text-gray-600">엑셀 업로드</div>
              <div className="text-xs text-gray-400 mt-0.5">NHIS-HCC분석템플릿 v6 또는 호환 파일</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer bg-blue-50/30"
              onClick={handleExport}>
              <div className="text-blue-400 text-xl mb-0.5">📥</div>
              <div className="text-xs font-semibold text-blue-600">현재값 내보내기</div>
              <div className="text-xs text-blue-400 mt-0.5">시뮬레이터 → 엑셀 Export</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-amber-200 rounded-lg p-3 text-center hover:border-amber-400 transition cursor-pointer bg-amber-50/30"
              onClick={() => { if (confirm("현재 업로드·수정한 모든 값을 지우고 파일럿 데이터(10개 의원, 69,604명)로 되돌립니다. 진행할까요?")) reset(); }}>
              <div className="text-amber-500 text-xl mb-0.5">↩</div>
              <div className="text-xs font-semibold text-amber-700">파일럿 복귀</div>
              <div className="text-xs text-amber-500 mt-0.5">기본 10개 의원 데이터로 초기화</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {G.map((r, i) => (
              <div key={i} className="rounded-lg px-2.5 py-2 border" style={{ borderColor: CL[i] + "40", background: CL[i] + "08" }}>
                <div className="text-xs font-bold mb-1" style={{ color: CL[i] }}>{SH[i]} <span className="font-normal text-gray-400">N={f(base[i].N)}</span></div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>P <b className="text-gray-900">{f(P[i])}</b>{R_g[i] > 0 && <span className="text-purple-600 text-[10px]"> +R {f(R_g[i])}</span>}</div>
                  <div>등록환자 1인 수입 <b className="text-blue-700">{f(Math.round(r.ab_reg_cur))}</b> → <b className="text-green-700">{f(Math.round(r.ab_reg_new))}</b></div>
                  <div className="text-gray-400" style={{ fontSize: 10 }}>A + 본인부담 + R · LC {LC}%p</div>
                </div>
              </div>
            ))}
          </div>

          {/* 상세 편집 테이블 */}
          <div className="mt-3 pt-2 border-t border-gray-100">
            <button onClick={() => set("showEditTable", !showEditTable)}
              className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
              <span>📋 환자군별 상세 편집 테이블</span>
              <span className="text-gray-400">{showEditTable ? "▲ 접기" : "▼ 펼치기"}</span>
            </button>
            {showEditTable && (
              <div className="mt-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 880 }}>
                    <thead>
                      <tr>
                        <th className="px-2 py-1" />
                        <th colSpan={3} className="text-center text-xs font-bold text-purple-600 bg-purple-50 px-1 py-1 border-b border-purple-200" style={{ borderRadius: "6px 6px 0 0" }}>근거 (빅데이터)</th>
                        <th colSpan={3} className="text-center text-xs font-bold text-blue-600 bg-blue-50 px-1 py-1 border-b border-blue-200" style={{ borderRadius: "6px 6px 0 0" }}>판단 (정책)</th>
                        <th colSpan={3} className="text-center text-xs font-bold text-gray-500 bg-gray-50 px-1 py-1 border-b border-gray-200" style={{ borderRadius: "6px 6px 0 0" }}>실측 (편집)</th>
                        <th colSpan={3} className="text-center text-xs font-bold text-green-600 bg-green-50 px-1 py-1 border-b border-green-200" style={{ borderRadius: "6px 6px 0 0" }}>산출 (1인당 등록환자)</th>
                      </tr>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-2 py-1.5">환자군</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">기준의료비</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">의원비중</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">계산P</th>
                        <th className="text-center px-1 py-1.5 bg-blue-50/50">수가(P)</th>
                        <th className="text-center px-1 py-1.5 bg-blue-50/50">R</th>
                        <th className="text-center px-1 py-1.5 bg-blue-50/50 text-purple-700">PP=P+R</th>
                        <th className="text-center px-1 py-1.5">L비용</th>
                        <th className="text-center px-1 py-1.5">현재외래비</th>
                        <th className="text-center px-1 py-1.5">환자수</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50">A(공단)</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50">수입</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50 text-green-600">수입(LC후)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {G.map((r, i) => {
                        const calcP = Math.round(base[i].ref * base[i].cr);
                        const Ri = R_g[i] ?? 0;
                        const pp = P[i] + Ri;
                        return (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                            <td className="text-center px-1 bg-purple-50/20 text-gray-600">{f(base[i].ref)}</td>
                            <td className="text-center px-1 bg-purple-50/20 text-gray-600">{(base[i].cr * 100).toFixed(1)}%</td>
                            <td className="text-center px-1 bg-purple-50/20 font-semibold text-purple-700">{f(calcP)}</td>
                            <td className="text-center px-1 bg-blue-50/20">
                              <input type="text" value={f(P[i])} className="w-16 text-center text-xs font-bold border border-blue-300 rounded bg-blue-50 py-0.5 text-blue-800"
                                onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) updP(i, v); }} />
                            </td>
                            <td className="text-center px-1 bg-blue-50/20 text-purple-600 font-semibold">{f(Ri)}</td>
                            <td className="text-center px-1 bg-blue-50/20 font-bold text-purple-700">{f(pp)}</td>
                            <td className="text-center px-1">
                              <input type="text" value={(base[i].L * 100).toFixed(1)} className="w-12 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 100) updBase(i, "L", v / 100); }} />%
                            </td>
                            <td className="text-center px-1">
                              <input type="text" value={f(base[i].M1)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updBase(i, "M1", v); }} />
                            </td>
                            <td className="text-center px-1">
                              <input type="text" value={f(base[i].N)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) updBase(i, "N", v); }} />
                            </td>
                            <td className="text-right px-1 bg-green-50/20 text-gray-600">{f(Math.round(r.A_cur + Ri))}</td>
                            <td className="text-right px-1 bg-green-50/20 font-semibold text-blue-700">{f(Math.round(r.ab_reg_cur))}</td>
                            <td className="text-right px-1 bg-green-50/20 font-bold text-green-700">{f(Math.round(r.ab_reg_new))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
                    <span><span className="inline-block w-3 h-3 bg-purple-50 border border-purple-200 rounded mr-1 align-middle"></span>근거 = 빅데이터 (읽기전용)</span>
                    <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-300 rounded mr-1 align-middle"></span>판단·실측 = 편집 가능</span>
                  </div>
                  <div className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1.5 font-mono leading-relaxed">
                    <div>계산P = 기준의료비 × 의원비중 · <b>PP = P + R</b> (명목)</div>
                    <div><b>A = P × (1 − L) + R</b> (공단 실지급, R은 L 우회) · B = M1 × 30% · 수입 = A + B</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </>);
})
