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

// v6.9.3 → v7.3.0: PB 정의 변경 (B×(1−L1) → M1×0.7).
//   시뮬 핵심 산식의 PB는 useSimulator.js의 pay_gov에서 M1×0.7 + F로 직접 산출.
//   아래 calcPB·PBtoB·calcPB_M1은 reference / 상세 편집 테이블 표시용으로만 사용.
//   PBtoB는 더 이상 호출되지 않음(슬라이더가 PB가 아니라 B를 직접 조작) — 하위 호환 유지.
//
// @deprecated v7.3.0 — 시뮬 핵심 산식에는 calcPB_M1 사용. calcPB는 reference (B×C1 표시).
export const calcPB = (B_g, L1_g) =>
  B_g.map((b, i) => Math.round(b * (1 - (L1_g?.[i] ?? 0.7))));

// v7.3.0: PB(시뮬 본체) = M1 × 0.7 — 공단지급분.
//   사용자 정책 의도("환자 본인부담 변화 없음, 의원 받는 돈 변화 없음, 변화는 PF만")에 정합.
export const calcPB_M1 = (base) =>
  base.map((b) => Math.round((b?.M1 ?? 0) * 0.70));

// @deprecated v7.3.0 — 더 이상 호출되지 않음. 하위 호환 유지 (이전 테스트 통과).
export const PBtoB = (PB_input, L1) =>
  Math.round(PB_input / Math.max(0.001, 1 - L1));

// v6.10.0: PF 분배 함수 (균형추 폐지 후 PF 카드 분배 토글에서 재사용).
//   totalTarget — 사업 전체 PF 지출 합 (Σ PF[i] × n_g[i])
//   rule        — "hcc" (B 가중) | "equal" (1인당 동일) | "inverse" (1/B 가중)
//   B[i]        — 환자군 기본수가 (HCC 비례 가중 기준)
//   n_g[i]      — 환자군별 등록환자수 (분배 가중 + 합산 기준)
//   returns     — 1인당 PF 절대값 4-array (음수 미가능 → 호출부에서 0 floor)
export function distribute(totalTarget, rule, B, n_g) {
  const N = n_g.reduce((s, n) => s + n, 0);
  if (N <= 0 || B.length === 0 || totalTarget === 0) {
    return B.map(() => 0);
  }
  if (rule === "equal") {
    const v = totalTarget / N;
    return B.map(() => v);
  }
  if (rule === "hcc") {
    const w = B.map((b, i) => b * n_g[i]);
    const W = w.reduce((s, x) => s + x, 0);
    if (W <= 0) return B.map(() => 0);
    return B.map((_, i) => (totalTarget * w[i] / W) / Math.max(1, n_g[i]));
  }
  // inverse: 1/B 가중
  const w = B.map((b, i) => (b > 0 ? (1 / b) * n_g[i] : 0));
  const W = w.reduce((s, x) => s + x, 0);
  if (W <= 0) return B.map(() => 0);
  return B.map((_, i) => (totalTarget * w[i] / W) / Math.max(1, n_g[i]));
}

// v6.10.0: PF 통합 슬라이더 — "PF = B의 X%"에서 4군 PF 절대값을 산출.
//   pfPct        — 통합 슬라이더 값 (0~20, %)
//   rule         — 분배 규칙 ("hcc"|"equal"|"inverse")
//   B[i]         — 환자군 기본수가
//   n_reg_g[i]   — 환자군별 등록환자수 (사업 전체 합 = regDist[i] × M_clinics)
//   returns      — 1인당 PF 절대값 4-array (반올림, 0 floor)
//
// HCC 비례 디폴트: PF[i] = B[i] × pfPct/100 (1군 = B 280,832×10% = 28,083).
// 균등: 모든 군 PF = (Σ B[i] × n_reg_g[i] × pfPct/100) / Σ n_reg_g[i] (1인당 동일).
// 역비례: 1/B 가중 (경증 등록 진입 인센티브).
export function calcPFfromPct(pfPct, rule, B, n_reg_g) {
  const totalTarget = B.reduce((s, b, i) => s + b * (n_reg_g[i] || 0), 0) * (pfPct / 100);
  return distribute(totalTarget, rule, B, n_reg_g).map(v => Math.max(0, Math.round(v)));
}

// v6.10.0: 현재 F_g에서 통합 슬라이더 % 역산 (사용자가 개별 슬라이더 조정 후 표시용).
//   pfPct_implied = (Σ F_g[i] × n_reg_g[i]) / (Σ B[i] × n_reg_g[i]) × 100
export function inferPFpct(F_g, B, n_reg_g) {
  const num = F_g.reduce((s, f, i) => s + (f || 0) * (n_reg_g[i] || 0), 0);
  const den = B.reduce((s, b, i) => s + b * (n_reg_g[i] || 0), 0);
  return den > 0 ? (num / den) * 100 : 0;
}
