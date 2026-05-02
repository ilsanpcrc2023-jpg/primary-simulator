export default function Header({
  zoomIdx = 1, zoomLevels = [1], onZoomIn, onZoomOut,
}) {
  const canDec = zoomIdx > 0;
  const canInc = zoomIdx < zoomLevels.length - 1;
  const btn = "rounded text-white font-bold px-2 h-8 flex items-center justify-center select-none transition shrink-0";

  // v7.0: 모드 토글 → 수가 시뮬레이션 탭 내부로 이동 (헤더에서 제거)
  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)" }} className="px-3 sm:px-5 py-3">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-white font-bold text-sm sm:text-base">일차의료 지불체계 시뮬레이터</h1>
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
