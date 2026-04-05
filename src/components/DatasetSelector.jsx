import presets from "../data/presets/index";

export default function DatasetSelector({ currentLabel, onSelect }) {
  if (presets.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 shrink-0">데이터셋:</span>
      <select
        value={currentLabel}
        onChange={e => {
          const preset = presets.find(p => p.label === e.target.value);
          if (preset) onSelect(preset);
        }}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
      >
        {presets.map(p => (
          <option key={p.year} value={p.label}>{p.label}</option>
        ))}
        {!presets.find(p => p.label === currentLabel) && (
          <option value={currentLabel}>{currentLabel}</option>
        )}
      </select>
    </div>
  );
}
