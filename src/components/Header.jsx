export default function Header({
  zoomIdx = 1, zoomLevels = [1], onZoomIn, onZoomOut,
  mode = "clinic", onModeChange,
}) {
  const canDec = zoomIdx > 0;
  const canInc = zoomIdx < zoomLevels.length - 1;
  const btn = "rounded text-white font-bold px-2 h-8 flex items-center justify-center select-none transition shrink-0";

  const modeBtn = (active) => ({
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: active ? 800 : 600,
    color: active ? "#0f172a" : "rgba(255,255,255,0.85)",
    background: active ? "#ffffff" : "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: 6,
    transition: "all .15s",
  });

  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)" }} className="px-3 sm:px-5 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-white font-bold text-sm sm:text-base">일차의료 지불체계 시뮬레이터</h1>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* 모드 토글 */}
          <div
            role="group"
            aria-label="사용 모드"
            className="flex items-center gap-0.5 rounded-md p-0.5"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <button
              type="button"
              onClick={() => onModeChange?.("policy")}
              aria-pressed={mode === "policy"}
              style={modeBtn(mode === "policy")}
              title="정책 입안자 모드 — 재정 안정과 의료계 수용성의 접점을 탐색"
            >
              🏛️ 정책
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.("clinic")}
              aria-pressed={mode === "clinic"}
              style={modeBtn(mode === "clinic")}
              title="의원 운영자 모드 — Track·타원이용 관리가 수입에 미치는 영향을 확인"
            >
              🩺 의원
            </button>
          </div>
          {/* 줌 */}
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="글자 크기 조절">
            <button type="button" onClick={onZoomOut} disabled={!canDec} aria-label="글자 작게"
              className={btn + " text-[10px]"}
              style={{ background: canDec ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)", opacity: canDec ? 1 : 0.4 }}>글자 작게</button>
            <span className="text-white/70 text-[11px] font-mono w-10 text-center" aria-live="polite">
              {Math.round(zoomLevels[zoomIdx] * 100)}%
            </span>
            <button type="button" onClick={onZoomIn} disabled={!canInc} aria-label="글자 크게"
              className={btn + " text-sm"}
              style={{ background: canInc ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)", opacity: canInc ? 1 : 0.4 }}>글자 크게</button>
          </div>
        </div>
      </div>
    </div>
  );
}
