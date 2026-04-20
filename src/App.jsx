import useSimulator from "./hooks/useSimulator";
import Header from "./components/Header";
import TabSimulation from "./components/TabSimulation";
import TabTrack from "./components/TabTrack";
import TabSharedSaving from "./components/TabSharedSaving";
import DatasetSelector from "./components/DatasetSelector";
import { sliderCSS } from "./constants";

const TABS = ["📋 수가 시뮬레이션", "📊 Track", "💰 Shared Saving"];

const tabStyle = (active) => ({
  background: active ? "#fff" : "#e2e8f0",
  color: active ? "#1e3a8a" : "#475569",
  border: active ? "2px solid #1e40af" : "2px solid #cbd5e1",
  borderBottom: active ? "2px solid #fff" : "2px solid #94a3b8",
  borderRadius: "10px 10px 0 0",
  fontWeight: active ? 800 : 600,
  fontSize: "17px",
  padding: "14px 10px",
  marginBottom: "-2px",
  boxShadow: active ? "0 -2px 8px rgba(30, 64, 175, 0.15)" : "none",
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

      <Header />

      {/* FOLDER TABS */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3" style={{ borderBottom: "2px solid #94a3b8" }}>
        <div className="flex gap-1.5">
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
            updP={sim.updP} updBase={sim.updBase}
            updF={sim.updF} setFAll={sim.setFAll}
            resetF={sim.resetF} resetP={sim.resetP} resetLC={sim.resetLC} resetReg={sim.resetReg}
            updRegDist={sim.updRegDist} setRegDistAll={sim.setRegDistAll} scaleRegDist={sim.scaleRegDist}
            reset={sim.reset} loadPreset={loadPreset}
            G={sim.G} T={sim.T} decomp={sim.decomp}
            reg={sim.reg} regRatios={sim.regRatios}
            incCurChg={sim.incCurChg} incNewChg={sim.incNewChg} nhiNewChg={sim.nhiNewChg}
            fileRef={sim.fileRef} handleFile={sim.handleFile} handleExport={sim.handleExport}
          />
        )}

        {tab === 1 && (
          <TabTrack
            state={state} set={set}
            G={sim.G} T={sim.T}
            nhiNewChg={sim.nhiNewChg}
            tAchg={sim.tAchg} tBchg={sim.tBchg} tCchg={sim.tCchg} tSchg={sim.tSchg}
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
        일차의료 지불모형 시뮬레이터 v6.1 · 일차의료개발센터 · © 2026
      </div>
    </div>
  );
}
