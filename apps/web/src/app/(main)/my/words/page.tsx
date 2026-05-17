// apps/web/src/app/(main)/my/words/page.tsx
// IA Refactor v06.26 — WordVault (내 단어장)
// /wordvault/page.tsx 가 'use client' 복잡 컴포넌트 (?view=browse|study|review)라
// 본 라우트는 redirect 처리. /wordvault 라우트 자체는 그대로 유지.

import { redirect } from 'next/navigation';

export default function MyWordsPage(): never {
  redirect('/wordvault');
}
