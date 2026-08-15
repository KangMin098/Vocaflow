// apps/web/src/lib/learner/today-blocks.ts
//
// 처방 5블록 → 화면이 쓰는 형태로 접는 순수 모듈. JSX 없음.
//
// 왜 뽑았나: /hub 과 재설계 랩이 같은 블록 구성을 각자 갖고 있으면 반드시 어긋난다.
// (이 프로젝트가 이름·라벨에서 이미 겪은 계열의 결함 — apps/web/CLAUDE.md 참조.)
// 랩(hub-lab)도 이 모듈을 import 한다 — 후보를 비교할 때 블록 구성이 본 화면과 같아야 한다.

import {
  BookOpenText,
  ClipboardCheck,
  Headphones,
  ListOrdered,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'

import { PRESCRIPTION_BLOCK_NAME } from './prescription-blocks'
import type { TodayPrescription } from './prescription-actions'

export type TodayBlockKey = 'review' | 'listen' | 'read' | 'syntax' | 'check'

export interface TodayBlock {
  key: TodayBlockKey
  icon: LucideIcon
  /** 표시 이름 — prescription-blocks 레지스트리에서 온다(화면에서 짓지 않는다) */
  name: string
  /** 지금 할 일로 승격됐을 때 쓰는 문장 — 명사가 아니라 "무엇을 왜" */
  headline: string
  minutes: number
  href: string
  /**
   * article 후보로 진입하는 블록. article 은 URL 직결이 불가하고 startArticleLearning 이
   * texts 행으로 변환한 뒤에야 /text/[id] 가 생긴다(PrescriptionArticleLaunch 와 같은 계약).
   */
  articleId?: string
  done: boolean
  locked: boolean
}

/**
 * 블록 → 완료로 인정하는 활동 모듈 id.
 *
 * ⚠️ **값은 DB enum 실측치다** (`learning_records.module` · `daily_activity.by_module`).
 * 이전 코드는 듣기 블록을 `'echomatch'` 로 판정했는데 enum 에 있는 값은 `'echo'` 다
 * (2026-08-15 pg_enum 실측 — `echomatch` 는 아예 없다). 그래서 **듣기 블록은 무엇을 해도
 * 완료가 되지 않았다.** 단위 테스트도 같은 오타를 그대로 썼기 때문에 통과하고 있었다.
 * 이 표를 고칠 때는 반드시 enum 을 다시 확인할 것 — 화면은 멀쩡히 뜨고 판정만 조용히 죽는다.
 */
export const BLOCK_MODULES: Record<TodayBlockKey, readonly string[]> = {
  review: ['flashcard', 'wordvault', 'pairflip', 'spellforge', 'wordblitz'],
  listen: ['echo'],
  read: ['textviewer', 'workspace'],
  // ⚠️ 비어 있는 것이 맞다. DCP(구문 연습)는 `learning_records`/`daily_activity` 가 아니라
  // `csat_item_attempts` 에 남는다(`grade_dcp_item` 이 직접 INSERT). 그래서 완료 신호를
  // 이 표가 아니라 `buildTodayBlocks` 의 `dcpDoneToday` 인자로 따로 받는다 —
  // 여기에 `'dcp'` 같은 가짜 키를 넣으면 "값은 전부 enum 실측치" 라는 이 표의 계약이 깨진다.
  syntax: [],
  check: ['scriptquiz'],
}

/** KST 오늘 00:00 (UTC ms) — 활동이 "오늘" 것인지 판정한다. */
export function kstTodayStartMs(): number {
  const KST = 9 * 3_600_000
  return Math.floor((Date.now() + KST) / 86_400_000) * 86_400_000 - KST
}

/** 읽기 블록 진입 경로 — 후보 1순위 도서. 후보가 없거나 article 이면 서재(article 은 버튼이 처리). */
function readHref(p: TodayPrescription): string {
  const first = p.input.candidates[0]
  return first?.kind === 'book' ? `/library/books/${first.id}` : '/library/books'
}

function readArticleId(p: TodayPrescription): string | undefined {
  const first = p.input.candidates[0]
  return first?.kind === 'article' ? first.id : undefined
}

/**
 * 처방 + 오늘 손댄 모듈 → 5블록.
 *
 * 완료 판정을 상수로 두지 않는 이유: 처방에는 완료 상태가 없다. 활동 기록에서 읽지 않으면
 * 이 화면은 다시 "누구에게나 같은 숫자" 가 된다(현행 허브들이 그랬다).
 */
export function buildTodayBlocks(
  p: TodayPrescription,
  touchedToday: ReadonlySet<string>,
  /**
   * 오늘 DCP(구문 연습) 문항을 푼 적이 있는가 — `csat_item_attempts` 에서 온다.
   *
   * 별도 인자인 이유는 저장 위치가 다르기 때문이다(위 `BLOCK_MODULES.syntax` 주석).
   * 기본값 false 는 "모름" 이 아니라 "안 했음" 이다 — 호출부가 안 넘기면 완료로 올리지 않는다.
   */
  dcpDoneToday = false,
): TodayBlock[] {
  const touched = (key: TodayBlockKey) => BLOCK_MODULES[key].some((m) => touchedToday.has(m))

  return [
    {
      key: 'review',
      icon: RotateCcw,
      name: PRESCRIPTION_BLOCK_NAME.review,
      headline:
        p.dueCount > 0
          ? `기억이 흐려진 단어 ${p.dueCount}개를 다시 만나요`
          : '오늘 복습할 단어는 없어요',
      minutes: 10,
      href: '/flashcard/play',
      // 밀린 단어가 0이 되는 것만 완료로 보면, 오늘 200개를 복습해도 41개가 남는 한
      // "아무것도 안 한" 것이 된다. 오늘 실제로 복습을 했다면 그것도 완료다.
      done: p.dueCount === 0 || touched('review'),
      locked: false,
    },
    {
      key: 'listen',
      icon: Headphones,
      name: PRESCRIPTION_BLOCK_NAME.listen,
      headline: '원어민 음성을 따라 소리 내어 읽어요',
      minutes: 10,
      href: p.listeningTextId ? `/text/${p.listeningTextId}/echo` : '/library/books',
      done: touched('listen'),
      locked: false,
    },
    {
      key: 'read',
      icon: BookOpenText,
      name: PRESCRIPTION_BLOCK_NAME.read,
      headline: `${p.input.stageBand} 수준 지문을 하나 읽어요`,
      minutes: 30,
      href: readHref(p),
      articleId: readArticleId(p),
      done: touched('read'),
      locked: false,
    },
    {
      key: 'syntax',
      icon: ListOrdered,
      name: PRESCRIPTION_BLOCK_NAME.syntax,
      headline: `문장 배열·삽입 ${p.practiceCount}개로 구조를 잡아요`,
      minutes: 15,
      href: '/practice/dcp',
      done: dcpDoneToday,
      locked: !p.practiceActive,
    },
    {
      key: 'check',
      icon: ClipboardCheck,
      name: PRESCRIPTION_BLOCK_NAME.check,
      headline: '오늘 읽은 것이 남았는지 확인해요',
      minutes: 10,
      href: '/scriptquiz',
      done: touched('check'),
      locked: false,
    },
  ]
}

/**
 * 오늘의 진행 — **앱 전체에서 이 함수 하나만** 쓴다.
 *
 * 이전에는 같은 화면이 두 개의 진행을 동시에 그렸다(2026-08-15 실측 스크린샷):
 * 셸 상태 띠는 `오늘 2/3`, 바로 아래 무대의 "오늘의 흐름" 은 `0/5`. 두 값 모두 근거가
 * 있었지만(띠는 굵은 4갈래를 `daily_activity.by_module` 로, 무대는 5블록을 클라이언트가
 * 받아 온 최근 활동 목록으로) 학습자에게는 **둘 중 무엇을 믿어야 하는지 알 방법이 없었다.**
 *
 * 잠긴 블록은 분모에서 뺀다 — 오늘 열리지 않은 것은 오늘의 분량이 아니다.
 */
export function blockProgress(blocks: readonly TodayBlock[]): { done: number; total: number } {
  const counted = blocks.filter((b) => !b.locked)
  return { done: counted.filter((b) => b.done).length, total: counted.length }
}

/** 지금 할 블록 — 아직 안 했고 열려 있는 첫 블록. 전부 끝났으면 null. */
export function pickNow(blocks: TodayBlock[]): TodayBlock | null {
  return blocks.find((b) => !b.done && !b.locked) ?? null
}

/** 오늘 손댄 모듈 집합 — 활동 기록에서 KST 오늘 것만 추린다. */
export function touchedModulesToday(
  activities: ReadonlyArray<{ module: unknown; createdAt: string }>,
): Set<string> {
  const start = kstTodayStartMs()
  return new Set(
    activities
      .filter((a) => new Date(a.createdAt).getTime() >= start)
      .map((a) => String(a.module)),
  )
}
