import { redirect } from 'next/navigation'

export default function VcbAdminIndex(): never {
  redirect('/admin/vocab/runs')
}
