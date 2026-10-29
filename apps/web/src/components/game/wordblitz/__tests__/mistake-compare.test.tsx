// apps/web/src/components/game/wordblitz/__tests__/mistake-compare.test.tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Word } from '@/components/game/_shared/gamekit';

import { MistakeCompare, addMiss, type MissEntry } from '../WordBlitzMistakes';

const w = (en: string, ko: string, example?: string): Word => ({ en, ko, ...(example ? { example } : {}) });
const reveal = w('reveal', '드러내다', 'The letter may reveal who sent the warning.');
const hide = w('hide', '숨기다');

describe('addMiss', () => {
  it('처음 놓친 순간을 보존하고 횟수만 센다(en 기준 중복 제거)', () => {
    let s: MissEntry[] = [];
    s = addMiss(s, { target: reveal, chosen: hide, form: 'ko', prompt: '드러내다' });
    s = addMiss(s, { target: reveal, chosen: null, form: 'context', prompt: 'The letter may _____ who.' });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ chosen: hide, form: 'ko', prompt: '드러내다', times: 2 });
  });

  it('놓친 순서를 유지하고 입력 배열을 바꾸지 않는다', () => {
    const a: MissEntry[] = [];
    const b = addMiss(a, { target: reveal, chosen: hide, form: 'ko', prompt: 'x' });
    const c = addMiss(b, { target: hide, chosen: null, form: 'en', prompt: 'hide' });
    expect(a).toHaveLength(0);
    expect(c.map((m) => m.target.en)).toEqual(['reveal', 'hide']);
  });
});

describe('MistakeCompare', () => {
  it('8개를 넘어도 놓친 단어를 전부 고를 수 있게 보여 준다', () => {
    let s: MissEntry[] = [];
    for (let i = 0; i < 11; i++) s = addMiss(s, { target: w(`word${i}`, `뜻${i}`), chosen: null, form: 'ko', prompt: `뜻${i}` });
    const html = renderToStaticMarkup(<MistakeCompare misses={s} />);
    expect(html).toContain('놓친 단어 11개');
    expect(html.match(/class="wbz-mx-item"/g)).toHaveLength(11);
    expect(html).toContain('word10');
  });

  it('처음엔 대조를 펼치지 않는다(고르기 전에는 상세 없음)', () => {
    const s = addMiss([], { target: reveal, chosen: hide, form: 'ko', prompt: '드러내다' });
    const html = renderToStaticMarkup(<MistakeCompare misses={s} />);
    expect(html).not.toContain('class="wbz-mx-detail"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('놓친 단어가 없으면 아무것도 그리지 않는다', () => {
    expect(renderToStaticMarkup(<MistakeCompare misses={[]} />)).toBe('');
  });

  it('원문이라 부르지 않는다', () => {
    const s = addMiss([], { target: reveal, chosen: hide, form: 'ko', prompt: '드러내다' });
    expect(renderToStaticMarkup(<MistakeCompare misses={s} />)).not.toContain('원문');
  });
});

describe('대조 닫기 → 그 단어 버튼으로 초점 복귀(T-0257 · 배선)', () => {
  const src = readFileSync(join(__dirname, '../WordBlitzMistakes.tsx'), 'utf8');
  it('닫기만 복귀 대상을 정하고, 상세가 사라진 커밋에서 한 번 옮긴 뒤 비운다', () => {
    expect(src).toMatch(/returnTo\.current = cur\.target\.en;\n\s+setOpen\(null\);/);
    expect(src).toContain('const key = returnTo.current;\n    returnTo.current = null;\n    itemRefs.current.get(key)?.focus();');
    expect(src).toContain('useLayoutEffect(() => {\n    if (open !== null || returnTo.current === null) return;');
    expect((src.match(/returnTo\.current = /g) ?? []).length).toBe(2);
  });
  it('버튼은 단어(en)로 찾는다 — 부모 재렌더에도 같은 단어, 빠지면 지운다', () => {
    expect(src).toContain('if (el) itemRefs.current.set(m.target.en, el);');
    expect(src).toContain('else itemRefs.current.delete(m.target.en);');
  });
  it('첫 화면은 그대로다(초점 이동 속성 · 새 콜백 없음)', () => {
    const html = renderToStaticMarkup(<MistakeCompare misses={addMiss([], { target: reveal, chosen: hide, form: 'ko', prompt: '드러내다' })} />);
    expect(html).toContain('wbz-mx-item');
    expect(html).not.toContain('autofocus');
  });
});
