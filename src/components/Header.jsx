export default function Header({
  zoomIdx = 1, zoomLevels = [1], onZoomIn, onZoomOut,
  mode = "clinic", onModeChange,
}) {
  const canDec = zoomIdx > 0;
  const canInc = zoomIdx < zoomLevels.length - 1;
  const btn = "rounded text-white font-bold px-2 h-8 flex items-center justify-center select-none transition shrink-0";

  // 세그먼티드 컨트롤 (iOS 스타일) · 선택 색: 정책=남색 #1E3A8A · 의원=녹색 #10B981
  const segActiveBg = mode === "policy" ? "#1E3A8A" : "#10B981";
  const segItem = (active) => ({
    padding: "7px 14px",
    fontSize: 15,
    fontWeight: active ? 800 : 600,
    color: active ? "#ffffff" : "rgba(255,255,255,0.65)",
    background: active ? segActiveBg : "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: 8,
    transition: "background 0.2s ease, color 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1.15,
  });

  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)" }} className="px-3 sm:px-5 pt-3 pb-2.5">
      <div className="max-w-4xl mx-auto">
        {/* 1행: 제목 ↔ 글자 크기 */}
        <div className="flex items-center justify-between gap-2 mb-2">
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
        {/* 2행: 모드 세그먼티드 (좌측) */}
        <div
          role="group"
          aria-label="사용 모드"
          className="inline-flex items-center gap-0.5 rounded-lg p-1"
          style={{ background: "rgba(255,255,255,0.10)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          <button
            type="button"
            onClick={() => onModeChange?.("policy")}
            aria-pressed={mode === "policy"}
            style={segItem(mode === "policy")}
            title="정책 모드 — 재정 안정과 의료계 수용성의 접점을 탐색"
          >
            <span>🏛️</span><span>정책 모드</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.("clinic")}
            aria-pressed={mode === "clinic"}
            style={segItem(mode === "clinic")}
            title="의원 모드 — Track·포괄관리 지표 관리가 수입에 미치는 영향을 확인"
          >
            <span>🏥</span><span>의원 모드</span>
          </button>
        </div>
      </div>
    </div>
  );
}
