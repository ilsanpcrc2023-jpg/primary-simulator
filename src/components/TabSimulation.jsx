import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { SH, CL, ON } from "../constants";
import { f, fE, pct, diffE } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({ state, set, updP, updBase, reset, G, T, incCurChg, incNewChg, nhiNewChg, fileRef, handleFile, handleExport }) {
  const { base, P, LC, totalN, showDetail, showEditTable, uploadBanner, dataLabel } = state;

  return (<>
    {/* 수가 설정 */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 text-sm">일차의료수가 설정</h2>
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
              <NumBox value={P[i]} onChange={v => updP(i, Math.max(50000, Math.min(2000000, v)))} color={CL[i]} suffix="원" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-700">타원이용비중 변화율 (LC)</span>
          <span className="text-xs text-gray-400">진료건수 기준 · 등록 후 관리 강화 시 예상 감소폭</span>
          <div className="ml-auto">
            <NumBox value={LC} onChange={v => set("LC", Math.max(-10, Math.min(0, v)))} color="#7c3aed" suffix="%p" />
          </div>
        </div>
        <input type="range" min={-10} max={0} step={0.5} value={LC}
          onChange={e => set("LC", parseFloat(e.target.value))}
          aria-label="타원이용비중 변화율 슬라이더"
          className="w-full big-thumb"
          style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((LC + 10) / 10) * 100}%, #e5e7eb 0%)` }} />
      </div>
    </div>

    {/* 등록환자 수 */}
    <div className={card + " px-3 py-2.5"}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-600 shrink-0">등록환자 수 (N)</span>
        <input type="text" value={totalN.toLocaleString()}
          onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) { set("totalN", v); if (v !== ON) set("dataLabel", "시뮬레이션 모드"); } }}
          className="w-28 text-sm font-bold text-gray-800 text-right border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
        <span className="text-xs text-gray-400">명</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-blue-600 font-semibold shrink-0">추정 환자수 예측</span>
        {[{ l: "10만", v: 100000 }, { l: "100만", v: 1000000 }, { l: "1000만", v: 10000000 }, { l: "5000만", v: 50000000 }].map(b => (
          <button key={b.v} onClick={() => { set("totalN", b.v); set("dataLabel", `추정 ${b.l}명 시뮬레이션`); }}
            className="text-xs px-2 py-1 rounded border font-medium transition"
            style={totalN === b.v ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
            {b.l}
          </button>
        ))}
        <span className="text-xs text-gray-400">명</span>
      </div>
    </div>

    {/* KPI 2열 */}
    <div className="grid grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <div className="text-xs text-gray-500 mb-1">의원 수입 변화 (LC {LC}%p)</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-green-600">{pct(incNewChg)}</div>
        <div className="text-sm font-bold text-green-600">{diffE(T.inc0, T.inc2)}원</div>
        <div className="text-xs text-gray-400 mt-1">{fE(T.inc0)}억 → {fE(T.inc2)}억</div>
      </div>
      <div className={card + " p-3"}>
        <div className="text-xs text-gray-500 mb-1">공단 총의료비 변화</div>
        <div className="text-2xl sm:text-3xl font-extrabold text-blue-700">{pct(nhiNewChg, 2)}</div>
        <div className="text-sm font-bold text-blue-600">{diffE(T.nhi0, T.nhi2)}원</div>
        <div className="text-xs text-gray-400 mt-1">{fE(T.nhi0)}억 → {fE(T.nhi2)}억</div>
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
              <div className="text-xs text-gray-400 mt-0.5">분석템플릿 v4 또는 호환 파일</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer bg-blue-50/30"
              onClick={handleExport}>
              <div className="text-blue-400 text-xl mb-0.5">📥</div>
              <div className="text-xs font-semibold text-blue-600">현재값 내보내기</div>
              <div className="text-xs text-blue-400 mt-0.5">시뮬레이터 → 엑셀 Export</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {G.map((r, i) => (
              <div key={i} className="rounded-lg px-2.5 py-2 border" style={{ borderColor: CL[i] + "40", background: CL[i] + "08" }}>
                <div className="text-xs font-bold mb-1" style={{ color: CL[i] }}>{SH[i]} <span className="font-normal text-gray-400">N={f(base[i].N)}</span></div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>수가(P) <b className="text-gray-900">{f(P[i])}</b></div>
                  <div>실수입 <b className="text-blue-700">{f(Math.round(r.AB_cur))}</b> → <b className="text-green-700">{f(Math.round(r.AB_new))}</b></div>
                  <div className="text-gray-400" style={{ fontSize: 10 }}>공단+본인부담, LC {LC}%p</div>
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
                  <table className="w-full text-xs" style={{ minWidth: 820 }}>
                    <thead>
                      <tr>
                        <th className="px-2 py-1" />
                        <th colSpan={3} className="text-center text-xs font-bold text-purple-600 bg-purple-50 px-1 py-1 border-b border-purple-200" style={{ borderRadius: "6px 6px 0 0" }}>근거 (빅데이터)</th>
                        <th colSpan={2} className="text-center text-xs font-bold text-blue-600 bg-blue-50 px-1 py-1 border-b border-blue-200" style={{ borderRadius: "6px 6px 0 0" }}>판단 (정책)</th>
                        <th colSpan={3} className="text-center text-xs font-bold text-gray-500 bg-gray-50 px-1 py-1 border-b border-gray-200" style={{ borderRadius: "6px 6px 0 0" }}>실측 (편집)</th>
                        <th colSpan={3} className="text-center text-xs font-bold text-green-600 bg-green-50 px-1 py-1 border-b border-green-200" style={{ borderRadius: "6px 6px 0 0" }}>산출</th>
                      </tr>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-2 py-1.5">환자군</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">기준의료비</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">의원비중</th>
                        <th className="text-center px-1 py-1.5 bg-purple-50/50">계산수가</th>
                        <th className="text-center px-1 py-1.5 bg-blue-50/50">수가(P)</th>
                        <th className="text-center px-1 py-1.5 bg-blue-50/50">조정폭</th>
                        <th className="text-center px-1 py-1.5">L비용</th>
                        <th className="text-center px-1 py-1.5">현재외래비</th>
                        <th className="text-center px-1 py-1.5">환자수</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50">A(공단)</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50">실수입</th>
                        <th className="text-right px-1 py-1.5 bg-green-50/50 text-green-600">실수입(LC후)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {G.map((r, i) => {
                        const calcP = Math.round(base[i].ref * base[i].cr);
                        const adj = P[i] - calcP;
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
                            <td className="text-center px-1 bg-blue-50/20">
                              <span className={`text-xs font-semibold ${adj >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {adj >= 0 ? "+" : ""}{f(adj)}
                              </span>
                            </td>
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
                            <td className="text-right px-1 bg-green-50/20 text-gray-600">{f(Math.round(r.A_cur))}</td>
                            <td className="text-right px-1 bg-green-50/20 font-semibold text-blue-700">{f(Math.round(r.AB_cur))}</td>
                            <td className="text-right px-1 bg-green-50/20 font-bold text-green-700">{f(Math.round(r.AB_new))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
                  <span><span className="inline-block w-3 h-3 bg-purple-50 border border-purple-200 rounded mr-1 align-middle"></span>근거 = 빅데이터 (읽기전용)</span>
                  <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-300 rounded mr-1 align-middle"></span>판단·실측 = 편집 가능</span>
                  <span>계산수가 = 기준의료비 × 의원비중 · A = P×(1−L) · 실수입 = A + M1×30%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </>);
})
