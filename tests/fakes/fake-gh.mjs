// tests/fakes/fake-gh.mjs — 테스트용 가짜 gh CLI. 교환 저장소를 FAKE_GH_DIR/state.json 으로 흉내 낸다.
// poc/work-bridge.mjs 가 쓰는 호출만: api repos/R · git/ref/heads · POST git/refs · PUT contents · label create ·
// pr create · pr list · api issues/N/comments · api contents/<path>?ref=<branch>
// 「Work 가 댓글을 다는 것」은 테스트가 state.json 에 직접 넣는다(SIMULATED — 실제 Work 실행이 아니다).
import fs from 'node:fs'
import path from 'node:path'

const dir = process.env.FAKE_GH_DIR
const sf = path.join(dir, 'state.json')
const st = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : { default_branch: 'main', refs: { main: 'a'.repeat(40) }, files: {}, prs: [], labels: [], calls: [] }
const a = process.argv.slice(2)
if (process.env.FAKE_GH_FAIL) {
  console.error('HTTP 502 (fake)')
  process.exit(1)
}
st.calls.push(a.slice(0, 4).join(' '))
const save = () => fs.writeFileSync(sf, JSON.stringify(st, null, 2))
const flag = (k) => {
  const i = a.indexOf(k)
  return i >= 0 ? a[i + 1] : undefined
}
const fields = () => Object.fromEntries(a.flatMap((x, i) => (a[i - 1] === '-f' ? [x.split(/=(.*)/s).slice(0, 2)] : [])))
const fail = (m) => {
  save()
  console.error(m)
  process.exit(1)
}

if (a[0] === 'api') {
  const method = a[1] === '-X' ? a[2] : 'GET'
  const url = a[1] === '-X' ? a[3] : a[1]
  let m
  if (method === 'GET' && (m = url.match(/^repos\/[^/]+\/[^/]+$/))) console.log(JSON.stringify({ default_branch: st.default_branch }))
  else if (method === 'GET' && (m = url.match(/git\/ref\/heads\/(.+)$/))) console.log(JSON.stringify({ object: { sha: st.refs[m[1]] } }))
  else if (method === 'POST' && /git\/refs$/.test(url)) {
    const f = fields()
    const b = f.ref.replace('refs/heads/', '')
    if (st.refs[b]) fail('Reference already exists')
    st.refs[b] = f.sha
    console.log('{}')
  } else if (method === 'PUT' && (m = url.match(/contents\/(.+)$/))) {
    const f = a.includes('--input') ? JSON.parse(fs.readFileSync(0, 'utf8')) : fields()
    st.files[`${f.branch}:${m[1]}`] = f.content
    console.log('{}')
  } else if (method === 'GET' && (m = url.match(/issues\/(\d+)\/comments/))) {
    const pr = st.prs.find((p) => p.number === Number(m[1]))
    console.log(JSON.stringify((pr?.comments || []).map((c, i) => ({ user: { login: c.author, type: c.type || 'User' }, created_at: c.at, body: c.body, html_url: `https://github.example/pr/${pr.number}#c${i}` }))))
  } else if (method === 'GET' && (m = url.match(/contents\/(.+)\?ref=(.+)$/))) {
    const c = st.files[`${m[2]}:${m[1]}`]
    if (!c) fail('Not Found (HTTP 404)')
    console.log(JSON.stringify({ content: c, html_url: `https://github.example/blob/${m[2]}/${m[1]}` }))
  } else fail(`fake gh: 모르는 api ${method} ${url}`)
} else if (a[0] === 'label' && a[1] === 'create') {
  if (st.labels.includes(a[2])) fail('already exists')
  st.labels.push(a[2])
} else if (a[0] === 'pr' && a[1] === 'create') {
  const n = st.prs.length + 1
  st.prs.push({ number: n, title: flag('--title'), headRefName: flag('--head'), labels: [flag('--label')], body: a.includes('--body-file') ? fs.readFileSync(0, 'utf8') : flag('--body'), createdAt: new Date().toISOString(), comments: [] })
  console.log(`https://github.example/pr/${n}`)
} else if (a[0] === 'pr' && a[1] === 'close') {
  const n = Number(String(a[2]).split('/').pop())
  const pr = st.prs.find((p) => p.number === n)
  if (!pr) fail('no pr')
  pr.state = 'closed'
} else if (a[0] === 'pr' && a[1] === 'list') {
  const label = flag('--label')
  console.log(JSON.stringify(st.prs.filter((p) => p.labels.includes(label)).map(({ number, title, headRefName, createdAt }) => ({ number, title, headRefName, createdAt }))))
} else fail(`fake gh: 모르는 명령 ${a.join(' ')}`)
save()
