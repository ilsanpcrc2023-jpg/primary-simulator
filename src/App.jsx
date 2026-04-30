import { useState, useEffect } from "react";
import useSimulator from "./hooks/useSimulator";
import Header from "./components/Header";
import TabSimulation from "./components/TabSimulation";
import TabTrack from "./components/TabTrack";
import TabSharedSaving from "./components/TabSharedSaving";
import DatasetSelector from "./components/DatasetSelector";
import { sliderCSS } from "./constants";

const TABS = [
  { full: "📋 수가 시뮬레이션", short: "📋 수가" },
  { full: "📊 Track", short: "📊 Track" },
  { full: "💰 Shared Saving", short: "💰 Saving" },
];

const tabStyle = (active) => ({
  background: active ? "#fff" : "#e2e8f0",
  color: active ? "#1e3a8a" : "#475569",
  border: active ? "2px solid #1e40af" : "2px solid #cbd5e1",
  borderBottom: active ? "2px solid #fff" : "2px solid #94a3b8",
  borderRadius: "10px 10px 0 0",
  fontWeight: active ? 800 : 600,
  padding: "12px 6px",
  marginBottom: "-2px",
  boxShadow: active ? "0 -2px 8px rgba(30, 64, 175, 0.15)" : "none",
  position: "relative",
  zIndex: active ? 2 : 1,
  whiteSpace: "nowrap",
});

const ZOOM_LEVELS = [0.9, 1.0, 1.15, 1.3];
const ZOOM_KEY = "primarySim.zoom";
const VALID_MODES = ["policy", "clinic"];

// v6.9.0: 의원 모드를 디폴트 화면으로 고정.
// URL `?mode=policy` 진입 시에만 정책 모드, 그 외 모든 첫 진입은 의원 모드.
// localStorage 우선순위는 제거(이전 세션 캐시로 정책 모드가 첫 화면이 되는 일 없음).
function readInitialMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromURL = params.get("mode");
    if (fromURL && VALID_MODES.includes(fromURL)) return fromURL;
  } catch { /* ignore */ }
  return "clinic";
}

export default function App() {
  const sim = useSimulator();
  const { state, set, loadPreset } = sim;
  const { tab } = state;

  const [zoomIdx, setZoomIdx] = useState(() => {
    const saved = parseInt(localStorage.getItem(ZOOM_KEY) ?? "1", 10);
    return Number.isFinite(saved) && saved >= 0 && saved < ZOOM_LEVELS.length ? saved : 1;
  });
  useEffect(() => { localStorage.setItem(ZOOM_KEY, String(zoomIdx)); }, [zoomIdx]);
  const incZoom = () => setZoomIdx(i => Math.min(ZOOM_LEVELS.length - 1, i + 1));
  const decZoom = () => setZoomIdx(i => Math.max(0, i - 1));

  const [mode, setMode] = useState(readInitialMode);
  // v6.9.0: localStorage 저장 제거 — 의원 모드를 항상 첫 화면으로 고정. URL ?mode=policy만 정책 진입.
  // v6.8.1: 첫 진입은 useSimulator 초기 state(tab=0, 수가 탭)로. 모드 전환 시 현재 탭 유지.

  return (
    <div className="overflow-x-hidden" style={{ fontFamily: "'Pretendard','Noto Sans KR',-apple-system,sans-serif", background: "#f8fafc", minHeight: "100vh", zoom: ZOOM_LEVELS[zoomIdx] }}>
      <style>{sliderCSS}</style>

      <Header zoomIdx={zoomIdx} zoomLevels={ZOOM_LEVELS} onZoomIn={incZoom} onZoomOut={decZoom}
        mode={mode} onModeChange={setMode} />

      {/* FOLDER TABS */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3" style={{ borderBottom: "2px solid #94a3b8" }}>
        <div className="flex gap-1.5">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => set("tab", i)}
              aria-selected={tab === i}
              className="flex-1 text-center cursor-pointer transition-all text-[13px] sm:text-[17px]"
              style={tabStyle(tab === i)}>
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.full}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        <DatasetSelector currentLabel={state.dataLabel} onSelect={loadPreset} />

        {/* 모드 안내 배너 (v6.8.1 — 모드별 문구 교체) */}
        <div className="rounded-lg px-3 py-2.5 text-xs sm:text-[13px] leading-relaxed"
          style={mode === "policy"
            ? { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a" }
            : { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
          {mode === "policy" ? (
            <>
              <div className="font-bold mb-1">🏛️ 정책 모드 — 재정 안정과 의료계 수용성이 맞닿는 수가 조합을 탐색하세요.</div>
              <div className="opacity-90">B·F·L1을 직접 조정하며 공단 지출 변화와 의원당 수입 변화를 동시에 확인할 수 있습니다. 좌측 상단 토글로 의원 모드로 전환할 수 있습니다.</div>
            </>
          ) : (
            <>
              <div className="font-bold mb-1">🏥 의원 모드 — 우리 의원에 이 제도가 어떻게 작용할지 확인하세요.</div>
              <div className="opacity-90">현재 표시된 수가는 정부 협상을 통해 확정된 값입니다. Track 선택과 포괄관리 지표(L2) 관리로 수입이 어떻게 변하는지 확인할 수 있습니다.</div>
            </>
          )}
        </div>

        {tab === 0 && (
          <TabSimulation
            mode={mode}
            state={state} set={set}
            updP={sim.updP} updBase={sim.updBase}
            updF={sim.updF} setFAll={sim.setFAll}
            resetF={sim.resetF} resetP={sim.resetP} resetReg={sim.resetReg}
            updL1={sim.updL1} setL1All={sim.setL1All} resetL1={sim.resetL1}
            setL2={sim.setL2} resetL2={sim.resetL2}
            updRegDist={sim.updRegDist} setRegDistAll={sim.setRegDistAll} scaleRegDist={sim.scaleRegDist}
            reset={sim.reset} loadPreset={loadPreset}
            G={sim.G} T={sim.T} decomp={sim.decomp} performance={sim.performance} tracks={sim.tracks}
            reg={sim.reg} regRatios={sim.regRatios}
            incChg={sim.incChg} nhiChg={sim.nhiChg}
            fileRef={sim.fileRef} handleFile={sim.handleFile} handleExport={sim.handleExport}
            handleCommitBaseline={sim.handleCommitBaseline}
          />
        )}

        {tab === 1 && (
          <TabTrack
            mode={mode}
            state={state} set={set}
            G={sim.G} T={sim.T} SS={sim.SS} performance={sim.performance} tracks={sim.tracks}
            nhiChg={sim.nhiChg}
            tAchg={sim.tAchg} tBchg={sim.tBchg} tCchg={sim.tCchg} tSchg={sim.tSchg}
            resetPtPct={sim.resetPtPct} resetSsPct={sim.resetSsPct}
            setL2={sim.setL2} resetL2={sim.resetL2}
          />
        )}

        {tab === 2 && (
          <TabSharedSaving
            mode={mode}
            state={state} set={set}
            handleMacroSync={sim.handleMacroSync}
            SS={sim.SS} tracks={sim.tracks}
            resetSsCost={sim.resetSsCost}
          />
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center py-3 px-3 text-xs text-gray-400 border-t border-gray-200 bg-white mt-4">
        일차의료 지불체계 시뮬레이터 v6.9.0 · 일차의료개발센터 · © 2026
      </div>
    </div>
  );
}
