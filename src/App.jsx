import useSimulator from "./hooks/useSimulator";
import Header from "./components/Header";
import TabSimulation from "./components/TabSimulation";
import TabTrack from "./components/TabTrack";
import TabSharedSaving from "./components/TabSharedSaving";
import DatasetSelector from "./components/DatasetSelector";
import { sliderCSS } from "./constants";

const TABS = ["📋 수가 시뮬레이션", "📊 Track", "💰 Shared Saving"];

const tabStyle = (active) => ({
  background: active ? "#fff" : "#e8ecf1",
  color: active ? "#1e40af" : "#64748b",
  border: active ? "1px solid #d1d5db" : "1px solid #d1d5db",
  borderBottom: active ? "1px solid #fff" : "1px solid #d1d5db",
  borderRadius: "8px 8px 0 0",
  fontWeight: active ? 700 : 500,
  fontSize: "12px",
  padding: "10px 4px",
  marginBottom: "-1px",
  position: "relative",
  zIndex: active ? 2 : 1,
});

export default function App() {
  const sim = useSimulator();
  const { state, set, loadPreset } = sim;
  const { tab } = state;

  return (
    <div className="overflow-x-hidden" style={{ fontFamily: "'Pretendard','Noto Sans KR',-apple-system,sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{sliderCSS}</style>

      <Header totalN={state.totalN} dataLabel={state.dataLabel} />

      {/* FOLDER TABS */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3" style={{ borderBottom: "1px solid #d1d5db" }}>
        <div className="flex gap-1">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => set("tab", i)}
              aria-selected={tab === i}
              className="flex-1 text-center cursor-pointer transition-all"
              style={tabStyle(tab === i)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        <DatasetSelector currentLabel={state.dataLabel} onSelect={loadPreset} />

        {tab === 0 && (
          <TabSimulation
            state={state} set={set}
            updP={sim.updP} updBase={sim.updBase} reset={sim.reset}
            G={sim.G} T={sim.T}
            incCurChg={sim.incCurChg} incNewChg={sim.incNewChg} nhiNewChg={sim.nhiNewChg}
            fileRef={sim.fileRef} handleFile={sim.handleFile} handleExport={sim.handleExport}
          />
        )}

        {tab === 1 && (
          <TabTrack
            state={state} set={set}
            G={sim.G} T={sim.T}
            nhiNewChg={sim.nhiNewChg}
            tBchg={sim.tBchg} tCchg={sim.tCchg} tSchg={sim.tSchg}
          />
        )}

        {tab === 2 && (
          <TabSharedSaving
            state={state} set={set}
            handleMacroSync={sim.handleMacroSync}
            SS={sim.SS}
          />
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center py-3 px-3 text-xs text-gray-400 border-t border-gray-200 bg-white mt-4">
        환자군(HCC) 기반 일차의료 지불모형 시뮬레이터 v5.0 · 일산병원 일차의료개발센터 · © 2026
      </div>
    </div>
  );
}
