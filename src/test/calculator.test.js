import { describe, it, expect } from 'vitest';
import { INIT_BASE, INIT_P, INIT_F, ON, COL_ALIASES,
  INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C,
  INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C,
  INIT_SS_COST_BASE, INIT_SS_PROJECT_COST,
  INIT_L1, INIT_ALPHA,
  B_MIN, B_MAX, OFFICIAL_BASELINE_META } from '../constants';

describe('calculation engine', () => {
  it('ON: total patient count from INIT_BASE', () => {
    const total = INIT_BASE.reduce((s, g) => s + g.N, 0);
    expect(total).toBe(ON);
    expect(ON).toBe(69604);
  });

  it('INIT_BASE has 4 patient groups', () => {
    expect(INIT_BASE).toHaveLength(4);
  });

  it('INIT_BASE rows have only N, M1, L (v6.4 simplified)', () => {
    INIT_BASE.forEach(b => {
      expect(Object.keys(b).sort()).toEqual(['L', 'M1', 'N']);
      expect(b).not.toHaveProperty('ref');
      expect(b).not.toHaveProperty('cr');
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
      // 등록환자 1인당 의원수입 = 공단지급 + 본인부담
      const ab_reg = pay_gov + b.M1 * 0.30;
      expect(ab_reg).toBeGreaterThan(pay_gov);
    });
  });

  it('v6.7: L1 lower than baseline L shifts pay_gov higher', () => {
    // 디폴트 L1=0.7 vs 실측 b.L≈0.79 — L1이 낮을수록 공단지급 확대
    INIT_BASE.forEach((b, i) => {
      const B_i = INIT_P[i];
      const F_i = INIT_F[i];
      const pay_L1 = B_i * (1 - INIT_L1[i]) + F_i;    // 0.70 적용
      const pay_baseL = B_i * (1 - b.L) + F_i;         // 0.79 적용
      expect(pay_L1).toBeGreaterThan(pay_baseL);
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

describe('v6.6 upload schema', () => {
  it('COL_ALIASES includes 5 fields: N, M1, L, HCC, CR', () => {
    expect(Object.keys(COL_ALIASES).sort()).toEqual(['CR', 'HCC', 'L', 'M1', 'N']);
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
  it('INIT_L1 기본값 0.7 · 4군 배열', () => {
    expect(INIT_L1).toHaveLength(4);
    INIT_L1.forEach(v => {
      expect(v).toBe(0.7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('INIT_ALPHA 공유율 기본 0.5 (no-downside · 50% 환원)', () => {
    expect(INIT_ALPHA).toBe(0.5);
  });

  it('성과급 공식: max(0, L1 − L2) × B × n_reg × α (no-downside)', () => {
    const perf = (L1_g, L2, B_g, n_reg, alpha) =>
      Math.max(0, L1_g - L2) * B_g * n_reg * alpha;
    // 정상: L2가 L1보다 낮을 때 양수
    expect(perf(0.7, 0.55, 280832, 100, 0.5)).toBeCloseTo(2106240, 0);
    // no-downside: L2 > L1이면 0
    expect(perf(0.7, 0.85, 280832, 100, 0.5)).toBe(0);
    // L2 = L1: 성과급 0 (기준점)
    expect(perf(0.7, 0.7, 280832, 100, 0.5)).toBe(0);
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

  it('L1 가중평균 = Σ L1_g × N_g / Σ N_g', () => {
    const t = INIT_BASE.reduce((s, g) => s + g.N, 0);
    const L1avg = INIT_BASE.reduce((s, g, i) => s + INIT_L1[i] * g.N, 0) / t;
    // 모든 L1이 0.7이면 가중평균도 0.7
    expect(L1avg).toBeCloseTo(0.7, 5);
  });

  it('Track A에서는 L1 미적용 (FFS 1인당 수가 = M1 + F)', () => {
    INIT_BASE.forEach((b, i) => {
      const tA = b.M1 + INIT_F[i];
      expect(tA).toBe(b.M1 + INIT_F[i]);
      // L1과 무관해야 함
      const alt_L1 = 0.3;
      const tA_alt = b.M1 + INIT_F[i];
      expect(tA).toBe(tA_alt);
    });
  });

  it('Track B = 0.5 × Track A + 0.5 × Track C (혼합 50:50)', () => {
    INIT_BASE.forEach((b, i) => {
      const B_i = INIT_P[i];
      const F_i = INIT_F[i];
      const L1_i = INIT_L1[i];
      const tA = b.M1 + F_i;
      const tC = B_i * (1 - L1_i) + F_i + b.M1 * 0.30;   // 환자군 모형 1인당
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

  it('v6.5.5 defaults: 사업대상 환자 의료비 10,000억원', () => {
    expect(INIT_SS_COST_BASE).toBe('project');
    expect(INIT_SS_PROJECT_COST).toBe(10000);    // 억원 (1조원 상당)
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
});
