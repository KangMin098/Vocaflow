// apps/web/src/lib/csat/listening/__tests__/pedagogy.test.ts
import { describe, expect, it } from 'vitest';
import { LISTENING_PEDAGOGY, LISTENING_TYPE_IDS } from '../pedagogy';

describe('listening pedagogy', () => {
  it('has exactly 18 types matching the id list', () => {
    expect(LISTENING_TYPE_IDS).toHaveLength(18);
    expect(Object.keys(LISTENING_PEDAGOGY).sort()).toEqual([...LISTENING_TYPE_IDS].sort());
  });

  it('every entry is grounded and non-empty', () => {
    for (const id of LISTENING_TYPE_IDS) {
      const p = LISTENING_PEDAGOGY[id];
      expect(p.skill.length, id).toBeGreaterThan(0);
      expect(p.judgmentKinds.length, id).toBeGreaterThan(0);
      expect(p.distractorPatterns.length, id).toBeGreaterThan(0);
      expect(p.refs.length, id).toBeGreaterThan(0);
      expect(p.interaction.learnerAction.length, id).toBeGreaterThan(0);
    }
  });

  it('interaction modes are not one uniform checklist', () => {
    const modes = new Set(LISTENING_TYPE_IDS.map((id) => LISTENING_PEDAGOGY[id].interaction.mode));
    expect(modes.size).toBeGreaterThanOrEqual(12);
  });
});
