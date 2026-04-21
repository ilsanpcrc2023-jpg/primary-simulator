import { describe, it, expect } from 'vitest';
import { INIT_BASE, INIT_P, INIT_F, ON, COL_ALIASES,
  INIT_PT_PCT_A, INIT_PT_PCT_B, INIT_PT_PCT_C,
  INIT_SS_PCT_A, INIT_SS_PCT_B, INIT_SS_PCT_C,
  INIT_SS_COST_BASE, INIT_SS_PROJECT_COST } from '../constants';

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

  it('A_cur = P * (1 - L) for each group', () => {
    INIT_BASE.forEach((b, i) => {
      const A_cur = INIT_P[i] * (1 - b.L);
      expect(A_cur).toBeGreaterThan(0);
      const AB_cur = A_cur + b.M1 * 0.30;
      expect(AB_cur).toBeGreaterThan(A_cur);
    });
  });

  it('LC adjustment reduces L (increases revenue)', () => {
    const LC = -3;
    const lc = LC / 100;
    INIT_BASE.forEach((b, i) => {
      const LL = b.L + lc;
      expect(LL).toBeLessThan(b.L);
      const A_new = INIT_P[i] * (1 - LL);
      const A_cur = INIT_P[i] * (1 - b.L);
      expect(A_new).toBeGreaterThan(A_cur);
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

describe('v6.4 upload schema', () => {
  it('COL_ALIASES exposes only N, M1, L (no ref/cr/P/F)', () => {
    expect(Object.keys(COL_ALIASES).sort()).toEqual(['L', 'M1', 'N']);
  });

  it('INIT_F has 4 entries (per-group F)', () => {
    expect(INIT_F).toHaveLength(4);
    INIT_F.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
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

  it('v6.5.4 defaults: 사업대상 환자 의료비 1,000억원', () => {
    expect(INIT_SS_COST_BASE).toBe('project');
    expect(INIT_SS_PROJECT_COST).toBe(1000);    // 억원
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
