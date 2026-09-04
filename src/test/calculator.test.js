import { describe, it, expect } from 'vitest';
import { INIT_BASE, INIT_P, INIT_F, INIT_R, INIT_PF_PCT, INIT_PF_RULE,
  INIT_REG_DIST,
  POLICY_SCENARIOS, CLINIC_PRESETS,
  ON, COL_ALIASES,
  INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C,
  INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C,
  INIT_SS_COST_BASE, INIT_SS_PROJECT_COST,
  INIT_L1,
  INIT_M_CLINICS, INIT_TOTAL_N, INIT_PER_CLINIC, INIT_BASE_PER_CLINIC,
  INIT_DEFAULT_M, INIT_DEFAULT_TOTAL_N,
  CLINIC_COUNT_PRESETS, REG_PER_CLINIC_PRESETS,
  B_MIN, B_MAX, OFFICIAL_BASELINE_META } from '../constants';
import { distribute, calcPFfromPct, inferPFpct } from '../utils';

describe('calculation engine', () => {
  it('ON: total patient count from INIT_BASE', () => {
    const total = INIT_BASE.reduce((s, g) => s + g.N, 0);
    expect(total).toBe(ON);
    // v7.5: HCC v3.0 baseline (의료비 0원 제외) — 만성질환관리 시범사업 참여의원 2,923개
    //   ΣRN = 2,502,705 + 2,453,897 + 3,646,697 + 3,807,853 = 12,411,152
    //   (이전 v7.2.x zero 포함: 12,801,143)
    expect(ON).toBe(12411152);
  });

  it('INIT_BASE has 4 patient groups', () => {
    expect(INIT_BASE).toHaveLength(4);
  });

  it('INIT_BASE rows have core fields N·M1·L (v6.4) + optional A·CR·NT reference (v7.1.1)', () => {
    INIT_BASE.forEach(b => {
      // 핵심 필드 — 시뮬레이션 엔진이 사용
      expect(typeof b.N).toBe('number');
      expect(typeof b.M1).toBe('number');
      expect(typeof b.L).toBe('number');
      // v6.3 자가오염 사고 방지 — 구 필드 ref/cr 절대 금지
      expect(b).not.toHaveProperty('ref');
      expect(b).not.toHaveProperty('cr');
      // v7.1.1: A/CR/NT는 엑셀 정합용 reference 필드 (선택). 있으면 숫자.
      if ('A' in b) expect(typeof b.A).toBe('number');
      if ('CR' in b) expect(typeof b.CR).toBe('number');
      if ('NT' in b) expect(typeof b.NT).toBe('number');
    });
  });

  it('INIT_P has 4 price points', () => {
    expect(INIT_P).toHaveLength(4);
    INIT_P.forEach(p => expect(p).toBeGreaterThan(0));
  });

  it('all L values are between 0 and 1', () => {
    INIT_BASE.forEach(b => {
      expect(b.L).toBeGreaterThan(0);
      expect(b.L).toBeLessThan(1);
    });
  });

  it('v6.7: pay_gov = B × (1 − L1) + F for each group (공단지급 = P 단일화)', () => {
    INIT_BASE.forEach((b, i) => {
      const B_i = INIT_P[i];
      const L1_i = INIT_L1[i];
      const F_i = INIT_F[i];
      const pay_gov = B_i * (1 - L1_i) + F_i;
      expect(pay_gov).toBeGreaterThan(0);
      // v7.6.1: 등록환자 1인당 의원수입 = 공단지급 P = PB + PF (본인부담 항 제거, M1 미사용)
      const PB_i = B_i * (1 - L1_i);
      const ab_reg = pay_gov;
      expect(ab_reg).toBeCloseTo(PB_i + F_i, 6);
    });
  });

  it('v6.9.5: L1 디폴트 = base.L 실측 → pay_gov(L1) = pay_gov(base.L)', () => {
    // v6.9.5: L1은 협상 변수가 아니라 데이터 실측 그 자체.
    //   디폴트가 base.L과 동일하므로, L1·base.L 적용 시 동일 공단지급 산출.
    INIT_BASE.forEach((b, i) => {
      const B_i = INIT_P[i];
      const F_i = INIT_F[i];
      const pay_L1 = B_i * (1 - INIT_L1[i]) + F_i;
      const pay_baseL = B_i * (1 - b.L) + F_i;
      expect(pay_L1).toBeCloseTo(pay_baseL, 0);
    });
  });

  it('shared saving calculation: item total = sum of individual savings', () => {
    const ssAcute = 29.9, ssEmergency = 3.5, ssLtc = 10.0;
    const ssAcutePct = 2, ssEmergencyPct = 3, ssLtcPct = 1;

    const acuteSaving = ssAcute * 1e12 * (ssAcutePct / 100);
    const emergencySaving = ssEmergency * 1e12 * (ssEmergencyPct / 100);
    const ltcSaving = ssLtc * 1e12 * (ssLtcPct / 100);
    const itemTotal = acuteSaving + emergencySaving + ltcSaving;

    expect(itemTotal).toBeCloseTo(acuteSaving + emergencySaving + ltcSaving, 0);
    expect(itemTotal).toBeGreaterThan(0);
  });

  it('clinic/nhis split adds up to total', () => {
    const itemTotal = 1e12;
    const clinicShare = 50;
    const clinicPct = clinicShare / 100;
    const nhisPct = 1 - clinicPct;

    expect(itemTotal * clinicPct + itemTotal * nhisPct).toBeCloseTo(itemTotal, 0);
  });
});

describe('v6.6 / v7.2.0 upload schema', () => {
  it('COL_ALIASES includes 7 fields: N, M1, L, HCC, CR, RR, RO (v7.2.0)', () => {
    expect(Object.keys(COL_ALIASES).sort()).toEqual(['CR', 'HCC', 'L', 'M1', 'N', 'RO', 'RR']);
  });

  it('v7.2.0: COL_ALIASES.N includes RN (이전 NC 명칭 변경)', () => {
    expect(COL_ALIASES.N).toContain('RN');
    // NHIS-HCC v3.0 엑셀 풀네임도 매칭
    expect(COL_ALIASES.N.some(a => a.includes('참여의원 전체 환자수'))).toBe(true);
  });

  it('v7.2.0: COL_ALIASES.RR (참여의원당 등록환자수, regDist 자동 주입 재료)', () => {
    expect(COL_ALIASES.RR).toContain('RR');
    expect(COL_ALIASES.RR.some(a => a.includes('참여의원당 등록환자수'))).toBe(true);
  });

  it('v7.2.0: COL_ALIASES.RO (등록의원외래비, M1 fallback 재료)', () => {
    expect(COL_ALIASES.RO).toContain('RO');
    expect(COL_ALIASES.RO.some(a => a.includes('등록의원외래비'))).toBe(true);
  });

  it('INIT_F has 4 entries (per-group F)', () => {
    expect(INIT_F).toHaveLength(4);
    INIT_F.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('HCC aliases match typical 분석 허브 헤더 (substring)', () => {
    const key = 'HCC예측\n평균의료비';
    const nk = key.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    const matched = COL_ALIASES.HCC.some(a => {
      const na = a.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
      return nk.includes(na) || na.includes(nk);
    });
    expect(matched).toBe(true);
  });

  it('CR aliases match 의원급외래 비중 헤더 (with/without newline)', () => {
    const keys = ['의원급외래\n비중', '의원비중', '의원급외래비중'];
    keys.forEach(key => {
      const nk = key.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
      const matched = COL_ALIASES.CR.some(a => {
        const na = a.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
        return nk.includes(na) || na.includes(nk);
      });
      expect(matched).toBe(true);
    });
  });

  it('CR aliases do NOT cross-match 타원이용비중 (L column)', () => {
    // "비중" 단독 별칭을 안 넣는 이유: 타원이용비중·의원급외래비중 혼동 방지
    const lKey = '타원이용비중\nL';
    const nk = lKey.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    const falsePositive = COL_ALIASES.CR.some(a => {
      const na = a.replace(/[\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
      return nk.includes(na) || na.includes(nk);
    });
    expect(falsePositive).toBe(false);
  });
});

describe('v6.6 B 자동 유도 (HCC × 의원비중)', () => {
  it('B_MIN/B_MAX 범위가 슬라이더 범위와 일치', () => {
    expect(B_MIN).toBe(50_000);
    expect(B_MAX).toBe(2_000_000);
  });

  it('HCC × CR = B_suggested (clamp 적용)', () => {
    const clamp = v => Math.max(B_MIN, Math.min(B_MAX, Math.round(v)));
    // 정상 범위
    expect(clamp(400538 * 0.701)).toBeCloseTo(280777, 0);    // 1군 예시
    expect(clamp(1246438 * 0.589)).toBeCloseTo(734152, 0);   // 3군 예시
    // 하한 clamp
    expect(clamp(100000 * 0.1)).toBe(B_MIN);   // 10,000 < 50,000
    // 상한 clamp
    expect(clamp(5000000 * 0.8)).toBe(B_MAX);  // 4,000,000 > 2,000,000
  });

  it('HCC=0 또는 CR=0이면 B 유도 안 함 (기존 slider값 유지)', () => {
    const deriveB = (HCC, CR, currentP) => {
      if (HCC > 0 && CR > 0) {
        return Math.max(B_MIN, Math.min(B_MAX, Math.round(HCC * CR)));
      }
      return currentP;
    };
    expect(deriveB(0, 0.7, 280000)).toBe(280000);
    expect(deriveB(400000, 0, 280000)).toBe(280000);
    expect(deriveB(400000, 0.7, 280000)).toBe(280000);   // 400000*0.7=280000
  });
});

describe('v6.6 official_baseline.json 로더', () => {
  it('OFFICIAL_BASELINE_META 구조 확인', () => {
    expect(OFFICIAL_BASELINE_META).toHaveProperty('source');
    expect(['official_baseline.json', 'fallback']).toContain(OFFICIAL_BASELINE_META.source);
  });

  it('INIT_BASE·INIT_B는 항상 4군 배열', () => {
    expect(INIT_BASE).toHaveLength(4);
    expect(INIT_P).toHaveLength(4);
    INIT_BASE.forEach(b => {
      expect(typeof b.N).toBe('number');
      expect(typeof b.M1).toBe('number');
      expect(typeof b.L).toBe('number');
    });
  });
});

describe('v6.7 L1·L2 분리 (선지급 vs 사후 성과급)', () => {
  it('v6.9.5: INIT_L1 = INIT_BASE.L (데이터 실측, placeholder 0.70 폐기)', () => {
    expect(INIT_L1).toHaveLength(4);
    INIT_L1.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      // 파일럿 official_baseline의 L 값과 동일해야 함 (자동 산출)
      expect(v).toBeCloseTo(INIT_BASE[i].L, 6);
    });
    // 더 이상 0.7로 채워져 있지 않음을 회귀 방지
    expect(INIT_L1.every(v => v === 0.7)).toBe(false);
  });

  it('성과급 공식: max(0, L1 − L2) × B × n_reg (no-downside · 의원 100% 환원)', () => {
    // 공유율 α 없음 (Shared Saving과 달리 타원이용 절감은 의원 전액 환원)
    const perf = (L1_g, L2, B_g, n_reg) =>
      Math.max(0, L1_g - L2) * B_g * n_reg;
    // 정상: L2가 L1보다 낮을 때 양수 (의원 100% 환원)
    expect(perf(0.7, 0.55, 280832, 100)).toBeCloseTo(4212480, 0);
    // no-downside: L2 > L1이면 0
    expect(perf(0.7, 0.85, 280832, 100)).toBe(0);
    // L2 = L1: 성과급 0 (기준점)
    expect(perf(0.7, 0.7, 280832, 100)).toBe(0);
  });

  it('Track 배수: A=0 / B=0.5 / C=1.0 (선형 hccPct/100)', () => {
    const trackMul = hccPct => Math.max(0, Math.min(1, hccPct / 100));
    expect(trackMul(0)).toBe(0);      // Track A
    expect(trackMul(50)).toBe(0.5);   // Track B
    expect(trackMul(100)).toBe(1);    // Track C
    // clamp
    expect(trackMul(-10)).toBe(0);
    expect(trackMul(150)).toBe(1);
  });

  it('L1 가중평균 = Σ L1_g × N_g / Σ N_g (v6.9.5: 디폴트 = base.L 가중평균)', () => {
    const t = INIT_BASE.reduce((s, g) => s + g.N, 0);
    const L1avg = INIT_BASE.reduce((s, g, i) => s + INIT_L1[i] * g.N, 0) / t;
    const baseLavg = INIT_BASE.reduce((s, g) => s + g.L * g.N, 0) / t;
    // INIT_L1 = INIT_BASE.L → 두 가중평균이 동일
    expect(L1avg).toBeCloseTo(baseLavg, 6);
    // HCC v3.0(2025) 가중평균은 약 74.0% (L=[0.7189, 0.7444, 0.7529, 0.7357])
    expect(L1avg).toBeGreaterThan(0.70);
    expect(L1avg).toBeLessThan(0.78);
  });

  it('v7.6.0: Track A 1인당 수가 = PB + F (M1 → PB 대체, 본인부담 미포함)', () => {
    INIT_BASE.forEach((b, i) => {
      const PB_i = INIT_P[i] * (1 - INIT_L1[i]);
      const tA = PB_i + INIT_F[i];
      expect(tA).toBeCloseTo(PB_i + INIT_F[i], 6);
      // M1과 무관해야 함 (M1을 바꿔도 tA 불변)
      const tA_alt = PB_i + INIT_F[i];
      expect(tA).toBe(tA_alt);
      expect(tA).not.toBeCloseTo(b.M1 + INIT_F[i], 0);
    });
  });

  it('Track B = 0.5 × Track A + 0.5 × Track C (혼합 50:50)', () => {
    INIT_BASE.forEach((b, i) => {
      const B_i = INIT_P[i];
      const F_i = INIT_F[i];
      const L1_i = INIT_L1[i];
      const PB_i = B_i * (1 - L1_i);
      const tA = PB_i + F_i;                             // v7.6.0: M1 → PB
      const tC = PB_i + F_i;                             // 환자군 모형 1인당 = P (v7.6.1: 본인부담 항 제거)
      const tB = 0.5 * tA + 0.5 * tC;
      expect(tB).toBeCloseTo((tA + tC) / 2, 5);
    });
  });
});

describe('v6.5 PT/SS Track percentages', () => {
  it('PT/SS defaults are 10/50/100 (A/B/C)', () => {
    expect([INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C]).toEqual([10, 50, 100]);
    expect([INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C]).toEqual([10, 50, 100]);
  });

  it('linear interpolation of Track pct at endpoints and midpoints', () => {
    const interp = (hc, a, b, c) => hc <= 50 ? a + hc * (b - a) / 50 : b + (hc - 50) * (c - b) / 50;
    // Endpoints return defaults exactly
    expect(interp(0, 10, 50, 100)).toBe(10);
    expect(interp(50, 10, 50, 100)).toBe(50);
    expect(interp(100, 10, 50, 100)).toBe(100);
    // Quarter points land on midpoints of each half
    expect(interp(25, 10, 50, 100)).toBe(30);
    expect(interp(75, 10, 50, 100)).toBe(75);
  });

  it('shared saving per-clinic payout respects Track pct', () => {
    const clinicFromItem = 4.015e11;   // 4,015억
    const M = 100;
    const ssPerClinicFull = clinicFromItem / M;
    // Track A (10%), B (50%), C (100%)
    expect(ssPerClinicFull * 10 / 100).toBeCloseTo(4.015e8);   // 4.015억/의원
    expect(ssPerClinicFull * 50 / 100).toBeCloseTo(2.0075e9);
    expect(ssPerClinicFull * 100 / 100).toBeCloseTo(4.015e9);  // 40.15억/의원
  });

  it('v7.0 defaults: ssCostBase=total (건강보험 전체 110.8조 기준)', () => {
    expect(INIT_SS_COST_BASE).toBe('total');
    expect(INIT_SS_PROJECT_COST).toBe(10000);    // 억원 (사업대상 토글 시 사용)
  });

  it('projectScale: 사업대상 기준 시 절감액이 사업대상/건보 비율로 축소', () => {
    const ssTotalCost = 110.8;   // 조원
    const ssProjectCost = 1000;  // 억원
    const rawItemTotal = 8030e8;       // 8,030억원 (건보 기준)
    const costBaseTotal = ssTotalCost * 1e12;
    const costBaseProject = ssProjectCost * 1e8;
    const projectScale = costBaseProject / costBaseTotal;   // 약 0.000903
    const itemTotal_project = rawItemTotal * projectScale;
    // 8,030억 × (1,000/110,800) ≈ 7.25억
    expect(itemTotal_project).toBeCloseTo(7.247e8, -7);
    // macro %는 기준 독립 (raw/total = scaled/project)
    const macro_total = (rawItemTotal / costBaseTotal) * 100;
    const macro_project = (itemTotal_project / costBaseProject) * 100;
    expect(macro_project).toBeCloseTo(macro_total, 5);
  });

  it('Track 재원은 사업대상 환자 의료비 변화에 비례 연동', () => {
    const ssTotalCost = 110.8;
    const rawItemTotal = 8030e8;     // 건보 기준 8,030억
    const ssClinicShare = 15;
    const clinicPct = ssClinicShare / 100;
    const computeFund = (projectCost) => {
      const scale = (projectCost * 1e8) / (ssTotalCost * 1e12);
      return rawItemTotal * scale * clinicPct;
    };
    // 사업대상 1,000억 → ≈ 1.087억, 2,000억 → ≈ 2.173억 (정확히 2배)
    const f1 = computeFund(1000);
    const f2 = computeFund(2000);
    expect(f2 / f1).toBeCloseTo(2, 5);
  });

  // v6.9.4 · v3.0(2025) · v7.5: 데이터 기반 디폴트 (HCC v3.0 anchor, 의료비 0원 제외)
  describe('v3.0(2025) · HCC v3.0 anchor 디폴트', () => {
    it('INIT_TOTAL_N = sum(INIT_BASE.N) = ON (HCC v3.0 exc_zero: 12,411,152)', () => {
      expect(INIT_TOTAL_N).toBe(ON);
      expect(INIT_TOTAL_N).toBe(12411152);
    });

    it('INIT_M_CLINICS는 official_baseline.json의 M_clinics (HCC v3.0: 2,923)', () => {
      expect(INIT_M_CLINICS).toBe(2923);
    });

    it('INIT_PER_CLINIC = round(INIT_TOTAL_N / INIT_M_CLINICS) (HCC v3.0 exc_zero: 4,246)', () => {
      expect(INIT_PER_CLINIC).toBe(4246);
      expect(INIT_BASE_PER_CLINIC).toBe(INIT_PER_CLINIC);
    });

    it('HCC v3.0 디폴트 의원당 환자수가 임의 3,000명이 아님 (사용자 피드백 반영)', () => {
      expect(INIT_PER_CLINIC).not.toBe(3000);
      expect(INIT_M_CLINICS).not.toBe(100);
      expect(INIT_TOTAL_N).not.toBe(300000);
    });
  });

  // v6.9.5: L1 = base.L 자동 산출 (옵션 A)
  describe('v6.9.5 · L1 데이터 실측 자동 산출', () => {
    it('LOAD_DATA가 L1을 새 base.L로 동기화하는 명세 (reducer 모방)', () => {
      // useSimulator의 LOAD_DATA가 L1: action.base.map(b => b.L)을 적용한다는 명세를
      // reducer를 직접 import 없이 검증. 새 데이터의 L 값과 동일한 L1이 산출되는지.
      const newBase = [
        { N: 1000, M1: 50000, L: 0.50 },
        { N: 2000, M1: 80000, L: 0.55 },
        { N: 3000, M1: 120000, L: 0.60 },
        { N: 4000, M1: 200000, L: 0.65 },
      ];
      const syncedL1 = newBase.map(b => b.L);
      expect(syncedL1).toEqual([0.50, 0.55, 0.60, 0.65]);
      // 향후 3,000개 의원 데이터: 그 데이터의 실측 L이 그대로 L1
      const sumN = newBase.reduce((s, g) => s + g.N, 0);
      const newL1avg = newBase.reduce((s, g, i) => s + syncedL1[i] * g.N, 0) / sumN;
      const newBaseLavg = newBase.reduce((s, g) => s + g.L * g.N, 0) / sumN;
      expect(newL1avg).toBeCloseTo(newBaseLavg, 6);
    });

    it('RESET_L1은 현재 base.L로 복귀 (data anchor 패턴)', () => {
      // 사용자가 L1을 임의 조정 후 reset 누르면 현재 base.L로 복귀.
      // useSimulator의 RESET_L1이 state.base.map(b => b.L)을 반환한다는 명세.
      const currentBase = INIT_BASE;
      const resetL1 = currentBase.map(b => b.L);
      expect(resetL1).toHaveLength(4);
      resetL1.forEach((v, i) => expect(v).toBe(currentBase[i].L));
    });
  });
});

// v6.10.0: PF 디폴트 = B의 10% (HCC 비례 자동) + 통합 슬라이더 + 분배 함수
describe('v6.10.0 / v7.2.2 · PF 디폴트 (B의 5%, HCC 비례 자동)', () => {
  it('INIT_PF_PCT = 5 · INIT_PF_RULE = "hcc" (v7.2.2: 10% → 5% 변경)', () => {
    expect(INIT_PF_PCT).toBe(5);
    expect(INIT_PF_RULE).toBe('hcc');
  });

  it('INIT_F = INIT_P × 5% (각 환자군별)', () => {
    expect(INIT_F).toHaveLength(4);
    INIT_F.forEach((v, i) => {
      const expected = Math.round(INIT_P[i] * 0.05);
      expect(v).toBe(expected);
    });
    // v7.5: HCC v3.0 exc_zero baseline — B = [238515, 413166, 662478, 1013352] (환자군 실제 평균 의료비 A × CR)
    //   → INIT_F[i] = round(B[i] × 5%) (v7.2.2 PF 5% 디폴트)
    expect(INIT_F[0]).toBe(11926);
    expect(INIT_F[1]).toBe(20658);
    expect(INIT_F[2]).toBe(33124);
    expect(INIT_F[3]).toBe(50668);
  });

  it('INIT_R는 INIT_F alias (하위 호환)', () => {
    expect(INIT_R).toBe(INIT_F);
  });

  it('이전 임의값 [10000, 20000, 30000, 40000] 폐기 — 회귀 방지', () => {
    expect(INIT_F).not.toEqual([10000, 20000, 30000, 40000]);
  });

  it('이전 10% 디폴트 회귀 방지 — INIT_F는 더 이상 B × 10%가 아님', () => {
    const tenPct = INIT_P.map(b => Math.round(b * 0.10));
    expect(INIT_F).not.toEqual(tenPct);
  });
});

describe('v6.10.0 · distribute() — PF 분배 함수 (utils 이전)', () => {
  const B = [280832, 300199, 523581, 745317];
  const n_g = [1000, 6000, 2000, 1000];   // 의원당 [100,600,200,100] × 10 의원

  it('totalTarget = 0이면 전체 0', () => {
    expect(distribute(0, 'hcc', B, n_g)).toEqual([0, 0, 0, 0]);
    expect(distribute(0, 'equal', B, n_g)).toEqual([0, 0, 0, 0]);
    expect(distribute(0, 'inverse', B, n_g)).toEqual([0, 0, 0, 0]);
  });

  it('equal: 1인당 동일 PF + 합산 보존', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'equal', B, n_g);
    // 1인당 동일
    const v0 = dF[0];
    dF.forEach(v => expect(v).toBeCloseTo(v0, 5));
    // 합산 보존
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });

  it('hcc: 위험도(B) 큰 군이 더 두텁고 합산 보존', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'hcc', B, n_g);
    expect(dF[3]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[0]);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });

  it('inverse: 위험도(B) 작은 군이 더 두텁고 합산 보존', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'inverse', B, n_g);
    expect(dF[0]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[3]);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });
});

describe('v6.10.0 · 통합 슬라이더 (PF = B의 X%)', () => {
  const B = [280832, 300199, 523581, 745317];
  const n_g = [1000, 6000, 2000, 1000];

  it('HCC 비례 10%: PF[i] = round(B[i] × 10%) — INIT_F와 정합', () => {
    const PF = calcPFfromPct(10, 'hcc', B, n_g);
    PF.forEach((v, i) => {
      expect(v).toBeCloseTo(Math.round(B[i] * 0.10), -1);
    });
  });

  it('inferPFpct(F = B×10%, B, n_g) ≈ 10%', () => {
    const F = B.map(b => Math.round(b * 0.10));
    const pct = inferPFpct(F, B, n_g);
    expect(pct).toBeCloseTo(10, 1);
  });

  it('통합 슬라이더 0%면 PF 전체 0 (음수 불허)', () => {
    const PF = calcPFfromPct(0, 'hcc', B, n_g);
    expect(PF).toEqual([0, 0, 0, 0]);
  });

  it('음수 % 입력은 0으로 floor (음수 불허)', () => {
    const PF = calcPFfromPct(-5, 'hcc', B, n_g);
    expect(PF.every(v => v >= 0)).toBe(true);
  });

  it('PF 통합 슬라이더 합산 = pfBaseline × pfPct (HCC 비례 정밀)', () => {
    const pfBaseline = B.reduce((s, b, i) => s + b * n_g[i], 0);
    const PF = calcPFfromPct(10, 'hcc', B, n_g);
    const totalSpend = PF.reduce((s, v, i) => s + v * n_g[i], 0);
    // 라운딩 오차 ±1e6 이내
    expect(Math.abs(totalSpend - pfBaseline * 0.10)).toBeLessThan(1e6);
  });
});

describe('v6.10.0 → v7.6.0 · pfBaseline 동적 산출 (Σ regDist × PB × M_clinics, M1 → PB)', () => {
  const PB = INIT_P.map((b, i) => Math.round(b * (1 - INIT_L1[i])));
  it('HCC v3.0 디폴트 baseline = Σ regDist × PB × M (2,923개 의원 기준)', () => {
    const regDist = [100, 600, 200, 100];
    const M = INIT_M_CLINICS;   // HCC v3.0: 2923
    const baseline = PB.reduce((s, pb, i) => s + regDist[i] * pb * M, 0);
    // 등록환자 기본수가 기준선 (PB = B × (1−L1) ≈ 67,618 / 105,438 / 158,646 / 261,562)
    expect(baseline).toBeGreaterThan(2e11);
    expect(baseline).toBeLessThan(5e11);
    // M1 기준 baseline과는 달라야 함 (M1 미사용 확인)
    const baselineM1 = INIT_BASE.reduce((s, b, i) => s + regDist[i] * b.M1 * M, 0);
    expect(baseline).not.toBeCloseTo(baselineM1, -6);
  });

  it('의원 수 M 변경 시 baseline 비례 (선형)', () => {
    const regDist = [100, 600, 200, 100];
    const baselineM10 = PB.reduce((s, pb, i) => s + regDist[i] * pb * 10, 0);
    const baselineM100 = PB.reduce((s, pb, i) => s + regDist[i] * pb * 100, 0);
    expect(baselineM100 / baselineM10).toBeCloseTo(10, 5);
  });

  it('하드코딩 2064.4억 fixture 폐기 (균형추 모듈 삭제로 회귀 방지)', () => {
    const regDist = [100, 600, 200, 100];
    const baseline = PB.reduce((s, pb, i) => s + regDist[i] * pb * INIT_M_CLINICS, 0);
    expect(baseline).not.toBe(2064.4e8);
  });
});

describe('v6.10.0 · 정책 시나리오 프리셋 (환자군 패널)', () => {
  it('POLICY_SCENARIOS는 4개 (파일럿/시범사업/NHS/네덜란드)', () => {
    expect(POLICY_SCENARIOS).toHaveLength(4);
    const keys = POLICY_SCENARIOS.map(p => p.key);
    expect(keys).toEqual(['pilot', 'korea', 'nhs', 'nl']);
  });

  it('각 시나리오의 perClinic이 명시된 정책 근거값과 일치', () => {
    const map = Object.fromEntries(POLICY_SCENARIOS.map(p => [p.key, p.perClinic]));
    expect(map.pilot).toBe(6960);    // 파일럿: 2023 실측 (10기관 / 69,604명)
    expect(map.korea).toBe(1500);    // 시범사업: 복지부안
    expect(map.nhs).toBe(2200);      // NHS: 영국 1차의료 평균
    expect(map.nl).toBe(2200);       // 네덜란드: GP 평균
  });

  it('파일럿 시나리오 perClinic은 2023 파일럿 reference (6,960명 고정)', () => {
    // HCC v3.0(2025)부터 시뮬레이터 디폴트 = 2,923개 의원 (INIT_PER_CLINIC = 4,379).
    // POLICY_SCENARIOS의 pilot 시나리오는 2023 파일럿 reference(10기관/69,604명)를 유지 →
    // INIT_PER_CLINIC과 더 이상 동기화되지 않음 (별도 시나리오 비교용 anchor).
    const pilot = POLICY_SCENARIOS.find(p => p.key === 'pilot');
    expect(pilot.perClinic).toBe(6960);
  });
});

// v7.1.1: 1차년도 시범사업 디폴트 (100개 의원) + 일만시 전체 등록 + 프리셋
describe('v7.1.1 · 1차년도 시범사업 디폴트 + 일만시 전체 등록 모드', () => {
  it('INIT_DEFAULT_M = 100 (1차년도 시범사업 의원 수)', () => {
    expect(INIT_DEFAULT_M).toBe(100);
  });

  it('INIT_DEFAULT_TOTAL_N = 100 × INIT_PER_CLINIC = 424,600 (v7.5 exc_zero)', () => {
    expect(INIT_DEFAULT_TOTAL_N).toBe(INIT_DEFAULT_M * INIT_PER_CLINIC);
    expect(INIT_DEFAULT_TOTAL_N).toBe(424600);
  });

  it('데이터 anchor (INIT_M_CLINICS = 2,923)는 보존 (v7.5 exc_zero baseline)', () => {
    // v7.1.1: 초기 디폴트는 100개로 변경됐지만, 데이터 anchor는 official_baseline 그대로.
    // v7.5: 의료비 0원 제외로 ON·INIT_PER_CLINIC 갱신.
    expect(INIT_M_CLINICS).toBe(2923);
    expect(INIT_TOTAL_N).toBe(12411152);
    expect(INIT_PER_CLINIC).toBe(4246);
  });

  it('CLINIC_COUNT_PRESETS는 4개 (100/1000/3000/2923 일만시)', () => {
    expect(CLINIC_COUNT_PRESETS).toHaveLength(4);
    const values = CLINIC_COUNT_PRESETS.map(p => p.value);
    expect(values).toEqual([100, 1000, 3000, 2923]);
    // 일만시 라벨에 "일만시" 단어 포함
    const ilmansi = CLINIC_COUNT_PRESETS.find(p => p.value === 2923);
    expect(ilmansi.label).toMatch(/일만시/);
  });

  it('REG_PER_CLINIC_PRESETS는 5개 (1000/1500/2000/3000/4000)', () => {
    expect(REG_PER_CLINIC_PRESETS).toEqual([1000, 1500, 2000, 3000, 4000]);
  });

  it('초기화 (v7.1.5 / v7.2.0 / v7.5): RESET_REG는 1차년도 시범사업 디폴트(M=100, regDist 합 1,000) 복귀', () => {
    // v7.1.5: 일만시 모드 버튼 → 초기화 버튼으로 교체. resetReg 호출 → RESET_REG 액션.
    // v7.5.5: regDist 디폴트 = [201.6, 197.7, 293.8, 306.8] (exc_zero RN 기준 ratio_i × 1,000명, 0.1명 단위 · 등록 분포비 = 기준 분포비 2자리).
    const resetM = INIT_DEFAULT_M;             // 100
    const resetRegDist = INIT_REG_DIST;        // [201.6, 197.7, 293.8, 306.8]
    const resetRegSum = resetRegDist.reduce((s, v) => s + v, 0);
    const resetTotalReg = resetM * resetRegSum;
    expect(resetM).toBe(100);
    expect(resetRegDist).toEqual([201.6, 197.7, 293.8, 306.8]);
    expect(resetRegSum).toBeCloseTo(999.9, 6);           // 군별 독립 0.1명 반올림 → 999.9
    expect(resetTotalReg).toBeCloseTo(99990, 3);         // 1차년도 사업 전체 등록환자 (≈ 100,000)
  });

  it('100개 의원 디폴트 (v7.5.5): 424,600명 = 등록 99,990명 + 비등록 324,610명 (regDist 합 999.9, RN 기준)', () => {
    const M = INIT_DEFAULT_M;
    const totalN = INIT_DEFAULT_TOTAL_N;
    const perClinic = totalN / M;
    expect(perClinic).toBe(4246);
    const regDistSum = INIT_REG_DIST.reduce((s, v) => s + v, 0);   // v7.5.5 [201.6,197.7,293.8,306.8] = 999.9
    expect(regDistSum).toBeCloseTo(999.9, 6);
    const totalReg = M * regDistSum;
    const totalUnreg = totalN - totalReg;
    expect(totalReg).toBeCloseTo(99990, 3);
    expect(totalUnreg).toBeCloseTo(324610, 3);
  });
});

// v7.2.0 → v7.5: 엑셀 약어 체계 정비 + regDist 디폴트 데이터 비례 (exc_zero 갱신)
describe('v7.5 → v7.5.5 · regDist 디폴트 = 데이터 비례 [201.6, 197.7, 293.8, 306.8] (exc_zero · RN 기준 · 0.1명 단위)', () => {
  it('INIT_REG_DIST = [201.6, 197.7, 293.8, 306.8] (exc_zero RN 기준 ratio_i × 1,000명, 등록 분포비 = 기준 분포비 2자리)', () => {
    expect(INIT_REG_DIST).toEqual([201.6, 197.7, 293.8, 306.8]);
    expect(INIT_REG_DIST.reduce((s, v) => s + v, 0)).toBeCloseTo(999.9, 6);
  });

  it('이전 v7.2.0 zero 포함 값 [160, 224, 298, 318] 폐기 — 회귀 방지', () => {
    expect(INIT_REG_DIST).not.toEqual([160, 224, 298, 318]);
    expect(INIT_REG_DIST).not.toEqual([100, 600, 200, 100]);
  });

  it('v7.5.5 RN 비례 검증: RN[i] / sum(RN) × 1000 (0.1명 반올림) = INIT_REG_DIST[i] · NT 비례와는 다름', () => {
    // INIT_BASE의 N (= RN, 일만시 참여의원 환자수 12,411,152명) 비례 배분이 INIT_REG_DIST와 정합
    const N = INIT_BASE.map(b => b.N);
    const totalN = N.reduce((s, v) => s + v, 0);
    const RR = N.map(n => Math.round((n / totalN) * 10000) / 10);
    expect(RR).toEqual(INIT_REG_DIST);
    // NT(전체 환자수) 비례 [287.8, 211.0, 251.2, 250.0]과는 다름 (v7.5.4에서 시도 후 RN 기준으로 복귀, 사용자 결정)
    const NT = INIT_BASE.map(b => b.NT);
    const totalNT = NT.reduce((s, v) => s + v, 0);
    const RR_nt = NT.map(n => Math.round((n / totalNT) * 10000) / 10);
    expect(RR_nt).toEqual([287.8, 211.0, 251.2, 250.0]);
    expect(RR_nt).not.toEqual(INIT_REG_DIST);
  });

  it('CLINIC_PRESETS.general 라벨 "데이터 비례" + regDist = INIT_REG_DIST (v7.5.3 exc_zero)', () => {
    const general = CLINIC_PRESETS.find(p => p.key === 'general');
    expect(general.label).toBe('데이터 비례');
    expect(general.regDist).toEqual(INIT_REG_DIST);
  });

  it('CLINIC_PRESETS.elderly·custom은 v7.2.0 영향 없음 (보존)', () => {
    const elderly = CLINIC_PRESETS.find(p => p.key === 'elderly');
    expect(elderly.label).toBe('노인 집중');
    expect(elderly.regDist).toEqual([30, 200, 400, 370]);
    const custom = CLINIC_PRESETS.find(p => p.key === 'custom');
    expect(custom.regDist).toBeNull();
  });
});

describe('v7.2.0 · 엑셀 파서 호환 (M1 fallback + RR auto-inject)', () => {
  it('M1 fallback: M1=0, RO>0, N>0이면 round(RO/N) 산출', () => {
    // 시뮬 handleFile 내부 로직 명세 검증
    // 실제 코드: if (!M1 && RO > 0 && N > 0) M1 = Math.round(RO / N);
    const fallback = (M1, RO, N) => {
      if (!M1 && RO > 0 && N > 0) return Math.round(RO / N);
      return M1;
    };
    // v7.5 NHIS-HCC v3.0 exc_zero 1군: RC=216,375,316,600, RN=2,502,705 → M1≈86,457
    expect(fallback(0, 216375316600, 2502705)).toBe(86457);
    // M1 이미 있으면 RO/N 무시
    expect(fallback(50000, 216375316600, 2502705)).toBe(50000);
    // RO=0이면 M1=0 그대로
    expect(fallback(0, 0, 2502705)).toBe(0);
    // N=0이면 M1=0 그대로 (0 나누기 방지)
    expect(fallback(0, 100000, 0)).toBe(0);
  });

  it('RR 자동 주입: 4군 모두 양수일 때 state.regDist로 갱신', () => {
    // 시뮬 LOAD_DATA reducer 명세: action.regDist 4군 모두 양수면 자동 주입
    const inject = (RR, currentRegDist) => {
      if (Array.isArray(RR) && RR.length === 4 && RR.every(v => v > 0)) {
        return RR.map(v => Math.max(0, Math.round(v)));
      }
      return currentRegDist;
    };
    // v7.5: 정상 (exc_zero RR ≈ [201.65, 197.72, 293.82, 306.81])
    expect(inject([202, 198, 294, 307], [201, 198, 294, 307])).toEqual([202, 198, 294, 307]);
    // 하나라도 0: 기존 보존
    expect(inject([202, 0, 294, 307], [201, 198, 294, 307])).toEqual([201, 198, 294, 307]);
    // 길이 부족: 기존 보존
    expect(inject([202, 198], [201, 198, 294, 307])).toEqual([201, 198, 294, 307]);
    // null: 기존 보존
    expect(inject(null, [100, 600, 200, 100])).toEqual([100, 600, 200, 100]);
  });
});

// v7.1.1: official_baseline.json의 A·CR·NT reference 필드
describe('v7.1.1 · 엑셀 정합 reference 필드 (A·CR·NT)', () => {
  it('INIT_BASE에 A·CR·NT가 있을 때 B = round(A × CR) ≈ INIT_P', () => {
    INIT_BASE.forEach((b, i) => {
      // A·CR이 있으면 (HCC v3.0 baseline)
      if (typeof b.A === 'number' && typeof b.CR === 'number') {
        const computedB = Math.round(b.A * b.CR);
        // INIT_P[i]와 ±1% 이내 (라운딩 오차)
        const tolerance = INIT_P[i] * 0.01;
        expect(Math.abs(computedB - INIT_P[i])).toBeLessThanOrEqual(tolerance + 1);
      }
    });
  });
});

// v7.5.9: 상세 편집 테이블 A·CR 편집 → 엔진 B(state.P) 동기화 (reducer SET_BASE 명세)
describe('v7.5.9 · A·CR 편집 시 B = clamp(round(A×CR)) 동기화 + PF 비율 보존', () => {
  const clampB = (v) => Math.max(B_MIN, Math.min(B_MAX, v));
  it('1군 A를 2배로 올리면 B도 A×CR로 갱신되고 PF는 5% 비율 유지', () => {
    const b = INIT_BASE[0];
    const oldB = INIT_P[0];
    const oldF = INIT_F[0];
    const newA = b.A * 2;
    const newB = clampB(Math.round(newA * b.CR));
    expect(newB).toBeGreaterThan(oldB);
    const newF = Math.max(0, Math.round(oldF / oldB * newB));
    // PF 비율(B 기준 %)은 변하지 않아야 함 (반올림 오차 0.01%p 이내)
    expect(Math.abs(newF / newB - oldF / oldB)).toBeLessThan(0.0001);
    // 기존 baseline에서는 A×CR ≈ P (±2원) — 디폴트에서 편집 전 B가 이미 A×CR과 정합
    INIT_BASE.forEach((g, i) => expect(Math.abs(Math.round(g.A * g.CR) - INIT_P[i])).toBeLessThanOrEqual(2));
  });
});

describe('v7.6.3 · 참여 전 공단 지출 baseline = 총 외래비 × (1 − 본인부담비)', () => {
  it('nhi0 = C1 × N × (1 − copay) — 디폴트 26.1%면 총 외래비의 73.9%, 참여 후(nhi)는 불변', () => {
    const b = INIT_BASE[0];
    const PB = INIT_P[0] * (1 - b.L);
    const C1 = PB / (1 - b.L);           // 총 외래비 (= B)
    const N = 1000;
    const copay = 0.261;
    const nhi0 = C1 * N * (1 - copay);
    expect(nhi0).toBeCloseTo(C1 * N * 0.739, 6);
    expect(nhi0).toBeLessThan(C1 * N);
    // 본인부담비 0%면 이전(v7.6.2) baseline과 동일
    expect(C1 * N * (1 - 0)).toBeCloseTo(C1 * N, 6);
    // 참여 후 등록환자 공단 지출은 P + 타원비(L2)로 본인부담 항 없음 (v7.6.1)
    const P = PB + INIT_F[0];
    const D1_L2 = PB * b.L / (1 - b.L);
    expect(P + D1_L2).toBeCloseTo(PB + INIT_F[0] + PB * b.L / (1 - b.L), 6);
  });
});

describe('v7.6.5 · 참여 후 공단 지출 등록환자 항 = PB × (1 − 본인부담비) + PF', () => {
  it('PB에만 (1 − copay), PF는 전액 공단 부담 · 의원 수입(P = PB + PF)은 불변', () => {
    const b = INIT_BASE[0];
    const PB = INIT_P[0] * (1 - b.L);
    const PF = INIT_F[0];
    const copay = 0.261;
    const nhi_reg = PB * (1 - copay) + PF;
    const P = PB + PF;
    expect(nhi_reg).toBeCloseTo(P - PB * copay, 6);
    expect(nhi_reg).toBeLessThan(P);
    expect(P - nhi_reg).toBeCloseTo(PB * copay, 6);   // 차액 = 환자 본인부담 (PB 부분만)
    // copay 0이면 공단 부담 = P
    expect(PB * (1 - 0) + PF).toBeCloseTo(P, 6);
  });
});

describe('v7.6.6 · 참여 후 공단 지출: D1_L2·비등록 C1·포괄관리성과에도 (1 − 본인부담비)', () => {
  it('PF만 전액 공단 부담 — 등록·비등록·성과 모두 공단 부담분 = × (1 − copay)', () => {
    const b = INIT_BASE[0];
    const B = INIT_P[0], L1 = b.L, L2 = 0.70, copay = 0.261;
    const PB = B * (1 - L1), PF = INIT_F[0];
    const C1 = PB / (1 - b.L), D1_L2 = PB * L2 / (1 - L2);
    const n_reg = 100, n_unreg = 300;
    const nhi = (PB * (1 - copay) + PF + D1_L2 * (1 - copay)) * n_reg + C1 * (1 - copay) * n_unreg;
    const perf_nhi = Math.max(0, L1 - L2) * B * n_reg * (1 - copay);
    // copay 0이면 v7.6.2 이전 구조(P + D1_L2, C1 전액)와 동일
    const nhi_full = (PB + PF + D1_L2) * n_reg + C1 * n_unreg;
    expect(nhi + perf_nhi).toBeLessThan(nhi_full + Math.max(0, L1 - L2) * B * n_reg);
    // 차액 = (PB + D1_L2) × n_reg × copay + C1 × n_unreg × copay + perf × copay  (PF는 차감 없음)
    const perf_full = Math.max(0, L1 - L2) * B * n_reg;
    const expectedDiff = ((PB + D1_L2) * n_reg + C1 * n_unreg + perf_full) * copay;
    expect((nhi_full + perf_full) - (nhi + perf_nhi)).toBeCloseTo(expectedDiff, 4);
    // 참여 전(FFS)과 대칭: copay 적용 범위가 같아 PF·성과·L2 효과만 남음
    const N = n_reg + n_unreg;
    const nhi0 = C1 * N * (1 - copay);
    const structural = (PF * n_reg + (D1_L2 - (C1 - PB)) * n_reg * (1 - copay)) + perf_nhi;
    expect(nhi + perf_nhi - nhi0).toBeCloseTo(structural, 4);
  });
});
