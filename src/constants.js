export const SH = ["1군", "2군", "3군", "4군"];
export const CL = ["#22c55e", "#6366f1", "#2563eb", "#f97316"];

export const INIT_BASE = [
  { ref: 400538, cr: 0.701, N: 11956, M1: 62801, L: 0.7975 },
  { ref: 642819, cr: 0.655, N: 13778, M1: 84083, L: 0.7934 },
  { ref: 1246438, cr: 0.589, N: 18089, M1: 138152, L: 0.7943 },
  { ref: 3495599, cr: 0.299, N: 25781, M1: 233560, L: 0.7722 },
];

export const INIT_P = [220000, 300000, 520000, 740000];
export const INIT_F = [122860, 203040, 291120, 362530];
export const INIT_REG_DIST = [100, 600, 200, 100];
export const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

export const NATIONAL_POP = 51_411_696;

export const COL_ALIASES = {
  ref: ["기준의료비", "refCost", "환자군 기준의료비", "환자군\n기준의료비", "HCC평균"],
  cr:  ["의원비중", "clinicRatio", "의원급 외래비중", "의원급\n외래비중", "의원급비중"],
  N:   ["환자수", "N", "등록환자수", "등록환자수\n(N)"],
  M1:  ["현재외래비", "M1", "현행 M1", "1인당\n등록의원외래", "현행M1\n(1인당등록의원)"],
  L:   ["타원이용비중", "L", "비용기반 L", "비용기반 L\n(C−M)/C", "비용기반L"],
  P:   ["수가", "P", "일차의료수가", "일차의료수가\n(P)", "제시안 수가", "제시안 수가\n(P_제시안)"],
};

export const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;
