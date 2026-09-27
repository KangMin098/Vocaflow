// apps/web/src/app/admin/csat/sources/SourceGetGuide.tsx
'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { sourceGetGuide, sourceGetPrompt } from '@/lib/textbook/source-get-guide'
import styles from './sources.module.css'

const KIND_LABEL = {
  acp: '매일 수집(ACP)',
  harvest: '하베스터',
  ingest: '교재 수집기',
  import: '확보 원문 적재',
  manual: '자동 경로 없음',
} as const

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={styles.copy}
      aria-label={`${label} 복사`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      <span>{done ? '복사됨' : '복사'}</span>
    </button>
  )
}

/** 원천 상세 패널의 「가져오는 법」 — 단계별 명령과 Claude Code 에 맡길 지시문. */
export function SourceGetGuide({ source, label }: { source: string; label: string }) {
  const guide = sourceGetGuide(source)
  if (!guide) {
    return (
      <details>
        <summary>가져오는 법 (Claude Code)</summary>
        <p className={styles.footnote}>
          이 원천은 등록된 수집 경로가 없습니다. 원천 점검 회차에서 쓰인 표본이거나 옛 수집분입니다.
        </p>
      </details>
    )
  }
  const prompt = sourceGetPrompt(source, label, guide)
  return (
    <details>
      <summary>가져오는 법 (Claude Code · 단계별)</summary>
      <p className={styles.footnote}>
        {KIND_LABEL[guide.kind]} · <code>{guide.script}</code>. 이 화면은 실행하지 않습니다 — 명령을
        터미널에서 돌리거나, 아래 지시문을 Claude Code 에 붙여 넣으세요.
      </p>
      <div className={styles.getPrompt}>
        <div>
          <b>Claude Code 에 맡기기</b>
          <CopyButton text={prompt} label="Claude Code 지시문" />
        </div>
        <p>쓰기 단계 앞에서 dry-run 결과를 보여 주고 확인을 받도록 적혀 있습니다.</p>
      </div>
      <ol className={styles.getSteps}>
        {guide.steps.map((step, i) => (
          <li key={step.title}>
            <p>
              <b>
                {i + 1}. {step.title}
              </b>{' '}
              <span className={step.writes ? styles.writes : styles.readonly}>
                {step.writes ? 'DB 쓰기' : '읽기 전용'}
              </span>
            </p>
            {step.command ? (
              <div className={styles.getCommand}>
                <code>{step.command}</code>
                <CopyButton text={step.command} label={`${i + 1}단계 명령`} />
              </div>
            ) : null}
            <p className={styles.footnote}>{step.note}</p>
          </li>
        ))}
      </ol>
      {guide.caution ? <p className={styles.footnote}>주의 · {guide.caution}</p> : null}
    </details>
  )
}
