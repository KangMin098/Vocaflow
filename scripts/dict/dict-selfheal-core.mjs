// scripts/dict/dict-selfheal-core.mjs
// 3R-Ⓒ 자기치유 공용 코어 — Wiktionary 게이트 + Google 번역.
// dict-selfheal-gate.mjs(오프라인 검수) 와 dict-selfheal-drain.mjs(자동 배선) 가 공유.
// 뜻 생성 LLM 0: Wiktionary 정의문 → Google 번역만.
const UA = { 'User-Agent': 'Vocaflow-dict-selfheal/1.0 (killerapp51@empal.com)' }
export const sleep = ms => new Promise(r => setTimeout(r, ms))

// 추출 파편(하이픈/아포스트로피) — 사전 대상 아님(추출단 처리). 게이트 사전 배제.
export const FRAGMENTS = new Set("agivin,ancks,anteddy,apens,arskin,arstin,artichook,atink,bachellar,backstickin,beatenes,beatenis,beatinis,becrowded,behabin,behol,beuk,biblio,bloodedly,bockered,boweryness,boxical,brekekex,brennschluss,bruteman,buil,clak,clangle,coend,conwenienth,cottonfiel,cusinier,dacious,darncin,dayman,despera,devani,dogwhip,dollarn,doonkle,downmost,dreadfo,dremp,droring,eberlastin,endyoin,entuzy,enythin,enytin,exp,eyedes,facedness,faithfo,fathuh,fearfo,fec,fedness,figurez,fivish,flas,flippetty,floppetty,flybie,footedly,foun,fourey,fuf,furgettin,furmety,gasfitters,ghari,gibblety,gingy,gingybread,grea,hadn,handsum,hankcher,hanticipatin,hia,hissel,hoasban,hobjec,hooal,iddy,interetht,intheristhin,ipsy,iums,jaal,jobman,jommlin,juneseyin,kaf,keat,ketchers,kiak,kow,krok,kursion,lenage,lighterd,llwyn,maders,markises,masel,mencin,mergence,miaw,micrometrically,mimmest,molloncolly,monst,muzy,natory,neeeeee,nelli,nently,neutual,newydd,nima,nimated,noor,oc,oge,oooooo,oratoire,oughtn,oum,overjoice,paralo,patht,peakt,peckery,pertec,pervenches,piritual,pisk,plodid,popsey,powerfulles,projickin,purt,purten,quatter,realizant,recious,reddinin,refoosin,revelant,rgs,riginal,rion,rk,rks,roas,rooft,rrr,rw,sarsnet,scrattlin,sebbent,senz,sevenpenny,seventimes,sexuo,shar,shib,shif,shtrappin,sidedly,simu,skarum,skirtishness,skybie,soj,spaceboat,splick,spon,squakin,sumthin,surrepshous,suthin,sweekin,tackety,taneous,taneously,tatteredness,taxicabman,teh,terterter,thauthepan,thelf,theologico,theveral,thip,thpy,threatnin,throthing,throtter,tial,tiful,tiggory,tle,topsel,trabblin,trimmlin,tsz,ture,twel,unburglar,underflannels,urmuts,urtin,venesta,vexto,vidence,wearifu,webbish,whi,whipperty,wishfo,wookey,wopsey,worly,woss,wukkin,wurno,wushin,wuzn,wymed,yih,zampni,zimmin,zwilnik,zyl".split(','))

const REJECT_TAGS = /\b(eye dialect|pronunciation spelling|misspelling|informal spelling|nonstandard spelling|obsolete spelling|dialectal spelling)\b/i
const DIALECT_TAG = /\b(dialect|dialectal|eye dialect|pronunciation spelling|colloquial|slang|nonstandard|informal|childish)\b/i
const FOLLOW_RE = /\{\{\s*(?:plural of|alternative (?:spelling|form) of|alt form|alt sp|inflection of|en-past of|archaic form of|dated form of|standard spelling of|superseded spelling of)\s*\|\s*en\s*\|\s*([^|}]+)/i
const REJECT_RE = /\{\{\s*(?:eye dialect of|pronunciation spelling of|misspelling of|informal spelling of|nonstandard spelling of)\s*\|/i
const core = s => (s || '').replace(/\([^)]*\)/g, '').replace(/[.\s:;,]/g, '')

async function wikitext(title) {
  const url = 'https://en.wiktionary.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&rvslots=main&formatversion=2&titles=' + encodeURIComponent(title)
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) { const j = await r.json(); return j?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? null } } catch {}
    await sleep(400 * (a + 1))
  }
  return null
}
function englishSection(wt) {
  if (!wt) return null
  const m = wt.match(/(^|\n)==\s*English\s*==\s*\n([\s\S]*?)(?=\n==[^=]|\n==\s*[A-Z][a-z]+\s*==|$)/)
  return m ? m[2] : null
}
function firstDef(sec) {
  if (!sec) return null
  for (const line of sec.split('\n')) { if (!/^#\s+\S/.test(line)) continue; if (/^#[:*]/.test(line)) continue; return line.replace(/^#\s+/, '').trim() }
  return null
}
function cleanGloss(def) {
  if (!def) return null
  let s = def
  s = s.replace(/\{\{\s*(?:lb|label|tlb|tag)\s*\|\s*en\s*\|([^}]*)\}\}/gi, (_, g) => '(' + g.split('|').filter(x => x && !/^_/.test(x)).join(', ') + ')')
  s = s.replace(/\{\{\s*(?:gloss|q|qualifier)\s*\|([^}]*)\}\}/gi, '($1)')
  s = s.replace(/\bnocat\s*=\s*\w+/gi, '').replace(/\|/g, ', ') // 템플릿 파라미터 잔여 정리
  s = s.replace(/\{\{[^}]*\}\}/g, '')
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
  s = s.replace(/'''?/g, '').replace(/<[^>]+>/g, '')
  s = s.split('#')[0]                                   // 추가 sense(# 리스트) 잔여 컷 — 첫 뜻만
  s = s.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim()
  return s || null
}
// 표제어 → {status, en, dialect, base}. en 이 있으면 게이트 통과.
export async function resolveGloss(title, depth = 0) {
  const wt = await wikitext(title)
  const sec = englishSection(wt)
  if (!sec) return { status: 'no-en', en: null }
  if (REJECT_RE.test(sec)) return { status: 'reject-dialect', en: null }
  const def = firstDef(sec)
  if (!def) return { status: 'no-def', en: null }
  let followTo = null
  const fol = def.match(FOLLOW_RE); if (fol) followTo = fol[1]
  if (!followTo) { const see = def.match(/^\s*see\s+\[?\[?([a-z][a-z '-]+?)\]?\]?\s*\.?\s*$/i); if (see) followTo = see[1] }
  const cleaned0 = cleanGloss(def)
  if (!followTo && core(cleaned0).length < 2) { const lk = def.match(/\[\[([a-z][a-z '-]+?)\]\]/i); if (lk) followTo = lk[1] }
  if (followTo && depth < 2) {
    const base = followTo.trim().replace(/#.*$/, '')
    if (base && base.toLowerCase() !== title.toLowerCase()) {
      const r = await resolveGloss(base, depth + 1)
      if (r.en) return { status: r.status.replace(/^ok$/, 'follow') + '→' + base, en: r.en, base, dialect: r.dialect }
    }
  }
  const g = cleaned0
  if (!g || REJECT_TAGS.test(g)) return { status: 'reject-tag', en: null }
  if (core(g).length < 2) return { status: 'thin', en: null }
  return { status: 'ok', en: g, dialect: DIALECT_TAG.test(g) }
}
// KO 글로스 품질: 한글 포함 + 괄호밖 본문에 미번역 라틴어(≥5) 없음 (meseemeth→meseens 류 차단)
export const koQualityOk = ko => { const body = (ko || '').replace(/\([^)]*\)/g, ''); const coreLen = body.replace(/[.\s:;,·]/g, '').length; return /[가-힣]/.test(ko) && coreLen >= 2 && !/[a-zA-Z]{5,}/.test(body) && !/[#{}|]|명사,|동사,/.test(ko) }
// 번역기 스위치 — TRANSLATOR=google(기본) | mymemory. 정의문 번역은 두 엔진 호각(실측),
// MyMemory 는 무키 대체(단일 벤더 의존 제거). MM_EMAIL 로 한도 상향(익명 1k→이메일 50k words/day).
const TRANSLATOR = process.env.TRANSLATOR || 'google'
const MM_EMAIL = process.env.MM_EMAIL || ''
async function translateGoogle(en) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' + encodeURIComponent(en)
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) { const j = await r.json(); return (j[0] || []).map(x => x[0]).join('').trim() } } catch {}
    await sleep(400 * (a + 1))
  }
  return null
}
async function translateMyMemory(en) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(en) + '&langpair=en|ko' + (MM_EMAIL ? '&de=' + encodeURIComponent(MM_EMAIL) : '')
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: UA })
      if (r.ok) { const j = await r.json(); const t = (j?.responseData?.translatedText || '').trim(); if (t && !/MYMEMORY WARNING|QUOTA/i.test(t)) return t; if (/QUOTA/i.test(t)) { console.error('MyMemory 한도소진'); return null } }
    } catch {}
    await sleep(500 * (a + 1))
  }
  return null
}
// primary(TRANSLATOR) 우선, 결과가 품질미달이면 타엔진 폴백 → 단일 벤더 의존/일시장애 완화.
export async function translateKo(en) {
  const primary = TRANSLATOR === 'mymemory' ? translateMyMemory : translateGoogle
  const fallback = TRANSLATOR === 'mymemory' ? translateGoogle : translateMyMemory
  const a = await primary(en)
  if (a && koQualityOk(a)) return a
  const b = await fallback(en)
  if (b && koQualityOk(b)) return b
  return a || b // 둘 다 미달이면 primary(있으면) 반환 — 상위 koQualityOk 가 최종 판정
}
