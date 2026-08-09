// apps/web/src/components/game/word-customs/WordCustomsGame.tsx
// Word Customs — 국경 심사대 (Papers, Please 계열). 학습자의 단어가 '입국 서류'로 도착하고
// 심사관은 벨이 울리기 전에 줄을 비워야 한다. 서류는 철자·품사·뜻·예문 4축이며 위조는
// **학습자 단어에서 절차적으로 생성**된다(고정 대본 없음 · 매 판 다름).
//
// v07.9 재설계 — 감사 23/50 의 원인 4가지를 구조로 제거했다.
//   ① 압력 0        → 근무일별 벽시계(useCountdown). 정확 +4초 · 오심 -7초 · 오심 3회면 교대 해제.
//   ② 매 판 같은 판 → 내장 뱅크도 '단어 목록'으로 격하하고 생성기 한 경로로 통일 + runSeed.
//   ③ 지식 없이 승리 → 위조 개수 랜덤 · 오표기 품사 랜덤 · 위조 뜻은 그날 화면에 없는 뜻 ·
//                     철자 위조는 실제 철자에서 절차 생성 · 예문 위조(문맥 인출) 신설.
//   ④ 18번 강제 정지 → 정확 판정은 1초 뒤 자동 진행 · 전 조작 키보드(A/D/F/1-4/Space/Esc).
// 트레이드오프: '속결 서약' — 4.5초 안에 끝내면 ×2, 못 끝내면 미결 -8초. 화면에 정보를 더하지
// 않으므로 인출 규칙을 깨지 않으면서 "지금 이 단어를 정말 아는가"에 판돈을 건다.
//
// v07.10 반증 감사(34/50) 대응 — 측정된 익스플로짓 6건을 구조로 막았다.
//   ① 최종일 뜻 위조가 '이미 읽은 한국어' 재활용 → 도너를 **런 밖**(미출제 뱅크 + 전용 오답뜻
//      풀)에서만 뽑는다. 위조 뜻은 이 판에서 진본으로 인쇄된 적이 없고 앞으로도 없다 →
//      '전에 본 문자열이면 위조' 대조 우회로 소멸. 도너 품사는 인쇄된 품사와 항상 일치시켜
//      '품사↔뜻 불일치' 라는 또 다른 무지 우회로도 함께 막는다.
//   ② 굴절형 예문이 진본 서류를 비문으로 인쇄 → 매칭에 실제로 쓴 표면형(exSurface)을 보존해
//      그대로 굵게 인쇄한다. 규칙 ④ 를 아는 학습자가 진본을 반송당하던 무고한 오심 제거.
//   ③ 예문 위조가 자연스러운 문장이 되어 '정답 없는 문항' → 도너를 **동사 자리 템플릿**으로
//      한정하고 비(非)동사 단어만 끼운다. 구문이 반드시 깨지되, '품사 위조인가 예문 위조인가'
//      는 그 단어를 알아야 갈리므로 인출 요구는 유지된다.
//   ④ A 키 리피트로 1.1초마다 자동 승인 → e.repeat 차단 + 서류 도착 후 250ms 입력 무장 지연.
//   ⑤ 속결 미결이 '목숨도 FSRS 도 안 잃는 무료 스킵' → 미결도 onWrong 으로 정직하게 적재한다.
//      모르는 단어가 복습 큐에서 조용히 사라지던 경로를 끊는 것이 이번 수정의 핵심.
//   ⑥ 위조 수 clamp(1, size-1) 이 '마지막 서류는 지식 없이 확정' → 하한 0 으로 연다.

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameKitStyles, AmbientBackground, Hud, GameDone, useSfx, useCountUp, clamp, shuffle,
  GameMusic, ParticleBurst, FeedbackIcon, TimerBar, LifePips, Kbd,
  useCountdown, useCombo, usePersonalBest, DEFAULT_COMBO_TIERS, type Word,
} from '@/components/game/_shared/gamekit';

interface ResultOpts { assisted?: boolean }
interface Props {
  wordPool?: Word[];
  onExit?: () => void;
  onCorrect?: (w: Word, opts?: ResultOpts) => void;
  onWrong?: (w: Word, opts?: ResultOpts) => void;
}

type PosKo = '명사' | '동사' | '형용사' | '부사';
type Field = 'spelling' | 'pos' | 'definition' | 'example';
type OutcomeKind = 'correct' | 'near' | 'wrong' | 'lapse';
type StampKind = 'approve' | 'deny' | 'pending';
type Phase = 'shift' | 'inspect' | 'reason' | 'reveal' | 'done';

/**
 * 생성기 입력 — 단어 하나가 가진 사실. ex 는 단어 자리가 `{}` 인 예문 템플릿.
 * exSurface = 그 자리에 원래 있던 **표면형**(received / companies). 원형으로 되돌려 인쇄하면
 * 진본 서류가 비문이 되어 무고한 오심을 만든다(감사 익스플로짓 #2).
 */
interface Src { en: string; ko: string; pos?: PosKo; ex?: string; exSurface?: string }

interface Traveler {
  key: string;
  /** 진실 */
  en: string; ko: string; posTrue?: PosKo; exTrue?: string; exTrueShown?: string;
  /** 서류에 인쇄된 값(위조면 진실과 다르다) */
  word: string; pos?: PosKo; def: string; ex?: string;
  /** 인쇄된 예문의 빈칸에 실제로 찍히는 형태(굴절형 보존 · 철자 위조 시 오철자) */
  exShown: string;
  forgery: Field | null;
  truth: string;
}
/** gainMs — 이 근무일의 '정확 판정 보상 시간'. 날이 갈수록 줄어 실효 사고시간이 실제로 좁아진다. */
interface Day { rules: string[]; fields: Field[]; travelers: Traveler[]; ms: number; gainMs: number }

const FIELD_LABEL: Record<Field, string> = { spelling: '철자', pos: '품사', definition: '뜻', example: '예문' };
const RULE_LINE: Record<Field, string> = {
  definition: '① 신고된 뜻이 그 단어의 뜻이 아니면 거부',
  spelling: '② 철자가 틀렸으면 거부',
  pos: '③ 품사 표기가 틀렸으면 거부',
  example: '④ 예문 속 쓰임이 그 단어의 것이 아니면 거부',
};
const STANDING_RULE = '거부할 때는 위조 항목까지 지목해야 인정 — 항목을 잘못 짚으면 시간이 깎인다';
/** 판돈을 걸기 전에 대가를 알려준다 — 이전 감사의 '안 알려준 룰' 지적이 판돈 메커닉에 재발했다. */
const ECON_LINE = (gainSec: number) => `시간 수지 — 정확 +${gainSec}초 · 오심 −7초 · 미결 −8초`;

// ── 근무 규칙 상수 ────────────────────────────────────────────────────────
const CITATIONS = 3;              // 하루 허용 오심(매 근무일 초기화)
const SHIFT_BANNER_MS = 1900;
const PLEDGE_WINDOW_MS = 3000;    // 서류 도착 후 서약 가능 시간
const PLEDGE_LIMIT_MS = 4500;     // 서약 시 판정 제한
// 정확 보상 시간은 **근무일마다 줄어든다**. 고정 4초였을 때 실효 사고시간이 14.5→13.0→11.6초
// (-20%) 로만 좁아져 3막 상승이 완만하다는 반증이 있었다. 아래 값이면 14.5→12.4→10.4초(-28%)로
// 서류 제한(10.5→9.0→7.6초, -28%)과 같은 기울기가 된다 — 시계가 실제로 조여든다.
const T_CORRECT_BY_DAY: Record<number, number[]> = { 2: [4000, 3200], 3: [4000, 3400, 2800] };
const T_CORRECT = 4000;           // 폴백(근무일 데이터가 없을 때)
const T_NEAR = 4000;
const T_WRONG = 7000;
const T_LAPSE = 8000;
const T_TIER = 3000;
const T_PLEDGE = 5000;
const AUTO_ADVANCE_MS = 1050;
/** 서류 도착 후 판정이 무장되기까지의 지연. 사람이 서류를 인지하기 전의 입력만 막는 값. */
const ARM_DELAY_MS = 250;

// ── 내장 단어 뱅크 (wordPool 이 없을 때만) — 위조는 여기서도 생성기가 만든다 ──
const BANK: Src[] = [
  { en: 'generous', ko: '너그러운, 관대한', pos: '형용사', ex: 'He is very {} with his time.' },
  { en: 'sensible', ko: '분별 있는, 현명한', pos: '형용사', ex: 'She made a {} choice.' },
  { en: 'postpone', ko: '연기하다, 미루다', pos: '동사', ex: 'They had to {} the meeting.' },
  { en: 'library', ko: '도서관', pos: '명사', ex: 'I borrowed a book from the {}.' },
  { en: 'eventually', ko: '결국, 마침내', pos: '부사', ex: 'She {} agreed to help.' },
  { en: 'fabric', ko: '천, 직물', pos: '명사', ex: 'The dress is made of soft {}.' },
  { en: 'receive', ko: '받다', pos: '동사', ex: 'I will {} the package tomorrow.' },
  { en: 'necessary', ko: '필요한', pos: '형용사', ex: 'Clean water is {} for life.' },
  { en: 'separate', ko: '분리하다, 나누다', pos: '동사', ex: 'Please {} the recycling.' },
  { en: 'familiar', ko: '익숙한, 친숙한', pos: '형용사', ex: 'The melody sounds {} to me.' },
  { en: 'achieve', ko: '이루다, 달성하다', pos: '동사', ex: 'She worked hard to {} her goal.' },
  { en: 'definitely', ko: '분명히, 확실히', pos: '부사', ex: 'I will {} be there on time.' },
  { en: 'success', ko: '성공', pos: '명사', ex: 'The concert was a great {}.' },
  { en: 'analyze', ko: '분석하다', pos: '동사', ex: 'We must {} the results carefully.' },
  { en: 'economic', ko: '경제의', pos: '형용사', ex: 'The country faces serious {} problems.' },
  { en: 'reliable', ko: '믿을 만한, 신뢰할 수 있는', pos: '형용사', ex: 'He is a {} and honest partner.' },
  { en: 'complement', ko: '보완(물)', pos: '명사', ex: 'This wine is a perfect {} to the meal.' },
  { en: 'gradually', ko: '점차, 서서히', pos: '부사', ex: 'The evening sky {} grew dark.' },
  { en: 'persuade', ko: '설득하다', pos: '동사', ex: 'They tried to {} him to stay.' },
  { en: 'accurate', ko: '정확한', pos: '형용사', ex: 'The report must be {} and complete.' },
  { en: 'maintain', ko: '유지하다, 관리하다', pos: '동사', ex: 'We must {} the engine regularly.' },
  { en: 'curious', ko: '호기심 많은', pos: '형용사', ex: 'The child was {} about everything.' },
];

// ── 오답 뜻 전용 풀 (진본으로는 절대 인쇄되지 않는 뜻) ──────────────────────
// 익스플로짓 #1 의 뿌리: 위조 뜻을 '이 판의 다른 단어' 에서 뽑으면, 최종일에는 후보가 전부
// 이전 날 진본으로 이미 읽은 한국어가 된다 → 영어를 몰라도 '전에 본 문자열=위조' 로 풀린다.
// 그래서 도너를 런 밖에서만 뽑는다. 여기 있는 뜻은 이 게임의 진본 목록(BANK·학습자 단어)과
// 겹치지 않도록 고른 실재 영단어의 뜻이며, 위조로 한 번 쓰이면 그 런에서 재사용하지 않는다
// (재사용은 '아까 가짜였던 뜻' 이라는 또 다른 대조 단서를 만든다).
// 품사별 12개 — 한 런의 최대 뜻 위조 수(18단어 3일 편성에서 이론상 12건)보다 많게 잡았다.
const DECOY_KO: { ko: string; pos: PosKo; from: string }[] = [
  { ko: '이웃, 이웃 사람', pos: '명사', from: 'neighbor' },
  { ko: '손잡이', pos: '명사', from: 'handle' },
  { ko: '그림자', pos: '명사', from: 'shadow' },
  { ko: '계단', pos: '명사', from: 'staircase' },
  { ko: '지붕', pos: '명사', from: 'roof' },
  { ko: '항구', pos: '명사', from: 'harbor' },
  { ko: '담요', pos: '명사', from: 'blanket' },
  { ko: '사다리', pos: '명사', from: 'ladder' },
  { ko: '봉투', pos: '명사', from: 'envelope' },
  { ko: '서랍', pos: '명사', from: 'drawer' },
  { ko: '발자국', pos: '명사', from: 'footprint' },
  { ko: '자물쇠', pos: '명사', from: 'lock' },
  { ko: '빌리다', pos: '동사', from: 'borrow' },
  { ko: '삼키다', pos: '동사', from: 'swallow' },
  { ko: '굽다', pos: '동사', from: 'bake' },
  { ko: '접다', pos: '동사', from: 'fold' },
  { ko: '흔들다', pos: '동사', from: 'shake' },
  { ko: '매달다, 걸다', pos: '동사', from: 'hang' },
  { ko: '문지르다', pos: '동사', from: 'rub' },
  { ko: '속삭이다', pos: '동사', from: 'whisper' },
  { ko: '기어가다', pos: '동사', from: 'crawl' },
  { ko: '뛰어넘다', pos: '동사', from: 'leap' },
  { ko: '엮다, 짜다', pos: '동사', from: 'weave' },
  { ko: '녹이다', pos: '동사', from: 'melt' },
  { ko: '축축한', pos: '형용사', from: 'damp' },
  { ko: '얕은', pos: '형용사', from: 'shallow' },
  { ko: '매끄러운', pos: '형용사', from: 'smooth' },
  { ko: '비좁은', pos: '형용사', from: 'cramped' },
  { ko: '시끄러운', pos: '형용사', from: 'noisy' },
  { ko: '가파른', pos: '형용사', from: 'steep' },
  { ko: '텅 빈', pos: '형용사', from: 'empty' },
  { ko: '날카로운', pos: '형용사', from: 'sharp' },
  { ko: '게으른', pos: '형용사', from: 'lazy' },
  { ko: '촘촘한', pos: '형용사', from: 'dense' },
  { ko: '끈적한', pos: '형용사', from: 'sticky' },
  { ko: '어두컴컴한', pos: '형용사', from: 'gloomy' },
  { ko: '마지못해', pos: '부사', from: 'reluctantly' },
  { ko: '조용히', pos: '부사', from: 'quietly' },
  { ko: '드물게', pos: '부사', from: 'rarely' },
  { ko: '갑작스럽게', pos: '부사', from: 'abruptly' },
  { ko: '서투르게', pos: '부사', from: 'clumsily' },
  { ko: '곧장, 똑바로', pos: '부사', from: 'straight' },
  { ko: '자주', pos: '부사', from: 'frequently' },
  { ko: '겨우, 간신히', pos: '부사', from: 'barely' },
  { ko: '부드럽게', pos: '부사', from: 'gently' },
  { ko: '대충, 대략', pos: '부사', from: 'roughly' },
  { ko: '끊임없이', pos: '부사', from: 'constantly' },
  { ko: '잠시', pos: '부사', from: 'briefly' },
];

// ── 스코프 단어 → 생성기 입력 ─────────────────────────────────────────────
const escapeRegWC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const posKoFromData = (raw?: string): PosKo | undefined => {
  const s = (raw || '').toLowerCase();
  if (/adverb|부사/.test(s)) return '부사'; // 'adverb'⊃'verb' → 먼저
  if (/adjective|형용사/.test(s)) return '형용사';
  if (/verb|동사/.test(s)) return '동사';
  if (/noun|명사/.test(s)) return '명사';
  return undefined;
};
const POS_ALL: PosKo[] = ['명사', '동사', '형용사', '부사'];

function normalizeSources(pool: Word[]): Src[] {
  const seen = new Set<string>();
  const out: Src[] = [];
  for (const w of pool) {
    const en = (w.en ?? '').trim();
    const ko = (w.ko ?? '').trim();
    if (!en || !ko) continue;
    if (!/^[a-zA-Z][a-zA-Z'-]{2,}$/.test(en)) continue;
    const lower = en.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    let ex: string | undefined;
    let exSurface: string | undefined;
    if (w.example) {
      const forms = [en, ...(w.inflected ?? [])].filter((f) => f && f.length >= 2);
      for (const f of forms) {
        const re = new RegExp(`\\b${escapeRegWC(f)}\\b`, 'i');
        const m = re.exec(w.example);
        if (m) {
          ex = w.example.replace(re, '{}');
          // 문장에 실제로 있던 형태를 그대로 보존한다. 원형으로 되돌려 인쇄하면
          // "She {receive} the letter." 같은 비문이 진본 서류에 찍힌다(익스플로짓 #2).
          exSurface = m[0];
          break;
        }
      }
    }
    out.push({ en, ko, pos: posKoFromData(w.pos), ex, exSurface });
  }
  return out;
}

/** 뜻 문자열의 개별 어의 토큰 — 도너 뜻이 진본과 한 어의라도 겹치면 무고한 오심이 된다. */
const koSenses = (ko: string): string[] =>
  ko.split(/[,·/;]/).map((s) => s.trim().replace(/\s+/g, '')).filter(Boolean);
const senseClash = (a: string, b: string): boolean => {
  const sb = new Set(koSenses(b));
  return koSenses(a).some((s) => sb.has(s));
};

/** 학습자 단어를 최우선. 너무 적을 때만 뱅크로 채우되 학습자 단어는 반드시 남긴다(FSRS 적재). */
function resolveSources(pool: Word[] | undefined): Src[] {
  const mine = normalizeSources(pool ?? []);
  if (mine.length >= 6) return mine.slice(0, 18);
  if (mine.length >= 2) {
    const have = new Set(mine.map((m) => m.en.toLowerCase()));
    const fill = shuffle(BANK.filter((b) => !have.has(b.en.toLowerCase()))).slice(0, Math.max(0, 8 - mine.length));
    return [...mine, ...fill];
  }
  return BANK;
}

// ── 철자 위조 — 실제 철자에서 절차 생성(고정 목록 아님) ────────────────────
function misspell(word: string, taken: Set<string>): string | null {
  const w = word.toLowerCase();
  if (word !== w || !/^[a-z-]{5,}$/.test(w)) return null;
  const cands: string[] = [];
  const push = (s: string) => { if (s && s !== w && s.length >= 4 && !taken.has(s)) cands.push(s); };

  if (w.includes('ie')) push(w.replace('ie', 'ei'));
  if (w.includes('ei')) push(w.replace('ei', 'ie'));
  const dbl = w.match(/([bcdfglmnprstz])\1/);
  if (dbl) push(w.replace(dbl[0], dbl[1]));
  const single = w.match(/[aeiou]([bcdfglmnprt])[aeiou]/);
  if (single) { const i = w.indexOf(single[0]) + 1; push(w.slice(0, i) + single[1] + w.slice(i)); }
  if (/able$/.test(w)) push(w.replace(/able$/, 'ible'));
  if (/ible$/.test(w)) push(w.replace(/ible$/, 'able'));
  if (/ance$/.test(w)) push(w.replace(/ance$/, 'ence'));
  if (/ence$/.test(w)) push(w.replace(/ence$/, 'ance'));
  if (/ent$/.test(w)) push(w.replace(/ent$/, 'ant'));
  if (/ant$/.test(w)) push(w.replace(/ant$/, 'ent'));
  if (/ary$/.test(w)) push(w.replace(/ary$/, 'ery'));
  if (/ely$/.test(w)) push(w.replace(/ely$/, 'ley'));
  if (/tion$/.test(w)) push(w.replace(/tion$/, 'sion'));
  if (/sion$/.test(w)) push(w.replace(/sion$/, 'tion'));
  if (/ous$/.test(w)) push(w.replace(/ous$/, 'ious'));
  const vi = w.slice(1).search(/[ae]/);
  if (vi >= 0) { const i = vi + 1; push(w.slice(0, i) + (w[i] === 'a' ? 'e' : 'a') + w.slice(i + 1)); }

  return cands.length ? shuffle(cands)[0] : null;
}

// ── 예문 위조 — '동사 자리' 템플릿에만 비(非)동사를 끼운다 ─────────────────
// 같은 품사 도너를 쓰면 "She made a {sensible→curious} choice." 처럼 완전히 자연스러운 문장이
// 나와 **정답 없는 문항**이 됐다(익스플로짓 #3). 반대로 빈칸 앞이 to/will/must/Please 인
// 동사 자리에 명사·형용사·부사를 끼우면 구문이 반드시 깨진다("They had to library the
// meeting."). 그런데 서류에는 진본 품사가 함께 인쇄되므로, 깨진 문장을 본 학습자는
// "품사 표기가 거짓인가, 예문이 거짓인가" 를 갈라야 한다 — 그 판단은 단어를 알아야만 선다.
const VERB_SLOT_RE = /\b(?:to|will|shall|must|should|can|could|would|may|might|please|let|don't|didn't|helps?|helped|wants?|wanted)\s+$/i;
const isVerbSlot = (tpl: string): boolean => {
  const at = tpl.indexOf('{}');
  if (at <= 0 || at >= tpl.length - 2) return false;
  return VERB_SLOT_RE.test(tpl.slice(0, at));
};

/** 철자 위조를 굴절 표면형에 안전하게 얹는다. 어간이 그대로 남는 경우에만. */
function misspellSurface(en: string, bad: string, surface: string): string {
  if (surface.toLowerCase() === en.toLowerCase()) {
    return /^[A-Z]/.test(surface) ? bad.charAt(0).toUpperCase() + bad.slice(1) : bad;
  }
  if (surface.toLowerCase().startsWith(en.toLowerCase())) {
    const tail = surface.slice(en.length);
    const head = /^[A-Z]/.test(surface) ? bad.charAt(0).toUpperCase() + bad.slice(1) : bad;
    return head + tail;
  }
  // 불규칙 굴절(went / companies) — 오철자를 안전하게 붙일 수 없으면 예문은 건드리지 않는다.
  return surface;
}

// ── 하루 편성 ──────────────────────────────────────────────────────────────
function buildRun(srcs: Src[]): Day[] {
  const u = shuffle(srcs).slice(0, 18);
  const n = u.length;
  if (n < 4) return [];
  const dayCount = n >= 12 ? 3 : 2;
  const base = Math.floor(n / dayCount);
  const rem = n % dayCount;
  const sizes = Array.from({ length: dayCount }, (_, i) => base + (i >= dayCount - rem ? 1 : 0));
  const perMs = dayCount === 3 ? [10500, 9000, 7600] : [10200, 8200];
  const fieldPlan: Field[][] = dayCount === 3
    ? [['definition'], ['definition', 'spelling'], ['definition', 'spelling', 'pos', 'example']]
    : [['definition'], ['definition', 'spelling', 'pos', 'example']];
  const ratio = dayCount === 3 ? [0.3, 0.42, 0.54] : [0.32, 0.5];
  const gains = T_CORRECT_BY_DAY[dayCount] ?? [T_CORRECT, T_CORRECT, T_CORRECT];

  const known = new Set(u.map((x) => x.en.toLowerCase()));
  const days: Day[] = [];
  let cursor = 0;

  // ── 뜻 위조 도너 — **런 밖에서만**. 이 판에서 진본으로 인쇄되는 뜻은 하나도 쓰지 않는다.
  // (구현: 이번 판에 뽑히지 않은 뱅크 단어 + 전용 오답뜻 풀. 둘 다 진본으로는 등장하지 않으므로
  //  '전에 본 한국어 = 위조' / '처음 보는 한국어 = 진본' 양방향 대조가 모두 무효가 된다.)
  const runKo = u.map((x) => x.ko);
  const outsideRun: { ko: string; pos?: PosKo; from: string }[] = [
    ...BANK.filter((b) => !known.has(b.en.toLowerCase())).map((b) => ({ ko: b.ko, pos: b.pos, from: b.en })),
    ...DECOY_KO.map((x) => ({ ko: x.ko, pos: x.pos as PosKo | undefined, from: x.from })),
  ].filter((cand) => !runKo.some((k) => senseClash(k, cand.ko)));
  const usedFakeKo = new Set<string>();
  /**
   * 도너 품사는 인쇄된 품사와 **반드시** 일치시킨다. '명사' 서류에 '빌리다' 를 실으면
   * 한국어만 읽고도 적발돼 어휘 인출이 필요 없어진다(품사↔뜻 불일치 우회로).
   * 품사가 인쇄되지 않는 서류(학습자 데이터에 pos 없음)에서만 품사 제약을 푼다.
   */
  const pickFakeKo = (item: Src): { ko: string; from: string } | null => {
    const fresh = outsideRun.filter((c) => !usedFakeKo.has(c.ko) && !senseClash(item.ko, c.ko));
    const fit = item.pos ? fresh.filter((c) => c.pos === item.pos) : fresh;
    const donor = shuffle(fit.length ? fit : (item.pos ? [] : fresh))[0];
    if (!donor) return null;
    usedFakeKo.add(donor.ko);
    return { ko: donor.ko, from: donor.from };
  };

  for (let d = 0; d < dayCount; d++) {
    const size = sizes[d];
    const slice = u.slice(cursor, cursor + size);
    cursor += size;
    const allowed = fieldPlan[d];
    const isLastDay = d === dayCount - 1;

    // 위조 수는 매 판·매 날 달라진다 — "n명 잡으면 나머지는 안전" 카운팅 봉쇄.
    // 하한을 1 → 0 으로 연다. clamp(1, …) 은 "3건을 진본으로 확신했으면 4번째는 무조건 위조"
    // 라는 **지식 없는 확정 추론**을 매 근무일 마지막 서류에 보장하고 있었다(익스플로짓 #6).
    // 밀도 자체도 ±0.12 흔들어 기대 개수를 세지 못하게 한다.
    const r = clamp(ratio[d] + (Math.random() * 0.24 - 0.12), 0.08, 0.82);
    let fc = Math.round(size * r);
    if (Math.random() < 0.4) fc += 1;
    if (Math.random() < 0.25) fc -= 1;
    // 8% 는 위조가 하나도 없는 '조용한 날'. 밀도 흔들기만으로는 위조율이 높은 날(size 4·ratio .5)
    // 에서 fc≥1 이 여전히 확정돼 마지막 서류가 공짜였다. 0 이 실제로 가능해져야만 추론이 끊긴다.
    // 재계산: P(마지막=위조 | 앞 전부 진본) 100% → 30% (즉 그 추론을 믿으면 오히려 손해).
    if (Math.random() < 0.08) fc = 0;
    fc = clamp(fc, 0, size);
    const forgeIdx = new Set(shuffle(slice.map((_, i) => i)).slice(0, fc));

    let exampleUsed = 0;

    const travelers: Traveler[] = slice.map((item, i) => {
      const surface = item.exSurface ?? item.en;
      const plain = (): Traveler => ({
        key: `${d}-${i}-${item.en}`,
        en: item.en, ko: item.ko, posTrue: item.pos, exTrue: item.ex, exTrueShown: surface,
        word: item.en, pos: item.pos, def: item.ko, ex: item.ex, exShown: surface,
        forgery: null, truth: `진본 — ${item.en} 의 뜻은 “${item.ko}”.`,
      });
      if (!forgeIdx.has(i)) return plain();

      // 이 서류에 실제로 만들 수 있는 위조 종류만 후보로.
      // item.ex 필수 — 진짜 쓰임을 되돌려 보여줄 수 없는 서류는 예문 축을 쓰지 않는다.
      const exDonors = (allowed.includes('example') && isLastDay && exampleUsed < 1
        && item.ex && item.pos && item.pos !== '동사')
        ? u.filter((x) => x.en !== item.en && x.ex && isVerbSlot(x.ex))
        : [];
      const cands: Field[] = [];
      if (allowed.includes('definition')) cands.push('definition');
      if (allowed.includes('pos') && item.pos) cands.push('pos');
      if (allowed.includes('spelling') && misspell(item.en, known)) cands.push('spelling');
      if (exDonors.length) cands.push('example');
      if (!cands.length) return plain();
      const field = shuffle(cands)[0];

      if (field === 'definition') {
        const donor = pickFakeKo(item);
        // 도너가 고갈되면 위조를 억지로 만들지 않는다 — 진본으로 내보내는 편이 정직하다.
        if (!donor) return plain();
        return {
          ...plain(), def: donor.ko, forgery: 'definition',
          truth: `뜻 위조 — ${item.en} 의 뜻은 “${item.ko}”. 신고된 “${donor.ko}” 는 ${donor.from} 의 뜻입니다.`,
        };
      }
      if (field === 'pos') {
        const wrong = shuffle(POS_ALL.filter((p) => p !== item.pos))[0];
        return {
          ...plain(), pos: wrong, forgery: 'pos',
          truth: `품사 위조 — ${item.en} 의 품사는 ${item.pos}. 서류에는 ${wrong} 로 적혀 있었습니다.`,
        };
      }
      if (field === 'spelling') {
        const bad = misspell(item.en, known);
        if (!bad) return plain();
        return {
          ...plain(), word: bad, forgery: 'spelling',
          exShown: misspellSurface(item.en, bad, surface),
          truth: `철자 위조 — 올바른 철자는 ${item.en} (서류: ${bad}).`,
        };
      }
      // example — 동사 자리 템플릿에 비동사 표제어를 끼워 구문을 반드시 깨뜨린다.
      const donor = shuffle(exDonors)[0];
      if (!donor?.ex) return plain();
      exampleUsed += 1;
      return {
        ...plain(), ex: donor.ex, exShown: item.en, forgery: 'example',
        truth: `예문 위조 — ${item.en}(${item.pos}) 은 이 자리에 올 수 없습니다. 실제 쓰임: “${(item.ex ?? '').replace('{}', surface)}”`,
      };
    });

    days.push({
      rules: allowed.map((f) => RULE_LINE[f]),
      fields: allowed,
      travelers,
      ms: size * perMs[d],
      gainMs: gains[d] ?? T_CORRECT,
    });
  }
  return days;
}

/** 이 서류에서 실제로 지목 가능한 항목 — 없는 칸은 칩도 없다(영구 오답 칩 제거). */
function chipsFor(t: Traveler, day: Day): Field[] {
  return day.fields.filter((f) =>
    f === 'definition' || f === 'spelling' || (f === 'pos' && !!t.pos) || (f === 'example' && !!t.ex));
}

const multFor = (c: number) => {
  let m = 1;
  for (const tier of DEFAULT_COMBO_TIERS) if (c >= tier.at) m = tier.mult;
  return m;
};

// ── 서류 (memo — useCountdown 이 매 프레임 부모를 리렌더한다) ───────────────
const Permit = memo(function Permit({
  t, tone, serial, revealed,
}: { t: Traveler; tone: OutcomeKind | null; serial: number; revealed: boolean }) {
  const exParts = (t.ex ?? '').split('{}');
  // 되돌려 보여주는 '실제 쓰임' 도 표면형으로 — 원형을 끼우면 정답 예문 자체가 비문이 된다.
  const trueEx = t.forgery === 'example' && t.exTrue
    ? t.exTrue.replace('{}', t.exTrueShown ?? t.en)
    : null;
  const toneCls = tone === 'correct' ? 'wc-doc--ok' : tone === 'near' ? 'wc-doc--near' : tone ? 'wc-doc--no' : '';
  return (
    <div className={`wc-doc ${toneCls}`}>
      <div className="wc-doc-top">
        <span className="wc-doc-title">ENTRY PERMIT · 입국 서류</span>
        <span className="wc-doc-serial">№ {String(serial).padStart(3, '0')}</span>
      </div>
      <div className="wc-headword" data-forged={revealed && t.forgery === 'spelling'}>{t.word}</div>
      <div className="wc-fields">
        {revealed && t.forgery === 'spelling' && (
          <div className="wc-row wc-row--forged">
            <span className="wc-k">철자</span>
            <span className="wc-v"><em className="wc-fix">정정 → {t.en}</em></span>
          </div>
        )}
        {t.pos && (
          <div className={`wc-row ${revealed && t.forgery === 'pos' ? 'wc-row--forged' : ''}`}>
            <span className="wc-k">품사</span>
            <span className="wc-v">{t.pos}{revealed && t.forgery === 'pos' && <em className="wc-fix"> → {t.posTrue}</em>}</span>
          </div>
        )}
        <div className={`wc-row ${revealed && t.forgery === 'definition' ? 'wc-row--forged' : ''}`}>
          <span className="wc-k">뜻(신고)</span>
          <span className="wc-v">{t.def}{revealed && t.forgery === 'definition' && <em className="wc-fix"> → {t.ko}</em>}</span>
        </div>
        {t.ex && (
          <div className={`wc-row ${revealed && t.forgery === 'example' ? 'wc-row--forged' : ''}`}>
            <span className="wc-k">예문</span>
            <span className="wc-v wc-ex">{exParts[0]}<b>{t.exShown}</b>{exParts[1] ?? ''}</span>
          </div>
        )}
        {revealed && trueEx && (
          <div className="wc-row wc-row--fixed">
            <span className="wc-k">실제 쓰임</span>
            <span className="wc-v wc-ex"><em className="wc-fix">{trueEx}</em></span>
          </div>
        )}
      </div>
    </div>
  );
});

const RuleCard = memo(function RuleCard({ rules, dayNo, gainSec }: { rules: string[]; dayNo: number; gainSec: number }) {
  return (
    <div className="wc-rules" aria-label={`제 ${dayNo} 일 규칙서`}>
      <span className="wc-rules-h">규칙서 · 제 {dayNo} 일</span>
      {rules.map((r) => <span key={r} className="wc-rule">{r}</span>)}
      <span className="wc-rule wc-rule--std">{STANDING_RULE}</span>
      <span className="wc-rule wc-rule--std">{ECON_LINE(gainSec)}</span>
    </div>
  );
});

export function WordCustomsGame({ wordPool, onExit, onCorrect, onWrong }: Props) {
  const sfx = useSfx();
  const [runSeed, setRunSeed] = useState(0);
  // runSeed 는 "값"이 아니라 **재편성 신호**다 — 이게 없으면 '다시 근무'가 인덱스만 되감아
  // 토씨 하나 같은 판을 다시 내보낸다(감사 지적 #2). 의도적 의존.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => buildRun(resolveSources(wordPool)), [wordPool, runSeed]);
  const daysRef = useRef(days);
  daysRef.current = days;
  const totalTravelers = useMemo(() => days.reduce((n, d) => n + d.travelers.length, 0), [days]);

  const [phase, setPhase] = useState<Phase>('shift');
  const [dayIdx, setDayIdx] = useState(0);
  const [tIdx, setTIdx] = useState(0);
  const [bannerDay, setBannerDay] = useState(0);
  const [daySummary, setDaySummary] = useState<{ day: number; correct: number; caught: number; bonus: number } | null>(null);

  const [score, setScore] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [correctN, setCorrectN] = useState(0);
  const [caughtN, setCaughtN] = useState(0);
  const [pledgeWin, setPledgeWin] = useState(0);
  const [lives, setLives] = useState(CITATIONS);
  const [outcome, setOutcome] = useState<{ kind: OutcomeKind; text: string } | null>(null);
  const [stamp, setStamp] = useState<{ kind: StampKind; n: number } | null>(null);
  const [burst, setBurst] = useState<{ n: number; power: number } | null>(null);
  const [gain, setGain] = useState<{ v: number; mult: number; pledged: boolean; n: number } | null>(null);
  const [pledged, setPledged] = useState(false);
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [endReason, setEndReason] = useState<'clear' | 'time' | 'citations'>('clear');
  const [log, setLog] = useState<{ en: string; truth: string; kind: OutcomeKind }[]>([]);
  const [record, setRecord] = useState<{ prev: number | null; improved: boolean } | null>(null);

  const day: Day | undefined = days[dayIdx];
  const traveler: Traveler | undefined = day?.travelers[tIdx];

  // ── 최신값 ref (타이머/키보드 핸들러가 stale closure 를 보지 않게) ──────
  const travelerRef = useRef(traveler);
  travelerRef.current = traveler;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pledgedRef = useRef(pledged);
  pledgedRef.current = pledged;
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const dayIdxRef = useRef(dayIdx);
  dayIdxRef.current = dayIdx;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const lockRef = useRef(false);
  // 서류가 도착한 시각 + ARM_DELAY_MS. 이 시각 전의 판정은 '서류를 본 판정'이 아니다.
  // (A 를 누른 채로 두면 OS 키 리피트가 자동 진행 직후 판정을 날려 1.1초/건으로 무독해 클리어가
  //  성립했다 — 익스플로짓 #4. e.repeat 차단과 이중으로 막는다. 마우스 연타에도 같이 적용.)
  const armAtRef = useRef(0);
  const stampSeq = useRef(0);
  const dayCorrect = useRef(0);
  const dayCaught = useRef(0);
  const dayCitations = useRef(0);
  const cleanDays = useRef(0);

  const winTimer = useRef(0);
  const deadTimer = useRef(0);
  const advTimer = useRef(0);
  const shiftTimer = useRef(0);
  const gainTimer = useRef(0);
  const clearT = (r: { current: number }) => { if (r.current) { window.clearTimeout(r.current); r.current = 0; } };
  const clearAll = useCallback(() => {
    [winTimer, deadTimer, advTimer, shiftTimer, gainTimer].forEach(clearT);
  }, []);

  // ── 근무 시계 ───────────────────────────────────────────────────────────
  const running = phase === 'inspect' || phase === 'reason';
  const finishRef = useRef<(r: 'clear' | 'time' | 'citations') => void>(() => {});
  const clock = useCountdown({
    totalMs: days[0]?.ms ?? 60000,
    running,
    warnAtMs: 9000,
    onWarn: () => sfx.click(),
    onEnd: () => finishRef.current('time'),
  });
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const combo = useCombo({ onTierUp: () => { sfx.coin(); clockRef.current.extend(T_TIER); } });
  const shownScore = useCountUp(score);
  const pb = usePersonalBest('word-customs');

  // ── 진행 ────────────────────────────────────────────────────────────────
  const openPledgeWindow = useCallback(() => {
    setPledged(false);
    setPledgeOpen(true);
    armAtRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ARM_DELAY_MS;
    clearT(winTimer);
    winTimer.current = window.setTimeout(() => setPledgeOpen(false), PLEDGE_WINDOW_MS);
  }, []);

  const finish = useCallback((reason: 'clear' | 'time' | 'citations') => {
    clearAll();
    lockRef.current = true;
    setEndReason(reason);
    setPhase('done');
    if (reason === 'clear') sfx.fanfare();
  }, [clearAll, sfx]);
  finishRef.current = finish;

  const beginShift = useCallback((idx: number) => {
    clearAll();
    setBannerDay(idx);
    setPhase('shift');
    lockRef.current = true;
    shiftTimer.current = window.setTimeout(() => {
      const d = daysRef.current[idx];
      if (!d) return;
      dayCorrect.current = 0; dayCaught.current = 0; dayCitations.current = 0;
      lockRef.current = false;
      setDayIdx(idx); setTIdx(0); setLives(CITATIONS);
      setOutcome(null); setStamp(null); setBurst(null);
      clockRef.current.reset(d.ms);
      setPhase('inspect');
      openPledgeWindow();
    }, SHIFT_BANNER_MS);
  }, [clearAll, openPledgeWindow]);
  const beginRef = useRef(beginShift);
  beginRef.current = beginShift;

  useEffect(() => {
    beginRef.current(0);
    return () => { clearAll(); };
  }, [clearAll]);

  // 개인 최고 기록은 렌더가 아니라 효과에서 제출한다(렌더 중 setState 금지).
  useEffect(() => {
    if (phase !== 'done' || record) return;
    setRecord(pb.submit(scoreRef.current));
  }, [phase, record, pb]);

  const advance = useCallback(() => {
    if (phaseRef.current !== 'reveal') return;
    // 오심 예산이 바닥나면 이 서류가 마지막 — 여기서 나아가면 해제 통보 타이머를 지워버린다.
    if (livesRef.current === 0) return;
    clearT(advTimer);
    const d = daysRef.current[dayIdxRef.current];
    if (!d) return;
    lockRef.current = false;
    if (tIdx + 1 < d.travelers.length) {
      setTIdx((i) => i + 1);
      setOutcome(null); setStamp(null); setBurst(null);
      setPhase('inspect');
      openPledgeWindow();
      return;
    }
    // 근무일 종료 — 남은 시간을 점수로 환산(빨리 비운 줄이 보상된다)
    const bonus = Math.max(0, Math.floor(clockRef.current.remainMs / 1000)) * 8;
    if (bonus > 0) { setScore((s) => s + bonus); sfx.coin(); }
    if (dayCitations.current === 0) cleanDays.current += 1;
    setDaySummary({ day: dayIdxRef.current + 1, correct: dayCorrect.current, caught: dayCaught.current, bonus });
    if (dayIdxRef.current + 1 < daysRef.current.length) beginRef.current(dayIdxRef.current + 1);
    else finish('clear');
  }, [tIdx, openPledgeWindow, finish, sfx]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // ── 판정 ────────────────────────────────────────────────────────────────
  const finalize = useCallback((kind: OutcomeKind, stampKind: StampKind, text: string, caught: boolean) => {
    const t = travelerRef.current;
    if (!t) return;
    const gainMs = daysRef.current[dayIdxRef.current]?.gainMs ?? T_CORRECT;
    clearT(winTimer); clearT(deadTimer);
    setPledgeOpen(false);
    setProcessed((n) => n + 1);
    stampSeq.current += 1;
    const seq = stampSeq.current;
    setStamp({ kind: stampKind, n: seq });

    if (kind === 'correct') {
      const c = combo.hit();
      const mult = multFor(c);
      const wasPledged = pledgedRef.current;
      const g = Math.round((100 + (caught ? 60 : 0)) * mult * (wasPledged ? 2 : 1));
      setScore((s) => s + g);
      setGain({ v: g, mult, pledged: wasPledged, n: seq });
      clearT(gainTimer);
      gainTimer.current = window.setTimeout(() => setGain(null), 980);
      setCorrectN((n) => n + 1);
      dayCorrect.current += 1;
      if (caught) {
        setCaughtN((n) => n + 1);
        dayCaught.current += 1;
        setBurst({ n: seq, power: 1 + Math.floor(c / 4) });
      }
      if (wasPledged) setPledgeWin((n) => n + 1);
      clockRef.current.extend(gainMs + (wasPledged ? T_PLEDGE : 0));
      sfx.correct(c, c % 3 === 0);
      // ── FSRS 무결성 ──────────────────────────────────────────────────────
      // '카드를 갱신해도 되는 성공' 은 **영어를 인출해야만 낼 수 있는 성공** 하나뿐이다.
      //  · 진본 통과 → 뜻이 서류에 인쇄된 채로 예/아니오만 고른 것. 눈 감고 A 만 눌러도
      //    40% 는 맞는다(시뮬: 무독해 승인연타의 진본 적중 7.3건/판). assisted.
      //  · 품사 위조 적발 → 인쇄된 한국어 뜻이 품사를 이미 알려준다('배열하다'=동사).
      //    영어 지식 없이 적발되므로 assisted.
      //  · 예문 위조 적발 → 진본 품사가 함께 인쇄돼 있어 같은 경로로 풀린다. assisted.
      //  · 뜻 위조 적발 → 도너를 품사까지 맞춰 뽑으므로 한국어만으로는 갈리지 않는다. 인출 증거.
      //  · 철자 위조 적발 → 철자 지식. 인출 증거.
      // 성공은 이렇게 좁히고, 실패는 아래에서 축을 가리지 않고 전부 정직하게 올린다.
      const proves = caught && (t.forgery === 'definition' || t.forgery === 'spelling');
      onCorrect?.({ en: t.en, ko: t.ko }, proves ? undefined : { assisted: true });
    } else if (kind === 'near') {
      combo.miss();
      clockRef.current.drain(T_NEAR);
      sfx.nearMiss();
      onWrong?.({ en: t.en, ko: t.ko });
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    } else if (kind === 'wrong') {
      combo.miss();
      clockRef.current.drain(T_WRONG);
      sfx.wrong();
      dayCitations.current += 1;
      setLives((v) => Math.max(0, v - 1));
      onWrong?.({ en: t.en, ko: t.ko });
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    } else {
      // 미결 — 서약해 놓고 시간 안에 판정하지 못했다. 이전 판(v07.9)은 여기서 onWrong 을
      // 부르지 않아 '목숨도 FSRS 도 안 잃는 무료 스킵' 이 됐고, 결과적으로 **모르는 단어만**
      // 복습 큐에서 조용히 사라졌다(반증 익스플로짓 #5 · letter-forge 와 같은 함정).
      // 미결은 인출 실패다 — 정직하게 오답으로 올린다. 대신 목숨은 깎지 않고 문구도
      // 비난하지 않는다(자진 보류는 찍기보다 정직한 선택이므로 벌은 시간·콤보로만).
      combo.miss();
      clockRef.current.drain(T_LAPSE);
      sfx.nearMiss();
      onWrong?.({ en: t.en, ko: t.ko });
      setLog((l) => [...l, { en: t.en, truth: t.truth, kind }]);
    }

    setOutcome({ kind, text });
    setPhase('reveal');

    if (kind === 'wrong' && dayCitations.current >= CITATIONS) {
      advTimer.current = window.setTimeout(() => finishRef.current('citations'), 1700);
      return;
    }
    if (kind === 'correct') {
      advTimer.current = window.setTimeout(() => advanceRef.current(), AUTO_ADVANCE_MS);
    }
  }, [combo, sfx, onCorrect, onWrong]);

  /** 서류 도착 250ms 이내의 입력은 무시 — 숙련자 속도는 손대지 않고 사고 입력만 거른다. */
  const armed = useCallback(
    () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) >= armAtRef.current,
    [],
  );

  const judge = useCallback((field: Field | null) => {
    if (lockRef.current || !armed()) return;
    const t = travelerRef.current;
    if (!t) return;
    lockRef.current = true;
    if (field === null) {
      if (t.forgery === null) finalize('correct', 'approve', `진본 통과 — 정확한 판단입니다. ${t.truth}`, false);
      else finalize('wrong', 'approve', `위조를 통과시켰습니다. ${t.truth}`, false);
      return;
    }
    if (t.forgery === null) finalize('wrong', 'deny', `진본을 반송했습니다. ${t.truth}`, false);
    else if (field === t.forgery) finalize('correct', 'deny', `적발. ${t.truth}`, true);
    else finalize('near', 'deny', `위조는 맞았지만 항목이 달랐습니다 — 실제는 ${FIELD_LABEL[t.forgery]} 위조. ${t.truth}`, false);
  }, [finalize, armed]);

  const lapse = useCallback(() => {
    if (lockRef.current) return;
    const t = travelerRef.current;
    if (!t) return;
    lockRef.current = true;
    finalize('lapse', 'pending', `미결로 인계했어요 — 이 단어는 복습 큐에 다시 올려 둡니다. ${t.truth}`, false);
  }, [finalize]);
  const lapseRef = useRef(lapse);
  lapseRef.current = lapse;

  const doPledge = useCallback(() => {
    if (pledgedRef.current || !pledgeOpen || lockRef.current) return;
    setPledged(true);
    setPledgeOpen(false);
    clearT(winTimer);
    sfx.click();
    clearT(deadTimer);
    deadTimer.current = window.setTimeout(() => lapseRef.current(), PLEDGE_LIMIT_MS);
  }, [pledgeOpen, sfx]);

  const onDeny = useCallback(() => {
    if (lockRef.current || !armed()) return;
    const t = travelerRef.current;
    const d = daysRef.current[dayIdxRef.current];
    if (!t || !d) return;
    const c = chipsFor(t, d);
    if (c.length <= 1) { judge(c[0] ?? 'definition'); return; }
    sfx.click();
    setPhase('reason');
  }, [judge, sfx, armed]);

  const chips = traveler && day ? chipsFor(traveler, day) : [];

  // 핸들러 최신본 — 키보드 리스너가 매 프레임 재구독되지 않게 ref 로 고정한다.
  const actRef = useRef({ judge, onDeny, doPledge, chips });
  actRef.current = { judge, onDeny, doPledge, chips };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // OS 키 리피트(≈30ms)는 판정이 아니다. 이게 없으면 A 를 누르고만 있어도 자동 진행 직후마다
      // 승인이 나가 서류당 ≈1.1초로 '읽지 않고 하루 클리어' 가 성립했다(익스플로짓 #4).
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const a = actRef.current;
      const p = phaseRef.current;
      if (p === 'inspect') {
        if (e.code === 'KeyA') { e.preventDefault(); a.judge(null); }
        else if (e.code === 'KeyD') { e.preventDefault(); a.onDeny(); }
        else if (e.code === 'KeyF') { e.preventDefault(); a.doPledge(); }
      } else if (p === 'reason') {
        const m = /^Digit([1-9])$/.exec(e.code);
        if (m) {
          const f = a.chips[Number(m[1]) - 1];
          if (f) { e.preventDefault(); a.judge(f); }
        } else if (e.code === 'Escape') { e.preventDefault(); setPhase('inspect'); }
      } else if (p === 'reveal') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault();
          advanceRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleExit = useCallback(() => { clearAll(); onExit?.(); }, [clearAll, onExit]);
  const restart = useCallback(() => {
    clearAll();
    lockRef.current = true;
    combo.reset();
    stampSeq.current = 0;
    dayCorrect.current = 0; dayCaught.current = 0; dayCitations.current = 0; cleanDays.current = 0;
    setRunSeed((s) => s + 1);
    setScore(0); setProcessed(0); setCorrectN(0); setCaughtN(0);
    setPledgeWin(0); setLives(CITATIONS); setOutcome(null); setStamp(null); setBurst(null);
    setGain(null); setDaySummary(null); setLog([]); setEndReason('clear'); setRecord(null);
    setDayIdx(0); setTIdx(0);
    beginRef.current(0);
  }, [clearAll, combo]);

  const night = dayIdx >= days.length - 1 && days.length > 1;
  const atmos = night
    ? { center: '#E4CFAE', mid: '#A9865A', edge: '#241811', glow: 'rgba(230,150,90,.42)' }
    : { center: '#F2E9D6', mid: '#D6C4A0', edge: '#3C2E22', glow: 'rgba(214,160,90,.3)' };

  // ── 결과 ────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const accuracy = processed ? Math.round((correctN / processed) * 100) : 0;
    const lead = endReason === 'clear'
      ? '근무 종료 — 오늘 국경은 정직했어요'
      : endReason === 'time'
        ? '벨이 울렸어요 — 줄이 아직 남았습니다'
        : '감독관이 교대를 요청했어요';
    const perfect = endReason === 'clear' && log.length === 0;
    const badge = perfect
      ? <>무결 근무 · 오심 0</>
      : combo.best >= 5
        ? <>최장 연속 {combo.best}건</>
        : cleanDays.current > 0
          ? <>무결 근무일 {cleanDays.current}일</>
          : null;
    const hint = endReason === 'time'
      ? '정확한 판정마다 4초가 돌아와요. 확실한 단어는 속결 서약(F)으로 시간을 벌어 보세요.'
      : endReason === 'citations'
        ? '거부는 항목까지 맞아야 인정돼요. 확신이 없으면 규칙서를 한 줄 더 읽는 편이 빠릅니다.'
        : `다음 근무는 ${(score + 400).toLocaleString()}점을 목표로.`;
    return (
      <div className="gk-root wc-root">
        <GameMusic gameId="word-customs" />
        <div className="gk-sr" aria-live="assertive">{outcome?.text ?? ''}</div>
        <GameKitStyles />
        <AmbientBackground center={atmos.center} mid={atmos.mid} edge={atmos.edge} glow={atmos.glow} glowAt="50% 30%" watermark="word-customs" />
        <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
        <Hud muted={sfx.muted} onToggleMute={() => sfx.setMuted((m) => !m)} onExit={handleExit} />
        <GameDone
          mark="word-customs"
          lead={lead}
          celebrate={perfect}
          badge={badge}
          best={record ? { prev: record.prev, now: score, label: '점수', improved: record.improved } : undefined}
          stats={[
            { num: score.toLocaleString(), label: '점수', accent: true },
            { num: `${accuracy}%`, label: `판정 정확도 · ${correctN}/${processed}` },
            { num: caughtN, label: '위조 적발' },
            { num: pledgeWin, label: '속결 성공' },
          ]}
          reveal={log.length > 0 ? (
            <div className="wc-recap">
              <span className="wc-recap-h">놓친 서류 — 다음 근무 전에 한 번만 더</span>
              {log.slice(-6).map((r, i) => (
                <span key={`${r.en}-${i}`} className="wc-recap-row">
                  {/* 미결은 '오심'이 아니다 — 목숨을 깎지 않았고 판정 자체가 없었다. 중립 아이콘. */}
                  <FeedbackIcon kind={r.kind === 'near' || r.kind === 'lapse' ? 'near' : 'wrong'} size={13} />
                  <span><b>{r.en}</b> — {r.truth}</span>
                </span>
              ))}
            </div>
          ) : undefined}
          restartHint={hint}
          restartLabel="다음 근무"
          onRestart={restart}
          onExit={handleExit}
        />
      </div>
    );
  }

  const bannerDayData = days[bannerDay];
  const newRule = bannerDay > 0 && bannerDayData
    ? bannerDayData.rules.filter((r) => !days[bannerDay - 1].rules.includes(r))
    : [];

  return (
    <div className="gk-root wc-root">
      <GameMusic gameId="word-customs" />
      <div className="gk-sr" aria-live="assertive">{outcome?.text ?? ''}</div>
      <GameKitStyles />
      <AmbientBackground center={atmos.center} mid={atmos.mid} edge={atmos.edge} glow={atmos.glow} glowAt="50% 20%" watermark="word-customs" />
      <style dangerouslySetInnerHTML={{ __html: WC_CSS }} />
      <Hud
        score={shownScore}
        progress={totalTravelers ? processed / totalTravelers : 0}
        combo={combo.combo}
        comboMult={combo.mult}
        muted={sfx.muted}
        onToggleMute={() => sfx.setMuted((m) => !m)}
        onExit={handleExit}
        extra={
          <div className="wc-clock">
            <div className="wc-clock-top">
              <span className="gk-stat-label">제 {dayIdx + 1} 일 근무</span>
              <LifePips total={CITATIONS} left={lives} label="남은 오심 여유" />
            </div>
            <TimerBar frac={clock.frac} warning={clock.warning} seconds={clock.remainSec} label="근무 종료까지" />
          </div>
        }
      />

      {/* 콤보 글로우는 .gk-root 직계 자식이어야 z-index 0 바닥으로 깔린다. <main> 안에 두면
          main 내부의 마지막 positioned 요소가 되어 콤보 13 이상에서 서류를 덮었다. */}
      <div className="gk-energy" aria-hidden="true" style={{ opacity: Math.min(0.4, combo.combo * 0.03), transform: `scale(${1 + combo.tierIndex * 0.1})` }} />

      <main className="gk-stage wc-stage">
        {phase === 'shift' ? (
          <div className="wc-banner" role="status">
            <span className="wc-banner-day">제 {bannerDay + 1} 일 근무</span>
            <span className="wc-banner-sub">
              서류 {bannerDayData?.travelers.length ?? 0}건 · 제한 {Math.round((bannerDayData?.ms ?? 0) / 1000)}초
            </span>
            {newRule.length > 0 && (
              <div className="wc-banner-rules">
                <span className="wc-banner-newh">추가된 규칙</span>
                {newRule.map((r) => <span key={r} className="wc-banner-rule">{r}</span>)}
              </div>
            )}
            {daySummary && (
              <span className="wc-banner-prev">
                제 {daySummary.day} 일 결산 — 정확 {daySummary.correct} · 적발 {daySummary.caught} · 시간 보너스 +{daySummary.bonus}
              </span>
            )}
          </div>
        ) : traveler && day ? (
          <>
            <RuleCard rules={day.rules} dayNo={dayIdx + 1} gainSec={Math.round(day.gainMs / 1000)} />

            <div className="wc-doc-wrap">
              <Permit
                t={traveler}
                tone={phase === 'reveal' ? (outcome?.kind ?? null) : null}
                serial={phase === 'reveal' ? processed : processed + 1}
                revealed={phase === 'reveal'}
              />
              {/* stamp·burst·gain 은 같은 부모의 형제이고 각자 자기 카운터(.n)로 키를 쓴다.
                  셋은 같은 판정에서 함께 증가하므로 n 이 겹치는 순간 React 가
                  "two children with the same key" 로 한쪽을 버린다(실측 세션당 5회).
                  리마운트(애니메이션 재생) 효과는 유지하고 충돌만 없애려면 네임스페이스가 필요하다. */}
              {stamp && (
                <div key={`stamp-${stamp.n}`} className={`wc-stampmark wc-stampmark--${stamp.kind}`} aria-hidden="true">
                  <span className="wc-stampmark-ko">{stamp.kind === 'approve' ? '통과' : stamp.kind === 'deny' ? '반송' : '미결'}</span>
                  <span className="wc-stampmark-en">{stamp.kind === 'approve' ? 'APPROVED' : stamp.kind === 'deny' ? 'DENIED' : 'PENDING'}</span>
                </div>
              )}
              {burst && (
                <span key={`burst-${burst.n}`} className="wc-burst-at" aria-hidden="true">
                  <ParticleBurst intensity={burst.power} colors={['var(--success)', 'var(--streak)', 'var(--combo)']} />
                </span>
              )}
              {gain && (
                <span key={`gain-${gain.n}`} className="wc-gain" aria-hidden="true">
                  +{gain.v}{gain.mult > 1 && <em>×{gain.mult}</em>}{gain.pledged && <em>속결×2</em>}
                </span>
              )}
              {pledged && phase !== 'reveal' && (
                <div className="wc-pledge-bar" aria-hidden="true"><span key={traveler.key} /></div>
              )}
            </div>

            {phase === 'reveal' ? (
              <div className="wc-verdict-box">
                <span className={`wc-verdict wc-verdict--${outcome?.kind ?? 'wrong'}`}>
                  {/* lapse 에 'wrong' 아이콘을 붙이면 스크린리더가 '오답' 이라 읽는다 — 미결은 중립. */}
                  <FeedbackIcon kind={outcome?.kind === 'correct' ? 'correct' : (outcome?.kind === 'near' || outcome?.kind === 'lapse') ? 'near' : 'wrong'} size={18} />
                  {outcome?.kind === 'correct' ? '정확' : outcome?.kind === 'near' ? '항목 오인' : outcome?.kind === 'lapse' ? '미결' : '오심'}
                </span>
                <span className="wc-truth">{outcome?.text}</span>
                {outcome?.kind === 'correct' ? (
                  <span className="wc-autoline" aria-hidden="true"><i /></span>
                ) : lives === 0 ? (
                  <span className="wc-relieved">오심 여유를 다 썼어요 — 교대 인계 중…</span>
                ) : (
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  <button type="button" className="gk-btn gk-btn--primary wc-next" onClick={advance} autoFocus>
                    다음 서류 <Kbd>Space</Kbd>
                  </button>
                )}
              </div>
            ) : phase === 'reason' ? (
              <div className="wc-reason">
                <span className="wc-reason-h">어느 항목이 위조입니까?</span>
                <div className="wc-chips">
                  {chips.map((f, i) => (
                    <button key={f} type="button" className="wc-chip" onClick={() => judge(f)}>
                      {FIELD_LABEL[f]} <Kbd>{i + 1}</Kbd>
                    </button>
                  ))}
                </div>
                <button type="button" className="wc-back" onClick={() => setPhase('inspect')}>
                  ← 서류 다시 보기 <Kbd>Esc</Kbd>
                </button>
              </div>
            ) : (
              <div className="wc-actions">
                <div className="wc-stamps">
                  <button type="button" className="wc-stamp wc-stamp--approve" onClick={() => judge(null)}>
                    승인<span>APPROVE <Kbd>A</Kbd></span>
                  </button>
                  <button type="button" className="wc-stamp wc-stamp--deny" onClick={onDeny}>
                    거부<span>DENY <Kbd>D</Kbd></span>
                  </button>
                </div>
                <button
                  type="button"
                  className="wc-pledge"
                  onClick={doPledge}
                  aria-disabled={!pledgeOpen || pledged}
                  data-armed={pledged ? '1' : '0'}
                >
                  {/* 판돈을 걸기 전에 대가를 전부 보여준다 — '안 알려준 룰' 은 이 게임의 재발 지적이었다. */}
                  {pledged
                    ? `속결 서약 중 — ${PLEDGE_LIMIT_MS / 1000}초 안에 판정 (놓치면 미결 −${T_LAPSE / 1000}초 · 콤보 끊김)`
                    : pledgeOpen
                      ? <>속결 서약 · 점수 ×2 · 실패 시 미결 −{T_LAPSE / 1000}초 <Kbd>F</Kbd></>
                      : '속결 창 종료 — 천천히 봐도 됩니다'}
                </button>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

const WC_CSS = `
  .wc-clock { display: flex; flex-direction: column; gap: 5px; align-items: stretch; min-width: 136px; }
  .wc-clock-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wc-root .wc-stage { gap: clamp(10px, 2.2vh, 20px); justify-content: flex-start; padding-top: clamp(12px, 2.4vh, 24px); overflow-y: auto; overscroll-behavior: contain; }

  .wc-rules { display: flex; flex-direction: column; gap: 4px; width: min(560px, 94vw); padding: 11px 16px; border-radius: 10px; background: color-mix(in srgb, var(--bg) 55%, transparent); border: 1px solid var(--bd); border-left: 3px solid var(--error); backdrop-filter: blur(3px); }
  .wc-rules-h { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--error); font-weight: 800; }
  .wc-rule { font-size: 12.5px; color: var(--t2); font-weight: 600; }
  .wc-rule--std { color: var(--t3); font-weight: 500; font-size: 11.5px; margin-top: 2px; }

  .wc-doc-wrap { position: relative; width: min(560px, 94vw); }
  .wc-doc { border-radius: 14px; background: color-mix(in srgb, var(--bg) 82%, #fff); border: 1px solid var(--bd); box-shadow: 0 20px 44px -22px rgba(40,26,14,.6); overflow: hidden; transition: box-shadow .2s, transform .13s var(--ease-settle, ease-out); }
  .wc-doc--ok { box-shadow: 0 0 0 2px var(--success), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc--near { box-shadow: 0 0 0 2px var(--streak, var(--combo)), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc--no { box-shadow: 0 0 0 2px var(--error), 0 20px 44px -22px rgba(40,26,14,.6); transform: translateY(3px); }
  .wc-doc-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: color-mix(in srgb, var(--t1) 8%, transparent); border-bottom: 1px solid var(--bd); }
  .wc-doc-title { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .12em; color: var(--t2); font-weight: 700; }
  .wc-doc-serial { font-family: var(--font-english, monospace); font-size: 11px; color: var(--t3); }
  .wc-headword { font-family: var(--font-english, monospace); font-size: clamp(26px, 5vw, 38px); font-weight: 800; text-align: center; padding: 14px 10px 8px; color: var(--t1); letter-spacing: .01em; overflow-wrap: anywhere; }
  .wc-headword[data-forged="true"] { color: var(--error); text-decoration: underline wavy var(--error); }
  .wc-fields { display: flex; flex-direction: column; padding: 4px 16px 16px; }
  .wc-row { display: grid; grid-template-columns: 74px 1fr; gap: 10px; padding: 8px; border-radius: 8px; border-bottom: 1px solid var(--bd); align-items: baseline; }
  .wc-row:last-child { border-bottom: none; }
  .wc-row--forged { background: var(--error-light); box-shadow: inset 3px 0 0 var(--error); }
  .wc-row--fixed { background: var(--success-light); box-shadow: inset 3px 0 0 var(--success); }
  .wc-k { font-family: var(--font-english, monospace); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); font-weight: 700; }
  .wc-v { font-size: 14.5px; color: var(--t1); font-weight: 600; }
  .wc-ex { font-family: var(--font-body, Georgia, serif); font-weight: 400; font-size: 14px; line-height: 1.45; }
  .wc-ex b { font-family: var(--font-english, system-ui); font-weight: 800; color: var(--combo); }
  .wc-fix { color: var(--success); font-style: normal; font-weight: 800; font-size: 13px; }

  /* 각인 — 이 게임의 시그니처 순간. 종이에 스며들도록 합성 모드로 눌러 찍는다. */
  .wc-stampmark { position: absolute; top: 44%; left: 50%; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 10px 20px; border: 3px double currentColor; border-radius: 8px; transform: translate(-50%, -50%) rotate(-13deg); opacity: .84; mix-blend-mode: multiply; pointer-events: none; animation: wc-stamp .14s cubic-bezier(.34,1.56,.64,1); }
  .wc-stampmark-ko { font-family: var(--font-display, system-ui); font-size: 21px; font-weight: 900; letter-spacing: .1em; line-height: 1; }
  .wc-stampmark-en { font-family: var(--font-english, monospace); font-size: 10px; font-weight: 800; letter-spacing: .22em; opacity: .8; }
  .wc-stampmark--approve { color: var(--success); }
  .wc-stampmark--deny { color: var(--error); }
  .wc-stampmark--pending { color: var(--t3); }
  [data-theme="dark"] .wc-stampmark { mix-blend-mode: screen; opacity: .96; }
  @keyframes wc-stamp { from { transform: translate(-50%, -50%) rotate(-13deg) scale(2.6); opacity: 0; } to { transform: translate(-50%, -50%) rotate(-13deg) scale(1); opacity: .84; } }

  .wc-burst-at { position: absolute; top: 44%; left: 50%; width: 0; height: 0; pointer-events: none; }
  .wc-gain { position: absolute; top: 10%; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: baseline; gap: 5px; font-family: var(--font-english, monospace); font-size: 19px; font-weight: 900; color: var(--combo); pointer-events: none; animation: gk-gain .95s ease-out forwards; white-space: nowrap; }
  .wc-gain em { font-style: normal; font-size: 12.5px; color: var(--streak, var(--combo)); }

  .wc-pledge-bar { position: absolute; left: 0; right: 0; top: -7px; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; }
  .wc-pledge-bar span { display: block; height: 100%; border-radius: 999px; background: var(--streak, var(--combo)); transform-origin: left center; animation: wc-drain ${PLEDGE_LIMIT_MS}ms linear forwards; }
  @keyframes wc-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .wc-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wc-stamps { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .wc-stamp { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 132px; min-height: 60px; padding: 12px 20px; border-radius: 12px; border: 2px solid; background: var(--bg); cursor: pointer; font-family: var(--font-display, system-ui); font-size: 19px; font-weight: 800; transition: transform .1s, box-shadow .15s, background .15s; }
  .wc-stamp span { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .2em; opacity: .78; }
  .wc-stamp:active { transform: scale(.95) rotate(-2deg); }
  .wc-stamp--approve { color: var(--success); border-color: var(--success); }
  .wc-stamp--approve:hover { background: var(--success-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--success) 26%, transparent); }
  .wc-stamp--deny { color: var(--error); border-color: var(--error); }
  .wc-stamp--deny:hover { background: var(--error-light); box-shadow: 0 8px 22px color-mix(in srgb, var(--error) 26%, transparent); }
  .wc-stamp:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 34%, transparent); }

  .wc-pledge { display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; text-align: center; line-height: 1.35; max-width: min(560px, 94vw); gap: 7px; min-height: 44px; padding: 7px 18px; border-radius: 999px; border: 1.5px dashed color-mix(in srgb, var(--streak, var(--combo)) 60%, var(--bd)); background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--t2); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 800; cursor: pointer; transition: transform .12s, background .15s, color .15s, border-color .15s, opacity .2s; }
  .wc-pledge:hover { color: var(--t1); background: color-mix(in srgb, var(--streak, var(--combo)) 14%, transparent); }
  .wc-pledge:active { transform: scale(.97); }
  .wc-pledge:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--streak, var(--combo)) 32%, transparent); }
  .wc-pledge[aria-disabled="true"] { pointer-events: none; opacity: .45; border-style: solid; }
  .wc-pledge[data-armed="1"] { opacity: 1; border-style: solid; border-color: var(--streak, var(--combo)); color: var(--streak, var(--combo)); background: color-mix(in srgb, var(--streak, var(--combo)) 16%, transparent); }

  .wc-reason { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wc-reason-h { font-size: 14px; font-weight: 800; color: var(--t1); }
  .wc-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .wc-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 48px; padding: 0 20px; border-radius: 999px; border: 1.5px solid var(--error); background: var(--bg); color: var(--t1); font-size: 14px; font-weight: 700; cursor: pointer; transition: transform .1s, background .15s, box-shadow .15s; }
  .wc-chip:hover { background: var(--error-light); transform: translateY(-2px); box-shadow: 0 6px 16px color-mix(in srgb, var(--error) 22%, transparent); }
  .wc-chip:active { transform: scale(.96); }
  .wc-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 30%, transparent); }
  .wc-back { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 8px; background: none; border: 1px solid transparent; color: var(--t3); font-size: 12.5px; font-weight: 700; cursor: pointer; transition: color .15s, border-color .15s, transform .1s; }
  .wc-back:hover { color: var(--t1); border-color: var(--bd); }
  .wc-back:active { transform: scale(.97); }
  .wc-back:focus-visible { outline: none; border-color: var(--bd); box-shadow: 0 0 0 3px color-mix(in srgb, var(--t3) 28%, transparent); }

  .wc-verdict-box { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding-bottom: 10px; }
  .wc-verdict { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-display, system-ui); font-size: 20px; font-weight: 900; animation: gk-pop .4s ease-out; }
  .wc-verdict--correct { color: var(--success); }
  .wc-verdict--near { color: var(--streak, var(--combo)); }
  .wc-verdict--wrong { color: var(--error); }
  .wc-verdict--lapse { color: var(--t3); }
  .wc-truth { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 14px; color: var(--t2); max-width: 48ch; line-height: 1.55; }
  .wc-next { margin-top: 6px; min-width: 170px; display: inline-flex; align-items: center; gap: 8px; justify-content: center; }
  .wc-autoline { display: block; width: 170px; height: 3px; border-radius: 999px; background: color-mix(in srgb, var(--t1) 12%, transparent); overflow: hidden; margin-top: 6px; }
  .wc-autoline i { display: block; height: 100%; background: var(--success); transform-origin: left center; animation: wc-drain ${AUTO_ADVANCE_MS}ms linear forwards; }
  .wc-relieved { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13.5px; color: var(--t3); }

  .wc-banner { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; margin: auto 0; animation: wc-rise .4s var(--ease-settle, ease-out); }
  .wc-banner-day { font-family: var(--font-display, system-ui); font-size: clamp(30px, 8vw, 48px); font-weight: 900; letter-spacing: -.02em; color: var(--t1); }
  .wc-banner-sub { font-family: var(--font-english, monospace); font-size: 12px; letter-spacing: .14em; color: var(--t3); font-weight: 700; }
  .wc-banner-rules { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--error); background: color-mix(in srgb, var(--error) 9%, transparent); animation: wc-pulse 1.2s ease-out 1; }
  .wc-banner-newh { font-family: var(--font-english, monospace); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--error); font-weight: 800; }
  .wc-banner-rule { font-size: 13px; font-weight: 700; color: var(--t1); }
  .wc-banner-prev { font-family: var(--font-body, Georgia, serif); font-style: italic; font-size: 13px; color: var(--t3); margin-top: 4px; }
  @keyframes wc-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wc-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--error) 45%, transparent); } 100% { box-shadow: 0 0 0 14px transparent; } }

  .wc-recap { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .wc-recap-h { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--t3); }
  .wc-recap-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.55; color: var(--t2); }
  .wc-recap-row b { font-family: var(--font-english, monospace); color: var(--t1); }

  /* HUD 2행화 — 기본 6열(auto 1fr auto auto auto auto)의 auto 합계가 ≈430px 라
     390px 에서 '나가기'가 .gk-root{overflow:hidden} 밖으로 잘려 나갔다. 근무 시계를
     둘째 행 전폭으로 내리면 첫 행은 점수·진행·콤보·음소거·나가기 5칸으로 정확히 맞는다.
     (공용 킷을 건드리지 않고 .wc-root 스코프에서만 재배치한다.) */
  @media (max-width: 430px) {
    .wc-root .gk-hud { grid-template-columns: auto 1fr auto auto auto; row-gap: 9px; column-gap: 8px; padding: 12px 12px; }
    .wc-root .gk-hud > .wc-clock { grid-column: 1 / -1; grid-row: 2; min-width: 0; }
  }

  @media (max-width: 420px) {
    .wc-stamp { min-width: 118px; }
    /* 시계가 둘째 행 전폭이 되었으므로 '제 N 일 근무' 레이블을 숨길 이유가 사라졌다. */
  }

  @media (prefers-reduced-motion: reduce) {
    .wc-verdict, .wc-banner, .wc-banner-rules { animation: none; }
    .wc-stampmark { animation: wc-stamp-rm .22s ease-out; }
    .wc-gain { animation: wc-fade-out .9s ease-out forwards; }
    .wc-chip:hover { transform: none; }
    .wc-chip:active, .wc-stamp:active, .wc-pledge:active, .wc-back:active { transform: none; }
    .wc-doc--ok, .wc-doc--near, .wc-doc--no { transform: none; }
  }
  @keyframes wc-stamp-rm { from { opacity: 0; } to { opacity: .84; } }
  @keyframes wc-fade-out { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
`;
