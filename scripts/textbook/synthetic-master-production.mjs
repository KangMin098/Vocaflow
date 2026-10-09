// scripts/textbook/synthetic-master-production.mjs
import { createHash } from 'node:crypto'
import { exerciseSingleGrade, exerciseMultiGrade } from './reading-promotion/synthetic-master.mjs'
import { hash } from './frym-benchmark/benchmark.mjs'

export const SYNTHETIC_MASTER_ORDERS = ['m1', 'h1', 'm1-m2']
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex')

/** Executable reference orders use the shared production functions with in-memory RPCs. */
export async function runSyntheticMasterProduction(order) {
  if (!SYNTHETIC_MASTER_ORDERS.includes(order)) throw Error('SYNTHETIC_MASTER_ORDER_UNSUPPORTED')
  let receipt, output
  if (order === 'm1-m2') ({ receipt, output } = await exerciseMultiGrade(true))
  else {
    const result = await exerciseSingleGrade(order === 'm1' ? 'middle_1' : 'high_1', true)
    const { fixture, ...publicReceipt } = result
    receipt = publicReceipt
    output = fixture.atomic
  }
  if (receipt.synthetic_fixture !== true || receipt.non_production !== true ||
      output.manifest.production_verified !== false || sha(output.html) !== receipt.output_hash)
    throw Error('SYNTHETIC_MASTER_OUTPUT_INVALID')
  const html = '<!-- synthetic_fixture=true non_production=true; SYNTHETIC MOCK RPC; NOT FOR PUBLICATION -->\n' + output.html
  const body = { schema: 'textbook-synthetic-master-output/1', synthetic_fixture: true,
    non_production: true, evidence_level: 'synthetic_mock_rpc', production_verified: false,
    publish_eligible: false, reference_order: order, receipt,
    injected_evidence: ['benchmark_snapshot', 'gold_s_decision', 'seed_approval'],
    factory_manifest: output.manifest, html_sha256: sha(html) }
  return { html, manifest: { ...body, manifest_hash: hash(body) } }
}
