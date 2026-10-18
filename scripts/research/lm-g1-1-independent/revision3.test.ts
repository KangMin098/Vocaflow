// scripts/research/lm-g1-1-independent/revision3.test.ts
// LM-G1 감사 G02 · G03 의 **revision 3**(LM-G1.1 수정 뒤). 원래 관찰(docs/csat-learner/v62/lm-g1/probes.json)은 읽기만 하고 덮어쓰지 않는다.
// 같은 합성 fixture(scripts/research/lm-g1/fixture.ts) · 같은 입력으로 수정 뒤 값을 lm-g1-1-independent/probes-r3.json 에 「before(원본) / after」로 남긴다.
// 합성 기록 · 순수 함수 · DB/학습자 쓰기 없음. 관찰은 제품 수용이 아니다.
import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { view, att } from '../lm-g1/fixture';
import { doneOf, taskPlan } from '@/lib/csat/map/v4/plan';
import { planWorkspaces } from '@/lib/csat/map/v4/workspace';
import { lifecycleEvidence, nextLifecycleAction } from '@/lib/csat/map/lifecycle-evidence';
import { skillMessage, skillDiagnosis } from '@/lib/csat/map/skill-diagnosis';

const id = 'r.central_meaning', key = 'claim-support';
const links = Object.fromEntries([[key, ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map((target) => ({ target, href: '/csat/item/' + target, label: target }))]]);
const at = (n: number) => new Date(Date.UTC(2026, 8, n)).toISOString();
const original = JSON.parse(readFileSync(new URL('../../../docs/csat-learner/v62/lm-g1/probes.json', import.meta.url), 'utf8')) as { observations: { id: string }[] };
const before = (gid: string) => original.observations.find((o) => o.id === gid) ?? null;
const out: unknown[] = [];
const save = () => writeFileSync(new URL('../../../docs/research/lm-g1-1-independent/probes-r3.json', import.meta.url), JSON.stringify({ kind: 'LM-G1 G02/G03 revision 3 — synthetic pure-function observations after LM-G1.1; original lm-g1/probes.json untouched', observations: out }, null, 2) + '\n');

const g02 = (correct: boolean | null) => {
  const v = view([att('i1', false, 10), att('i2', false, 11)], 12);
  const plan = planWorkspaces({ asIs: v.asIs, toBe: v.toBe, confirmLinks: links, transferItems: { [key]: 2 }, transferTargets: { [key]: ['t1', 't2'].map((target) => ({ target, href: '/csat/practice/claim-support?item=' + target, label: target })) } });
  const ws = [plan.primary, ...plan.others].filter(Boolean) as Parameters<typeof taskPlan>[3];
  const activity = ['i1', 'i2'].map((itemRef) => ({ itemRef, taskKey: key, phase: 'practice', isCorrect: false as boolean | null, answeredAt: at(13) }));
  if (correct !== false) activity.push({ itemRef: 'i1', taskKey: key, phase: 'practice', isCorrect: correct, answeredAt: at(14) });
  const p = taskPlan(id, v.asIs, v.toBe, ws, activity);
  const ev = lifecycleEvidence({ verifiedAt: v.asIs.tasks[id].check!.verifiedAt, verifiedItems: ['i1', 'i2'], status: 'verified' }, links[key].map((l) => ({ itemRef: l.target, taskKey: key })), activity);
  return { p, ev, done: doneOf('repair', v.asIs.tasks[id], activity) };
};

it('G02 r2 — 바로잡기 2회 실패: 수행 2 · PLAN 단계 = lifecycle = 바로잡기 · 재시도 링크', () => {
  const { p, ev, done } = g02(false);
  expect(done).toBe(2);
  expect(p.stage).toBe('repair');
  expect(nextLifecycleAction('verified', ev)).toBe('repair');
  expect(p.next?.href).toMatch(/\/csat\/item\/i[12]$/);
  out.push({ id: 'G02', revision: 3, before: before('G02'), after: { repairAttempts: done, planStage: p.stage, planNext: p.next, lifecycleNext: nextLifecycleAction('verified', ev), repairSuccess: ev.repairAt }, verdict: 'FIXED — progress kept as attempts; PLAN no longer advances without a successful repair' });
  save();
});

it('G02 r2 대조 — 정오 없음(null) 재시도는 성공이 아니다 · 정답 재시도 뒤에만 적용 준비', () => {
  const n = g02(null);
  expect(n.p.stage).toBe('repair');
  const ok = g02(true);
  expect(ok.p.stage).toBe('transfer');
  expect(nextLifecycleAction('verified', ok.ev)).toBe('transfer');
  out.push({ id: 'G02-contrast', revision: 3, nullRetry: { planStage: n.p.stage, lifecycleNext: nextLifecycleAction('verified', n.ev) }, correctRetry: { planStage: ok.p.stage, planNext: ok.p.next, lifecycleNext: nextLifecycleAction('verified', ok.ev) } });
  save();
});

it('G03 r2 — 독립 CHECK 로 resolved(판정 불변) · 문구가 바로잡기 · 적용 완주나 지연 확인으로 말하지 않는다', () => {
  const v = view([att('i1', false, 10), att('i2', false, 11), att('i3', true, 11.01), att('i4', true, 11.02)], 12);
  expect(v.asIs.tasks[id].status).toBe('resolved');
  const targets = links[key].map((l) => ({ itemRef: l.target, taskKey: key }));
  const d = skillDiagnosis(targets, [att('i1', false, 10), att('i2', false, 11), att('i3', true, 11.01), att('i4', true, 11.02)], new Date(at(12)));
  const m = skillMessage(d);
  expect(d.status).toBe('resolved');
  expect(m).not.toMatch(/연습하고/);
  out.push({ id: 'G03', revision: 3, before: before('G03'), after: { status: v.asIs.tasks[id].status, recordedRepair: 0, recordedTransfer: 0, message: m }, verdict: 'POLICY KEPT (resolved unchanged); wording no longer claims practice/transfer completion or delayed retention' });
  save();
});
