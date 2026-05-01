export const f = v => Math.round(v).toLocaleString("ko-KR");
export const fE = v => (v / 1e8).toFixed(1);
export const fSv = v => v >= 1e12 ? (v / 1e12).toFixed(2) + "조" : f(Math.round(v / 1e8)) + "억";
export const pct = (v, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
export const diffE = (a, b) => `${b >= a ? "+" : ""}${fE(b - a)}억`;

// 단위 자동 선택: 1조 이상 → 조, 1억 이상 → 억, 1만 이상 → 만원, 그 미만 → 원
export const fAuto = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2) + "조원";
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + "억원";
  if (abs >= 1e4) return f(v / 1e4) + "만원";
  return f(v) + "원";
};
export const diffAuto = (a, b) => {
  const d = b - a;
  return (d >= 0 ? "+" : "") + fAuto(d);
};

// 만원 단위 고정 포매팅 (의원당 평균처럼 작은 차이 가독성 필요 시)
export const fMan = (v) => Math.round(v / 1e4).toLocaleString("ko-KR") + "만원";
export const diffMan = (delta) => (delta >= 0 ? "+" : "") + fMan(delta);

// v6.9.1: 의료비 변화액 음(−) 표기 헬퍼 (U+2212).
// 양수 절감액 → "−XXX억원" prefix 부착, 0이면 부호 없이.
// "이용 감소 가정" 박스에서 양수 입력을 음(−) 변화로 표기할 때 사용.
export const fChangeAuto = (v) => v > 0 ? `−${fAuto(v)}` : fAuto(v);
