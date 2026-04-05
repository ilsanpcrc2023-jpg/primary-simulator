import { describe, it, expect } from 'vitest';
import { f, fE, fSv, pct, diffE } from '../utils';

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
