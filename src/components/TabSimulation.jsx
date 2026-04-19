import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { FCard, TCard, RegScaleCard } from "./RegistrationPanel";
import { SH, CL, ON } from "../constants";
import presets from "../data/presets/index";
import { f, fE, pct, diffAuto, fAuto, fMan, diffMan } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({ state, set, updP, updBase, updF, setFAll, resetF, updRegDist, setRegDistAll, scaleRegDist, reset, loadPreset, G, T, decomp, incCurChg, incNewChg, nhiNewChg, fileRef, handleFile, handleExport, reg, regRatios }) {
  const { base, P, LC, totalN, showDetail, showEditTable, uploadBanner, dataLabel, F_g, M_clinics } = state;
  const M = Math.max(1, M_clinics);
  const ratios = base.map(g => g.N / base.reduce((s, x) => s + x.N, 0));
  const [showFormula, setShowFormula] = useState(false);

  // L 가중평균
  const Lavg = ratios.reduce((s, r, i) => s + r * base[i].L, 0);
  const LavgAfter = Math.max(0, Math.min(1, Lavg + LC / 100));

  // 의원당 수입 절대값 (참여 전 기준 vs 참여 후 지불모형)
  const perClinicBaseline = decomp.baselineIncome / M;
  const perClinicAfter = decomp.afterIncome / M;
  const perClinicPanel = decomp.panelEffect / M;
  const perClinicModel = decomp.modelEffect / M;
  const perClinicNet = decomp.netChange / M;

  return (<>
    {/* ① 환자군 기본수가 P — 4 슬라이더 + NumBox */}
    <div className={card + " p-4"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base text-gray-900">환자군 기본수가 (P)</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">{dataLabel}</span>
          <button
            onClick={() => {
              if (confirm("모든 설정을 기본값(복지부 시범사업안)으로 되돌립니다. 진행할까요?")) reset();
            }}
            className="text-[11px] text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
            ↩ 전체 초기화
          </button>
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

    {/* ③ 일차의료 기능수가 F — P와 동일 구조 */}
    <FCard state={state} setFAll={setFAll} updF={updF} reg={reg} regRatios={regRatios} />

    {/* ④ 통합 수가 T — 접힘 */}
    <TCard state={state} G={G} />

    {/* ⑤ 타원이용비중 L 변화율 — 슬림 박스 */}
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
        aria-label="타원이용비중 변화율 슬라이더"
        className="w-full big-thumb"
        style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${((Math.max(-30, Math.min(0, LC)) + 30) / 30) * 100}%, #e5e7eb 0%)` }} />
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
        <span>-30%p</span><span>-20%p</span><span>-10%p</span><span>0%p</span>
      </div>
    </div>

    {/* ⑥ KPI 2카드 — 상시 표시, 의원당 수입 확대, 토글 없음 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-green-800">의원 수입 변화 (분해)</h3>
          <span className="text-[11px] font-semibold text-green-600">LC {LC}%p</span>
        </div>

        {/* 기준선 */}
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-green-700/80 font-semibold">기준 수입 (참여 전, 전원 FFS)</span>
          <span className="text-sm font-bold text-green-800/80">{fMan(perClinicBaseline)}/의원·년</span>
        </div>

        {/* ① 패널 축소 효과 */}
        <div className="mt-2 bg-white/60 rounded px-2 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-slate-600">① 패널 변화 효과</span>
            <span className="text-sm font-bold" style={{ color: decomp.panelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicPanel)}/의원
            </span>
          </div>
          <div className="text-[10px] text-slate-500">FFS 유지 가정 시 실인원 변화분</div>
        </div>

        {/* ② 지불방식 전환 효과 */}
        <div className="mt-1.5 bg-white/60 rounded px-2 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-indigo-700 font-semibold">② 지불방식 전환 효과</span>
            <span className="text-sm font-bold" style={{ color: decomp.modelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicModel)}/의원
            </span>
          </div>
          <div className="text-[10px] text-indigo-500">등록환자 HCC 모형 프리미엄</div>
        </div>

        {/* 순 변화 */}
        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="flex items-baseline justify-between mb-0.5">
            <span className="text-[11px] text-green-700 font-semibold">순 변화 (① + ②)</span>
            <span className="text-[11px] font-bold" style={{ color: decomp.netChgPct >= 0 ? "#16a34a" : "#dc2626" }}>
              {pct(decomp.netChgPct)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-green-700/70">의원당</span>
            <span className="text-2xl font-extrabold leading-tight" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicNet)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-green-700/70">전체</span>
            <span className="text-base font-bold" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffAuto(0, decomp.netChange)}
            </span>
          </div>
        </div>

        {/* 참여 후 총수입 */}
        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-green-700 font-semibold">참여 후 의원당 수입</span>
            <span className="text-lg font-extrabold text-green-900">{fMan(perClinicAfter)}/년</span>
          </div>
        </div>

        <div className="mt-1.5 text-[9.5px] text-green-700/60 italic leading-tight">
          ※ 등록·비등록 외래 수입 추정치. 의사 1인 소득 ≠ 의원 외래 수입.
        </div>
      </div>

      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단 의원급 외래 지출 변화</h3>
          <span className="text-[11px] font-semibold text-blue-600">입원·약국·병원급 제외</span>
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

    {/* ⑦ 의원당 환자 규모 (KPI 아래로 이동) */}
    <RegScaleCard state={state} set={set} reg={reg}
      updRegDist={updRegDist} setRegDistAll={setRegDistAll} scaleRegDist={scaleRegDist}
      reset={reset} />

    {/* ⑧ 차트 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">의원 수입 비교 (환자군별, 억원)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={G.map((r, i) => ({ name: SH[i], "기존": r.inc0 / 1e8, "LC 후": r.inc2 / 1e8 }))} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(0) + "억"} tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="기존" fill="#d1d5db" radius={[3, 3, 0, 0]} />
            <Bar dataKey="LC 후" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">공단 지출 비교 (억원)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { name: "기존", v: T.nhi0 / 1e8 },
            { name: `LC ${LC}%p`, v: T.nhi2 / 1e8 },
          ]} barSize={50}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => v.toFixed(0)} tick={{ fontSize: 10 }} width={40} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]}>
              <Cell fill="#d1d5db" /><Cell fill="#f59e0b" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* ⑧ Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "추가 부담 없이 주치의 확보\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `환자군 반영 공정 보상\n의원당 ${diffMan(perClinicNet)}\n(LC ${LC}%p)` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `지출 ${pct(nhiNewChg, 2)}\n예측 가능성 향상\n*Saving 효과 별도` },
    ]} />

    {/* ⑨ 공식 구조 (맨 아래 토글) */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => setShowFormula(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <span>📐 공식 구조 및 환자군별 L 상세</span>
        <span className="text-gray-400 text-xs">{showFormula ? "▲ 접기" : "▼ 펼치기"}</span>
      </button>
      {showFormula && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-700 leading-relaxed font-mono space-y-1">
            <div><b className="text-purple-700">T = P + F</b> (명목 청구수가)</div>
            <div><b className="text-purple-700">A = P × (1 − L) + F</b> (공단 실지급, F는 L 우회)</div>
            <div><b className="text-purple-700">B = M1 × 30%</b> (본인부담, 고정)</div>
            <div>의원 수입 = 등록환자(A + F + B) + 비등록환자(FFS M1)</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-700 leading-relaxed font-mono space-y-1">
            <div className="font-semibold text-gray-800 mb-0.5">분해 (패널 효과 ↔ 지불방식 효과)</div>
            <div>기준 수입 = <b>baseN × ffsPerPerson × M</b></div>
            <div>① 패널 효과 = <b>Σ M1_g × (N_g − baseN_g)</b></div>
            <div>② 모형 효과 = <b>Σ n_reg_g × (ab_reg_new_g − M1_g)</b></div>
            <div>순 변화 = ① + ② = 참여 후 수입 − 기준 수입</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-700 mb-1">환자군별 타원이용비중 (현재 → 변화 후)</div>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {SH.map((g, i) => {
                const before = base[i].L * 100;
                const after = Math.max(0, Math.min(100, before + LC));
                return (
                  <div key={i} className="text-center rounded px-1 py-1" style={{ background: CL[i] + "12" }}>
                    <div className="font-bold" style={{ color: CL[i] }}>{g}</div>
                    <div className="text-purple-700/70">{before.toFixed(1)}% → <b className="text-purple-900">{after.toFixed(1)}%</b></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ⑩ 데이터 관리 */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => set("showDetail", !showDetail)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
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
            </div>
            <div className="flex-1 border-2 border-dashed border-blue-200 rounded-lg p-3 text-center hover:border-blue-400 transition cursor-pointer bg-blue-50/30"
              onClick={handleExport}>
              <div className="text-blue-400 text-xl mb-0.5">📥</div>
              <div className="text-xs font-semibold text-blue-600">내보내기</div>
            </div>
            <div className="flex-1 border-2 border-dashed border-amber-200 rounded-lg p-3 text-center hover:border-amber-400 transition cursor-pointer bg-amber-50/30"
              onClick={() => { if (confirm(`파일럿 데이터(10개 의원, 69,604명, 2023)로 전환합니다. 진행할까요?`)) loadPreset(presets[0]); }}>
              <div className="text-amber-500 text-xl mb-0.5">↩</div>
              <div className="text-xs font-semibold text-amber-700">파일럿 로드</div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <button onClick={() => set("showEditTable", !showEditTable)}
              className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
              <span>📋 환자군별 상세 편집 테이블</span>
              <span className="text-gray-400">{showEditTable ? "▲" : "▼"}</span>
            </button>
            {showEditTable && (
              <div className="mt-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 880 }}>
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-2 py-1.5">환자군</th>
                        <th className="text-center px-1">기준의료비</th>
                        <th className="text-center px-1">의원비중</th>
                        <th className="text-center px-1">P</th>
                        <th className="text-center px-1">F</th>
                        <th className="text-center px-1 text-purple-700">T=P+F</th>
                        <th className="text-center px-1">L</th>
                        <th className="text-center px-1">M1</th>
                        <th className="text-center px-1">N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {G.map((r, i) => {
                        const Fi = F_g[i] ?? 0;
                        return (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                            <td className="text-center px-1 text-gray-600">{f(base[i].ref)}</td>
                            <td className="text-center px-1 text-gray-600">{(base[i].cr * 100).toFixed(1)}%</td>
                            <td className="text-center px-1">
                              <input type="text" value={f(P[i])} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                                onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) updP(i, v); }} />
                            </td>
                            <td className="text-center px-1 text-purple-600 font-semibold">{f(Fi)}</td>
                            <td className="text-center px-1 font-bold text-purple-700">{f(P[i] + Fi)}</td>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </>);
})
