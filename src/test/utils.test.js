import { describe, it, expect } from 'vitest';
import { f, fE, fSv, pct, diffE, calcPB, PBtoB, ratiosFromBase, refRatiosFromBase, regDistFromRatios, roundRegDist } from '../utils';
import { INIT_BASE, INIT_REG_DIST } from '../constants';

describe('format utilities', () => {
  it('f: formats numbers with Korean locale', () => {
    expect(f(1234567)).toBe('1,234,567');
    expect(f(0)).toBe('0');
    expect(f(999)).toBe('999');
  });

  it('fE: converts to 억원 units', () => {
    expect(fE(1e8)).toBe('1.0');
    expect(fE(5.5e8)).toBe('5.5');
    expect(fE(0)).toBe('0.0');
  });

  it('fSv: smart format for large amounts', () => {
    expect(fSv(1.5e12)).toBe('1.50조');
    expect(fSv(5e8)).toBe('5억');
    expect(fSv(0)).toBe('0억');
  });

  it('pct: percentage with sign', () => {
    expect(pct(0.1234)).toBe('+12.3%');
    expect(pct(-0.05)).toBe('-5.0%');
    expect(pct(0)).toBe('+0.0%');
    expect(pct(0.1, 2)).toBe('+10.00%');
  });

  it('diffE: difference in 억원', () => {
    expect(diffE(1e8, 2e8)).toBe('+1.0억');
    expect(diffE(2e8, 1e8)).toBe('-1.0억');
  });
});

// v6.9.3: PB·PF 명칭 체계
describe('v6.9.3 PB·PF helpers', () => {
  it('calcPB: PB = B × (1 − L1) for each group', () => {
    const B_g = [280832, 300199, 523581, 745317];
    const L1_g = [0.7, 0.7, 0.7, 0.7];
    const PB = calcPB(B_g, L1_g);
    expect(PB).toEqual([
      Math.round(280832 * 0.3),
      Math.round(300199 * 0.3),
      Math.round(523581 * 0.3),
      Math.round(745317 * 0.3),
    ]);
    // 핵심 디폴트 시나리오 값 검증 (정책 모드 첫 화면 표시값)
    expect(PB[0]).toBe(84250);
    expect(PB[3]).toBe(223595);
  });

  it('calcPB: respects per-group L1 (non-uniform)', () => {
    const B_g = [100000, 200000, 300000, 400000];
    const L1_g = [0.5, 0.6, 0.7, 0.8];
    const PB = calcPB(B_g, L1_g);
    expect(PB).toEqual([50000, 80000, 90000, 80000]);
  });

  it('calcPB: falls back to L1=0.7 when group L1 missing', () => {
    expect(calcPB([100000], [])).toEqual([30000]);
    expect(calcPB([100000], undefined)).toEqual([30000]);
    expect(calcPB([100000], [null])).toEqual([30000]);
  });

  it('PBtoB: round-trip with calcPB (within 1 won)', () => {
    const B = 280832;
    const L1 = 0.7;
    const PB = Math.round(B * (1 - L1));
    const B_back = PBtoB(PB, L1);
    expect(Math.abs(B_back - B)).toBeLessThanOrEqual(2); // 반올림 오차 허용
    // 사용자 시나리오: PB 90,000 입력 → B = 300,000
    expect(PBtoB(90000, 0.7)).toBe(300000);
  });
});

// v7.5.1: 상세 편집 테이블 분포비 2종 — 기준(ratio_i) vs 등록(regDist/Σ)
describe('v7.5.1 ratiosFromBase / regDistFromRatios', () => {
  it('ratiosFromBase: ratio_i = N_i / ΣN, 합 1', () => {
    const base = [{ N: 100 }, { N: 300 }, { N: 400 }, { N: 200 }];
    const r = ratiosFromBase(base);
    expect(r).toEqual([0.1, 0.3, 0.4, 0.2]);
    expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
  });

  it('ratiosFromBase: ΣN=0이면 균등 fallback', () => {
    expect(ratiosFromBase([{ N: 0 }, { N: 0 }])).toEqual([0.5, 0.5]);
  });

  it('regDistFromRatios: ratio × total을 0.1명 단위로 반올림 (등록 분포비 % 소수 2자리와 1:1)', () => {
    const out = regDistFromRatios([0.2016, 0.1977, 0.2938, 0.3069], 1000);
    expect(out).toEqual([201.6, 197.7, 293.8, 306.9]);
    expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(1000, 6);
    // 군별 독립 반올림이라 합은 ±0.2명 이내에서 1,000과 어긋날 수 있음 (2자리 동일성이 우선)
    const out2 = regDistFromRatios([0.20165, 0.19772, 0.29382, 0.30681], 1000);
    expect(Math.abs(out2.reduce((s, v) => s + v, 0) - 1000)).toBeLessThan(0.3);
  });

  it('v7.5.5: refRatiosFromBase = RN 기준 (N_i / ΣN) — NT는 참고 표시일 뿐 기준 분포비에 쓰이지 않음', () => {
    const rn = refRatiosFromBase(INIT_BASE);
    const sumN = INIT_BASE.reduce((s, g) => s + g.N, 0);
    expect(sumN).toBe(12411152);
    rn.forEach((r, i) => expect(r).toBeCloseTo(INIT_BASE[i].N / sumN, 12));
    expect(rn.map(r => (r * 100).toFixed(2))).toEqual(['20.16', '19.77', '29.38', '30.68']);
    expect(refRatiosFromBase(INIT_BASE)).toEqual(ratiosFromBase(INIT_BASE, 'N'));
    // NT 기준(v7.5.4)과는 다름
    expect(ratiosFromBase(INIT_BASE, 'NT').map(r => (r * 100).toFixed(2))).toEqual(['28.78', '21.10', '25.12', '25.00']);
  });

  it('regDistFromRatios: INIT_BASE(v7.5 exc_zero) RN 기준에 적용하면 INIT_REG_DIST와 일치 (등록 분포비 디폴트 = 기준 분포비)', () => {
    const ratios = refRatiosFromBase(INIT_BASE);
    expect(regDistFromRatios(ratios, 1000)).toEqual(INIT_REG_DIST);
    expect(INIT_REG_DIST).toEqual([201.6, 197.7, 293.8, 306.8]);
  });

  it('v7.5.3/v7.5.5: 디폴트 등록 분포비(%)는 기준 분포비(%, RN 기준)와 소수점 2자리까지 동일', () => {
    const ratios = refRatiosFromBase(INIT_BASE);
    INIT_REG_DIST.forEach((rr, i) => {
      expect((rr / 10).toFixed(2)).toBe((ratios[i] * 100).toFixed(2));
    });
    // exc_zero RN 기준값: 20.16 / 19.77 / 29.38 / 30.68 % (사용자 제시값과 일치)
    expect(INIT_REG_DIST.map(rr => (rr / 10).toFixed(2))).toEqual(['20.16', '19.77', '29.38', '30.68']);
  });

  it('regDistFromRatios: total 스케일(1,500명)에서도 0.1 단위·근사 합 보존', () => {
    const out = regDistFromRatios(refRatiosFromBase(INIT_BASE), 1500);
    expect(Math.abs(out.reduce((s, v) => s + v, 0) - 1500)).toBeLessThan(0.3);
    out.forEach(v => expect(Math.round(v * 10) / 10).toBe(v));
  });

  it('roundRegDist: 0 floor + 0.1명 반올림', () => {
    expect(roundRegDist(201.65)).toBe(201.7);
    expect(roundRegDist(-3)).toBe(0);
    expect(roundRegDist('12.34')).toBe(12.3);
    expect(roundRegDist(undefined)).toBe(0);
  });
});
