// scripts/acp/__tests__/atomic-analysis.sql.mjs
// Local PostgreSQL regression, never connects to Supabase.
// PGLITE_MODULE_PATH must point to an installed @electric-sql/pglite/dist/index.js.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
if (!process.env.PGLITE_MODULE_PATH) throw new Error('Set PGLITE_MODULE_PATH to run local PostgreSQL regressions')
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href)
const db = new PGlite()
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.library_articles (
      id uuid PRIMARY KEY, status text, updated_at timestamptz, content text,
      compose_batch_id uuid, source text, feed_id text, composed_spec jsonb,
      article_v_level smallint, vrl_components jsonb, vrl_calculated_at timestamptz,
      syntax_score jsonb, cefr_level text, cefr_confidence real, word_count integer,
      reading_minutes integer, llm_cost_usd numeric, register text, lexical_noise numeric,
      content_hash text, status_message text
    );
    CREATE TABLE public.library_article_vocabularies (
      library_article_id uuid REFERENCES library_articles(id), word text,
      frequency_in_article integer, first_sentence text, base_learning_value float8,
      context_pos text, PRIMARY KEY(library_article_id,word)
    );
    CREATE FUNCTION public.compute_article_vrl(p_article_id uuid) RETURNS void
    LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS (SELECT 1 FROM library_article_vocabularies WHERE word='raise_error') THEN
        RAISE EXCEPTION 'synthetic VRL failure';
      END IF;
      IF EXISTS (SELECT 1 FROM library_article_vocabularies WHERE word='unmatched') THEN RETURN; END IF;
      UPDATE library_articles SET article_v_level=3, vrl_components='{"new":true}' WHERE id=p_article_id;
    END $$;
    CREATE FUNCTION public.compute_article_syntax(p_article_id uuid) RETURNS void
    LANGUAGE sql AS $$ UPDATE library_articles SET syntax_score=jsonb_build_object('body',content) WHERE id=p_article_id $$;
  `)
  await db.exec(await fs.readFile(new URL('../../../supabase/migrations/20260919023610_acp_atomic_analysis.sql', import.meta.url), 'utf8'))
  const id = '11111111-1111-4111-8111-111111111111'
  const revision = '2026-09-19T08:00:01.123456Z'
  const input = {
    words: [{ word: 'learn', frequency_in_article: 2, first_sentence: 'Body A', base_learning_value: 0.7, context_pos: 'verb' }],
    cefr_level: 'B1', cefr_confidence: 0.8, word_count: 100, reading_minutes: 1,
    llm_cost_usd: 0, register: 'expository', lexical_noise: 0, content_hash: 'a'.repeat(64), status_message: null,
  }
  async function reset() {
    await db.exec('DELETE FROM library_article_vocabularies; DELETE FROM library_articles;')
    await db.query(`INSERT INTO library_articles(id,status,updated_at,content,source,article_v_level,content_hash)
      VALUES($1,'analyzing',$2,'Body A','nasa',8,'old-hash')`, [id,revision])
    await db.query(`INSERT INTO library_article_vocabularies VALUES($1,'old',1,'old sentence',0.2,null)`, [id])
  }
  const snapshot = async () => ({
    article: (await db.query('SELECT * FROM library_articles')).rows,
    vocab: (await db.query('SELECT * FROM library_article_vocabularies ORDER BY word')).rows,
  })
  const commit = (payload=input, rev=revision, body='Body A') => db.query(
    'SELECT commit_article_analysis($1,$2,$3,$4) AS result', [id,rev,body,JSON.stringify(payload)],
  )
  assert.deepEqual((await db.query('SELECT commit_article_analysis(null,null,null,null) AS result')).rows[0].result, { version: 1 })
  let cases = 1
  for (const mutation of [
    "UPDATE library_articles SET content='Body B',updated_at=updated_at+interval '1 microsecond'",
    "UPDATE library_articles SET status='archived'",
    "UPDATE library_articles SET updated_at=updated_at+interval '1 microsecond'",
    // Even a content edit that bypasses the timestamp trigger is rejected.
    "UPDATE library_articles SET content='Body B'",
  ]) {
    await reset(); await db.exec(mutation)
    const before = await snapshot()
    await assert.rejects(commit(), /claim lost|revision changed/)
    assert.deepEqual(await snapshot(), before); cases++
  }
  for (const payload of [
    { ...input, words: [{ ...input.words[0], word: 'raise_error' }] },
    { ...input, words: [{ ...input.words[0], word: 'unmatched' }] },
    { ...input, words: [input.words[0], input.words[0]] },
    { ...input, words: [] },
    { ...input, cefr_confidence: null },
    { ...input, content_hash: 'bad' },
  ]) {
    await reset(); const before = await snapshot()
    await assert.rejects(commit(payload))
    assert.deepEqual(await snapshot(), before); cases++
  }
  await reset()
  await db.query("UPDATE library_articles SET source='original',feed_id='compose-drain',compose_batch_id=$1", [id])
  const otherPipeline = await snapshot()
  await assert.rejects(commit(), /another compose pipeline/)
  assert.deepEqual(await snapshot(), otherPipeline); cases++
  await reset()
  const result = (await commit()).rows[0].result
  assert.equal(result.committed, true)
  const after = await snapshot()
  assert.equal(after.article[0].content, 'Body A')
  assert.equal(after.article[0].status, 'ready')
  assert.equal(after.article[0].article_v_level, 3)
  assert.deepEqual(after.article[0].syntax_score, { body: 'Body A' })
  assert.deepEqual(after.vocab.map(x=>x.word), ['learn']); cases++
  await assert.rejects(commit(), /claim lost|revision changed/)
  assert.deepEqual(await snapshot(), after); cases++
  const privileges = (await db.query(`SELECT
    has_function_privilege('anon','public.commit_article_analysis(uuid,timestamptz,text,jsonb)','execute') AS anon,
    has_function_privilege('authenticated','public.commit_article_analysis(uuid,timestamptz,text,jsonb)','execute') AS authenticated,
    has_function_privilege('service_role','public.commit_article_analysis(uuid,timestamptz,text,jsonb)','execute') AS service`)).rows[0]
  assert.deepEqual(privileges, { anon: false, authenticated: false, service: true }); cases++
  console.log(`Atomic analysis PostgreSQL regressions: ${cases} passed; no remote DB writes.`)
} finally { await db.close() }
