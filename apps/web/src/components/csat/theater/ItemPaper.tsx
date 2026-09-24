'use client'

// apps/web/src/components/csat/theater/ItemPaper.tsx
//
// **해설 극장 왼쪽 열 — 기출문제 원본(발문 · 지문 · 선지).** (2026-09-25 재설계)
//
// ⚠️ 원문은 서버에서 오지 않는다(DECISIONS D15 · 78행). 세션 화면과 같은 길을 쓴다 —
//    학습자가 놓은 공개 문제지를 이 브라우저가 뽑아 기기에 남긴 추출본(`lib/csat/reflow`)을 읽는다.
//    한 번 놓으면 같은 회차의 다른 문항에서도 바로 보인다. 추출에 실패한 문항은 종이 그대로(크롭)다.

import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PaperDrop } from '@/components/csat/session/PaperDrop'
import { cropOf } from '@/lib/csat/reflow/read-paper'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import type { CachedPaper } from '@/lib/csat/reflow/types'
import type { LearnerCatalog } from '@/lib/csat/session/catalog'
import { loadPaper } from '@/lib/csat/session/store'
import { CIRCLED } from '@/lib/csat/theater'

import styles from './theater.module.css'

export function ItemPaper({ catalog, examId, no }: { catalog: LearnerCatalog; examId: string; no: number }) {
  // null = 여는 중 · 'missing' = 기기에 이 회차 추출본이 없다
  const [paper, setPaper] = useState<CachedPaper | 'missing' | null>(null)

  useEffect(() => {
    let alive = true
    void loadPaper(examId, REFLOW_VERSION).then((p) => {
      if (alive) setPaper(p ?? 'missing')
    })
    return () => {
      alive = false
    }
  }, [examId])

  if (paper === null) {
    return (
      <p className={styles.quiet} aria-busy="true">
        문제지를 여는 중…
      </p>
    )
  }

  const item = paper === 'missing' ? null : paper.items.find((i) => i.no === no) ?? null
  if (!item) {
    return (
      <div className={styles.paperDrop} data-testid="item-paper-missing">
        <p className={styles.quiet}>
          원문(발문·지문·선지)은 평가원 저작물이라 서버가 보내지 않아요. 공개 문제지 PDF 를 한 번 놓으면 이 기기에서
          글자를 뽑아 이 회차 모든 문항에 보여 줘요.
        </p>
        <PaperDrop
          catalog={catalog}
          needed={[examId]}
          compact
          onLoaded={(p) => {
            if (p.exam_id === examId) setPaper(p)
          }}
        />
      </div>
    )
  }

  const again = (
    <button type="button" className={styles.paperAgain} onClick={() => setPaper('missing')}>
      <RotateCcw size={12} aria-hidden /> 문제지 다시 놓기
    </button>
  )

  if (!item.ok) {
    const crop = cropOf(examId, no)
    return (
      <div data-testid="item-paper-crop">
        {crop ? (
          // eslint-disable-next-line @next/next/no-img-element -- 탭 메모리의 data URL(서버 이미지 아님)
          <img className={styles.paperCrop} src={crop} alt={`${no}번 문항 — 문제지 그대로`} />
        ) : (
          <p className={styles.quiet}>이 문항은 글자를 온전히 뽑지 못했어요. 문제지를 다시 놓으면 종이 그대로 보여 줘요.</p>
        )}
        {again}
      </div>
    )
  }

  return (
    <article className={styles.paper} data-testid="item-paper">
      <p className={styles.paperStem}>
        <b>{no}.</b> {item.stem}
      </p>
      <p className={styles.paperPassage} lang="en">
        {item.passage}
      </p>
      {item.notes.length ? (
        <p className={styles.paperNotes} lang="en">
          {item.notes.join('\n')}
        </p>
      ) : null}
      {item.inline ? (
        <p className={styles.quiet}>선지 ①~⑤ 는 지문 속에 표시돼 있어요.</p>
      ) : (
        <ol className={styles.paperChoices}>
          {item.choices.map((c, i) => (
            <li key={i}>
              <span aria-hidden>{CIRCLED[i + 1]}</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      )}
      {again}
    </article>
  )
}
