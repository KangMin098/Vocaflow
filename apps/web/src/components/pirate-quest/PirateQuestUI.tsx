// apps/web/src/components/pirate-quest/PirateQuestUI.tsx
// HUD(밀물 시계 · 점수 · 콤보 · 미확정) + 하단 조타실 카드 + 결과.
//
// v08 원칙:
//   · 화면 정중앙 모달 토스트를 전부 걷어냈다. 피드백·선택·교정은 전부 **하단 인라인**.
//     (프로젝트 제약: 모달 오버레이로 학습을 끊지 않는다.)
//   · 정답/오답은 색 + 아이콘(gamekit FeedbackIcon) + 모션 3중으로만 말한다.
//   · 등급 랭킹("CABIN BOY")은 삭제 — 비난조이고 Empathetic Feedback 위반이었다.
//   · 게임 무드 색은 컨테이너에서 토큰을 재정의해 공용 킷 컴포넌트까지 함께 대비를 맞춘다.
//
// v08.2 추가 (적대적 반증 대응):
//   · recall 카드 — 오답 뒤 "뜻은 알고 있었나" 3지선다. 위치 실패와 어휘 실패를 갈라
//     FSRS 에 올릴지 말지를 결정하고, 그 결정을 학습자에게 그대로 말해준다.
//   · 정산 카드가 **실제로 늘어난 밀물**만 말한다. 만조(가산 상한)와 등불 잠수를 구분.
//   · 등불 남은 개수 표시 · 맛보기 어휘로 대체됐을 때의 고지.

'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Anchor, Flame, Lightbulb, Waves, X } from 'lucide-react';

import {
  FeedbackIcon,
  GameDone,
  IconSound,
  Kbd,
  ParticleBurst,
  TimerBar,
  useCountUp,
  type Word,
} from '@/components/game/_shared/gamekit';

import { PQ, type Dive, type Phase } from './logic';
import './PirateQuestUI.css';

export interface MissInfo {
  target: Word;
  picked: Word | null;
  lost: number;
  /** 큰 연쇄를 눈앞에서 놓쳤는가 — 소리·문구가 달라진다("틀렸다"가 아니라 "아까웠다") */
  near: boolean;
  /** 이미 건져 올린 자리를 다시 눌렀는가 — 문구를 다르게 준다 */
  hauledPick: boolean;
}

/** 오답 뒤 "뜻은 알고 있었나" 마이크로 체크. */
export interface RecallInfo {
  word: Word;
  options: string[];
}

export interface SettleInfo {
  points: number;
  seconds: number;
  full: boolean;
  items: number;
  /** 등불 잠수 — 밀물 환급 없음 */
  lantern: boolean;
  /** 가산 상한(만조)에 걸려 실제로는 1ms 도 안 늘었다 */
  capped: boolean;
}

export interface DoneInfo {
  score: number;
  bankedItems: number;
  bestCombo: number;
  bestChain: number;
  missed: Word[];
  /** 밀물이 끝날 때 확정하지 못하고 두고 온 보물 — 다음 판의 가장 강한 동기다. */
  strandedPending: number;
  best: { prev: number | null; now: number; improved: boolean };
}

export interface PirateUIProps {
  phase: Phase;
  dive: Dive | null;
  /** 라벨 노출 남은 비율 0..1 */
  scanFrac: number;
  scanSeconds: number;
  tideFrac: number;
  tideWarning: boolean;
  tideSeconds: number;
  /** 밀물 가산 상한 도달 — 확정해도 시계가 더는 안 늘어난다 */
  tideCapped: boolean;
  score: number;
  combo: number;
  comboMult: number;
  tierLabel: string | null;
  bankPreview: number;
  nextChainMult: number;
  askKo: string | null;
  lastHaul: Word | null;
  miss: MissInfo | null;
  recall: RecallInfo | null;
  /** 마이크로 체크 결과 — null 이면 아직 판정 전 */
  knewMeaning: boolean | null;
  settle: SettleInfo | null;
  done: DoneInfo | null;
  lanternLeft: number;
  /** 내 단어를 못 써서 맛보기 해적 어휘로 대체됐는가 */
  substitutedPool: boolean;
  muted: boolean;
  burstKey: number;
  burstColors: string[];
  onToggleMute: () => void;
  onExit: () => void;
  onDiveNow: () => void;
  onBank: () => void;
  onPushLuck: () => void;
  onLantern: () => void;
  onRecallPick: (choice: string | null) => void;
  onContinue: () => void;
  onRestart: () => void;
}

export function PirateQuestUI(props: PirateUIProps) {
  return (
    <>
      {props.phase !== 'done' && <PirateHud {...props} />}
      {props.phase !== 'done' && props.phase !== 'loading' && <PirateDeck {...props} />}
      {props.phase === 'done' && props.done && (
        <PirateDone
          done={props.done}
          onRestart={props.onRestart}
          onExit={props.onExit}
        />
      )}
    </>
  );
}

// ─── HUD ──────────────────────────────────────────────────────────────────
function PirateHud({
  phase,
  score,
  combo,
  comboMult,
  tierLabel,
  dive,
  tideFrac,
  tideWarning,
  tideSeconds,
  tideCapped,
  muted,
  onToggleMute,
  onExit,
}: PirateUIProps) {
  const shownScore = useCountUp(score);
  const pending = dive?.pending ?? 0;
  const live = phase !== 'done' && phase !== 'loading';

  return (
    <header className="pq-hud">
      <div className="pq-hud-brand">
        <Anchor size={16} strokeWidth={2.6} aria-hidden />
        <span className="pq-hud-brand-name">
          Pirate&apos;s <strong>Bounty</strong>
        </span>
      </div>

      {live && (
        <div className="pq-hud-tide" data-capped={tideCapped ? '1' : '0'}>
          {/* 만조는 색이 아니라 글자로도 말한다 — 이중 인코딩 */}
          <span className="pq-hud-cap">
            <Waves size={11} strokeWidth={2.6} aria-hidden /> {tideCapped ? '만조' : '밀물'}
          </span>
          <TimerBar frac={tideFrac} warning={tideWarning} seconds={tideSeconds} label="남은 밀물 시간" />
        </div>
      )}

      <div className="pq-hud-right">
        <div className="pq-hud-stat">
          <span className="pq-hud-cap">보물</span>
          <span className="pq-hud-num">{shownScore.toLocaleString()}</span>
        </div>

        {pending > 0 && (
          <div className="pq-hud-stat pq-hud-stat--pending" title="확정 전 — 틀리면 잃습니다">
            <span className="pq-hud-cap">미확정</span>
            <span className="pq-hud-num">{pending.toLocaleString()}</span>
          </div>
        )}

        {combo > 0 && (
          <div className="pq-hud-stat pq-hud-stat--combo" data-tier={comboMult >= 3 ? '2' : comboMult > 1 ? '1' : '0'}>
            <span className="pq-hud-cap">
              <Flame size={11} strokeWidth={2.6} aria-hidden /> 연속
            </span>
            <span className="pq-hud-num">
              {combo}
              {comboMult > 1 && <em className="pq-hud-mult">×{comboMult}</em>}
            </span>
          </div>
        )}

        {tierLabel && <span className="pq-hud-tier">{tierLabel}</span>}

        <button
          type="button"
          className="pq-icon-btn"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
        >
          <IconSound muted={muted} />
        </button>
        <button type="button" className="pq-icon-btn" onClick={onExit} aria-label="나가기">
          <X size={17} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </header>
  );
}

// ─── 하단 조타실 카드 ─────────────────────────────────────────────────────
function PirateDeck(props: PirateUIProps) {
  const {
    phase,
    dive,
    scanFrac,
    scanSeconds,
    askKo,
    lastHaul,
    miss,
    recall,
    knewMeaning,
    settle,
    bankPreview,
    nextChainMult,
    lanternLeft,
    substitutedPool,
    burstKey,
    burstColors,
    onDiveNow,
    onBank,
    onPushLuck,
    onLantern,
    onRecallPick,
    onContinue,
  } = props;

  const k = dive?.markers.length ?? 0;
  const firstDive = (dive?.index ?? 1) === 1;
  const lanternReady = lanternLeft > 0 && !dive?.lantern;

  return (
    <section className="pq-deck" data-phase={phase}>
      <div className="pq-deck-burst" aria-hidden="true">
        {burstKey > 0 && <ParticleBurst key={burstKey} intensity={2} colors={burstColors} />}
      </div>

      {/* pq-card 는 스타일이 아니라 e2e 스모크(07-arcade-games)의 준비 마커다 — 유지. */}
      <div className="pq-deck-inner pq-card">
        {phase === 'scan' && (
          <>
            <p className="pq-eyebrow">
              <span className="pq-step">1</span> 외우세요 — 어느 자리에 어느 단어인지
            </p>
            <div className="pq-scanrow">
              <TimerBar frac={scanFrac} label="라벨 노출 남은 시간" seconds={scanSeconds} />
              <span className="pq-scan-count">
                {k}자리 · 최대 {Math.max(1, k - 1)}회
              </span>
            </div>
            <p className="pq-line">
              라벨은 곧 물에 잠깁니다. 그 뒤에는 <b>한국어 뜻</b>만 불려요.
            </p>
            {firstDive && (
              <p className="pq-rules">
                뜻이 불리면 그 단어가 있던 <b>자리</b>를 누르세요. 건져 올린 자리도 물속에서는
                똑같이 보이니 <b>내가 어디를 캤는지</b>까지 기억해야 해요. 언제든 확정할 수 있지만,
                한 번이라도 틀리면 이번 잠수의 미확정 보물은 바다에 잃습니다.
              </p>
            )}
            {substitutedPool && firstDive && (
              <p className="pq-note pq-note--info">
                쓸 수 있는 내 단어가 부족해 맛보기 해적 어휘로 놀아요. 단어장이 채워지면 내 단어로 바뀝니다.
              </p>
            )}
            <div className="pq-actions">
              <button type="button" className="pq-btn pq-btn--ghost" onClick={onDiveNow}>
                다 외웠어요 · 잠수 <Kbd>Space</Kbd>
              </button>
            </div>
          </>
        )}

        {phase === 'haul' && dive && (
          <>
            <p className="pq-eyebrow">
              <span className="pq-step">2</span> 찾으세요 — {dive.hauled + 1}번째 회수
              <em className="pq-chain">×{nextChainMult}</em>
            </p>
            <p className="pq-ask" lang="ko">
              {askKo}
            </p>
            <p className="pq-line">
              물속 <b>번호</b>를 누르거나 그 자리를 클릭하세요.
              <span className="pq-keys">
                {dive.markers.map((m) => (
                  <Kbd key={m.badge}>{m.badge}</Kbd>
                ))}
              </span>
            </p>
            <div className="pq-actions">
              <button
                type="button"
                className="pq-btn pq-btn--ghost"
                onClick={onLantern}
                aria-disabled={lanternReady ? undefined : 'true'}
              >
                <Lightbulb size={14} strokeWidth={2.6} aria-hidden />
                {dive.lantern
                  ? '등불 켜짐 · 이번 잠수 ×0.5 · 밀물 환급 없음'
                  : lanternLeft > 0
                    ? `등불 ${lanternLeft}개 · −4초 · 이번 잠수 ×0.5`
                    : '등불 소진'}
                {lanternReady && <Kbd>H</Kbd>}
              </button>
            </div>
          </>
        )}

        {phase === 'choice' && dive && (
          <>
            <p className="pq-eyebrow pq-eyebrow--good">
              <FeedbackIcon kind="correct" /> 회수 성공
            </p>
            {lastHaul && (
              <p className="pq-got">
                <b lang="en">{lastHaul.en}</b>
                <span>{lastHaul.ko}</span>
              </p>
            )}
            <p className="pq-line">
              미확정 <b>{dive.pending.toLocaleString()}</b> · 더 캘 수 있는 자리 {dive.queue.length}개
            </p>
            <div className="pq-actions pq-actions--split">
              <button type="button" className="pq-btn pq-btn--primary" onClick={onBank} autoFocus>
                확정 +{bankPreview.toLocaleString()} <Kbd>Enter</Kbd>
              </button>
              <button type="button" className="pq-btn pq-btn--risk" onClick={onPushLuck}>
                한 번 더 ×{nextChainMult} <Kbd>D</Kbd>
              </button>
            </div>
            <p className="pq-note">틀리면 미확정 {dive.pending.toLocaleString()}은 바다로 갑니다.</p>
          </>
        )}

        {phase === 'recall' && recall && (
          <>
            <p className="pq-eyebrow">
              <span className="pq-step">?</span> 자리는 빗나갔어요 — 그럼 이 단어의 뜻은?
            </p>
            <p className="pq-recall-word" lang="en">
              {recall.word.en}
            </p>
            {/* 남은 시간은 장식이 아니라 정보다 — prefers-reduced-motion 에서도 그대로 둔다. */}
            <div className="pq-recall-bar" aria-hidden="true">
              <span
                className="pq-recall-fill"
                style={{ animationDuration: `${PQ.RECALL_MS}ms` } as CSSProperties}
              />
            </div>
            <div className="pq-actions pq-actions--recall">
              {recall.options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  className="pq-btn pq-btn--ghost pq-btn--recall"
                  onClick={() => onRecallPick(opt)}
                  autoFocus={i === 0}
                  lang="ko"
                >
                  <Kbd>{i + 1}</Kbd>
                  {opt}
                </button>
              ))}
            </div>
            <p className="pq-note">
              뜻을 맞히면 자리만 놓친 것으로 보고 복습 일정은 건드리지 않아요.
            </p>
          </>
        )}

        {phase === 'reveal' && miss && (
          <>
            <p className="pq-eyebrow pq-eyebrow--miss">
              <FeedbackIcon kind={miss.near ? 'near' : 'wrong'} />
              {miss.near ? '아까웠어요 — 큰 연쇄를 눈앞에서' : '이 단어였어요'}
            </p>
            <p className="pq-correction">
              <b lang="en">{miss.target.en}</b>
              <span>{miss.target.ko}</span>
              {miss.target.pron && <em>{miss.target.pron}</em>}
            </p>
            {miss.picked && (
              <p className="pq-line pq-line--sub">
                {miss.hauledPick ? '이미 건져 올린 자리였어요 · ' : '고른 자리는 '}
                <b lang="en">{miss.picked.en}</b> · {miss.picked.ko}
                {miss.hauledPick ? '' : ' 였어요.'}
              </p>
            )}
            {knewMeaning !== null && (
              <p className="pq-line pq-line--sub" data-knew={knewMeaning ? '1' : '0'}>
                {knewMeaning
                  ? '뜻은 알고 있었네요 — 자리만 놓친 거라 복습 일정은 그대로 둘게요.'
                  : '이 단어는 복습 목록에 올려 둘게요. 곧 다시 만나요.'}
              </p>
            )}
            {miss.lost > 0 && (
              <p className="pq-note">미확정 {miss.lost.toLocaleString()}을 바다에 두고 옵니다.</p>
            )}
            <div className="pq-actions">
              <button type="button" className="pq-btn pq-btn--ghost" onClick={onContinue} autoFocus>
                계속 <Kbd>Enter</Kbd>
              </button>
            </div>
          </>
        )}

        {phase === 'settle' && settle && (
          <>
            <p className="pq-eyebrow pq-eyebrow--good">
              <FeedbackIcon kind="correct" /> 확정{' '}
              {settle.full && <em className="pq-chain">완전 회수</em>}
            </p>
            <p className="pq-settle">
              <b>+{settle.points.toLocaleString()}</b>
              <span>
                보물 {settle.items}개
                {settle.lantern
                  ? ' · 등불 잠수라 밀물은 그대로'
                  : settle.capped
                    ? ' · 만조 — 밀물은 더 차오르지 않아요'
                    : ` · 밀물 +${settle.seconds}초`}
              </span>
            </p>
          </>
        )}
      </div>

      <LiveRegion
        phase={phase}
        askKo={askKo}
        miss={miss}
        recall={recall}
        settle={settle}
      />
    </section>
  );
}

/** 스크린리더 안내 — 시각 연출과 별도로 상태 전환을 말로 알린다. */
function LiveRegion({
  phase,
  askKo,
  miss,
  recall,
  settle,
}: {
  phase: Phase;
  askKo: string | null;
  miss: MissInfo | null;
  recall: RecallInfo | null;
  settle: SettleInfo | null;
}) {
  let msg = '';
  if (phase === 'scan') msg = '라벨 노출 중입니다. 자리를 외우세요.';
  else if (phase === 'haul' && askKo) msg = `${askKo}. 그 단어가 있던 자리를 고르세요.`;
  else if (phase === 'choice') msg = '회수 성공. 확정하거나 한 번 더 캘 수 있습니다.';
  else if (phase === 'recall' && recall)
    msg = `자리를 놓쳤습니다. ${recall.word.en} 의 뜻을 ${recall.options.length}개 중에서 고르세요.`;
  else if (phase === 'reveal' && miss) msg = `정답은 ${miss.target.en}, ${miss.target.ko} 였습니다.`;
  else if (phase === 'settle' && settle) msg = `${settle.points}점 확정.`;
  return (
    <p className="pq-sr" role="status" aria-live="polite">
      {msg}
    </p>
  );
}

// ─── 결과 ─────────────────────────────────────────────────────────────────
function PirateDone({
  done,
  onRestart,
  onExit,
}: {
  done: DoneInfo;
  onRestart: () => void;
  onExit: () => void;
}) {
  const hint =
    done.strandedPending > 0
      ? `밀물에 미확정 ${done.strandedPending.toLocaleString()}을 두고 왔어요. 다음엔 조금 일찍 확정해 볼까요.`
      : done.missed.length > 0
        ? `다음 판은 놓친 ${done.missed.length}단어부터 다시 불러줄게요.`
        : done.bestChain >= 3
          ? `${done.bestChain}연쇄를 지켜냈어요. 다음엔 ${done.bestChain + 1}연쇄에 도전해 볼까요.`
          : '다음 판은 한 번 더 캐 보세요 — 3연쇄부터 배수가 크게 붙어요.';

  const badge: ReactNode =
    done.best.improved ? (
      <>
        <Anchor size={13} strokeWidth={2.6} aria-hidden /> 개인 최고 갱신
      </>
    ) : done.bestChain >= 4 ? (
      <>
        <Waves size={13} strokeWidth={2.6} aria-hidden /> {done.bestChain}연쇄 잠수
      </>
    ) : null;

  return (
    <div className="gk-root pq-done-root">
      <GameDone
        lead="오늘 잘 마쳤어요"
        stats={[
          { num: done.bankedItems, label: '확정한 보물' },
          { num: done.score.toLocaleString(), label: '점수', accent: true },
          { num: done.bestChain, label: '최장 연쇄' },
          { num: done.bestCombo, label: '최고 연속' },
        ]}
        best={{ prev: done.best.prev, now: done.best.now, label: '점수', improved: done.best.improved }}
        badge={badge}
        celebrate={done.best.improved}
        restartLabel={done.missed.length > 0 ? `다시 하기 · 놓친 ${done.missed.length}단어부터` : '다시 하기'}
        restartHint={hint}
        reveal={
          done.missed.length > 0 ? (
            <>
              <strong className="pq-reveal-title">바다에 두고 온 단어</strong>
              <span className="pq-reveal-list">
                {done.missed.map((w) => (
                  <span key={w.en} className="pq-reveal-chip">
                    <b lang="en">{w.en}</b> · {w.ko}
                  </span>
                ))}
              </span>
            </>
          ) : undefined
        }
        onRestart={onRestart}
        onExit={onExit}
      />
    </div>
  );
}

// ─── 에셋 로딩 게이트 ─────────────────────────────────────────────────────
// 이전 판은 800ms 고정 타이머로 라운드를 시작해, GLB 가 아직 없는 빈 해변에서
// 보너스 시계가 이미 돌고 있었다(순수 불공정). 이제 로드가 끝나야 밀물이 시작된다.
export function PirateGate({ progress, onExit }: { progress: number; onExit: () => void }) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = window.setInterval(() => setDots((d) => (d % 3) + 1), 420);
    return () => window.clearInterval(id);
  }, []);
  return (
    // pq-intro 는 e2e 스모크(07-arcade-games)의 준비 마커 — 클래스 이름을 유지한다.
    <div className="pq-gate pq-intro" role="status" aria-live="polite">
      <div className="pq-gate-mark" aria-hidden="true">
        <Anchor size={30} strokeWidth={2.2} />
      </div>
      <p className="pq-gate-title">해변을 여는 중{'.'.repeat(dots)}</p>
      <div className="pq-gate-bar" aria-hidden="true">
        <div className="pq-gate-fill" style={{ width: `${Math.min(100, Math.round(progress))}%` }} />
      </div>
      <p className="pq-gate-sub">에셋이 다 뜬 다음에 밀물이 시작돼요.</p>
      <button type="button" className="pq-btn pq-btn--ghost" onClick={onExit}>
        나가기 <Kbd>Esc</Kbd>
      </button>
    </div>
  );
}
