// apps/web/src/app/(main)/csat/item/[slug]/page.tsx
//
// **문항 하나의 해설 — 「이 문제의 답이 왜 이것인가」.**
//
// 유형 화면이 "이 유형은 이렇게 푼다" 를 말한다면, 여기는 **눈앞의 한 문항**을 답한다.
// 학습자가 채점을 하고 나서 알고 싶은 것은 딱 하나다 — 그래서 왜 ③인가.
//
// 순서를 이렇게 둔 이유:
//   ① 답이 왜 이것인가 → ② 나머지가 왜 아닌가 → ③ 다시 풀 때의 순서
// 오답부터 보여 주면 "내가 왜 틀렸나" 로 시작해 자책이 앞선다(Empathetic Feedback).
// 정답 근거를 먼저 세워 두면 오답 넷은 그 근거에 비추어 읽히고, 그때 배제가 절차가 된다.
//
// ⚠️ **문항 원문은 싣지 않는다.** 지문·선지는 평가원 저작물이고 `csat_items_public` 뷰에
//    컬럼 자체가 없다. 이 화면은 **해설**이라 학습자가 평가원 공개 문제지를 곁에 두고 읽는다.
//    그래서 오답은 번호로 가리키고, 지문은 근거 인용(짧은 발췌)까지만 나온다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PassageMap } from '@/components/csat/PassageMap'
import { LecturePlayerBar } from '@/components/csat/lecture/LecturePlayerBar'
import { LectureStage } from '@/components/csat/lecture/LectureStage'
import { kiceSourceOf } from '@/lib/csat/kice-source'
import { toItemSlug } from '@/lib/csat/item-slug'
import { fromItemSlug, loadCsatItemExplain } from '@/lib/csat/learner'
import { lectureMeta } from '@/lib/csat/lecture/store'
import { pickNextItem } from '@/lib/csat/next-item'
import { offMapChoices, type MapAnchor } from '@/lib/csat/passage-map-model'
import { loadItemSkeleton, skeletonSiblings } from '@/lib/csat/skeleton'

export const dynamic = 'force-dynamic'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/**
 * 접히는 층 하나 — **`<details>` 라 JS 없이 선다.**
 *
 * 서버 컴포넌트에서 그대로 쓴다. 클라이언트 상태를 들이지 않는 이유: 이 화면은 서버 HTML 에
 * 해설이 남아야 하고(I6), 접힌 내용도 크롤러와 「찾기(Ctrl+F)」가 읽을 수 있어야 한다 —
 * `<details>` 는 둘 다 된다(브라우저가 찾기 결과를 스스로 펼친다).
 *
 * ⚠️ 손잡이에 **분량**을 적는다(`size`). 전달 모델 §4 규칙 4 — 몇 자를 여는지 알고 열어야 한다.
 * ⚠️ 계측기(`csat-surface-measure`)는 닫힌 `details` 안을 **세지 않는다** — 접기가 개선인데
 *   세면 개선이 악화로 잡히기 때문이다. 그래서 여기로 옮긴 산문은 「보이는 글자」에서 빠진다.
 */
function Layer({
  label,
  size,
  target,
  children,
}: {
  label: string
  size: string
  /** 강의가 이 층을 가리킬 때의 키 — 가리키면 무대가 층을 편다 */
  target?: string
  children: React.ReactNode
}) {
  return (
    <details data-lecture-target={target} className="group mb-6 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--r-md)] px-4 py-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-bold text-[var(--t1)]">{label}</h2>
        <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--t3)]">
          <span className="tabular-nums">{size}</span>
          {/* 열림 상태를 **기호로도** 말한다 — 회전 애니메이션은 쓰지 않는다(모션 화이트리스트 밖). */}
          <span aria-hidden className="group-open:hidden">
            펼치기 ▸
          </span>
          <span aria-hidden className="hidden group-open:inline">
            접기 ▾
          </span>
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { item } = await loadCsatItemExplain(fromItemSlug(slug))
  return {
    title: item ? `${item.exam_label} ${item.no}번 해설 — 기출 분석` : '기출 문항 해설',
  }
}

export default async function CsatItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { item, error } = await loadCsatItemExplain(fromItemSlug(slug))

  if (!error && !item) notFound()

  // 구워 둔 골격이 있으면 **지도가 해설을 대신한다** — 근거가 «지문의 어디인가» 까지 말하므로
  // 같은 내용을 산문으로 한 번 더 쌓을 이유가 없다. 없으면(지문이 잘린 210문항) 지금까지의
  // 산문 화면이 그대로 나온다. DB 를 치지 않는다 — 커밋된 JSON 을 읽는다.
  const skeleton = item ? loadItemSkeleton(item.id) : null
  const mapAnchors: MapAnchor[] = !item
    ? []
    : [
        ...(item.answer != null && !item.answer_unknown && item.why_correct
          ? [
              {
                id: 'answer',
                label: CIRCLED[item.answer] ?? String(item.answer),
                kind: 'answer' as const,
                detail: item.why_correct,
              },
            ]
          : []),
        ...item.distractors.map((d) => ({
          id: `reject:${d.n}`,
          label: CIRCLED[d.n] ?? String(d.n),
          kind: 'reject' as const,
          detail: d.how_to_reject,
          tempting: d.why_tempting,
        })),
      ]
  // 골격이 가리키는 앵커만 지도에 올린다 — 지도에 없는 칩을 누르면 아무 일도 안 일어난다.
  // **출처를 함께 싣는다.** 「끌리는 이유」에서 위치를 찾은 칩은 그 자리가 이 선지를 지우는
  // 것이 아니라 **끌어당기는** 것이라, 지도가 다르게 말해야 한다(§AnchorOrigin).
  const shown = skeleton
    ? mapAnchors.flatMap((a) => {
        const placed = skeleton.anchors.find((x) => x.id === a.id)
        return placed ? [{ ...a, origin: placed.from }] : []
      })
    : []
  const useMap = skeleton != null && shown.length > 0
  // **지도가 못 든 선지는 글로 내려온다.** 조건이 문항 단위였을 때 136문항(23.1%)의 오답
  // 분석 544문단이 화면에서 통째로 사라져 있었다 — §offMapChoices 머리말에 실측이 있다.
  const offMap = item ? offMapChoices(item.distractors, shown.map((a) => a.id)) : []
  // 라벨이 약속을 지키게 한다 — 평가원이 지금 공개하는 기출은 **올해 수능 하나**다
  // (게시판 7개·모평 안내 3쪽·본원 사이트·옛 archive 전수 확인 · kice-source.ts 머리말).
  // 링크가 없는 회차에서 「원본과 함께 보기」라고 적으면 눌러 본 사람이 속는다.
  const hasKicePaper = item ? kiceSourceOf(item.id.split('#')[0]).paperUrl != null : false

  // **다 보고 나면 앞이 없었다** — 나가는 문이 「← 유형 목록」과 오버레이 둘뿐이라, 다음 지도에
  // 닿으려면 목록으로 되돌아가 다시 골라야 했다. 그런데 이 화면의 값어치는 **연달아 볼 때**
  // 생긴다(한 문항은 일화, 서넛이면 규칙). 해설이 있고 **지도가 있는 것**을 먼저 고른다 —
  // 지도가 없으면 방금 익힌 조작이 사라진다.
  // 「다음 기출」은 **조회 0회**로 고른다 — 커밋된 골격이 `type_id` 까지 들고 있다.
  // 예전에는 `loadCsatTypeItems` 가 유형 전체 문항의 **모든 버전 분석을 jsonb 째로** 받아
  // 왔다(R-BLANK 실측 **432행 · choice_analysis 633 kB**). 그 값으로 하는 일은 문항마다
  // 불리언 하나였고, 문항 화면을 열 때마다 그 값을 치렀다(§skeletonSiblings 에 근거).
  const siblings = item?.type_id
    ? skeletonSiblings(item.type_id).map((sib) => ({
        id: sib.id,
        slug: toItemSlug(sib.id),
        exam_label: sib.exam_label,
        no: sib.no,
        // 골격이 있으면 정답 근거가 있다 — 589개가 **전부** answer 앵커를 갖는다(실측).
        explained: true,
      }))
    : []
  const next = item ? pickNextItem(siblings, item.id, () => true) : null
  // **강의** — 길이(초)와 큐 수만 서버가 안다. 대본은 재생을 누른 뒤 API 로 받는다(대본이
  // 이 HTML 에 한 글자도 남지 않게). 강의가 없는 문항은 무대 자체를 세우지 않는다.
  const lecture = item ? lectureMeta(item.id) : null
  const Stage = ({ children }: { children: React.ReactNode }) =>
    lecture && item ? (
      <LectureStage slug={toItemSlug(item.id)} meta={lecture}>
        {children}
      </LectureStage>
    ) : (
      <>{children}</>
    )
  // ⚠️ **`<main>` 이 아니라 `<div>` 다.** 셸(`(main)/layout.tsx`)이 이미
  //    `<main id="main-content">` 를 그린다. 중첩하면 문서에 보이는 main 이 둘이 되어
  //    스크린리더가 본문을 못 짚고 건너뛰기 링크도 어디로 갈지 모호해진다.
  //    실측 2026-09-15: Playwright strict mode 가 `locator('main')` 에서 2개를 만나 드러났다 —
  //    **axe 의 wcag2a/aa 태그로는 안 잡힌다**(중복 landmark 는 best-practice 규칙이다).

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={item?.type_id ? `/csat/${item.type_id}` : '/csat'}
        className="inline-flex min-h-[44px] items-center text-sm text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
      >
        ← {item?.type_name ?? '유형 목록'}
      </Link>

      {error || !item ? (
        <p className="mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
          지금은 해설을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : (
        <Stage>
          <header className="mb-6 mt-2" data-lecture-target="analysis:head">
            <h1 className="font-editorial text-2xl font-[600] text-[var(--t1)]">
              {item.exam_label} {item.no}번
            </h1>
            <p className="mt-2 text-xs text-[var(--t3)]">
              {item.type_name ?? '유형 미정'}
              {item.points ? ` · ${item.points}점` : ''}
              {item.time_budget_sec ? ` · 권장 풀이 시간 ${item.time_budget_sec}초` : ''}
            </p>
            {/* ── 1층 · 이 문항이 재는 것 ─────────────────────────────────
                **열어 둔다.** 한 호흡(중앙값 91자)이라 접으면 여는 수고가 읽는 수고보다 크다.
                이것이 없으면 학습자는 무엇을 연습하는지 모른 채 근거를 따라간다 —
                802문항 전부에 쓰여 있었는데 로더가 안 읽어 한 번도 안 나왔다. */}
            {item.measured_ability ? (
              <p
                data-lecture-target="analysis:ability"
                className="mt-3 break-keep border-l-2 border-[var(--p)] pl-3 text-sm leading-relaxed text-[var(--t1)]"
              >
                <span className="mr-1.5 text-xs text-[var(--t3)]">재는 것</span>
                {item.measured_ability}
              </p>
            ) : null}
          </header>

          {lecture ? <LecturePlayerBar /> : null}

          {/* ── 2층 · 출제 의도 ─────────────────────────────────────────
              **접어 둔다**(중앙값 177자 · 최대 438자). 정답을 확인하러 온 사람에게는 곁가지고,
              「왜 이렇게 냈나」가 궁금한 사람만 연다(철학 2 Progressive Disclosure).
              손잡이에 분량을 적는다 — 몇 자를 여는지 알고 열어야 한다(전달 모델 §4 규칙 4). */}
          {item.design_intent ? (
            <Layer label="출제 의도" size={`${item.design_intent.length}자`} target="analysis:intent">
              <p className="break-keep text-sm leading-relaxed text-[var(--t2)]">{item.design_intent}</p>
            </Layer>
          ) : null}

          {/* 지문 지도 — 근거가 «지문의 어디인가» 를 클릭 하나로 보여 준다. 첫 화면에서
              이미 정답 근거가 열려 있으므로 클릭 0 으로도 증명이 보인다. */}
          {skeleton && shown.length > 0 ? (
            <PassageMap sentences={skeleton.sentences} anchors={shown} placements={skeleton.anchors} />
          ) : null}

          {item.answer_unknown || item.answer == null ? (
            // 정답표가 없는 회차. **추정한 정답을 정답인 척 적지 않는다** —
            // 그 한 줄이 학습자를 반대로 훈련시킨다.
            <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm leading-relaxed text-[var(--t2)]">
              이 회차는 평가원 정답표를 구하지 못했어요. 정답을 모르는 채로 근거를 적으면 그건 창작이라,
              이 문항은 <strong>답을 지목하지 않습니다.</strong> 대신 아래 절차는 그대로 쓸 수 있어요.
            </p>
          ) : useMap ? null : (
            <section className="mb-6" data-lecture-target="analysis:answer">
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-bold text-[var(--t1)]">답이 왜 이것인가</h2>
                <span className="font-display text-lg font-bold tabular-nums text-[#2E7D5A]">
                  {CIRCLED[item.answer] ?? item.answer}
                </span>
              </div>

              {item.why_correct ? (
                <p className="mt-2 rounded-[var(--r-md)] border border-[#2E7D5A] bg-[var(--bg)] p-4 text-sm leading-relaxed text-[var(--t1)]">
                  {item.why_correct}
                </p>
              ) : (
                <p className="mt-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm leading-relaxed text-[var(--t2)]">
                  이 문항은 정답 근거 서술을 아직 쓰는 중이에요.
                </p>
              )}

              {item.evidence_quote ? (
                <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
                  <p className="text-xs text-[var(--t3)]">근거가 되는 문장</p>
                  {/* 지문 발췌는 여기까지다 — 문단 전체는 평가원 공개자료에서 본다 */}
                  {/* ⚠️ 인용은 **영어**다 — `font-display`(IBM Plex Sans)로 찍혀 있었는데
                      CLAUDE.md 가 「영어에 산세리프」를 금지한다. 영문 전용면(Lora)으로 돌린다. */}
                  <blockquote className="mt-1 border-l-2 border-[var(--bd)] pl-3 font-english text-sm italic leading-relaxed text-[var(--t1)]">
                    {item.evidence_quote}
                  </blockquote>
                  {item.evidence_reasoning ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{item.evidence_reasoning}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          {/* 지도가 **이미 든 선지**만 이 절에서 뺀다 — 같은 내용을 산문으로 한 번 더 쌓는 것이
              이 화면이 「단순 텍스트 나열」이라 불린 이유였지만, 안 든 선지까지 지우면 그건
              중복 제거가 아니라 **누락**이다. */}
          {offMap.length ? (
            <section className="mb-6">
              <h2 className="text-sm font-bold text-[var(--t1)]">나머지가 왜 아닌가</h2>
              {useMap ? (
                // 칩이 없는 이유를 사실대로 적는다 — 「지문에 근거가 없다」가 아니라 «가리킬
                // 문장을 못 찾았다» 다. 배제 근거가 도표·형식·상식에 걸려 있거나, 한국어로만
                // 쓰여 지문 대조가 안 되는 경우다.
                <p className="mt-1 break-keep text-xs leading-relaxed text-[var(--t3)]">
                  지문에서 가리킬 문장을 찾지 못한 선지예요 — 근거는 여기에 글로 적혀 있습니다.
                </p>
              ) : null}
              <ul className="mt-2 space-y-2">
                {offMap.map((d) => (
                  <li
                    key={d.n}
                    data-lecture-target={`analysis:reject:${d.n}`}
                    className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-base font-bold tabular-nums text-[var(--t2)]">
                        {CIRCLED[d.n] ?? d.n}
                      </span>
                      {d.trap ? (
                        <span className="shrink-0 rounded bg-[var(--bg3)] px-1.5 py-0.5 text-[10px] text-[var(--t3)]">
                          {d.trap}
                        </span>
                      ) : null}
                    </div>
                    {d.why_tempting ? (
                      <p className="mt-1 text-sm leading-relaxed text-[var(--t2)]">{d.why_tempting}</p>
                    ) : null}
                    {d.how_to_reject ? (
                      <p className="mt-2 border-l-2 border-[#9C3A30] pl-3 text-sm leading-relaxed text-[var(--t1)]">
                        지우는 근거 — {d.how_to_reject}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── 4층 · 다시 풀 때의 순서 ───────────────────────────────────
              **접어 둔다.** 이 화면에서 가장 무거운 산문이다(중앙값 5단계 · 약 700자, 실측).
              지도와 선지 해설로 「왜 ③인가」를 확인한 뒤에야 쓸모가 있는 층이라, 확인하러 온
              사람의 첫 화면을 차지할 이유가 없다. 손잡이에 **단계 수**를 적는다. */}
          {item.procedure.length ? (
            <Layer label="다시 풀 때의 순서" size={`${item.procedure.length}단계`} target="analysis:procedure">
              <ol className="space-y-2">
                {item.procedure.map((s, i) => (
                  <li key={i} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
                    <p className="text-sm leading-relaxed text-[var(--t1)]">{s.step}</p>
                    {s.on_fail ? (
                      <p className="mt-2 border-l-2 border-[var(--bd)] pl-3 text-xs leading-relaxed text-[var(--t3)]">
                        막히면 — {s.on_fail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Layer>
          ) : null}

          {item.required_vocab.length ? (
            <section className="mb-6" data-lecture-target="analysis:vocab">
              <h2 className="text-sm font-bold text-[var(--t1)]">이 문항이 요구한 낱말</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {item.required_vocab.map((w) => (
                  <li
                    key={w}
                    className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1 text-sm text-[var(--t2)]"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* **다음 걸음.** 이 유형을 연달아 봐야 「여기를 본다」가 규칙으로 잡힌다.
              1차 문이므로 다른 링크보다 앞에 두고 더 또렷하게 그린다. */}
          {next ? (
            <Link
              href={`/csat/item/${next.item.slug}`}
              className="mt-8 flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--bg)] px-4 py-3 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
            >
              <span className="min-w-0 break-keep">
                <span className="block text-sm font-bold text-[var(--t1)]">
                  같은 유형 다음 기출 — {next.item.exam_label} {next.item.no}번
                </span>
                <span className="mt-0.5 block text-xs text-[var(--t3)]">
                  {next.hasMap ? '지문 지도로 이어집니다' : '해설로 이어집니다'} · 지도 있는 기출 {next.remaining}개 더
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-[var(--t3)]">
                →
              </span>
            </Link>
          ) : null}

          {/* 「곁에 두고 읽는다」의 «곁» 을 같은 화면으로 옮기는 길 — 이 화면이 원문을 싣지
              않는다는 사실이 바로 이 링크의 이유다. 막다른 안내로 끝내지 않는다(D4). */}
          <Link
            href={`/csat/overlay?exam=${encodeURIComponent(item.id.split('#')[0])}&no=${item.no}`}
            className="mt-8 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
          >
            {hasKicePaper ? '평가원 원본과 함께 보기 →' : '문제지 열고 해설 얹기 →'}
          </Link>

          <p className="mt-6 text-xs leading-relaxed text-[var(--t3)]">
            문항 원문(지문·선지)은 싣지 않습니다. 저작권은 한국교육과정평가원에 있고, 여기 있는 것은
            그 문항을 분석해 우리가 쓴 해설입니다. 원문은 평가원 공개자료에서 함께 보세요.
          </p>
        </Stage>
      )}
    </div>
  )
}
