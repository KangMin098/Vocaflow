// apps/web/src/app/(main)/my/page.tsx
// IA Refactor v06.26 — /my 진입 시 default tab으로 redirect

import { redirect } from 'next/navigation';

export default function MyIndexPage(): never {
  redirect('/my/texts');
}
