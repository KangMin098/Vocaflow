// apps/web/src/components/game/scriptquiz/ScriptQuizQueue.tsx
//
// ScriptQuiz 진입면 — **"읽은 것의 확인 대기열"**. 카탈로그가 아니다.
//
// 이전 진입면은 퀴즈가 있는 챕터 129개를 동일한 버튼으로 5.57 화면 높이만큼 나열했다.
// 학습자는 고를 근거가 없었고(어느 걸 읽었는지 화면이 말하지 않았다), 그중 41개는
// **아직 읽지 않은 챕터**라 풀면 줄거리가 새어 나갔다. 지금 이 화면이 답하는 질문은
// "129개 중 무엇을 고를까" 가 아니라 **"읽은 것 중 무엇이 아직 확인되지 않았나"** 다.
//
// 구조 (위에서 아래로 딱 세 층):
//   ① 다음 한 걸음 하나 — 읽은 지 가장 오래된 미확인 챕터 (§4④ 한 번에 한 걸음만)
//   ② 읽고 있는 책들 — 책 한 장씩, 펼치면 **읽은 챕터만** 칩으로
//   ③ 안 읽은 챕터는 목록에 없다 — 대신 "읽으러 가기". 잠그지 않는다(§4①), 없앤다.
//
// Calm UI: 정답률을 붉게 압박하지 않는다. 확인 여부는 채움/빈 점 + 글자로 말한다
// (색만으로 정보를 전달하지 않는다 — 색맹 대응).

'use client'

import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import styles from '@/components/hub/queue-line.module.css'

import type { QueueBook, QueueChapter, QuizQueue } from '@/lib/scriptquiz/queue'

// 2026-09-19 화면 재설계(DD-37 · docs/design/compare/scriptquiz.md 발산 A 「읽은 챕터 장부」):
//   카드 3종(다음 한 걸음 그림자 카드 · 반짝이 아이콘 점선 빈 상태 · 책마다 테두리 카드 + 앰버 아이콘 칩)과
//   앰버 CTA(hover scale)를 걷고 **괘선 장부**로. 확인 안 한 챕터에 권점 — 이번에 확인할 것(허브·모듈 허브와 같은 표식).
//   1차 행동은 주묵 하나. 번역 토글은 한 줄.
const ACCENT_INK = 'var(--active-ink)'
const PRIMARY =
  'inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px'

/** 며칠 전인지 — "언제 읽었나" 가 이 화면에서 가장 값나가는 한 줄이다(간격 인출 근거). */
function daysAgo(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const d = Math.floor((Date.now() - t) / 86_400_000)
  if (d <= 0) return '오늘 읽었어요'
  if (d === 1) return '어제 읽었어요'
  if (d < 30) return `${d}일 전에 읽었어요`
  const m = Math.floor(d / 30)
  return `${m}달 전에 읽었어요`
}

/** 퀴즈가 준비된 책 한 권 — 빈 상태에서 실제 목록으로 보인다 */
export interface CatalogSample {
  bookId: string
  bookTitle: string
  chapters: number
  questions: number
}

export function ScriptQuizQueue({
  queue,
  hasCatalog,
  catalogSample = [],
}: {
  queue: QuizQueue
  /** 퀴즈 자체가 하나도 없는지 — 빈 상태 문구를 가른다(내가 안 읽은 것 vs 아직 안 만들어진 것) */
  hasCatalog: boolean
  catalogSample?: CatalogSample[]
}) {
  const [showKorean, setShowKorean] = useState(false)
  const ko = showKorean ? '&ko=1' : ''
  const playHref = (bookId: string, ch: number) => `/scriptquiz/play?book=${bookId}&ch=${ch}${ko}`

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      {/* 제목 — 그라디언트 히어로를 쓰지 않는다. 이 화면은 확인하러 오는 자리이지
          브랜드를 보러 오는 자리가 아니다(연습 진입면 v06.202 와 같은 판단). */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-[var(--t1)] pb-3">
        <h1 className="font-editorial text-[30px] font-[500] leading-[1.15] tracking-[-0.014em] text-[var(--t1)] md:text-[36px]">
          읽은 것 확인하기
        </h1>
        {queue.readTotal > 0 && (
          <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
            읽은 {queue.readTotal}챕터 · 확인 안 한 {queue.unconfirmed}개
          </span>
        )}
      </header>

      {queue.next ? (
        <NextStep
          bookTitle={queue.next.bookTitle}
          chapter={queue.next.chapter}
          href={playHref(queue.next.bookId, queue.next.chapter.chapterIdx)}
        />
      ) : (
        <AllCaughtUp readTotal={queue.readTotal} hasCatalog={hasCatalog} catalogSample={catalogSample} />
      )}

      {queue.books.length > 0 && (
        <section aria-label="읽고 있는 책" className="flex flex-col gap-2">
          <h2 className="font-body text-[12px] text-[var(--t2)]">읽고 있는 책</h2>
          {queue.books.map((b) => (
            <BookRow key={b.bookId} book={b} playHref={playHref} />
          ))}
        </section>
      )}

      {/* 언어 보조 — 설정은 맨 아래 한 줄. 시작을 막지 않는다. */}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-t border-[var(--bd)] pt-3">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[13px] font-[600] text-[var(--t1)]">
            한국어 번역 보기
          </span>
          <span className="block font-body text-[11px] text-[var(--t2)]">
            질문·선택지 아래 작은 글씨로 — 영어로만 보고 싶다면 꺼 두세요
          </span>
        </span>
        <input
          type="checkbox"
          checked={showKorean}
          onChange={(e) => setShowKorean(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--p)]"
          aria-label="한국어 번역 보기"
        />
      </label>
    </div>
  )
}

/** ① 다음 한 걸음 — 하나만. 고르는 부담을 화면이 대신 진다. */
function NextStep({
  bookTitle,
  chapter,
  href,
}: {
  bookTitle: string
  chapter: QueueChapter
  href: string
}) {
  return (
    <section aria-label="다음 한 걸음" className="border-l-2 border-[var(--ju)] py-1 pl-4">
      <p className="font-body text-[12px] text-[var(--t2)]">{daysAgo(chapter.readAt)}</p>
      <h2 className="mt-1 font-english text-[19px] font-[700] leading-snug text-[var(--t1)]">
        {bookTitle}
      </h2>
      <p className="mt-0.5 font-english text-[14px] text-[var(--t2)]">
        {chapter.chapterTitle} · {chapter.questionCount}문항
      </p>
      <p className="mt-3 max-w-[46ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        읽고 시간이 지난 챕터부터 확인해요. 바로 뒤에 푸는 것보다 이렇게 사이를 둔 인출이 더
        오래 남아요.
      </p>
      <Link href={href} className={`mt-4 ${PRIMARY}`}>
        확인 시작
        <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
      </Link>
    </section>
  )
}

/** 미확인이 없을 때 — 빈 화면 대신 다음에 할 일을 말한다. 축하 폭죽은 두지 않는다(철학 ④). */
function AllCaughtUp({
  readTotal,
  hasCatalog,
  catalogSample,
}: {
  readTotal: number
  hasCatalog: boolean
  catalogSample: CatalogSample[]
}) {
  const [title, body, cta, href] =
    readTotal > 0
      ? [
          '읽은 챕터를 다 확인했어요',
          '다음 챕터를 읽고 오면 여기에 새로 쌓여요.',
          '읽으러 가기',
          '/library/books',
        ]
      : hasCatalog
        ? [
            '아직 읽은 챕터가 없어요',
            '독해 확인은 **읽은 뒤에** 뜻이 있어요. 한 챕터를 먼저 읽고 오면 여기에 나타나요.',
            '읽을 책 고르기',
            '/library/books',
          ]
        : [
            '준비된 챕터 퀴즈가 없어요',
            '도서 큐레이션이 끝나면 챕터별 확인 문항이 생겨요. 먼저 샘플로 흐름만 볼 수 있어요.',
            '샘플 체험',
            '/scriptquiz/play',
          ]

  return (
    <section className="flex flex-col items-start gap-2 border-l-2 border-[var(--bd)] py-1 pl-4">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">{title}</h2>
      <p className="max-w-[46ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        {body.replace(/\*\*/g, '')}
      </p>
      <Link
        href={href}
        className={PRIMARY}
      >
        {cta}
        <ArrowRight size={13} aria-hidden />
      </Link>

      {/* 아직 읽은 챕터가 없으면 — 무엇을 읽으면 여기에 쌓이는지 **실제 목록**으로(빈 상태가 주인공이 되지 않게 · 수정 1회차) */}
      {readTotal === 0 && catalogSample.length > 0 && (
        <div className="mt-3 w-full">
          <h3 className="font-body text-[12px] text-[var(--t2)]">확인 문항이 준비된 책 — 한 챕터를 읽고 오면 여기에 쌓여요</h3>
          <ul className="m-0 mt-1 list-none border-t border-[var(--bd)] p-0">
            {catalogSample.map((b) => (
              <li key={b.bookId} className="border-b border-[var(--bd)]">
                <Link
                  href={`/library/books/${b.bookId}`}
                  className="flex min-h-[44px] items-baseline gap-3 px-1 py-2 no-underline transition-colors hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)]"
                >
                  <span lang="en" className="min-w-0 flex-1 truncate font-english text-[15px] text-[var(--t1)]">
                    {b.bookTitle}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {b.chapters}챕터 · {b.questions}문항
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** ② 책 한 장 — 접힌 상태가 기본. 펼치면 **읽은 챕터만** 나온다. */
function BookRow({
  book,
  playHref,
}: {
  book: QueueBook
  playHref: (bookId: string, ch: number) => string
}) {
  const [open, setOpen] = useState(false)
  const panelId = `sq-book-${book.bookId}`

  return (
    <div className="border-b border-[var(--bd)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[48px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-english text-[14px] font-[700] text-[var(--t1)]">
            {book.bookTitle}
          </span>
          <span className="block font-mono text-[11px] tabular-nums text-[var(--t2)]">
            읽은 {book.readChapters.length}챕터 중 {book.confirmed}개 확인함
            {book.unreadHidden > 0 && ` · 아직 안 읽은 ${book.unreadHidden}챕터는 빼 뒀어요`}
          </span>
        </span>
        <span className="shrink-0 font-body text-[12px] text-[var(--t2)]">
          {open ? '접기' : '펼치기'}
        </span>
      </button>

      {open && (
        <div id={panelId} className="px-1 pb-4">
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
            {book.readChapters.map((c) => (
              <li key={c.chapterIdx}>
                <Link
                  href={playHref(book.bookId, c.chapterIdx)}
                  // 확인 여부는 점 + 글자 둘 다로 — 색만으로 알리지 않는다.
                  aria-label={`${c.chapterTitle} · ${c.questionCount}문항 · ${
                    c.attemptedAt ? '확인함' : '아직 확인 안 함'
                  }`}
                  className="flex min-h-[44px] items-center gap-2 font-english text-[14px] text-[var(--t1)] underline decoration-[var(--bd)] underline-offset-4 transition-colors hover:text-[var(--p)] hover:decoration-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                >
                  {c.attemptedAt ? <Check size={13} aria-hidden style={{ color: ACCENT_INK }} /> : null}
                  {/* 확인 안 한 챕터에 권점 — 이번에 확인할 것(허브·모듈 허브와 같은 표식). 확인함은 체크 + 글자 */}
                  <span className={`font-mono text-[13px] tabular-nums ${styles.word}`} data-on={!c.attemptedAt}>
                    {c.chapterIdx}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--t2)]">
                    {c.questionCount}문항
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* ③ 안 읽은 챕터는 **퀴즈가 아니라 읽기**로 보낸다. 잠그는 게 아니라 없애고 길을 준다. */}
          {book.nextToRead && (
            <p className="mt-3 font-body text-[12px] text-[var(--t2)]">
              다음은 {book.nextToRead.chapterTitle} —{' '}
              <Link
                href="/library/books"
                className="underline decoration-[var(--bd)] underline-offset-2 hover:text-[var(--t1)]"
              >
                읽으러 가기
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
