import { f } from "../utils";

export default function Header({ totalN, dataLabel }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)" }} className="px-3 sm:px-5 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-gray-400 text-xs tracking-widest" style={{ fontSize: 10 }}>NHIS-HCC SIMULATOR v5.0</div>
          <h1 className="text-white font-bold mt-0.5 text-sm sm:text-base">환자군 기반 일차의료 지불모형 시뮬레이터</h1>
        </div>
        <div className="text-right text-xs shrink-0">
          <div><span className="text-blue-200">등록환자 </span><b className="text-white">{f(totalN)}</b><span className="text-blue-200">명</span></div>
          <div className="text-gray-400 mt-0.5">{dataLabel}</div>
        </div>
      </div>
    </div>
  );
}
