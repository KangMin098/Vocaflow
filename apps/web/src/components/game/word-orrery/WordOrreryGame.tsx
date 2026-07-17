// apps/web/src/components/game/word-orrery/WordOrreryGame.tsx
// The Word Orrery — 지식 게이트 탐사 (Outer Wilds 계열). 미니 태양계의 여섯 행성을 자유롭게
// 탐사(관측)해 각 '현상'에서 단어의 뜻을 읽어내 성좌 노트(코덱스)에 기록한다. 여섯 성좌를 모두
// 관측하면 중심 핵의 봉인이 깨어난다. 봉인은 스탯·운이 아니라 오직 '앎'으로만 열린다 — 각 봉인의
// 수수께끼는 현상을 에둘러 가리키므로, 관측으로 이해한 자만이 답을 새길 수 있다.
//
// 학습 과학: 현상 문맥에서 단어 뜻을 획득(Dual Coding·Context-Dependent) → 봉인에서 에두른
// 단서로 인출(Active Recall, 새 맥락 전이). 시간 루프처럼 오답 페널티 없이 자유 탐사.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, ParticleBurst, useSfx, useCountUp, shuffle, type Word,
} from '@/components/game/_shared/gamekit';

interface Props { wordPool?: Word[]; onExit?: () => void; onCorrect?: (w: Word) => void; onWrong?: (w: Word) => void; }

interface Planet { icon: string; name: string; phenomenon: string; en: string; ko: string; hue: string; }
interface Seal { riddle: string; answer: number; }

// 여섯 성좌 — 각 행성의 '현상'이 곧 단어의 뜻을 체현한다(추상 형용사 → 이미지로 이해).
const PLANETS: Planet[] = [
  { icon: '🌑', name: '재의 행성', hue: '#8A7A6A', en: 'desolate', ko: '황량한',
    phenomenon: '한때 울창한 숲이었으나, 이제 잿더미와 침묵뿐. 생명의 흔적조차 남지 않았다.' },
  { icon: '🌊', name: '심연의 바다', hue: '#3E7AB0', en: 'profound', ko: '깊은 · 심오한',
    phenomenon: '빛조차 닿지 못하는 깊이. 그 바닥을 잰 자는 아직 아무도 없다.' },
  { icon: '☄️', name: '길 잃은 혜성', hue: '#B06AC0', en: 'erratic', ko: '종잡을 수 없는',
    phenomenon: '궤도를 잃고, 어디로 튈지 예측할 수 없이 우주를 헤맨다.' },
  { icon: '🌋', name: '불의 행성', hue: '#D2603A', en: 'volatile', ko: '격렬한 · 변덕스러운',
    phenomenon: '쉼 없이 터지고 격렬하게 끓어오른다. 한순간도 잠잠하지 않는다.' },
  { icon: '❄️', name: '얼어붙은 위성', hue: '#5AA6C4', en: 'dormant', ko: '잠든 · 휴면의',
    phenomenon: '시간이 멈춘 듯 모든 것이 얼어, 깊은 잠에 빠져 고요하다.' },
  { icon: '✨', name: '쌍둥이 별', hue: '#D8B24A', en: 'radiant', ko: '눈부시게 빛나는',
    phenomenon: '두 별이 서로를 비추며 눈부시게 빛나, 주위의 어둠을 밀어낸다.' },
];

// 봉인 — 수수께끼가 현상을 에둘러 가리킨다(뜻·단어를 직접 말하지 않음 → 이해 필요).
const SEALS: Seal[] = [
  { riddle: '빛조차 삼키는 깊이를 헤아린 자여 — 그 심연의 본질을 새겨라.', answer: 1 },
  { riddle: '생명이 스러진 잿빛 세계. 그 황폐함의 이름을 대라.', answer: 0 },
  { riddle: '궤도를 잃고 헤매는 별. 종잡을 수 없는 그 성질을 답하라.', answer: 2 },
  { riddle: '멈춘 시간 속 잠든 세계. 그 고요한 상태의 이름을 봉인에 새겨라.', answer: 4 },
];

const N = PLANETS.length;

export function WordOrreryGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  void wordPool; // 현상은 수제 오센틱 콘텐츠 — 내장 성좌 뱅크 사용.
  const sfx = useSfx();
  const mounted = useRef(true);

  const [observed, setObserved] = useState<boolean[]>(Array(N).fill(false));
  const [sealsOpen, setSealsOpen] = useState<boolean[]>(Array(SEALS.length).fill(false));
  const [choices, setChoices] = useState<number[][]>([]);
  const [focus, setFocus] = useState<'orrery' | 'core' | number>('orrery');
  const [revealed, setRevealed] = useState(false); // 관측 패널에서 이름 공개 여부
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState<number | null>(null); // 오답 봉인 index
  const [justSeal, setJustSeal] = useState<number | null>(null);
  const [phase, setPhase] = useState<'explore' | 'done'>('explore');

  const observedCount = observed.filter(Boolean).length;
  const openCount = sealsOpen.filter(Boolean).length;
  const shownObs = useCountUp(observedCount);

  const start = useCallback(() => {
    setObserved(Array(N).fill(false));
    setSealsOpen(Array(SEALS.length).fill(false));
    // 봉인별 선택지: 정답 + 다른 성좌 3 → 셔플(관측 완료 시점에 전부 노출됨).
    setChoices(SEALS.map((s) => {
      const others = shuffle(PLANETS.map((_, i) => i).filter((i) => i !== s.answer)).slice(0, 3);
      return shuffle([s.answer, ...others]);
    }));
    setFocus('orrery'); setRevealed(false); setAttempts(0); setShake(null); setJustSeal(null); setPhase('explore');
  }, []);
  useEffect(() => { mounted.current = true; start(); return () => { mounted.current = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coreReady = observedCount >= N;

  // ── 행성 관측 ──
  const openPlanet = useCallback((i: number) => {
    sfx.click(); setFocus(i); setRevealed(observed[i]); // 이미 관측한 성좌는 즉시 이름 표시
  }, [sfx, observed]);

  const observe = useCallback((i: number) => {
    if (observed[i]) return;
    sfx.correct(observedCount, false);
    setObserved((o) => { const n = o.slice(); n[i] = true; return n; });
    setRevealed(true);
    onCorrect?.({ en: PLANETS[i].en, ko: PLANETS[i].ko });
  }, [observed, observedCount, sfx, onCorrect]);

  // ── 봉인 개방 ──
  const answerSeal = useCallback((sIdx: number, planetIdx: number) => {
    if (sealsOpen[sIdx]) return;
    if (planetIdx === SEALS[sIdx].answer) {
      sfx.correct(openCount + 4, true);
      setSealsOpen((s) => { const n = s.slice(); n[sIdx] = true; return n; });
      setJustSeal(sIdx); setTimeout(() => mounted.current && setJustSeal(null), 800);
      onCorrect?.({ en: PLANETS[planetIdx].en, ko: PLANETS[planetIdx].ko });
      if (openCount + 1 >= SEALS.length) {
        setTimeout(() => { if (mounted.current) { sfx.fanfare(); setPhase('done'); } }, 700);
      }
    } else {
      sfx.wrong(); setAttempts((a) => a + 1);
      setShake(sIdx); setTimeout(() => mounted.current && setShake(null), 400);
      onWrong?.({ en: PLANETS[planetIdx].en, ko: PLANETS[planetIdx].ko });
    }
  }, [sealsOpen, openCount, sfx, onCorrect, onWrong]);

  const handleExit = useCallback(() => onExit?.(), [onExit]);

  // 행성 궤도 좌표(퍼센트) — 여섯 성좌를 원형 배치.
  const positions = useMemo(() => PLANETS.map((_, i) => {
    const ang = (-90 + i * (360 / N)) * (Math.PI / 180);
    return { x: 50 + Math.cos(ang) * 38, y: 50 + Math.sin(ang) * 38 };
  }), []);

  if (phase === 'done') {
    const perfect = attempts === 0;
    const grade = perfect ? '완벽한 항해 — 앎이 곧 열쇠였다' : attempts <= 3 ? '핵에 도달했다' : '봉인을 모두 열었다';
    return (
      <div className="gk-root wo-root">
        <GameKitStyles />
        <AmbientBackground center="#3A4468" mid="#141A2E" edge="#080A16" glow="rgba(255,176,86,.34)" glowAt="50% 48%" watermark="word-orrery" />
        <style dangerouslySetInnerHTML={{ __html: WO_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="word-orrery"
          lead={grade}
          stats={[
            { num: `${N}`, label: '관측한 성좌', accent: true },
            { num: `${SEALS.length}`, label: '연 봉인' },
            { num: perfect ? '0' : `${attempts}`, label: '헛디딤' },
          ]}
          restartLabel="새 항성계"
          onRestart={start}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="gk-root wo-root">
      <GameKitStyles />
      <AmbientBackground center="#3A4468" mid="#141A2E" edge="#080A16" glow="rgba(255,176,86,.3)" glowAt="50% 46%" watermark="word-orrery" />
      <style dangerouslySetInnerHTML={{ __html: WO_CSS }} />
      <Hud
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={<div className="wo-hud"><span className="gk-stat-label">관측</span><span className="wo-hud-v">{shownObs}/{N} · 봉인 {openCount}/{SEALS.length}</span></div>}
      />

      <main className="gk-stage wo-stage">
        {/* ── 성계 뷰(오리리) ── */}
        {focus === 'orrery' && (
          <>
            <p className="wo-help" aria-hidden="true">
              {coreReady
                ? <>여섯 성좌를 모두 읽었다. <b>중심 핵</b>을 눌러 봉인을 마주하라.</>
                : <>행성을 눌러 <b>현상을 관측</b>하고 그 이름을 성좌 노트에 새겨라.</>}
            </p>

            <div className="wo-orrery" role="group" aria-label="항성계 지도">
              <span className="wo-orbit" aria-hidden="true" />
              {/* 중심 핵(태양) */}
              <button
                type="button"
                className={`wo-sun ${coreReady ? 'wo-sun--ready' : 'wo-sun--locked'}`}
                onClick={() => { if (coreReady) { sfx.click(); setFocus('core'); } else sfx.wrong(); }}
                data-ready={coreReady ? '1' : '0'}
                aria-label={coreReady ? '핵 봉인 — 열림 가능' : `핵 — 잠김, ${observedCount}/${N} 관측`}
              >
                <span className="wo-sun-core" aria-hidden="true" />
                <span className="wo-sun-label">{coreReady ? '핵 봉인' : '핵'}</span>
                <span className="wo-sun-sub">{coreReady ? '열림 가능' : `${observedCount}/${N}`}</span>
              </button>

              {/* 여섯 행성 */}
              {PLANETS.map((p, i) => (
                <button
                  key={p.en}
                  type="button"
                  className={`wo-planet ${observed[i] ? 'wo-planet--seen' : 'wo-planet--new'}`}
                  style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%`, ['--ph' as string]: p.hue }}
                  onClick={() => openPlanet(i)}
                  data-idx={i} data-en={p.en}
                  aria-label={`${p.name}${observed[i] ? ` — ${p.en}` : ' — 미관측'}`}
                >
                  <span className="wo-planet-orb" aria-hidden="true">{p.icon}</span>
                  <span className="wo-planet-name">{p.name}</span>
                  {observed[i] && <span className="wo-planet-en">{p.en}</span>}
                </button>
              ))}
            </div>

            {/* 성좌 노트(코덱스) */}
            <div className="wo-codex" aria-label="성좌 노트">
              <span className="wo-codex-label">성좌 노트</span>
              <div className="wo-codex-list">
                {PLANETS.map((p, i) => (
                  <span key={p.en} className={`wo-codex-item ${observed[i] ? 'is-on' : ''}`} data-en={observed[i] ? p.en : ''}>
                    {observed[i] ? <><b>{p.en}</b> {p.ko}</> : <span className="wo-codex-q">？ 미관측</span>}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 관측 패널(행성) ── */}
        {typeof focus === 'number' && (
          <section className="wo-panel wo-obs" style={{ ['--ph' as string]: PLANETS[focus].hue }} aria-label={`${PLANETS[focus].name} 관측`}>
            <button type="button" className="wo-back" onClick={() => { sfx.click(); setFocus('orrery'); }}>← 성계로</button>
            <div className="wo-obs-orb" aria-hidden="true">{PLANETS[focus].icon}</div>
            <h2 className="wo-obs-name">{PLANETS[focus].name}</h2>
            <p className="wo-obs-phenom">“{PLANETS[focus].phenomenon}”</p>

            {revealed ? (
              <div className="wo-obs-reveal">
                <span className="wo-obs-tag">이 현상의 이름</span>
                <span className="wo-obs-en">{PLANETS[focus].en}</span>
                <span className="wo-obs-ko">{PLANETS[focus].ko}</span>
                <ParticleBurst intensity={2} />
                <button type="button" className="wo-obs-done" onClick={() => { sfx.click(); setFocus('orrery'); }}>성계로 돌아가기</button>
              </div>
            ) : (
              <button type="button" className="wo-observe-btn" onClick={() => observe(focus)}>
                관측 — 이름을 읽어내다
              </button>
            )}
          </section>
        )}

        {/* ── 핵 봉인 패널 ── */}
        {focus === 'core' && (
          <section className="wo-panel wo-core" aria-label="핵 봉인">
            <button type="button" className="wo-back" onClick={() => { sfx.click(); setFocus('orrery'); }}>← 성계로</button>
            <p className="wo-core-lead">핵의 <b>{SEALS.length} 봉인</b>. 관측으로 이해한 자만이 이름을 새길 수 있다. <span className="wo-core-prog">{openCount}/{SEALS.length}</span></p>
            <div className="wo-seals">
              {SEALS.map((s, si) => (
                <div key={si} className={`wo-seal ${sealsOpen[si] ? 'is-open' : ''} ${shake === si ? 'is-shake' : ''} ${justSeal === si ? 'is-just' : ''}`} data-seal={si}>
                  <p className="wo-seal-riddle">{s.riddle}</p>
                  {sealsOpen[si] ? (
                    <div className="wo-seal-solved">
                      <span className="wo-seal-lock" aria-hidden="true">✦</span>
                      <b>{PLANETS[s.answer].en}</b> <span className="wo-seal-ko">{PLANETS[s.answer].ko}</span>
                      {justSeal === si && <ParticleBurst intensity={3} />}
                    </div>
                  ) : (
                    <div className="wo-seal-choices" role="group">
                      {(choices[si] ?? []).map((pi) => (
                        <button key={pi} type="button" className="wo-chip" data-en={PLANETS[pi].en} onClick={() => answerSeal(si, pi)}>
                          {PLANETS[pi].en}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const WO_CSS = `
  .wo-hud { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.05; }
  .wo-hud-v { font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; color: var(--t1); }
  .wo-stage { gap: clamp(12px, 2.6vh, 22px); }
  .wo-help { margin: 0; font-size: 13px; color: var(--t2); text-align: center; }
  .wo-help b { color: var(--t1); }

  /* ── 오리리 ── */
  .wo-orrery { position: relative; width: min(440px, 92vw); aspect-ratio: 1; margin: 0 auto; }
  .wo-orbit { position: absolute; left: 50%; top: 50%; width: 76%; height: 76%; transform: translate(-50%, -50%);
    border-radius: 50%; border: 1px dashed color-mix(in srgb, #9fb4e0 42%, transparent); pointer-events: none;
    box-shadow: 0 0 40px -6px rgba(140,170,255,.18) inset; animation: wo-spin 90s linear infinite; }

  .wo-sun { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    width: clamp(78px, 20vw, 96px); height: clamp(78px, 20vw, 96px); border-radius: 50%; cursor: pointer;
    border: 1px solid rgba(255,210,150,.4); transition: transform .2s var(--ease, ease-out), box-shadow .3s; z-index: 3; }
  .wo-sun-core { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
  .wo-sun--locked { background: radial-gradient(circle at 50% 42%, #4a5170, #262b44); color: #b9c2e0; box-shadow: 0 0 0 1px rgba(160,180,230,.2); }
  .wo-sun--locked .wo-sun-core { background: radial-gradient(circle at 50% 40%, rgba(160,180,230,.22), transparent 62%); }
  .wo-sun--ready { background: radial-gradient(circle at 50% 40%, #ffd27a, #e07a2c 74%, #b4531c); color: #3a1e08;
    box-shadow: 0 0 0 1px rgba(255,220,160,.6), 0 0 42px -2px rgba(255,168,72,.7), 0 0 90px -10px rgba(255,140,40,.5); animation: wo-pulse 2.6s ease-in-out infinite; }
  .wo-sun--ready .wo-sun-core { background: radial-gradient(circle at 50% 38%, rgba(255,244,214,.6), transparent 60%); }
  .wo-sun:hover { transform: translate(-50%, -50%) scale(1.06); }
  .wo-sun--ready:hover { box-shadow: 0 0 0 2px rgba(255,230,180,.8), 0 0 58px 2px rgba(255,168,72,.85); }
  .wo-sun:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,235,190,.85); }
  .wo-sun-label { position: relative; font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 900; letter-spacing: .02em; }
  .wo-sun-sub { position: relative; font-family: var(--font-english, monospace); font-size: 10px; font-weight: 700; opacity: .82; }

  .wo-planet { position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 2px; width: clamp(72px, 17vw, 92px); padding: 6px 4px;
    background: none; border: none; cursor: pointer; z-index: 4; transition: transform .16s var(--ease, ease-out); }
  .wo-planet:hover { transform: translate(-50%, -50%) scale(1.08); }
  .wo-planet:focus-visible { outline: none; }
  .wo-planet:focus-visible .wo-planet-orb { box-shadow: 0 0 0 3px rgba(255,255,255,.7); }
  .wo-planet-orb { display: grid; place-items: center; width: clamp(44px, 11vw, 56px); height: clamp(44px, 11vw, 56px);
    font-size: clamp(22px, 5.5vw, 28px); border-radius: 50%;
    background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--ph) 60%, #fff 8%), color-mix(in srgb, var(--ph) 82%, #000 30%));
    border: 1px solid color-mix(in srgb, var(--ph) 55%, #fff 10%);
    box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); transition: box-shadow .3s; }
  .wo-planet-name { font-family: var(--font-display, system-ui); font-size: 11px; font-weight: 800; color: var(--t1); text-shadow: 0 1px 6px rgba(0,0,0,.5); white-space: nowrap; }
  .wo-planet-en { font-family: var(--font-english, monospace); font-size: 10px; font-weight: 700; color: var(--ph); filter: brightness(1.4); }
  .wo-planet--new .wo-planet-orb { animation: wo-beacon 2.4s ease-in-out infinite; }
  .wo-planet--seen .wo-planet-orb { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ph) 65%, transparent), 0 6px 20px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); }
  .wo-planet--seen::after { content: '✓'; position: absolute; top: -2px; right: 12px; font-size: 10px; font-weight: 900; color: #0b0e1c;
    width: 15px; height: 15px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--ph) 80%, #fff); }

  /* ── 코덱스 ── */
  .wo-codex { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .wo-codex-label { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--t3); }
  .wo-codex-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: min(460px, 92vw); }
  .wo-codex-item { font-size: 11.5px; color: var(--t2); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); transition: border-color .3s, color .3s; }
  .wo-codex-item.is-on { color: var(--t1); border-color: color-mix(in srgb, #ffb056 45%, var(--bd)); }
  .wo-codex-item.is-on b { font-family: var(--font-english, system-ui); }
  .wo-codex-q { color: var(--t3); font-style: italic; }

  /* ── 패널 공통 ── */
  .wo-panel { position: relative; width: min(460px, 94vw); margin: 0 auto; padding: clamp(18px, 3.4vh, 28px) clamp(16px, 4vw, 26px);
    border-radius: 18px; background: color-mix(in srgb, var(--bg) 82%, #0a1024); border: 1px solid var(--bd);
    box-shadow: 0 30px 70px -30px rgba(0,0,0,.7); display: flex; flex-direction: column; align-items: center; gap: 12px; animation: wo-rise .32s ease-out; }
  .wo-back { position: absolute; left: 12px; top: 12px; font-family: var(--font-english, monospace); font-size: 11px; font-weight: 700;
    color: var(--t3); background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 8px; transition: color .2s, background .2s; }
  .wo-back:hover { color: var(--t1); background: color-mix(in srgb, var(--t3) 12%, transparent); }

  /* ── 관측 패널 ── */
  .wo-obs { text-align: center; }
  .wo-obs-orb { width: 64px; height: 64px; display: grid; place-items: center; font-size: 34px; border-radius: 50%; margin-top: 8px;
    background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--ph) 55%, #fff 10%), color-mix(in srgb, var(--ph) 82%, #000 26%));
    border: 1px solid color-mix(in srgb, var(--ph) 55%, #fff 10%); box-shadow: 0 0 34px -6px color-mix(in srgb, var(--ph) 70%, transparent); }
  .wo-obs-name { margin: 2px 0 0; font-size: 16px; font-weight: 800; color: var(--t1); }
  .wo-obs-phenom { margin: 4px 0 6px; max-width: 34ch; font-family: var(--font-serif, Lora, Georgia, serif); font-style: italic; font-size: 15px; line-height: 1.6; color: var(--t2); word-break: keep-all; }
  .wo-observe-btn { font-family: var(--font-display, system-ui); font-size: 14px; font-weight: 800; color: #2a1806; cursor: pointer;
    padding: 11px 26px; border-radius: 999px; border: 1px solid rgba(255,220,160,.6);
    background: linear-gradient(140deg, #ffd680, #e88a3a); box-shadow: 0 10px 26px -10px rgba(255,150,60,.7); transition: transform .16s, box-shadow .24s; }
  .wo-observe-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -12px rgba(255,150,60,.85); }
  .wo-observe-btn:active { transform: translateY(0); }
  .wo-obs-reveal { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; animation: wo-rise .34s ease-out; }
  .wo-obs-tag { font-family: var(--font-english, monospace); font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); }
  .wo-obs-en { font-family: var(--font-english, system-ui); font-size: clamp(26px, 7vw, 34px); font-weight: 900; letter-spacing: -.01em; color: var(--ph); filter: brightness(1.35); }
  .wo-obs-ko { font-size: 14px; color: var(--t1); }
  .wo-obs-done { margin-top: 10px; font-size: 12.5px; font-weight: 700; color: var(--t2); background: none; border: 1px solid var(--bd); border-radius: 999px; padding: 8px 18px; cursor: pointer; transition: border-color .2s, color .2s; }
  .wo-obs-done:hover { color: var(--t1); border-color: var(--t2); }

  /* ── 핵 봉인 패널 ── */
  .wo-core { align-items: stretch; }
  .wo-core-lead { margin: 2px 0 4px; text-align: center; font-size: 13px; color: var(--t2); }
  .wo-core-lead b { color: var(--t1); }
  .wo-core-prog { font-family: var(--font-english, monospace); font-weight: 800; color: #ffb056; margin-left: 4px; }
  .wo-seals { display: flex; flex-direction: column; gap: 10px; }
  .wo-seal { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--bd); background: color-mix(in srgb, var(--bg) 60%, transparent); transition: border-color .3s, box-shadow .3s, background .3s; }
  .wo-seal.is-open { border-color: color-mix(in srgb, #ffb056 55%, var(--bd)); background: color-mix(in srgb, #ffb056 8%, var(--bg)); box-shadow: 0 0 0 1px color-mix(in srgb, #ffb056 30%, transparent), 0 0 24px -8px rgba(255,176,86,.6); }
  .wo-seal.is-shake { animation: gk-shake .38s ease-in-out; border-color: var(--error); }
  .wo-seal.is-just { animation: wo-flare .7s ease-out; }
  .wo-seal-riddle { margin: 0 0 9px; font-family: var(--font-serif, Lora, Georgia, serif); font-style: italic; font-size: 13.5px; line-height: 1.55; color: var(--t1); word-break: keep-all; }
  .wo-seal-choices { display: flex; flex-wrap: wrap; gap: 7px; }
  .wo-chip { font-family: var(--font-english, system-ui); font-size: 13px; font-weight: 700; color: var(--t1); cursor: pointer;
    padding: 7px 15px; border-radius: 999px; border: 1px solid var(--bd); background: var(--bg); transition: transform .12s, border-color .2s, box-shadow .2s, background .2s; }
  .wo-chip:hover { transform: translateY(-2px); border-color: #ffb056; box-shadow: 0 6px 16px -8px rgba(255,176,86,.7); }
  .wo-chip:active { transform: translateY(0); }
  .wo-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, #ffb056 34%, transparent); }
  .wo-seal-solved { position: relative; display: flex; align-items: center; gap: 8px; font-family: var(--font-english, system-ui); font-size: 16px; font-weight: 900; color: var(--t1); }
  .wo-seal-lock { color: #ffb056; font-size: 15px; filter: drop-shadow(0 0 8px rgba(255,176,86,.8)); }
  .wo-seal-ko { font-family: var(--font-display, system-ui); font-size: 12px; font-weight: 600; color: var(--t2); }

  @keyframes wo-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
  @keyframes wo-pulse { 0%,100% { box-shadow: 0 0 0 1px rgba(255,220,160,.6), 0 0 42px -2px rgba(255,168,72,.7), 0 0 90px -10px rgba(255,140,40,.5); } 50% { box-shadow: 0 0 0 1px rgba(255,230,180,.75), 0 0 54px 2px rgba(255,178,86,.85), 0 0 110px -6px rgba(255,150,50,.6); } }
  @keyframes wo-beacon { 0%,100% { box-shadow: 0 6px 20px -6px color-mix(in srgb, var(--ph) 70%, #000), inset 0 2px 6px rgba(255,255,255,.28); } 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ph) 40%, transparent), 0 6px 24px -4px color-mix(in srgb, var(--ph) 80%, #000), inset 0 2px 6px rgba(255,255,255,.28); } }
  @keyframes wo-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wo-flare { 0% { box-shadow: 0 0 0 1px color-mix(in srgb, #ffb056 30%, transparent), 0 0 0 rgba(255,176,86,0); } 40% { box-shadow: 0 0 0 2px rgba(255,210,150,.8), 0 0 40px 4px rgba(255,176,86,.8); } 100% { box-shadow: 0 0 0 1px color-mix(in srgb, #ffb056 30%, transparent), 0 0 24px -8px rgba(255,176,86,.6); } }
  @media (prefers-reduced-motion: reduce) { .wo-orbit, .wo-sun--ready, .wo-planet--new .wo-planet-orb, .wo-panel, .wo-obs-reveal, .wo-seal.is-just, .wo-seal.is-shake { animation: none; } .wo-planet, .wo-sun, .wo-chip, .wo-observe-btn { transition: none; } }
`;
