import { memo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import NumBox from "./shared/NumBox";
import WinWinWin from "./WinWinWin";
import { FCard, TCard, RegScaleCard } from "./RegistrationPanel";
import { SH, CL, INIT_REG_DIST, OFFICIAL_BASELINE_META } from "../constants";
import presets from "../data/presets/index";
import { f, fE, pct, diffAuto, fMan, diffMan } from "../utils";

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

export default memo(function TabSimulation({
  state, set, updP, updBase, updF, setFAll, resetF, resetP, resetReg,
  updL1, setL1All, resetL1, setL2, resetL2, setAlpha, resetAlpha,
  updRegDist, setRegDistAll, scaleRegDist, reset, loadPreset,
  G, T, decomp, performance: perfMemo,
  incChg, nhiChg,
  fileRef, handleFile, handleExport, handleCommitBaseline,
  reg, regRatios,
}) {
  const { base, P, L1, L2, alpha, showDetail, uploadBanner, F_g, M_clinics } = state;
  const M = Math.max(1, M_clinics);
  const [showFormula, setShowFormula] = useState(false);

  // L2 기본값 · 표시값 (null이면 L1 가중평균)
  const L2_display = L2 ?? perfMemo.L1avg;

  // 의원당 수입 절대값 (선지급 기준)
  const perClinicBaseline = decomp.baselineIncome / M;
  const perClinicAfter = decomp.afterIncome / M;
  const perClinicPanel = decomp.panelEffect / M;
  const perClinicModel = decomp.modelEffect / M;
  const perClinicNet = decomp.netChange / M;
  const perClinicPerfC = perfMemo.perfByTrack.C / M;   // Track C 기준 성과급 미리보기

  return (<>
    {/* ①+② B와 F 통합 박스 */}
    <div className={card + " p-4 space-y-4"}>
      {/* ① 환자군 기본수가 B */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base text-gray-900">1. 환자군 기본수가 (B)</h2>
          <div className="flex items-center gap-2">
            <button onClick={resetP}
              className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded px-2 py-0.5 bg-white">
              ↩ 초기화
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {SH.map((g, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold" style={{ color: CL[i] }}>{g}</span>
                <NumBox value={P[i]} onChange={v => updP(i, Math.max(0, Math.round(v)))} color={CL[i]} suffix="원" />
              </div>
              <input type="range" min={50000} max={2000000} step={10000} value={P[i]}
                onChange={e => updP(i, parseFloat(e.target.value))}
                aria-label={`${g} 기본수가 슬라이더`}
                className="w-full big-thumb"
                style={{ '--thumb-bg': CL[i], accentColor: CL[i], background: `linear-gradient(to right, ${CL[i]} ${((P[i] - 50000) / 1950000) * 100}%, #e5e7eb 0%)` }} />
            </div>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-gray-200" />

      {/* ② 일차의료 기능보정 F */}
      <FCard state={state} setFAll={setFAll} updF={updF} resetF={resetF} bare />
    </div>

    {/* ③ 선지급 기준 타원이용비중 L1 (P 박스 위 · 신규) */}
    <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)", borderColor: "#5eead4" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-bold text-base" style={{ color: "#0f766e" }}>
            3. 선지급 기준 타원이용비중 (L1)
          </h2>
          <span className="text-xs text-teal-700/80">가중평균 {(perfMemo.L1avg * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setL1All(base.map(b => b.L))}
            title="엑셀에서 로딩된 실측 L 값을 L1 초기값으로 복사"
            className="text-xs px-2 py-0.5 rounded border border-teal-300 bg-white text-teal-700 hover:bg-teal-50 font-medium">
            엑셀 L → L1 복사
          </button>
          <button onClick={resetL1}
            className="text-xs text-teal-700 hover:text-red-600 border border-teal-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
            ↩ 초기화
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SH.map((g, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1.5 border border-teal-200">
            <span className="text-[11px] font-bold shrink-0" style={{ color: CL[i] }}>{g}</span>
            <input type="number" min={0} max={1} step={0.01}
              value={(L1?.[i] ?? 0.7).toFixed(2)}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updL1(i, v);
              }}
              className="w-full text-sm text-center border border-teal-300 rounded px-1 py-0.5 tabular-nums"
              style={{ color: "#0f766e" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10px] text-teal-700/70 leading-relaxed">
        ※ L1은 선지급 계산용(과거 평균). 데이터 수령 전 placeholder 0.70. &quot;엑셀 L → L1 복사&quot; 버튼으로 업로드 값 반영.
      </div>
    </div>

    {/* ④ 일차의료수가 (P = B(1−L1) + F) */}
    <TCard state={state} G={G} />

    {/* ⑤ 실측 타원이용비중 L2 (P 박스 아래 · 성과급 트리거) */}
    <div className="rounded-xl border-2 shadow-sm px-4 py-3" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderColor: "#c4b5fd" }}>
      <div className="flex items-center mb-2 gap-3 flex-wrap">
        <h2 className="font-bold text-base" style={{ color: "#6d28d9" }}>5. 실측 타원이용비중 (L2)</h2>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-purple-600 font-semibold">기준 L1</span>
          <span className="text-sm font-bold text-purple-700/70">{(perfMemo.L1avg * 100).toFixed(1)}%</span>
          <span className="text-purple-400">→</span>
          <span className="text-xs text-purple-600 font-semibold">L2</span>
          <span className="text-lg font-extrabold text-purple-900">{(L2_display * 100).toFixed(1)}%</span>
          <NumBox
            value={parseFloat((L2_display * 100).toFixed(1))}
            onChange={v => setL2(v / 100)}
            color="#7c3aed" suffix="%" />
        </div>
        <button onClick={resetL2}
          className="ml-auto text-xs text-purple-700 hover:text-red-600 border border-purple-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
          ↩ L1 복귀
        </button>
      </div>
      <input type="range" min={0} max={1} step={0.005} value={L2_display}
        onChange={e => setL2(parseFloat(e.target.value))}
        aria-label="실측 타원이용비중 L2 슬라이더"
        className="w-full big-thumb"
        style={{ '--thumb-bg': '#7c3aed', accentColor: "#7c3aed", background: `linear-gradient(to right, #7c3aed ${L2_display * 100}%, #e5e7eb 0%)` }} />
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8b5cf6" }}>
        <span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span>
      </div>
      <div className="mt-1.5 text-[10px] text-purple-700/70 leading-relaxed">
        ※ L2가 L1보다 낮을수록 성과급 발생 (no-downside: L2 &gt; L1이면 성과급 0).
      </div>
    </div>

    {/* ⑥ 성과급 미리보기 (신규 · L2 기반) */}
    <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", borderColor: "#fbbf24" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="font-bold text-base" style={{ color: "#b45309" }}>
          6. 성과급 미리보기 (max(0, L1 − L2) × B × n_reg × α)
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-amber-700">공유율 α</span>
          <NumBox
            value={parseFloat((alpha * 100).toFixed(0))}
            onChange={v => setAlpha(v / 100)}
            color="#d97706" suffix="%" />
          <button onClick={resetAlpha}
            className="text-xs text-amber-700 hover:text-red-600 border border-amber-200 hover:border-red-300 rounded px-2 py-0.5 bg-white/70">
            ↩
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: "A", label: "Track A (FFS)", mul: 0, color: "#6b7280", bg: "bg-gray-50" },
          { k: "B", label: "Track B (혼합)", mul: 0.5, color: "#3b82f6", bg: "bg-blue-50" },
          { k: "C", label: "Track C (모형)", mul: 1.0, color: "#16a34a", bg: "bg-green-50" },
        ].map(t => {
          const amt = perfMemo.perfByTrack[t.k];
          return (
            <div key={t.k} className={`rounded-lg px-2 py-2 border ${t.bg}`} style={{ borderColor: t.color + "40" }}>
              <div className="text-[11px] font-bold text-center" style={{ color: t.color }}>{t.label}</div>
              <div className="text-[9px] text-center text-gray-500">Track 배수 ×{t.mul.toFixed(1)}</div>
              <div className="mt-1 text-center">
                <div className="text-xs text-gray-600">의원당/년</div>
                <div className="text-base font-extrabold tabular-nums" style={{ color: t.color }}>
                  {fMan(amt / M)}
                </div>
              </div>
              <div className="text-[10px] text-center text-gray-500 mt-0.5">
                전체 {fE(amt)}억
              </div>
            </div>
          );
        })}
      </div>
      {perfMemo.perfByTrack.C <= 0 && (
        <div className="mt-2 text-[10px] text-amber-700/80 leading-relaxed">
          ※ 현재 L2({(L2_display * 100).toFixed(1)}%) ≥ L1 가중평균({(perfMemo.L1avg * 100).toFixed(1)}%) — 성과급 0원 상태. L2 슬라이더를 낮추면 성과급 발생.
        </div>
      )}
    </div>

    {/* ⑦ KPI 2카드 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderColor: "#86efac" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-green-800">의원 수입 변화 (선지급)</h3>
          <span className="text-xs font-semibold text-green-600">L1 가중 {(perfMemo.L1avg * 100).toFixed(1)}%</span>
        </div>

        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-green-700/80 font-semibold">기준 수입 (참여 전, 전원 FFS)</span>
          <span className="text-sm font-bold text-green-800/80">{fMan(perClinicBaseline)}/의원·년</span>
        </div>

        <div className="mt-2 bg-white/60 rounded px-2 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-600">① 환자군 패널 변화 효과</span>
            <span className="text-sm font-bold" style={{ color: decomp.panelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicPanel)}/의원
            </span>
          </div>
        </div>

        <div className="mt-1.5 bg-white/60 rounded px-2 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-indigo-700 font-semibold">② 지불방식 전환 효과 (선지급)</span>
            <span className="text-sm font-bold" style={{ color: decomp.modelEffect >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicModel)}/의원
            </span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="flex items-baseline justify-between mb-0.5">
            <span className="text-xs text-green-700 font-semibold">순 변화 (① + ②)</span>
            <span className="text-xs font-bold" style={{ color: decomp.netChgPct >= 0 ? "#16a34a" : "#dc2626" }}>
              {pct(decomp.netChgPct)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-green-700/70">의원당</span>
            <span className="text-2xl font-extrabold leading-tight" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffMan(perClinicNet)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-green-700/70">전체</span>
            <span className="text-base font-bold" style={{ color: decomp.netChange >= 0 ? "#16a34a" : "#dc2626" }}>
              {diffAuto(0, decomp.netChange)}
            </span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-green-200/70">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-green-700 font-semibold">참여 후 의원당 수입</span>
            <span className="text-lg font-extrabold text-green-900">{fMan(perClinicAfter)}/년</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-[10px] text-amber-700">+ 성과급 (Track C)</span>
            <span className="text-xs font-bold text-amber-700">{fMan(perClinicPerfC)}/년</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 shadow-md p-4" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", borderColor: "#93c5fd" }}>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-bold text-base text-blue-800">공단 의원급 외래 지출 변화</h3>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl sm:text-4xl font-extrabold text-blue-700 leading-tight">{diffAuto(T.nhi0, T.nhi)}</span>
          <span className="text-base sm:text-lg font-bold text-blue-700/80 leading-tight">{pct(nhiChg, 2)}</span>
        </div>
        <div className="text-sm sm:text-base text-blue-700/70 font-semibold mt-1">{fE(T.nhi0)}억 → <b className="text-blue-800">{fE(T.nhi)}억</b></div>
        <div className="mt-2 pt-2 border-t border-blue-200/70 text-xs text-blue-700/70">
          ※ 성과급 {fE(perfMemo.perfByTrack.C)}억 (Track C 기준)은 별도 사후 정산 재원
        </div>
      </div>
    </div>

    {/* ⑧ 의원당 환자 규모 */}
    <RegScaleCard state={state} set={set} reg={reg}
      scaleRegDist={scaleRegDist} resetReg={resetReg} />

    {/* ⑨ 차트 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">의원 수입 비교 (환자군별, 억원 · 선지급)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={G.map((r, i) => ({ name: SH[i], "기존": r.inc0 / 1e8, "참여 후": r.inc / 1e8 }))} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(0) + "억"} tick={{ fontSize: 10 }} width={36} />
            <Tooltip formatter={v => v.toFixed(1) + "억"} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="기존" fill="#d1d5db" radius={[3, 3, 0, 0]} />
            <Bar dataKey="참여 후" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={card + " p-3"}>
        <h3 className="text-xs font-bold text-gray-700 mb-2">공단 지출 비교 (억원)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { name: "기존", v: T.nhi0 / 1e8 },
            { name: "참여 후", v: T.nhi / 1e8 },
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

    {/* ⑩ Win-Win-Win */}
    <WinWinWin items={[
      { t: "국민 (환자)", c: "#059669", bg: "#ecfdf5", bd: "#a7f3d0",
        txt: "주치의 환자관리\n본인부담 현행 유지\n불필요한 병원 이용 감소" },
      { t: "의원 (의사)", c: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe",
        txt: `환자군 기반 적절 보상\n의원당 선지급 ${diffMan(perClinicNet)}\n+ 성과급 최대 ${fMan(perClinicPerfC)}` },
      { t: "공단 (정부)", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca",
        txt: `지출 ${pct(nhiChg, 2)}\n예측 가능성 향상\n*Saving 효과 별도` },
    ]} />

    {/* ⑪ 공식 구조 */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => setShowFormula(v => !v)}
        className="w-full flex items-center justify-start gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <span className="text-gray-400 text-xs">{showFormula ? "▲" : "▼"}</span>
        <span>📐 수가 산출 구조 (v6.7 L1·L2 분리)</span>
      </button>
      {showFormula && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700 leading-relaxed font-mono space-y-1">
            <div><b className="text-indigo-700">P_g = B_g × (1 − L1_g) + F_g</b>  (환자군별 선지급)</div>
            <div><b className="text-indigo-700">공단지급 = P</b>  (단일화)</div>
            <div><b className="text-indigo-700">본인부담 = M1 × 30%</b>  (고정)</div>
            <div className="pt-1 mt-1 border-t border-gray-300">
              <b className="text-amber-700">성과급_L2 = Σ max(0, L1_g − L2) × B_g × n_reg_g × α × TrackMul</b>
            </div>
            <div className="text-gray-500">α = 공유율 (기본 0.5) · TrackMul: A=0 / B=0.5 / C=1.0</div>
            <div className="text-gray-500">no-downside: L2 &gt; L1이면 성과급 0 (환수 없음)</div>
          </div>
        </div>
      )}
    </div>

    {/* ⑫ 데이터 관리 */}
    <div className={card + " overflow-hidden"}>
      <button onClick={() => set("showDetail", !showDetail)}
        className="w-full flex items-center justify-start gap-2 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
        <span className="text-gray-400 text-xs">{showDetail ? "▲" : "▼"}</span>
        <span>⚙️ 데이터 관리</span>
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
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="text-xs text-gray-500">
                현재 공식 baseline:
                {OFFICIAL_BASELINE_META.source === "official_baseline.json" ? (
                  <span className="ml-1 text-gray-700">
                    <b>v{OFFICIAL_BASELINE_META.version}</b>
                    {OFFICIAL_BASELINE_META.updated_at ? ` · ${OFFICIAL_BASELINE_META.updated_at}` : ""}
                    {OFFICIAL_BASELINE_META.updated_by ? ` · ${OFFICIAL_BASELINE_META.updated_by}` : ""}
                  </span>
                ) : (
                  <span className="ml-1 text-amber-700">fallback (official_baseline.json 없음/불완전)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (!handleCommitBaseline) return;
                const SHL = ["1군", "2군", "3군", "4군"];
                const fmt = v => Math.round(v).toLocaleString("ko-KR");
                const preview = state.base.map((b, i) =>
                  `${SHL[i]}: N=${fmt(b.N)}, M1=${fmt(b.M1)}, L=${b.L.toFixed(4)}, B=${fmt(state.P[i])}`).join("\n");
                const msg = `⚠️ 현재 값을 모든 사용자의 공식 baseline으로 등록합니다.\n\n${preview}\n\nVercel 재배포 후 (약 1~2분) 모든 사용자의 디폴트가 갱신됩니다.\n진행하시겠습니까?`;
                if (confirm(msg)) handleCommitBaseline();
              }}
              className="w-full border-2 border-dashed border-rose-300 rounded-lg py-2.5 text-center hover:border-rose-500 hover:bg-rose-50 transition cursor-pointer bg-rose-50/30">
              <span className="text-rose-500 text-base mr-1.5">🏛️</span>
              <span className="text-xs font-bold text-rose-700">현재 값을 공식 baseline으로 등록 (전역 · 관리자)</span>
            </button>
            <div className="mt-1 text-[10px] text-gray-400 leading-relaxed">
              ※ 이 버튼을 누르면 <code>src/data/presets/official_baseline.json</code>이 GitHub에 커밋되고 Vercel이 재배포됩니다.
              슬라이더 조정·엑셀 업로드만으로는 다른 세션에 영향 없음. 버튼 클릭 시에만 전역 디폴트로 고정.
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 py-1.5 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-600">📋 환자군별 상세 편집 테이블</span>
                <span className="text-[10px] font-normal text-gray-400">입력 셀: N · M1 · L · 등록 (B·F·L1은 정책 슬라이더)</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-gray-500">등록 분포 프리셋:</span>
                {[
                  { label: "부록", v: INIT_REG_DIST },
                  { label: "균등", v: [250, 250, 250, 250] },
                  { label: "건강편중", v: [400, 400, 150, 50] },
                  { label: "고위험편중", v: [50, 350, 300, 300] },
                ].map(p => {
                  const active = state.regDist.every((v, i) => v === p.v[i]);
                  return (
                    <button key={p.label} onClick={() => setRegDistAll(p.v)}
                      className="text-[10px] px-1.5 py-0.5 rounded border font-medium transition"
                      style={active ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 780 }}>
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-2 py-1.5">환자군</th>
                    <th className="text-center px-1">N</th>
                    <th className="text-center px-1">M1</th>
                    <th className="text-center px-1">L (실측)</th>
                    <th className="text-center px-1">B</th>
                    <th className="text-center px-1">L1</th>
                    <th className="text-center px-1">F</th>
                    <th className="text-center px-1 text-indigo-700">P = B(1−L1)+F</th>
                    <th className="text-center px-1 text-blue-700">등록</th>
                  </tr>
                </thead>
                <tbody>
                  {G.map((r, i) => {
                    const Fi = F_g[i] ?? 0;
                    const L1_i = L1?.[i] ?? 0.7;
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-bold" style={{ color: CL[i] }}>{SH[i]}</td>
                        <td className="text-center px-1">
                          <input type="text" value={f(base[i].N)} className="w-20 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v > 0) updBase(i, "N", v); }} />
                        </td>
                        <td className="text-center px-1">
                          <input type="text" value={f(base[i].M1)} className="w-20 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updBase(i, "M1", v); }} />
                        </td>
                        <td className="text-center px-1">
                          <input type="text" value={base[i].L.toFixed(4)} className="w-16 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5"
                            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= 1) updBase(i, "L", v); }} />
                        </td>
                        <td className="text-center px-1 text-gray-700">{f(P[i])}</td>
                        <td className="text-center px-1 text-teal-700 tabular-nums">{L1_i.toFixed(2)}</td>
                        <td className="text-center px-1 text-purple-600 font-semibold">{f(Fi)}</td>
                        <td className="text-center px-1 font-bold text-indigo-700 tabular-nums">{f(Math.round(P[i] * (1 - L1_i) + Fi))}</td>
                        <td className="text-center px-1">
                          <input type="text" value={f(state.regDist[i])} className="w-14 text-center text-xs border border-blue-200 rounded bg-blue-50 py-0.5 text-blue-700"
                            onChange={e => { const v = parseInt(e.target.value.replace(/,/g, "")); if (!isNaN(v) && v >= 0) updRegDist(i, v); }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 text-xs text-gray-500 leading-relaxed">
                ※ N·M1·L·등록만 직접 편집. B·F·L1은 위쪽 정책 슬라이더로 설정. L1 시드는 &quot;엑셀 L → L1 복사&quot; 버튼.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
})
