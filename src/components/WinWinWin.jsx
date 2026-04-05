export default function WinWinWin({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {items.map((w, i) => (
        <div key={i} className="rounded-xl px-3 py-2.5 text-center" style={{ background: w.bg, border: `1px solid ${w.bd}` }}>
          <div className="text-sm font-bold mb-1" style={{ color: w.c }}>{w.t}</div>
          <div className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{w.txt}</div>
        </div>
      ))}
    </div>
  );
}
