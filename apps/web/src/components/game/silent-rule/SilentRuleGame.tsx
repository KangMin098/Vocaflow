// apps/web/src/components/game/silent-rule/SilentRuleGame.tsx
// The Silent Rule — 철자 규칙 귀납 (The Witness 계열). 설명이 없다. 각 패널에서 '규칙을 지키는
// 칸'만 활성화하라. 오답들은 모두 같은 규칙을 어기게 설계돼, 여러 패널을 풀며 규칙을 스스로
// 귀납한다. 클러스터를 마치면 규칙과 교정이 드러난다(발견 학습 = 가장 깊은 정착).

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, GameMark, Hud, GameDone, ParticleBurst, useSfx, shuffle, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

interface Tile { text: string; valid: boolean; fix?: string; ko?: string }
interface Cluster { rule: string; hint: string; panels: Tile[][] }

const T = (text: string, ko?: string): Tile => ({ text, valid: true, ko });
const X = (text: string, fix: string): Tile => ({ text, valid: false, fix });

const CLUSTERS: Cluster[] = [
  {
    rule: 'i before e, except after c', hint: '기본은 ie · c 뒤에서만 ei',
    panels: [
      [T('believe', '믿다'), T('achieve', '이루다'), T('field', '들판'), X('recieve', 'receive'), X('decieve', 'deceive')],
      [T('chief', '우두머리'), T('receipt', '영수증'), T('niece', '조카'), X('freind', 'friend'), X('percieve', 'perceive')],
    ],
  },
  {
    rule: '어미 -e 탈락 후 -ing', hint: '자음+e로 끝나면 e를 빼고 -ing',
    panels: [
      [T('making'), T('writing'), T('coming'), X('hopeing', 'hoping'), X('useing', 'using')],
      [T('riding'), T('taking'), T('smiling'), X('careing', 'caring'), X('moveing', 'moving')],
    ],
  },
  {
    rule: '단모음+단자음 → 자음 중복 후 -ing', hint: '짧은 모음 뒤 자음 하나면 그 자음을 겹친다',
    panels: [
      [T('running'), T('planning'), T('stopping'), X('siting', 'sitting'), X('geting', 'getting')],
      [T('swimming'), T('shopping'), T('winning'), X('begining', 'beginning'), X('runing', 'running')],
    ],
  },
];

export function SilentRuleGame({ onExit, onCorrect }: Props) {
  const sfx = useSfx();
  const [ci, setCi] = useState(0);
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'panel' | 'reveal' | 'done'>('panel');
  const [msg, setMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [glow, setGlow] = useState(false);
  const [solvedPanels, setSolvedPanels] = useState(0);
  const [misses, setMisses] = useState(0);
  const mounted = useRef(true);
  const lock = useRef(false);

  const cluster = CLUSTERS[ci];
  const panel = useMemo(() => shuffle(cluster.panels[pi]), [ci, pi, cluster.panels]);
  const validSet = useMemo(() => new Set(cluster.panels[pi].filter((t) => t.valid).map((t) => t.text)), [ci, pi, cluster.panels]);
  const totalPanels = useMemo(() => CLUSTERS.reduce((n, c) => n + c.panels.length, 0), []);

  const toggle = useCallback((text: string) => {
    if (lock.current) return;
    setMsg('');
    setSel((s) => { const n = new Set(s); if (n.has(text)) n.delete(text); else n.add(text); return n; });
    sfx.click();
  }, [sfx]);

  const check = useCallback(() => {
    if (lock.current) return;
    // 대칭차 = 어긋난 칸 수 (어디인지는 밝히지 않음 → 귀납 보존)
    let diff = 0;
    validSet.forEach((t) => { if (!sel.has(t)) diff++; });
    sel.forEach((t) => { if (!validSet.has(t)) diff++; });
    if (diff === 0) {
      lock.current = true; setGlow(true);
      cluster.panels[pi].filter((t) => t.valid).forEach((t) => onCorrect?.({ en: t.text, ko: t.ko ?? '' }));
      setSolvedPanels((n) => n + 1);
      sfx.correct(pi + 1, true);
      setTimeout(() => {
        if (!mounted.current) return;
        setGlow(false); lock.current = false; setSel(new Set());
        if (pi + 1 < cluster.panels.length) { setPi((p) => p + 1); }
        else { setPhase('reveal'); sfx.fanfare(); }
      }, 720);
    } else {
      setMisses((m) => m + 1); setMsg(`${diff}칸이 규칙에 어긋난다`); setShake(true); sfx.wrong();
      setTimeout(() => mounted.current && setShake(false), 420);
    }
  }, [validSet, sel, cluster.panels, pi, onCorrect, sfx]);

  const nextCluster = useCallback(() => {
    if (ci + 1 < CLUSTERS.length) { setCi((c) => c + 1); setPi(0); setSel(new Set()); setPhase('panel'); setMsg(''); }
    else { setPhase('done'); sfx.fanfare(); }
  }, [ci, sfx]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);
  const fixes = useMemo(() => cluster.panels.flat().filter((t) => !t.valid), [cluster]);

  if (phase === 'done') {
    return (
      <div className="gk-root sr-root">
        <GameKitStyles />
        <AmbientBackground center="#EAF3EE" mid="#AAC9BE" edge="#173F3B" glow="rgba(120,230,180,.3)" glowAt="50% 30%" watermark="silent-rule" />
        <style dangerouslySetInnerHTML={{ __html: SR_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="silent-rule"
          lead="규칙이 보이기 시작했다"
          stats={[
            { num: solvedPanels, label: '밝힌 패널', accent: true },
            { num: CLUSTERS.length, label: '귀납한 규칙' },
            { num: `${Math.round((solvedPanels / (solvedPanels + misses || 1)) * 100)}%`, label: '통찰 효율' },
          ]}
          restartLabel="다시 귀납"
          onRestart={() => { setCi(0); setPi(0); setSel(new Set()); setPhase('panel'); setMsg(''); setSolvedPanels(0); setMisses(0); lock.current = false; }}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root sr-root">
      <GameKitStyles />
      <AmbientBackground center="#EAF3EE" mid="#AAC9BE" edge="#173F3B" glow="rgba(120,230,180,.28)" glowAt="50% 22%" watermark="silent-rule" />
      <style dangerouslySetInnerHTML={{ __html: SR_CSS }} />
      <Hud
        progress={(solvedPanels) / totalPanels}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="sr-hud"><span className="gk-stat-label">패널</span><span className="sr-hud-v">{ci * 2 + pi + 1}/{totalPanels}</span></div>}
      />

      {phase === 'reveal' ? (
        <main className="gk-stage sr-reveal">
          <div className="sr-reveal-mark" aria-hidden="true"><GameMark id="silent-rule" /><ParticleBurst intensity={3} /></div>
          <p className="sr-reveal-lead">규칙을 찾았다</p>
          <h2 className="sr-rule">{cluster.rule}</h2>
          <p className="sr-hint">{cluster.hint}</p>
          <div className="sr-fixes">
            {fixes.map((f) => <span key={f.text} className="sr-fix"><s>{f.text}</s> → <b>{f.fix}</b></span>)}
          </div>
          <button type="button" className="gk-btn gk-btn--primary sr-next" onClick={nextCluster}>{ci + 1 < CLUSTERS.length ? '다음 규칙 →' : '세계를 읽어내다'}</button>
        </main>
      ) : (
        <main className="gk-stage sr-stage">
          <p className="sr-instr" aria-hidden="true">규칙을 <b>지키는 칸만</b> 밝혀라. <span className="sr-instr-dim">규칙은 말해주지 않는다.</span></p>
          <div className={`sr-grid ${shake ? 'sr-grid--shake' : ''} ${glow ? 'sr-grid--glow' : ''}`}>
            {panel.map((t) => {
              const on = sel.has(t.text);
              return (
                <button key={t.text} type="button" className={`sr-panel ${on ? 'sr-panel--on' : ''}`} onClick={() => toggle(t.text)} aria-pressed={on}>
                  <span className="sr-panel-node" aria-hidden="true" />
                  <span className="sr-panel-word">{t.text}</span>
                </button>
              );
            })}
          </div>
          <div className="sr-actions">
            <span className={`sr-msg ${msg ? '' : 'sr-msg--hide'}`}>{msg || ' '}</span>
            <button type="button" className="gk-btn gk-btn--primary sr-check" onClick={check} disabled={sel.size === 0}>활성화</button>
          </div>
        </main>
      )}
    </div>
  );
}

const SR_CSS = `
  .sr-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .sr-hud-v { font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; color: var(--t1); }
  .sr-stage { gap: clamp(18px, 4vh, 40px); }
  .sr-instr { margin: 0; font-size: 14px; color: var(--t2); text-align: center; }
  .sr-instr b { color: var(--t1); }
  .sr-instr-dim { color: var(--t3); font-style: italic; }

  .sr-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: clamp(8px, 1.6vw, 14px); width: min(720px, 96vw); }
  @media (max-width: 620px) { .sr-grid { grid-template-columns: repeat(2, 1fr); max-width: 360px; } }
  .sr-grid--shake { animation: gk-shake .42s ease-in-out; }
  .sr-grid--glow .sr-panel--on { border-color: var(--success); box-shadow: 0 0 0 2px var(--success), 0 0 26px -2px color-mix(in srgb, var(--success) 55%, transparent); }
  .sr-panel { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; aspect-ratio: 3 / 3.4; padding: 10px; border-radius: 14px; border: 2px solid var(--bd); background: color-mix(in srgb, var(--bg) 80%, #fff); cursor: pointer; transition: transform .12s var(--ease, ease-out), border-color .18s, box-shadow .18s, background .18s; }
  .sr-panel-node { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--t3); background: transparent; transition: background .18s, border-color .18s, box-shadow .18s; }
  .sr-panel-word { font-family: var(--font-english, system-ui); font-size: clamp(13px, 2.6vw, 17px); font-weight: 700; color: var(--t1); word-break: break-all; text-align: center; }
  .sr-panel:hover { transform: translateY(-3px); border-color: var(--success); }
  .sr-panel:focus-visible { outline: none; border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 28%, transparent); }
  .sr-panel--on { border-color: var(--success); background: color-mix(in srgb, var(--success) 10%, var(--bg)); box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--success) 40%, transparent); }
  .sr-panel--on .sr-panel-node { background: var(--success); border-color: var(--success); box-shadow: 0 0 12px 1px color-mix(in srgb, var(--success) 70%, transparent); }

  .sr-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .sr-msg { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; font-weight: 700; color: var(--warning); min-height: 20px; }
  .sr-msg--hide { visibility: hidden; }
  .sr-check { min-width: 150px; }

  .sr-reveal { gap: 14px; text-align: center; }
  .sr-reveal-mark { position: relative; width: 60px; height: 60px; color: var(--success); display: grid; place-items: center; }
  .sr-reveal-mark svg { width: 44px; height: 44px; }
  .sr-reveal-lead { margin: 0; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 16px; color: var(--t2); }
  .sr-rule { margin: 0; font-family: var(--font-english, system-ui); font-size: clamp(20px, 4vw, 28px); font-weight: 800; color: var(--t1); }
  .sr-hint { margin: 0; font-size: 14px; color: var(--t2); }
  .sr-fixes { display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: center; max-width: 60ch; margin: 6px 0; }
  .sr-fix { font-family: var(--font-english, system-ui); font-size: 13px; color: var(--t3); }
  .sr-fix s { color: var(--error); opacity: .8; }
  .sr-fix b { color: var(--success); }
  .sr-next { margin-top: 8px; min-width: 160px; }

  @media (prefers-reduced-motion: reduce) { .sr-grid--shake, .sr-panel { animation: none; transition: none; } }
`;
