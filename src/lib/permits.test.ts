import { describe, expect, it } from 'vitest';
import { expandPermitPattern } from './permits';

describe('expandPermitPattern', () => {
  it('expands Mondays and Wednesdays across the range with each time', () => {
    // 2026-04-27 is a Monday
    const occ = expandPermitPattern(['Mon', 'Wed'], ['17:30', '19:30'], '2026-04-27', '2026-05-10');
    // Mondays: 4/27, 5/4; Wednesdays: 4/29, 5/6 -> 4 dates x 2 times
    expect(occ).toHaveLength(8);
    expect(occ[0]).toEqual({ date: '2026-04-27', time: '17:30' });
    expect(occ.every((o) => ['2026-04-27', '2026-04-29', '2026-05-04', '2026-05-06'].includes(o.date))).toBe(true);
  });

  it('returns nothing when no day matches', () => {
    expect(expandPermitPattern(['Sun'], ['10:00'], '2026-04-27', '2026-05-01')).toHaveLength(0);
  });
});
