// apps/web/src/components/workspace/KeyboardHints.tsx

'use client'

import { useEffect, useState } from 'react'

export function KeyboardHints() {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setOpacity(0.4), 8000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="fixed bottom-6 left-[264px] z-50 hidden gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[11px] text-[var(--t2)] shadow-[var(--sh-sm)] transition-opacity duration-[var(--dur-slow)] lg:flex"
      style={{ opacity }}
      aria-label="키보드 단축키"
    >
      <Hint keys={['←', '→']} label="페이지" />
      <Divider />
      <Hint keys={['Space']} label="재생" />
      <Divider />
      <Hint keys={['B']} label="북마크" />
      <Divider />
      <Hint keys={['⌘.']} label="인사이트" />
    </div>
  )
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center">
      {keys.map((k) => (
        <kbd
          key={k}
          className="mx-0.5 inline-block rounded border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] font-[600] text-[var(--t2)]"
        >
          {k}
        </kbd>
      ))}
      <span className="ml-1">{label}</span>
    </span>
  )
}

function Divider() {
  return <span className="mx-1 h-3 w-px bg-[var(--bd)]" aria-hidden="true" />
}
