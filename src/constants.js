export const SH = ["1군", "2군", "3군", "4군"];
export const CL = ["#22c55e", "#6366f1", "#2563eb", "#f97316"];

// v6.4: base 구조 단순화 — N (실인원), M1 (1인당 의원외래비), L (타원이용비중, 0~1)
// ref/cr는 v6.3까지 잔존했으나 시뮬 계산에 사용되지 않아 제거 (정보 표시 + B 폴백 경로 모두 폐기).
export const INIT_BASE = [
  { N: 11956, M1: 62801, L: 0.7975 },
  { N: 13778, M1: 84083, L: 0.7934 },
  { N: 18089, M1: 138152, L: 0.7943 },
  { N: 25781, M1: 233560, L: 0.7722 },
];

// B = 환자군 기본수가 (정책 슬라이더 — 데이터 업로드와 무관, UI에서만 설정)
// F = 일차의료 기능보정 (환자군별 차등)
// P = B + F (일차의료수가, 명목 청구수가)
export const INIT_B = [220000, 300000, 520000, 740000];
export const INIT_R = [10000, 20000, 30000, 40000];   // 차등 디폴트 (환자군별 1·2·3·4만원, F 값)
export const INIT_REG_DIST = [100, 600, 200, 100];
// 100기관 · 참여 전·후 3,000명 (동일 · 패널 유지 가정) · 등록 1,000명
export const INIT_M_CLINICS = 100;
export const INIT_PER_CLINIC = 3000;
export const INIT_BASE_PER_CLINIC = 3000;
export const INIT_TOTAL_N = INIT_M_CLINICS * INIT_PER_CLINIC;
export const INIT_DATA_LABEL = "복지부 시범사업안 (100기관 · 등록 1,000명)";
export const INIT_PT_BASE = 30_000_000;   // 일차의료 전환지원금 기준 금액 (의원당 · 1회)
// 이전 명칭 유지 (하위 호환)
export const INIT_P = INIT_B;
export const INIT_F = INIT_R;
export const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

export const NATIONAL_POP = 51_411_696;

// v6.4: 업로드 템플릿이 N·M1·L 3 필드만 사용하도록 단순화.
// ref/cr/P/F 별칭은 모두 제거 (정책 슬라이더는 엑셀 비반영, 라운드트립 일관성 보장).
export const COL_ALIASES = {
  N:   ["N", "환자수", "등록환자수", "등록환자수\n(N)", "실인원"],
  M1:  ["M1", "현재외래비", "1인당 의원외래비", "1인당\n의원외래비", "1인당\n등록의원외래", "현행M1\n(1인당등록의원)"],
  L:   ["L", "타원이용비중", "비용기반 L", "비용기반 L\n(C−M)/C", "비용기반L"],
};

export const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;
