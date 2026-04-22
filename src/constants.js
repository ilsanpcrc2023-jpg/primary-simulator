import officialBaseline from "./data/presets/official_baseline.json";

export const SH = ["1군", "2군", "3군", "4군"];
export const CL = ["#22c55e", "#6366f1", "#2563eb", "#f97316"];

// v6.6: 공식 baseline은 official_baseline.json에서 우선 로드.
// 관리자가 "공식 baseline 등록" 버튼을 누르면 api/commit-baseline이 이 파일을 갱신 → Vercel 재배포.
// JSON 파일이 없거나 불완전하면 아래 FALLBACK으로 복귀.
const FALLBACK_BASE = [
  { N: 11956, M1: 62801, L: 0.7975 },
  { N: 13778, M1: 84083, L: 0.7934 },
  { N: 18089, M1: 138152, L: 0.7943 },
  { N: 25781, M1: 233560, L: 0.7722 },
];
const FALLBACK_B = [280832, 300199, 523581, 745317];

const validBase = Array.isArray(officialBaseline?.base)
  && officialBaseline.base.length === 4
  && officialBaseline.base.every(b => typeof b?.N === "number" && typeof b?.M1 === "number" && typeof b?.L === "number");
const validP = Array.isArray(officialBaseline?.P)
  && officialBaseline.P.length === 4
  && officialBaseline.P.every(v => typeof v === "number");

export const INIT_BASE = validBase ? officialBaseline.base : FALLBACK_BASE;
export const INIT_B = validP ? officialBaseline.P : FALLBACK_B;

// v6.6: 공식 baseline 메타 (UI에 최종 갱신일 표시용)
export const OFFICIAL_BASELINE_META = {
  version: officialBaseline?.version ?? null,
  updated_at: officialBaseline?.updated_at ?? null,
  updated_by: officialBaseline?.updated_by ?? null,
  source: (validBase && validP) ? "official_baseline.json" : "fallback",
};

// F = 일차의료 기능보정 (환자군별 차등) — 정책 슬라이더 (엑셀 업로드와 무관)
// B = 환자군 기본수가 — 정책 슬라이더 (엑셀 업로드 시 HCC×의원비중 자동 유도)
// P = B + F (일차의료수가, 명목 청구수가)
export const INIT_R = [10000, 20000, 30000, 40000];   // 차등 디폴트 (환자군별 1·2·3·4만원, F 값)
export const INIT_REG_DIST = [100, 600, 200, 100];
// 100기관 · 참여 전·후 3,000명 (동일 · 패널 유지 가정) · 등록 1,000명
export const INIT_M_CLINICS = 100;
export const INIT_PER_CLINIC = 3000;
export const INIT_BASE_PER_CLINIC = 3000;
export const INIT_TOTAL_N = INIT_M_CLINICS * INIT_PER_CLINIC;
export const INIT_DATA_LABEL = "복지부 시범사업안 (100기관 · 등록 1,000명)";
export const INIT_PT_BASE = 10_000_000;   // 일차의료 전환지원금 기준 금액 (의원당 · 1회)
// PT · 성과배분 Track 지급률 (A/B/C, %) — 편집 가능, 초기화 시 복귀
export const INIT_PT_PCT_A = 10;
export const INIT_PT_PCT_B = 50;
export const INIT_PT_PCT_C = 100;
export const INIT_SS_PCT_A = 10;
export const INIT_SS_PCT_B = 50;
export const INIT_SS_PCT_C = 100;
// Shared Saving 기준 — "total"=건강보험 전체(ssTotalCost, 조원) · "project"=사업대상 환자 의료비(ssProjectCost, 억원)
// v6.5.3: 사업대상 단위 조원→억원 (수천~수만억 규모라 조원은 소수점 입력 필요)
// v6.5.4: 디폴트를 사업대상 환자 의료비로 전환. 참여의원 성과배분 재원은 이 기준으로 산정.
// v6.5.5: 디폴트 1,000 → 10,000억원 (1조원 상당 · 실측 규모 반영)
export const INIT_SS_COST_BASE = "project";
export const INIT_SS_PROJECT_COST = 10000;  // 억원 (사업 참여 의원 환자군 총진료비 추정 디폴트)
// 이전 명칭 유지 (하위 호환)
export const INIT_P = INIT_B;
export const INIT_F = INIT_R;
export const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

export const NATIONAL_POP = 51_411_696;

// B 슬라이더 범위 (HCC×의원비중 자동 유도값 clamp 시에도 사용)
export const B_MIN = 50_000;
export const B_MAX = 2_000_000;

// v6.6: 업로드 파서는 N·M1·L·HCC·CR 5 필드 인식.
//   - N/M1/L: 환자군 기초지표 (base)
//   - HCC: HCC 예측 평균의료비 (원/년)
//   - CR (Clinic Ratio): 의원급외래 비중 (0~1, M1/실제평균총의료비 또는 의원급외래1인당/총의료비)
//   - B_suggested = HCC × CR (시뮬레이터가 계산) → 슬라이더 초기값으로 주입
//   - B 컬럼 자체는 엑셀에 두지 않음 (v6.3 자가오염 사고 재발 방지 · 시뮬레이터에서만 계산)
export const COL_ALIASES = {
  N:   ["N", "환자수", "등록환자수", "등록환자수\n(N)", "실인원", "N 실인원"],
  M1:  ["M1", "현재외래비", "1인당 의원외래비", "1인당\n의원외래비", "1인당\n등록의원외래", "1인당 등록의원외래", "현행M1\n(1인당등록의원)"],
  L:   ["L", "타원이용비중", "비용기반 L", "비용기반 L\n(C−M)/C", "비용기반L"],
  HCC: ["HCC", "HCC예측", "HCC 평균", "HCC예측 평균의료비", "HCC예측\n평균의료비", "HCC예측평균의료비", "HCC 예측평균의료비"],
  CR:  ["의원비중", "의원급외래 비중", "의원급외래비중", "의원급외래\n비중"],
};

export const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;
