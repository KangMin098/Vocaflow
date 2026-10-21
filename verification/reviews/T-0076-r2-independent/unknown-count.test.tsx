import{describe,it,expect}from'vitest'
import{renderToStaticMarkup}from'react-dom/server'
import{evidenceView}from'@/lib/csat/map/v62/evidence-claims'
import{EvidenceBlock}from'@/components/csat/diagnosis/map/EvidenceClaims'
const run=(firsts:any,activity:any)=>evidenceView({task:'r.central_meaning',check:null,firsts,activity,hashes:undefined,transfer:{done:0,planned:null}})
const checkText=(e:ReturnType<typeof run>)=>renderToStaticMarkup(<EvidenceBlock e={e}/>).match(/data-testid="ev-check"[^>]*>([\s\S]*?)<\/dd>/)![1].replace(/<[^>]*>/g,'')
describe('unknown is not zero in current-check display',()=>{
 it('failed first ledger with no check cannot claim current independent0',()=>{const e=run(undefined,undefined);expect(e.ledger).toBe('unknown');expect(e.currentCheck.status).toBe('unknown');expect(checkText(e)).not.toMatch(/이번 판정의 독립 확인 0문항/);expect(checkText(e)).toMatch(/보류|확인.*못/)})
 it('missing activity ledger cannot be rendered as a complete zero current tally',()=>{const e=run([],undefined);expect(e.ledger).toBe('unknown');expect(checkText(e)).not.toMatch(/이번 판정의 독립 확인 0문항/)})
 it('readable empty ledgers are a legitimate known zero control',()=>{const e=run([],[]);expect(e.ledger).toBe('complete');expect(checkText(e)).toContain('이번 판정의 독립 확인 0문항')})
})
