// apps/web/src/lib/csat/authored/__tests__/pglite-supabase.ts
// 시험 전용 — supabase-js 클라이언트의 좁은 부분집합을 PGlite 위에 흉내 낸다(서버 코드를 실제 SQL 위에서 돌리기 위해).
// 지원: from(t).select(cols, { head, count }) · eq · neq · in · order · limit · maybeSingle · then / rpc(name, args).
// 호출마다 request.jwt.claim.sub 를 이 클라이언트의 uid 로 맞춘다(auth.uid()). PGlite 는 슈퍼유저라 RLS 는 적용되지 않는다 —
// RLS 는 별도 시험(authored-supply.pglite)이 권한으로 확인한다. 여기서는 서버 코드가 user_id 로 직접 거르는지까지만 본다.
import type { PGlite } from '@electric-sql/pglite'

type Row = Record<string, unknown>
interface Res { data: unknown; error: { message: string; code?: string } | null; count?: number | null }

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`identifier: ${s}`)
  return `"${s}"`
}

class Query implements PromiseLike<Res> {
  private where: { sql: string; vals: unknown[] }[] = []
  private ord: string[] = []
  private lim: number | null = null
  private single = false
  constructor(private c: FakeClient, private table: string, private cols = '*', private head = false, private count = false) {}
  select(cols = '*', opts: { head?: boolean; count?: string } = {}) { this.cols = cols; this.head = !!opts.head; this.count = !!opts.count; return this }
  eq(col: string, v: unknown) { this.where.push({ sql: `${ident(col)} = $?`, vals: [v] }); return this }
  neq(col: string, v: unknown) { this.where.push({ sql: `${ident(col)} is distinct from $?`, vals: [v] }); return this }
  in(col: string, vs: unknown[]) {
    if (vs.length === 0) this.where.push({ sql: 'false', vals: [] })
    else this.where.push({ sql: `${ident(col)}::text in (${vs.map(() => '$?').join(',')})`, vals: vs.map((v) => String(v)) })
    return this
  }
  order(col: string, o: { ascending?: boolean } = {}) { this.ord.push(`${ident(col)} ${o.ascending === false ? 'desc' : 'asc'}`); return this }
  limit(n: number) { this.lim = n; return this }
  maybeSingle() { this.single = true; return this }
  async run(): Promise<Res> {
    const vals: unknown[] = []
    const w = this.where.map((x) => { let s = x.sql; for (const v of x.vals) { vals.push(v); s = s.replace('$?', `$${vals.length}`) } return s })
    const cols = this.cols === '*' ? '*' : this.cols.split(',').map((x) => {
      // Actual plan route uses this PostgREST FK projection; retain real SQL reads and owner filters.
      if (x.trim() === 'learner_workspace!inner(template_id)' && this.table === 'learner_workspace_plan') {
        return "(select jsonb_build_object('template_id', w.template_id) from public.learner_workspace w where w.id = learner_workspace_plan.workspace_id) as learner_workspace"
      }
      return ident(x.trim())
    }).join(', ')
    const base = `from public.${ident(this.table)}${w.length ? ` where ${w.join(' and ')}` : ''}`
    try {
      await this.c.auth()
      if (this.head) {
        const r = await this.c.db.query<{ n: number }>(`select count(*)::int n ${base}`, vals)
        return { data: null, error: null, count: this.count ? r.rows[0]!.n : null }
      }
      const r = await this.c.db.query<Row>(`select ${cols} ${base}${this.ord.length ? ` order by ${this.ord.join(', ')}` : ''}${this.lim !== null ? ` limit ${this.lim}` : ''}`, vals)
      return { data: this.single ? r.rows[0] ?? null : r.rows, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }
    }
  }
  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run().then(ok, bad) }
}

export class FakeClient {
  constructor(readonly db: PGlite, readonly uid: string | null) {}
  async auth() { await this.db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [this.uid ?? '']) }
  from(table: string) { return new Query(this, table) }
  async rpc(name: string, args: Record<string, unknown>): Promise<Res> {
    const keys = Object.keys(args)
    const vals = keys.map((k) => { const v = args[k]; return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v })
    try {
      await this.auth()
      const r = await this.db.query<{ r: unknown }>(`select public.${ident(name)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) r`, vals)
      return { data: r.rows[0]?.r ?? null, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }
    }
  }
}
