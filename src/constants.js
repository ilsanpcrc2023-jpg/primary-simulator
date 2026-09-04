import officialBaseline from "./data/presets/official_baseline.json";

export const SH = ["1군", "2군", "3군", "4군"];
export const CL = ["#22c55e", "#6366f1", "#2563eb", "#f97316"];

// v6.6: 공식 baseline은 official_baseline.json에서 우선 로드.
// 관리자가 "공식 baseline 등록" 버튼을 누르면 api/commit-baseline이 이 파일을 갱신 → Vercel 재배포.
// JSON 파일이 없거나 불완전하면 아래 FALLBACK으로 복귀.
// v7.1.1: FALLBACK도 A·CR·NT 추가 (옵션 — official_baseline.json 누락 시 fallback)
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
// B = 환자군 기본수가 — 정책 슬라이더 (엑셀 업로드 시 환자군 평균 의료비 A × 의원급 외래비중 CR 자동 유도)
// P = B + F (일차의료수가, 명목 청구수가)
//
// v6.10.0: PF 디폴트 = B의 X% (HCC 비례 자동, 데이터 기반).
// v7.2.2: 디폴트 10% → 5% (사용자 결정).
// v7.5: 의료비 0원 제외 baseline(B=[238515, 413166, 662478, 1013352]) 적용 시: [11926, 20658, 33124, 50668].
//   PF 통합 슬라이더의 디폴트 위치(5%)와 정합.
export const INIT_PF_PCT = 5;                // PF 통합 슬라이더 디폴트 (B의 X%, 0~20)
export const INIT_PF_RULE = "hcc";           // 분배 규칙 디폴트 (hcc|equal|inverse)
export const INIT_F = INIT_B.map(b => Math.round(b * INIT_PF_PCT / 100));
export const INIT_R = INIT_F;                // 하위 호환 alias (v6.9.x까지의 명칭)
// v7.2.0: regDist 디폴트 = 참여의원 환자분포(RD) × 1,000명.
// v7.5: NHIS-HCC v3.0 (의료비 0원 제외, 2,923개 의원) RR 컬럼 정합으로 갱신.
//   엑셀 RD = [20.165%, 19.772%, 29.382%, 30.681%] × 1,000명
//   Largest-remainder rounding (합 1,000 유지):
//     1군 0.20165 × 1000 = 201.65 → 201
//     2군 0.19772 × 1000 = 197.72 → 198
//     3군 0.29382 × 1000 = 293.82 → 294
//     4군 0.30681 × 1000 = 306.81 → 307  (합 1,000)
//   이전 v7.2.0 값 [160, 224, 298, 318]은 zero 포함 기준의 RD에서 유도된 것이라
//   의료비 0원 제외 baseline으로 갱신 시 함께 변경.
// v7.5.3: 등록 분포비 디폴트 = 기준 분포비(ratio_i)와 소수점 2자리(%)까지 동일 (사용자 결정).
//   regDist를 0.1명 단위로 보관 → 등록 분포비(%) = regDist / 10 이 ratio_i × 100 의 2자리 반올림과 일치.
//   (이전 정수 largest-remainder [201, 198, 294, 307]은 2자리 불일치 → 폐기)
// v7.5.5: 기준 분포비 = RN(일만시 참여의원 환자수 12,411,152명) 기준 (사용자 결정 — v7.5.4의 NT 기준은 복귀).
//   exc_zero baseline RN [2,502,705 · 2,453,897 · 3,646,697 · 3,807,853]
//   → ratio_i 20.16 / 19.77 / 29.38 / 30.68 % → INIT_REG_DIST [201.6, 197.7, 293.8, 306.8] (합 999.9 — 군별 독립 반올림)
const _sumN = INIT_BASE.reduce((s, g) => s + (g?.N || 0), 0);
export const INIT_REG_DIST = _sumN > 0
  ? INIT_BASE.map(g => Math.round((g.N / _sumN) * 1000 * 10) / 10)
  : [201.6, 197.7, 293.8, 306.8];

// v7.5.1: 환자 본인부담비 (디폴트 30%). v7.6.0: 기준을 M1 → PB(= B × (1−L1))로 변경 (사용자 결정, M1 미사용).
//   본인부담 = PB × copayRates[i]. 디폴트는 4군 모두 COPAY_RATE(30%).
//   v7.5.2: 상세 편집 테이블에서 환자군별 수기 수정 가능 (state.copayRates).
export const COPAY_RATE = 0.30;
export const INIT_COPAY_RATES = [COPAY_RATE, COPAY_RATE, COPAY_RATE, COPAY_RATE];

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

// v7.1.1: 1차년도 시범사업 디폴트 — 초기 화면은 100개 의원 (1차년도 시범사업 scope).
//   데이터 anchor (INIT_M_CLINICS = 2,923, official_baseline.json)는 만성질환관리 시범사업 전체 코호트.
//   초기 디스플레이는 100개 의원 × 의원당 4,379명 = 437,900명. 의원당 등록 1,000명 (regDist 합).
//   "일만시 전체 등록 모드" 버튼으로 데이터 anchor (M=2,923, 의원당 4,379명 전체 등록) 전환 가능.
export const INIT_DEFAULT_M = 100;
export const INIT_DEFAULT_TOTAL_N = Math.max(1, INIT_DEFAULT_M * INIT_PER_CLINIC);

// 의원 수 프리셋 (ClinicCountCard) — 100/1,000/3,000/2,923
//   - 100: 1차년도 시범사업
//   - 1,000·3,000: 확장 단계
//   - 2,923 = INIT_M_CLINICS: 일만시 (만성질환관리 시범사업 참여의원 전체)
export const CLINIC_COUNT_PRESETS = [
  { value: 100,             label: "100",                    title: "1차년도 시범사업" },
  { value: 1000,            label: "1,000",                  title: "확장" },
  { value: 3000,            label: "3,000",                  title: "확장" },
  { value: INIT_M_CLINICS,  label: `일만시 ${INIT_M_CLINICS.toLocaleString("ko-KR")}`, title: "만성질환관리 시범사업 참여의원 전체 (2,923개)" },
];

// 의원당 등록환자수 프리셋 (고급설정) — 1,000/1,500/2,000/3,000/4,000명
//   regDist 합을 비례 스케일 (scaleRegDist).
export const REG_PER_CLINIC_PRESETS = [1000, 1500, 2000, 3000, 4000];

// v7.1.4: 일만시 모드는 시범사업안 디폴트 등록환자수(1,000명, INIT_REG_DIST [100,600,200,100])를 사용.
//   이전 v7.1.1의 FULL_REG_REG_DIST(N비례 분배 ≈ 4,379명 전체 등록)는 폐기.
//   일만시 모드 = 데이터 anchor 의원 수(2,923) + 시범사업안 등록 분포.
export const INIT_PT_BASE = 10_000_000;   // 일차의료 전환지원금 기준 금액 (의원당 · 1회)
// PT · 성과공유 Track 지급률 (A/B/C, %) — 편집 가능, 초기화 시 복귀
export const INIT_PT_PCT_A = 10;
export const INIT_PT_PCT_B = 50;
export const INIT_PT_PCT_C = 100;
export const INIT_SS_PCT_A = 10;
export const INIT_SS_PCT_B = 50;
export const INIT_SS_PCT_C = 100;
// Shared Saving 기준 — "total"=건강보험 전체(ssTotalCost, 조원) · "project"=사업대상 환자 의료비(ssProjectCost, 억원)
// v7.0: 디폴트를 건강보험 전체(110.8조)로 복귀 (사용자 결정 — SS는 일차의료 후속 의료비 변화 추정).
export const INIT_SS_COST_BASE = "total";
export const INIT_SS_PROJECT_COST = 10000;  // 억원 (사업대상 토글 시 사용)
// 이전 명칭 유지 (하위 호환)
export const INIT_P = INIT_B;
export const ON = INIT_BASE.reduce((s, g) => s + g.N, 0);

export const NATIONAL_POP = 51_411_696;

// B 슬라이더 범위 (환자군 평균 의료비 A × 의원급 외래비중 CR 자동 유도값 clamp 시에도 사용)
export const B_MIN = 50_000;
export const B_MAX = 2_000_000;

// v6.8.2: 의원 모드용 환자군 구성 프리셋 (RegScaleCard 상단 노출).
//   - regDist 합 1,000명 기준. 총량 스케일은 RegScaleCard "등록 환자" NumBox에서 조정.
//   - "사용자 지정"은 어떤 프리셋과도 일치하지 않을 때 자동 활성 (regDist=null).
// v7.2.0: "일반 의원" 라벨 → "데이터 비례" 변경, 값 [100,600,200,100] → [160,224,298,318].
//   엑셀 NHIS-HCC v3.0의 참여의원 환자분포 RD (16.0/22.4/29.8/31.8%)를 1,000명에 비례 배분.
//   이전 임의값 폐기 (사용자 결정).
export const CLINIC_PRESETS = [
  { key: "general", label: "데이터 비례",  regDist: [...INIT_REG_DIST] },
  { key: "elderly", label: "노인 집중",     regDist: [30, 200, 400, 370] },
  { key: "custom",  label: "사용자 지정",   regDist: null },
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

// v6.6 / v3.0(2025) / v7.2.0: 업로드 파서는 7 필드 인식 (N·M1·L·A·CR·RR·RO).
//   - N/M1/L: 환자군 기초지표 (base)
//   - A (HCC 키 호환): 환자군 평균 의료비 (원/년)
//     ※ v3.0(2025)부터 'HCC 4분위 예측 평균'이 아니라 환자군의 실제 평균 의료비를 사용.
//       내부 키는 하위호환을 위해 'HCC' 유지, UI/문서 명칭은 '환자군 평균 의료비 A'로 통일.
//   - CR (Clinic Ratio): 의원급 외래비중 (0~1, 의원급외래비 / 총의료비)
//   - B_suggested = A × CR (시뮬레이터가 계산) → 슬라이더 초기값으로 주입
//   - B 컬럼 자체는 엑셀에 두지 않음 (v6.3 자가오염 사고 재발 방지 · 시뮬레이터에서만 계산)
// v7.2.0 신규 약어 (NHIS-HCC v3.0 엑셀):
//   - RN (Registered N): 참여의원 전체 환자수 (이전 NC). N alias로 흡수.
//   - RR (Registered Reg): 참여의원당 등록환자수 = state.regDist 자동 주입 재료.
//   - RO (Registered Outpatient): 등록의원 외래의료비 (총합) → M1 fallback (RO ÷ N).
//   - RD (Registered Distribution): 참여의원 환자분포 (보조 reference).
//   - CO (Clinic Outpatient, 의원급외래비) 등은 시뮬 미사용 → alias 제외.
export const COL_ALIASES = {
  N:   ["N", "RN", "환자수", "등록환자수", "등록환자수\n(N)", "실인원", "N 실인원", "참여의원 환자수", "참여의원 전체 환자수", "환자군별 (2,923개) 참여의원 환자수"],
  M1:  ["M1", "1인당 등록의원 외래비", "1인당 등록의원외래비", "1인당 등록의원\n외래비", "현재외래비", "1인당 의원외래비", "1인당\n의원외래비", "1인당\n등록의원외래", "1인당 등록의원외래", "현행M1\n(1인당등록의원)"],
  L:   ["L", "타원이용비중", "비용기반 L", "비용기반 L\n(C−M)/C", "비용기반L", "cf. 타원이용비중", "cf. 타원이용비중 \nL1"],
  HCC: ["HCC", "HCC예측", "HCC 평균", "HCC예측 평균의료비", "HCC예측\n평균의료비", "HCC예측평균의료비", "HCC 예측평균의료비", "환자군 평균\n의료비 A", "환자군 평균 의료비 A", "환자군 평균의료비", "환자군 평균의료비 A", "평균 의료비 A"],
  CR:  ["의원비중", "의원급외래 비중", "의원급외래비중", "의원급외래\n비중"],
  RR:  ["RR", "참여의원당 등록환자수", "참여의원당\n등록환자수", "참여의원당\r\n등록환자수\r\nRR"],
  RO:  ["RO", "등록의원외래비", "등록의원 외래비", "등록의원외래의료비"],
};

// v6.10.0: balance-thumb CSS 제거 (균형추 모듈 폐지와 함께).
export const sliderCSS = `
  input[type=range].big-thumb { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
  input[type=range].big-thumb::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
  input[type=range].big-thumb::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); background: var(--thumb-bg, #3b82f6); }
`;
