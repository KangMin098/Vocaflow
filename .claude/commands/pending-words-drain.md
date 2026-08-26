---
description: pending_words 드레인 배치 — 청크를 pending-words-judge 서브에이전트로 팬아웃해 한 번에 판정한다
argument-hint: [--dir scripts/dict/pending-drain] [--chunks 01,02] [--pilot] [--wave-size 4] [--export N] [--force]
allowed-tools: Read, Write, Edit, Bash, Glob, Agent
---

당신은 `pending_words` 드레인의 **오케스트레이터**다. 청크를 찾아 `pending-words-judge`
서브에이전트에 하나씩 맡기고, 끝나면 적재 명령을 안내한다. **당신이 직접 판정하지 않는다.**

## 왜 팬아웃인가

큐가 **1만 건대**이고 TCP 수확이 돌 때마다 더 쌓인다(실측 2026-08-26: TCP 4만 편을
처리하는 사이 pending_words 가 8,962 → 14,534 로 늘었다). 청크 하나씩 순서대로 채우면
사람이 그 자리에 계속 있어야 한다. 청크는 서로 독립이므로 동시에 돌릴 수 있다.

## 인자

`$ARGUMENTS` 를 파싱한다:

- `--dir <경로>` — 기본 `scripts/dict/pending-drain`
- `--export N` — 시작 전에 export 를 돌려 청크를 새로 뽑는다(N = 청크당 낱말 수, 기본 60)
- `--chunks 01,02` — 그 번호만
- `--pilot` — **첫 청크 하나만** 돌리고 멈춘다. 품질을 먼저 보고 싶을 때
- `--wave-size N` — N개씩 물결로 (기본 4)
- `--force` — 이미 `.out.json` 이 있는 청크도 다시

## 1단계 — 청크 확보

`--export` 가 있으면 먼저:

```bash
node scripts/dict/drain-pending-words.mjs export --dir <DIR> --chunk <N>
```

⚠️ export 는 **적재 안 한 `.out.json` 이 있으면 멈춘다**(청크 경계가 어긋나므로).
그 경우 먼저 import 를 끝내라고 사용자에게 말하고 중단한다.

그다음 목록을 만든다:

```bash
ls <DIR>/chunk-*.json | grep -v '\.out\.json$'
```

**이미 `chunk-NN.out.json` 이 있는 청크는 건너뛴다**(`--force` 가 없으면).
건너뛴 수를 반드시 말한다 — 0 건 처리를 "완료" 로 보고하는 것이 이 저장소가 경계하는 실패다.

### ⚠️ claim 을 먼저 찍는다 — 워크스페이스를 여러 세션이 공유한다

실측 2026-08-26: 3차 물결에서 **두 에이전트가 "내 청크에 이미 다른 판정본이 있었다"** 고
보고했다. 다른 세션이 같은 청크를 동시에 돌고 있었던 것이다. TCP 큐는 DB 가
`FOR UPDATE SKIP LOCKED` 로 막아 주지만, **이 청크 폴더에는 그런 장치가 없다.**
결과는 낭비된 판정과, 서로 다른 판정본이 덮어쓰는 경합이다.

그래서 스폰 **전에** 표시를 남긴다:

```bash
# 잡기 — 이미 신선한 claim 이 있으면 그 청크는 건너뛴다
for c in <대상 청크들>; do
  claim="${c%.json}.claim"
  if [ -f "$claim" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$claim") ))
    [ "$age" -lt 1800 ] && echo "SKIP(claimed ${age}s) $c" && continue   # 30분
  fi
  echo "$(hostname)-$$ $(date -Is)" > "$claim"
  echo "CLAIM $c"
done
```

- **30분이 지난 claim 은 죽은 것으로 보고 가져간다** — 세션이 중간에 끊길 수 있다
  (`compose` 큐가 쓰는 30분 회수와 같은 값).
- 청크가 끝나면 `.claim` 을 지운다. 실패했으면 남겨 두지 말 것 — 다음 실행이 못 잡는다.
- `.claim` 은 커밋하지 않는다.

## 2단계 — 팬아웃

물결마다 `--wave-size` 개씩, 각 청크에 `pending-words-judge` 서브에이전트 하나.
**한 메시지에 여러 Agent 호출을 넣어야 실제로 동시에 돈다.**

각 에이전트에 넘길 것: 청크의 **절대 경로**와, 출력이 `chunk-NN.out.json` 이라는 것.

`--pilot` 이면 첫 청크 하나만 돌리고, 결과를 요약한 뒤 **멈춘다** —
나머지를 자동으로 잇지 않는다.

## 3단계 — 형태 검사 (적재 전)

각 `.out.json` 에 대해 값이 아니라 **모양**만 본다. 내용 판정은 이미 끝났다.

```bash
node -e "
const fs=require('fs');
for (const f of process.argv.slice(1)) {
  const inp = JSON.parse(fs.readFileSync(f.replace('.out.json','.json'),'utf8'));
  const out = JSON.parse(fs.readFileSync(f,'utf8'));
  const miss = inp.map(x=>x.w).filter(w=>!out.some(o=>o.word===w));
  const bad = out.filter(o=>!['add','proper_noun','noise','defer'].includes(o.verdict));
  const noCat = out.filter(o=>o.verdict==='noise' && !o.category);
  console.log(f, inp.length+'→'+out.length, miss.length?('빠짐 '+miss.length+': '+miss.slice(0,5)):'빠짐 0', bad.length?('verdict 이상 '+bad.length):'', noCat.length?('category 누락 '+noCat.length):'');
}" <DIR>/chunk-*.out.json
```

빠진 항목·이상한 verdict·category 누락이 있으면 **그 청크만 다시 돌린다.**

## 4단계 — 적재

먼저 DRY-RUN:

```bash
node scripts/dict/drain-pending-words.mjs import --dir <DIR>
```

검증 탈락 목록을 **먼저 읽는다**. 그다음:

```bash
node scripts/dict/drain-pending-words.mjs import --dir <DIR> --commit
```

⚠️ `add` 는 **사전에 새 표제어를 쓴다.** 되돌리려면 그 행을 지워야 한다.
첫 실행이거나 판정 규칙을 바꿨으면 `--pilot` 로 한 청크만 돌려 import DRY-RUN 까지
확인한 뒤 나머지를 진행한다.

## 5단계 — 확인

```bash
node scripts/dict/drain-pending-words.mjs export --dir <DIR>
```

를 다시 돌려 **후보 수가 처리한 만큼 줄었는지** 본다. 안 줄었으면 큐 정리가 실패한 것이다.

## 보고

- 청크 N개 · 건너뜀 N · 판정 합계(add / proper_noun / noise / defer)
- 형태 검사에서 걸린 것
- import DRY-RUN 의 검증 탈락 수
- 큐 잔량 변화

**숫자 없이 "완료" 라고 쓰지 않는다.**
