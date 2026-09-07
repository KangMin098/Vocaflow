// apps/web/src/app/admin/vocab/page.tsx

import { redirect } from 'next/navigation'

export default function VcbAdminIndex(): never {
  redirect('/admin/vocab/runs')
}
