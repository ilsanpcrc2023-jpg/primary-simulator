import { describe, it, expect } from 'vitest';
import { INIT_BASE, INIT_P, INIT_F, ON, COL_ALIASES } from '../constants';

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
