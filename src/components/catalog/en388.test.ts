import { describe, it, expect } from 'vitest';
import { en388Columns } from './en388';

describe('en388Columns', () => {
  it('returns the five EN 388 columns in standard order', () => {
    const cols = en388Columns({ abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' });
    expect(cols.map((c) => c.label)).toEqual(['Abrasion', 'Blade cut', 'Tear', 'Puncture', 'TDM cut']);
    expect(cols.map((c) => c.value)).toEqual(['4', 'X', '4', '3', 'D']);
  });

  it('describes X as not tested', () => {
    const cols = en388Columns({ abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' });
    expect(cols[1].title).toMatch(/not tested/i);
  });

  it('describes a numeric level as a tested result, including level 0', () => {
    const cols = en388Columns({ abrasion: '4', bladeCut: '1', tear: '0', puncture: '1', tdmCut: 'X' });
    expect(cols[2].title).toMatch(/level 0/i);
    expect(cols[2].title).not.toMatch(/not tested/i);
  });
});
