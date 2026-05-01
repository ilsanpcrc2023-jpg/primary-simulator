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
const validMClinics = typeof officialBaseline?.M_clinics === "number" && officialBaseline.M_clinics > 0;
const validDataLabel = typeof officialBaseline?.dataLabel === "string" && officialBaseline.dataLabel.trim().length > 0;

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
//
// v6.10.0: PF 디폴트 = B의 10% (HCC 비례 자동, 데이터 기반).
//   기존 [1·2·3·4만원] 임의값은 폐기 — "1군 28,083원 = B 280,832원의 10%"가 가장 강한 답변.
//   파일럿 baseline(B=[280832, 300199, 523581, 745317]) 적용 시: [28083, 30020, 52358, 74532].
//   PF 통합 슬라이더의 디폴트 위치(10%)와 정합.
export const INIT_PF_PCT = 10;               // PF 통합 슬라이더 디폴트 (B의 X%, 0~20)
export const INIT_PF_RULE = "hcc";           // 분배 규칙 디폴트 (hcc|equal|inverse)
export const INIT_F = INIT_B.map(b => Math.round(b * INIT_PF_PCT / 100));
export const INIT_R = INIT_F;                // 하위 호환 alias (v6.9.x까지의 명칭)
export const INIT_REG_DIST = [100, 600, 200, 100];

// v6.9.4: 데이터 기반 디폴트로 전환.
//   INIT_TOTAL_N = sum(INIT_BASE.N) — 파일럿(2023)이면 69,604명
//   INIT_M_CLINICS = official_baseline.json의 M_clinics (없으면 10 = 파일럿 기관 수)
//   INIT_PER_CLINIC = INIT_TOTAL_N / INIT_M_CLINICS (= 6,960명/의원, 파일럿 기준)
//   분석 중인 만성질환관리시범사업 데이터(약 3,000개 의원)가 들어오면, 관리자가
//   "공식 baseline 등록" 버튼으로 base + M_clinics + dataLabel을 함께 갱신 → 새 디폴트.
//   세션 중에는 state.datasetM/datasetTotalN/datasetLabel(useSimulator)이 anchor 역할,
//   환자군 패널 "↩ 초기화"는 그 anchor로 복귀 (예: 3,000개 의원 데이터 로드 후엔 그 값으로 초기화).
const _initTotalN = INIT_BASE.reduce((s, g) => s + (g?.N || 0), 0);
export const INIT_TOTAL_N = _initTotalN > 0 ? _initTotalN : 69604;
export const INIT_M_CLINICS = validMClinics ? officialBaseline.M_clinics : 10;
export const INIT_PER_CLINIC = Math.max(1, Math.round(INIT_TOTAL_N / INIT_M_CLINICS));
export const INIT_BASE_PER_CLINIC = INIT_PER_CLINIC;
export const INIT_DATA_LABEL = validDataLabel
  ? officialBaseline.dataLabel
  : `데이터 baseline (${INIT_M_CLINICS}기관 · ${INIT_TOTAL_N.toLocaleString("ko-KR")}명)`;
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
export const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

export const NATIONAL_POP = 51_411_696;

// B 슬라이더 범위 (HCC×의원비중 자동 유도값 clamp 시에도 사용)
export const B_MIN = 50_000;
export const B_MAX = 2_000_000;

// v6.8.2: 의원 모드용 환자군 구성 프리셋 (RegScaleCard 상단 노출).
//   - regDist 합 1,000명 기준. 총량 스케일은 RegScaleCard "등록 환자" NumBox에서 조정.
//   - "사용자 지정"은 어떤 프리셋과도 일치하지 않을 때 자동 활성 (regDist=null).
export const CLINIC_PRESETS = [
  { key: "general", label: "일반 의원",  regDist: [100, 600, 200, 100] },
  { key: "elderly", label: "노인 집중",  regDist: [30, 200, 400, 370] },
  { key: "custom",  label: "사용자 지정", regDist: null },
];

// v6.10.0: 정책 모드 환자군 패널 시나리오 프리셋 (의원당 환자수 기준).
//   - 파일럿: 2023 실측 (10기관 / 69,604명 / 의원당 6,960명)
//   - 시범사업: 복지부 시범사업안 (의원당 1,500명)
//   - NHS: 영국 1차의료 평균 등록 패널 규모 (의원당 약 2,200명)
//   - 네덜란드: GP 평균 등록 패널 규모 (의원당 약 2,200명)
//   - 의원 모드는 CLINIC_PRESETS(분포)를 사용 — 정책 모드는 패널 규모 비교가 핵심.
export const POLICY_SCENARIOS = [
  { key: "pilot",    label: "파일럿",   perClinic: 6960, sub: "2023 실측" },
  { key: "korea",    label: "시범사업", perClinic: 1500, sub: "복지부안" },
  { key: "nhs",      label: "NHS",      perClinic: 2200, sub: "영국 GP" },
  { key: "nl",       label: "네덜란드", perClinic: 2200, sub: "GP 평균" },
];

// v6.7: L1 · L2 분리 (선지급 vs 사후 성과급)
// L1 = 선지급 기준 타원이용비중 (환자군별, 사업 시작 전 과거 평균 기반)
// L2 = 실측 타원이용비중 (단일 스칼라, 사업 중 관측치 · 성과급 산정 기준)
// 성과급 = max(0, L1 − L2) × B × n_reg × TrackMul
//   (no-downside · 의원 100% 환원, 공유율 없음 — Shared Saving과는 다른 구조)
//
// v6.9.5: L1 = base.L 자동 산출 (사용자 결정).
//   L1은 협상 변수가 아니라 데이터 실측 = 과거 평균 타원이용비중 그 자체.
//   official_baseline.json·엑셀 업로드의 L 값이 곧 L1 디폴트가 됨.
//   파일럿(2023): [0.7975, 0.7934, 0.7943, 0.7722]
//   3,000개 의원 데이터 업로드 시 그 실측 L이 자동으로 L1 디폴트가 됨.
//   향후 사용자가 슬라이더로 임의 조정 가능하지만, 새 데이터 LOAD_DATA 시 다시 base.L로 동기화.
export const INIT_L1 = INIT_BASE.map(b => (typeof b?.L === "number" ? b.L : 0.7));

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

// v6.10.0: balance-thumb CSS 제거 (균형추 모듈 폐지와 함께).
export const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;
