import { describe, it, expect } from 'vitest';
import { distribute, signalLevel } from '../components/FBalanceCorrection';
import { fChangeAuto } from '../utils';

describe('FBalanceCorrection · distribute()', () => {
  const B = [280832, 300199, 523581, 745317];
  // 환자군별 등록환자 (10/60/20/10 비율 × 30만명 = 30k/180k/60k/30k)
  const n_total_g = [30000, 180000, 60000, 30000];
  const N_total = n_total_g.reduce((s, n) => s + n, 0); // 300,000

  it('returns zeros when deltaTotal <= 0', () => {
    expect(distribute(0, 'hcc', B, n_total_g)).toEqual([0, 0, 0, 0]);
    expect(distribute(-100, 'equal', B, n_total_g)).toEqual([0, 0, 0, 0]);
  });

  it('returns zeros when N_total = 0', () => {
    expect(distribute(1e8, 'hcc', B, [0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('equal: every group gets the same per-patient ΔF', () => {
    const deltaTotal = N_total * 1000; // 1인당 1,000원 추가
    const dF = distribute(deltaTotal, 'equal', B, n_total_g);
    dF.forEach(v => expect(v).toBeCloseTo(1000, 0));
  });

  it('equal: total spend reconstructs to deltaTotal', () => {
    const deltaTotal = 5e8;
    const dF = distribute(deltaTotal, 'equal', B, n_total_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_total_g[i], 0);
    expect(reconstructed).toBeCloseTo(deltaTotal, -2);
  });

  it('hcc: high-risk groups (3, 4) get larger per-patient ΔF', () => {
    const deltaTotal = 5e8;
    const dF = distribute(deltaTotal, 'hcc', B, n_total_g);
    expect(dF[3]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[0]);
  });

  it('hcc: total spend reconstructs to deltaTotal', () => {
    const deltaTotal = 1e9;
    const dF = distribute(deltaTotal, 'hcc', B, n_total_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_total_g[i], 0);
    expect(reconstructed).toBeCloseTo(deltaTotal, -2);
  });

  it('inverse: low-risk groups (1, 2) get larger per-patient ΔF', () => {
    const deltaTotal = 5e8;
    const dF = distribute(deltaTotal, 'inverse', B, n_total_g);
    expect(dF[0]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[3]);
  });

  it('inverse: total spend reconstructs to deltaTotal', () => {
    const deltaTotal = 5e8;
    const dF = distribute(deltaTotal, 'inverse', B, n_total_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_total_g[i], 0);
    expect(reconstructed).toBeCloseTo(deltaTotal, -2);
  });
});

describe('FBalanceCorrection · signalLevel()', () => {
  it('green zone: 0% ~ 2%', () => {
    expect(signalLevel(0).cls).toBe('green');
    expect(signalLevel(1).cls).toBe('green');
    expect(signalLevel(2).cls).toBe('green');
  });

  it('yellow zone: just above 2% to 5%', () => {
    expect(signalLevel(2.01).cls).toBe('yellow');
    expect(signalLevel(3).cls).toBe('yellow');
    expect(signalLevel(5).cls).toBe('yellow');
  });

  it('orange zone: just above 5% to 8%', () => {
    expect(signalLevel(5.01).cls).toBe('orange');
    expect(signalLevel(7).cls).toBe('orange');
    expect(signalLevel(8).cls).toBe('orange');
  });

  it('red zone: above 8%', () => {
    expect(signalLevel(8.01).cls).toBe('red');
    expect(signalLevel(10).cls).toBe('red');
  });
});

describe('utils · fChangeAuto()', () => {
  it('positive value: prefixes U+2212 minus sign', () => {
    expect(fChangeAuto(1e8)).toBe('−1.0억원');
    expect(fChangeAuto(5e4)).toBe('−5만원');
  });

  it('zero: no sign', () => {
    expect(fChangeAuto(0)).toBe('0원');
  });

  it('negative input: passes through fAuto without extra prefix', () => {
    // 음수 입력은 모형 범위 밖이지만 안전하게 fAuto 결과 그대로
    expect(fChangeAuto(-1e8)).toBe('-1.0억원');
  });
});
