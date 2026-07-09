// apps/web/src/components/game/wordblitz/WordBlitzUI.tsx
// WordBlitz 로딩 폴백(동적 import fallback). 게임 본체는 WordBlitzGame.tsx(2D 속사 인지).

'use client';

export function WordBlitzLoading({ message }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-screen w-screen flex-col items-center justify-center gap-3"
      style={{ background: 'var(--bg2)', color: 'var(--t2)' }}
    >
      <div className="wbz-load-spinner" aria-hidden="true" />
      <div className="font-display text-[13px] font-[700]" style={{ color: 'var(--t2)' }}>
        {message ?? '불러오는 중…'}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .wbz-load-spinner {
              width: 32px; height: 32px; border-radius: 50%;
              border: 3px solid var(--bd); border-top-color: var(--combo);
              animation: wbz-spin 0.8s linear infinite;
            }
            @keyframes wbz-spin { to { transform: rotate(360deg); } }
            @media (prefers-reduced-motion: reduce) { .wbz-load-spinner { animation-duration: 2s; } }
          `,
        }}
      />
    </div>
  );
}
