// apps/web/src/app/api/admin/methodology/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { assertBundle, researchCoverage } from '@/lib/methodology/core'
import { researchSeed } from '@/lib/methodology/research-seed'
import { readMethodologySnapshot } from '@/lib/methodology/server'

export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const mode = request.nextUrl.searchParams.get('mode') ?? 'database'
  const id = request.nextUrl.searchParams.get('id')
  if (!['database', 'research'].includes(mode) || (id && !/^[a-f0-9]{64}$/.test(id))) return NextResponse.json({ error: 'invalid_query' }, { status: 400 })
  if (mode === 'research' && id) return NextResponse.json({ error: 'research_has_no_database_id' }, { status: 400 })
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    if (mode === 'research') {
      assertBundle(researchSeed)
      return NextResponse.json({ mode: 'research', notice: '공식 공개자료의 초기 조사 스냅샷. DB 적재·사람 검토 전이며 영상 자막 분석 완료가 아닙니다.', bundle: researchSeed, coverage: researchCoverage(researchSeed) }, { headers })
    }
    const snapshot = await readMethodologySnapshot(id ?? undefined)
    if (!snapshot) return NextResponse.json({ mode, status: 'empty', nextAction: '검증된 조사 번들을 적재하세요. 초기 조사 자료는 mode=research로 명시적으로 조회할 수 있습니다.' }, { headers })
    return NextResponse.json({ mode, ...snapshot, coverage: researchCoverage(snapshot.bundle) }, { headers })
  } catch (error) {
    console.error('[methodology/read]', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'methodology_unavailable', message: '저장소 또는 자료 검증에 실패했습니다. 마이그레이션 적용 여부와 서버 로그를 확인하세요.' }, { status: 503, headers })
  }
}
