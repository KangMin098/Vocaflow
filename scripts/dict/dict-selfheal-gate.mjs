// scripts/dict/dict-selfheal-gate.mjs
// 3R-Ⓒ 온디맨드 자기치유 게이트 — 잔여 not_found 中 "진짜 희귀·전문 실단어"만
// Wiktionary(영어 섹션 + register 게이트)로 정확히 해소해 KO 글로스 후보 생성.
// LLM 뜻 생성 금지 원칙 준수: 뜻은 Wiktionary 정의문 → Google 번역(외부).
// 이 스크립트는 후보 JSONL 만 만들고 DB 적재는 하지 않음(검수 후 별도 적재).
//
// 입력: scratchpad-foreign/nf.json  [{w,occ,b}]  (잔여 not_found)
// 게이트 임계: MINOCC(기본3) · MINBOOKS(기본2) — (occ>=MINOCC OR b>=MINBOOKS)
// 실행: node scripts/dict/dict-selfheal-gate.mjs
// 출력: scratchpad-foreign/selfheal-candidates.jsonl + 요약
import fs from 'node:fs'

const UA = { 'User-Agent': 'Vocaflow-dict-selfheal/1.0 (killerapp51@empal.com)' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const MINOCC = parseInt(process.env.MINOCC || '3')
const MINBOOKS = parseInt(process.env.MINBOOKS || '2')

// 추출 파편(하이픈/아포스트로피) — 사전 대상 아님(추출단 처리). 게이트 사전 배제.
const FRAGMENTS = new Set("agivin,ancks,anteddy,apens,arskin,arstin,artichook,atink,bachellar,backstickin,beatenes,beatenis,beatinis,becrowded,behabin,behol,beuk,biblio,bloodedly,bockered,boweryness,boxical,brekekex,brennschluss,bruteman,buil,clak,clangle,coend,conwenienth,cottonfiel,cusinier,dacious,darncin,dayman,despera,devani,dogwhip,dollarn,doonkle,downmost,dreadfo,dremp,droring,eberlastin,endyoin,entuzy,enythin,enytin,exp,eyedes,facedness,faithfo,fathuh,fearfo,fec,fedness,figurez,fivish,flas,flippetty,floppetty,flybie,footedly,foun,fourey,fuf,furgettin,furmety,gasfitters,ghari,gibblety,gingy,gingybread,grea,hadn,handsum,hankcher,hanticipatin,hia,hissel,hoasban,hobjec,hooal,iddy,interetht,intheristhin,ipsy,iums,jaal,jobman,jommlin,juneseyin,kaf,keat,ketchers,kiak,kow,krok,kursion,lenage,lighterd,llwyn,maders,markises,masel,mencin,mergence,miaw,micrometrically,mimmest,molloncolly,monst,muzy,natory,neeeeee,nelli,nently,neutual,newydd,nima,nimated,noor,oc,oge,oooooo,oratoire,oughtn,oum,overjoice,paralo,patht,peakt,peckery,pertec,pervenches,piritual,pisk,plodid,popsey,powerfulles,projickin,purt,purten,quatter,realizant,recious,reddinin,refoosin,revelant,rgs,riginal,rion,rk,rks,roas,rooft,rrr,rw,sarsnet,scrattlin,sebbent,senz,sevenpenny,seventimes,sexuo,shar,shib,shif,shtrappin,sidedly,simu,skarum,skirtishness,skybie,soj,spaceboat,splick,spon,squakin,sumthin,surrepshous,suthin,sweekin,tackety,taneous,taneously,tatteredness,taxicabman,teh,terterter,thauthepan,thelf,theologico,theveral,thip,thpy,threatnin,throthing,throtter,tial,tiful,tiggory,tle,topsel,trabblin,trimmlin,tsz,ture,twel,unburglar,underflannels,urmuts,urtin,venesta,vexto,vidence,wearifu,webbish,whi,whipperty,wishfo,wookey,wopsey,worly,woss,wukkin,wurno,wushin,wuzn,wymed,yih,zampni,zimmin,zwilnik,zyl".split(','))

// register 태그 → 게이트 (거부: 방언/오기/발음표기 = 사전 실단어 아님)
const REJECT_TAGS = /\b(eye dialect|pronunciation spelling|misspelling|informal spelling|nonstandard spelling|obsolete spelling|dialectal spelling)\b/i
// 리다이렉트 계열 (base 로 추적)
const FOLLOW_RE = /\{\{\s*(?:plural of|alternative (?:spelling|form) of|alt form|alt sp|inflection of|en-past of|archaic form of|dated form of|standard spelling of|superseded spelling of)\s*\|\s*en\s*\|\s*([^|}]+)/i
const REJECT_RE = /\{\{\s*(?:eye dialect of|pronunciation spelling of|misspelling of|informal spelling of|nonstandard spelling of)\s*\|/i

async function wikitext(title) {
  const url = 'https://en.wiktionary.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&rvslots=main&formatversion=2&titles=' + encodeURIComponent(title)
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) { const j = await r.json(); return j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? null } } catch {}
    await sleep(400 * (a + 1))
  }
  return null
}
// ==English== 섹션 추출
function englishSection(wt) {
  if (!wt) return null
  const m = wt.match(/(^|\n)==\s*English\s*==\s*\n([\s\S]*?)(?=\n==[^=]|\n==\s*[A-Z][a-z]+\s*==|$)/)
  return m ? m[2] : null
}
// 첫 정의(# ...) 라인, 템플릿/링크 정리
function firstDef(sec) {
  if (!sec) return null
  for (const line of sec.split('\n')) {
    if (!/^#\s+\S/.test(line)) continue                 // '# 정의' 만 (예문 '#:' 제외)
    if (/^#[:*]/.test(line)) continue
    return line.replace(/^#\s+/, '').trim()
  }
  return null
}
function cleanGloss(def) {
  if (!def) return null
  let s = def
  s = s.replace(/\{\{\s*(?:lb|label|tlb|tag)\s*\|\s*en\s*\|([^}]*)\}\}/gi, (_, g) => '(' + g.split('|').filter(x => x && !/^_/.test(x)).join(', ') + ')')
  s = s.replace(/\{\{\s*(?:gloss|q|qualifier)\s*\|([^}]*)\}\}/gi, '($1)')
  s = s.replace(/\{\{[^}]*\}\}/g, '')                   // 남은 템플릿 제거
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, '')
  s = s.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim()
  return s || null
}
async function resolveGloss(title, depth = 0) {
  const wt = await wikitext(title)
  const sec = englishSection(wt)
  if (!sec) return { status: 'no-en', en: null }
  if (REJECT_RE.test(sec)) return { status: 'reject-dialect', en: null }
  const def = firstDef(sec)
  if (!def) return { status: 'no-def', en: null }
  // 리다이렉트 추적 (plural/alt form → base)
  const fol = def.match(FOLLOW_RE)
  if (fol && depth < 1) {
    const base = fol[1].trim().replace(/#.*$/, '')
    if (base && base.toLowerCase() !== title.toLowerCase()) {
      const r = await resolveGloss(base, depth + 1)
      if (r.en) return { status: r.status + '→' + base, en: r.en, base }
    }
  }
  const g = cleanGloss(def)
  if (!g || REJECT_TAGS.test(g)) return { status: 'reject-tag', en: null }
  if (/[a-z]/i.test(g) && g.length >= 3) return { status: 'ok', en: g }
  return { status: 'thin', en: null }
}
async function translateKo(en) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodeURIComponent(en)
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) { const j = await r.json(); return (j[0] || []).map(x => x[0]).join('').trim() } } catch {}
    await sleep(400 * (a + 1))
  }
  return null
}

// ── main ──
const nf = JSON.parse(fs.readFileSync('scratchpad-foreign/nf.json', 'utf8'))
let cands = nf.filter(x => (x.occ >= MINOCC || x.b >= MINBOOKS) && !FRAGMENTS.has(x.w) && /^[a-z]{3,}$/.test(x.w))
console.error(`게이트 후보: ${cands.length} (occ>=${MINOCC} OR books>=${MINBOOKS}, 파편/단문 제외)`)

const out = fs.createWriteStream('scratchpad-foreign/selfheal-candidates.jsonl')
const tally = { ok: 0, 'no-en': 0, 'reject-dialect': 0, 'reject-tag': 0, 'no-def': 0, thin: 0, notrans: 0 }
let done = 0
for (const c of cands) {
  const r = await resolveGloss(c.w)
  let ko = null
  if (r.en) { ko = await translateKo(r.en); if (!ko) { tally.notrans++ } }
  const status = r.en ? 'ok' : r.status.split('→')[0]
  tally[status] = (tally[status] || 0) + 1
  if (r.en && ko) out.write(JSON.stringify({ w: c.w, occ: c.occ, b: c.b, en: r.en, ko, via: r.status, base: r.base || null }) + '\n')
  if (++done % 40 === 0) console.error(`  ${done}/${cands.length} · ok=${tally.ok}`)
  await sleep(120)
}
out.end()
console.error('\n=== 게이트 결과 ===')
console.error(JSON.stringify(tally, null, 0))
const accepted = fs.readFileSync('scratchpad-foreign/selfheal-candidates.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
const occSum = accepted.reduce((s, x) => s + x.occ, 0)
console.error(`\n적재 후보(통과): ${accepted.length} lemma / ${occSum} occ`)
console.error('예시:')
for (const a of accepted.sort((x, y) => y.occ - x.occ).slice(0, 30)) console.error(`  ${a.w}(${a.occ}) → ${a.ko}  [${a.en.slice(0, 60)}]`)
