import { describe, expect, it } from 'vitest';
import { fmtG, fmtNum } from '../../src/lib/format';

describe('fmtG', () => {
  it('keeps up to 3 decimals without trailing zeros', () => {
    expect(fmtG(0.166)).toBe('0.166');
    expect(fmtG(0.38)).toBe('0.38');
    expect(fmtG(1)).toBe('1');
    expect(fmtG(0)).toBe('0');
    expect(fmtG(0.16600000001)).toBe('0.166');
  });
  it('fmtNum still rounds to one decimal', () => {
    expect(fmtNum(10.1771)).toBe('10.2');
  });
});
