// apps/web/src/components/my/MyTabs.tsx
// IA Refactor v06.26 — /my 그룹 탭 셸 (TextVault / WordVault / BookVault)

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, BookMarked, Library } from 'lucide-react';

const TABS = [
  {
    href: '/my/texts',
    label: 'TextVault',
    subtitle: '내가 입력한 텍스트',
    Icon: FileText,
  },
  {
    href: '/my/words',
    label: 'WordVault',
    subtitle: '내가 모은 단어',
    Icon: BookMarked,
  },
  {
    href: '/my/books',
    label: 'BookVault',
    subtitle: 'Library에서 추가한 책',
    Icon: Library,
  },
];

export function MyTabs() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-4">
      <div className="mb-3 flex flex-col gap-0.5">
        <h1 className="font-display text-[20px] font-[700] text-[var(--t1)]">📦 My</h1>
        <p className="font-body text-[12px] text-[var(--t3)]">내 학습 자산</p>
      </div>

      <nav role="tablist" aria-label="My 탭" className="flex flex-wrap gap-1">
        {TABS.map(({ href, label, subtitle, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              role="tab"
              aria-selected={active}
              href={href}
              className={[
                'inline-flex min-h-[40px] items-center gap-2',
                'border-b-2 px-3 -mb-px',
                'font-display text-[13px] font-[600]',
                'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
                active
                  ? 'border-[var(--p)] text-[var(--p)]'
                  : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]',
              ].join(' ')}
              title={subtitle}
            >
              <Icon size={14} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
