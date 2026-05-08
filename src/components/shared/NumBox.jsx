import { useState } from "react";
import { f } from "../../utils";

// v7.2.1: decimals prop 추가 — 소수점 자릿수 지정 시 toFixed(decimals) + 천 단위 콤마.
//   예: decimals=1 → 2.5%p (이전: 정수 라운딩으로 "2%p"가 되던 문제 해소).
export default function NumBox({ value, onChange, color = "#1d4ed8", suffix = "", style = {}, decimals = 0 }) {
  const [ed, setEd] = useState(false);
  const [tmp, setTmp] = useState("");
  const start = () => { setEd(true); setTmp(String(value)); };
  const end = () => { setEd(false); const v = parseFloat(tmp); if (!isNaN(v)) onChange(v); };
  const display = decimals > 0
    ? Number(value).toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : f(value);
  if (ed) return (
    <input autoFocus value={tmp} onChange={e => setTmp(e.target.value)} onBlur={end} onKeyDown={e => e.key === "Enter" && end()}
      className="w-24 text-center text-sm font-bold border-2 rounded-md outline-none bg-white px-1 py-0.5"
      style={{ borderColor: color, color, ...style }} />
  );
  return (
    <button onClick={start}
      className="text-sm font-bold border border-gray-300 rounded-md px-2 py-0.5 hover:border-blue-400 transition bg-white cursor-text"
      style={{ color, ...style }}>
      {display}{suffix}
    </button>
  );
}
