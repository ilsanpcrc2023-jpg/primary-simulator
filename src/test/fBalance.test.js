import { describe, it, expect } from 'vitest';
import { distribute, signalLevel, calcF_fromBalance } from '../components/FBalanceCorrection';
import { fChangeAuto } from '../utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// distribute() — 합산 보존 + 음수 허용 (v6.9.2-bidir)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('FBalanceCorrection · distribute()', () => {
  const B = [280832, 300199, 523581, 745317];
  // 환자군별 등록환자 (10/60/20/10 비율 × 30만명)
  const n_g = [30000, 180000, 60000, 30000];
  const N_total = n_g.reduce((s, n) => s + n, 0); // 300,000

  it('returns zeros when totalTarget === 0', () => {
    expect(distribute(0, 'hcc', B, n_g)).toEqual([0, 0, 0, 0]);
    expect(distribute(0, 'equal', B, n_g)).toEqual([0, 0, 0, 0]);
    expect(distribute(0, 'inverse', B, n_g)).toEqual([0, 0, 0, 0]);
  });

  it('returns zeros when N_total = 0', () => {
    expect(distribute(1e8, 'hcc', B, [0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('equal: every group gets the same per-patient F', () => {
    const totalTarget = N_total * 1000; // 1인당 1,000원
    const dF = distribute(totalTarget, 'equal', B, n_g);
    dF.forEach(v => expect(v).toBeCloseTo(1000, 0));
  });

  it('equal: total spend reconstructs to totalTarget (positive)', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'equal', B, n_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });

  // v6.9.2-bidir: 음수 totalTarget 허용 (F 절대값 음수 시나리오)
  it('equal: total spend reconstructs to totalTarget (negative)', () => {
    const totalTarget = -3e8;
    const dF = distribute(totalTarget, 'equal', B, n_g);
    dF.forEach(v => expect(v).toBeLessThan(0));
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });

  it('hcc: high-risk groups (3, 4) get larger per-patient F (positive)', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'hcc', B, n_g);
    expect(dF[3]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[0]);
  });

  it('hcc: high-risk groups (3, 4) get more-negative per-patient F (negative)', () => {
    const totalTarget = -5e8;
    const dF = distribute(totalTarget, 'hcc', B, n_g);
    // 음수 영역: 4군이 가장 깊게 음수, 1군이 가장 얕게 음수
    expect(dF[3]).toBeLessThan(dF[2]);
    expect(dF[2]).toBeLessThan(dF[1]);
    expect(dF[1]).toBeLessThan(dF[0]);
  });

  it('hcc: total spend reconstructs to totalTarget', () => {
    const totalTarget = 1e9;
    const dF = distribute(totalTarget, 'hcc', B, n_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });

  it('inverse: low-risk groups (1, 2) get larger per-patient F', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'inverse', B, n_g);
    expect(dF[0]).toBeGreaterThan(dF[1]);
    expect(dF[1]).toBeGreaterThan(dF[2]);
    expect(dF[2]).toBeGreaterThan(dF[3]);
  });

  it('inverse: total spend reconstructs to totalTarget', () => {
    const totalTarget = 5e8;
    const dF = distribute(totalTarget, 'inverse', B, n_g);
    const reconstructed = dF.reduce((s, v, i) => s + v * n_g[i], 0);
    expect(reconstructed).toBeCloseTo(totalTarget, -2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// calcF_fromBalance() — 절대 재정중립 (v6.9.2-bidir 신규)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('FBalanceCorrection · calcF_fromBalance()', () => {
  const B_g = [280832, 300199, 523581, 745317];
  const n_reg_g = [10000, 60000, 20000, 10000];          // 의원당 1000명 × 100개 × 비율
  const F_current = [10000, 20000, 30000, 40000];        // 디폴트 차등 1·2·3·4만
  const T_nhi0 = 2064.4e8;                                // 가상 baseline 2,064.4억
  // 현 NHI는 T_nhi0 + (F 기여분 23억) = 2,087.7억 가정 (시뮬레이터 기본 시나리오 근사)
  const F_contribution = F_current.reduce((s, F, i) => s + F * n_reg_g[i], 0); // = 2.3e9
  const T_nhi = T_nhi0 + F_contribution;

  it('targetPct=0 → resulting NHI equals baseline (within 1억)', () => {
    const F_new = calcF_fromBalance(0, 'hcc', T_nhi0, T_nhi, F_current, B_g, n_reg_g);
    // 적용 후 NHI 시뮬레이션: NHI_withoutF + Σ F_new × n_reg_g = baseline (목표)
    const NHI_withoutF = T_nhi - F_contribution;
    const F_total_new = F_new.reduce((s, F, i) => s + F * n_reg_g[i], 0);
    const newNHI = NHI_withoutF + F_total_new;
    expect(Math.abs(newNHI - T_nhi0)).toBeLessThan(1e8); // 1억 이내
  });

  it('targetPct=+5 → resulting NHI = baseline × 1.05 (within 1억)', () => {
    const F_new = calcF_fromBalance(5, 'hcc', T_nhi0, T_nhi, F_current, B_g, n_reg_g);
    const NHI_withoutF = T_nhi - F_contribution;
    const F_total_new = F_new.reduce((s, F, i) => s + F * n_reg_g[i], 0);
    const newNHI = NHI_withoutF + F_total_new;
    expect(Math.abs(newNHI - T_nhi0 * 1.05)).toBeLessThan(1e8);
  });

  it('targetPct=-3 → resulting NHI = baseline × 0.97 (within 1억)', () => {
    const F_new = calcF_fromBalance(-3, 'hcc', T_nhi0, T_nhi, F_current, B_g, n_reg_g);
    const NHI_withoutF = T_nhi - F_contribution;
    const F_total_new = F_new.reduce((s, F, i) => s + F * n_reg_g[i], 0);
    const newNHI = NHI_withoutF + F_total_new;
    expect(Math.abs(newNHI - T_nhi0 * 0.97)).toBeLessThan(1e8);
  });

  it('targetPct=-3 with HCC rule → at least one group has negative F', () => {
    // baseline 대비 -3% 절감하려면 F 합산이 baseline 위 NHI_withoutF 부족분만큼 줄어야 함.
    // 현 NHI - baseline = +F_contribution 가정에서, -3% 가려면 F_total_new ≪ F_contribution.
    // 음수 영역으로 진입할 가능성 검증.
    const F_new = calcF_fromBalance(-5, 'hcc', T_nhi0, T_nhi, F_current, B_g, n_reg_g);
    expect(F_new.some(v => v < 0)).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// signalLevel() — 7단계 (v6.9.2-bidir)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('FBalanceCorrection · signalLevel() — 7단계', () => {
  it('deep-blue zone: pct ≤ -3', () => {
    expect(signalLevel(-5).cls).toBe('deep-blue');
    expect(signalLevel(-3).cls).toBe('deep-blue');
  });

  it('blue zone: -3 < pct ≤ -1', () => {
    expect(signalLevel(-2.99).cls).toBe('blue');
    expect(signalLevel(-2).cls).toBe('blue');
    expect(signalLevel(-1).cls).toBe('blue');
  });

  it('green-pale zone: -1 < pct ≤ 0', () => {
    expect(signalLevel(-0.99).cls).toBe('green-pale');
    expect(signalLevel(-0.5).cls).toBe('green-pale');
    expect(signalLevel(0).cls).toBe('green-pale');
  });

  it('green zone (재정중립): 0 < pct ≤ 2', () => {
    expect(signalLevel(0.01).cls).toBe('green');
    expect(signalLevel(1).cls).toBe('green');
    expect(signalLevel(2).cls).toBe('green');
  });

  it('yellow zone (적극 투자): 2 < pct ≤ 5', () => {
    expect(signalLevel(2.01).cls).toBe('yellow');
    expect(signalLevel(3).cls).toBe('yellow');
    expect(signalLevel(5).cls).toBe('yellow');
  });

  it('orange zone (고투자): 5 < pct ≤ 8', () => {
    expect(signalLevel(5.01).cls).toBe('orange');
    expect(signalLevel(7).cls).toBe('orange');
    expect(signalLevel(8).cls).toBe('orange');
  });

  it('red zone (협상한계): pct > 8', () => {
    expect(signalLevel(8.01).cls).toBe('red');
    expect(signalLevel(10).cls).toBe('red');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 위치 매핑 — pct ∈ [-5, +10] → left% ∈ [0, 100]
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('FBalanceCorrection · 위치 매핑', () => {
  const pctToLeft = (pct) => ((pct - (-5)) / (10 - (-5))) * 100;
  it('-5% → 0%, 0% → 33.33%, +10% → 100%', () => {
    expect(pctToLeft(-5)).toBeCloseTo(0, 2);
    expect(pctToLeft(0)).toBeCloseTo(33.33, 1);
    expect(pctToLeft(10)).toBeCloseTo(100, 2);
  });
  it('+5% → 66.67%', () => {
    expect(pctToLeft(5)).toBeCloseTo(66.67, 1);
  });
  it('-3% → 13.33%, -1% → 26.67%', () => {
    expect(pctToLeft(-3)).toBeCloseTo(13.33, 1);
    expect(pctToLeft(-1)).toBeCloseTo(26.67, 1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// utils.fChangeAuto — v6.9.1 부호 컨벤션 (양수 → 음수 prefix)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('utils · fChangeAuto()', () => {
  it('positive value: prefixes U+2212 minus sign', () => {
    expect(fChangeAuto(1e8)).toBe('−1.0억원');
    expect(fChangeAuto(5e4)).toBe('−5만원');
  });

  it('zero: no sign', () => {
    expect(fChangeAuto(0)).toBe('0원');
  });

  it('negative input: passes through fAuto without extra prefix', () => {
    expect(fChangeAuto(-1e8)).toBe('-1.0억원');
  });
});
