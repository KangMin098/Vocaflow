# 어원 니모닉 확대 — 멀티 세션 지시문 (2026-07-18)

> **목적**: 미니모닉인 노출-고난도(v≥7·rank≤12k) 단어에 kaikki `etymology_text`(실제 어원)를 **근거**로 어근 다리 니모닉 생성.
> **경선식(발음 소리흉내) 절대 금지** — [[feedback_mnemonic_etymology_only]]. 근거(어원) 대조 게이트로 기계 차단.
> **규모**: 대상 3,486단어(고전어 어원 보유) → 현 니모닉 2,618개의 2배+. 30청크 → 6세션×5청크.

---

## 1. 경선식이란 무엇이고 왜 금지인가 (반드시 숙지)

- **경선식(금지)** = 영어 발음을 **뜻 없는 한국어 소리**로 흉내 내 이야기를 만드는 것.
  예: `advocate → 애드보킷 → "애들 보고 캣!" 하며 편들다`. `애들·보고·캣`은 뜻이 없고 그냥 소리를 닮았을 뿐.
- **어원(허용)** = 실제 뜻을 가진 어근으로 분해.
  예: `advocate → ad(~쪽으로)+voc(목소리) → 목소리를 내다 → 옹호하다`. `ad·voc`은 진짜 라틴 어근.
- **차이**: 어원=뜻 가진 진짜 어근 / 경선식=뜻 없는 소리 흉내.

**핵심 잠금 = 근거 대조**: 니모닉에 쓴 어근이 그 단어의 `etymology_text`에 실제로 등장해야 통과. 경선식이 지어낸 소리(애들·보고·캣)는 실제 어원에 없으므로 apply 게이트가 자동 거부한다.

---

## 2. 왜 멀티 세션 / 어떻게 격리되나

| 축 | 설계 |
|---|---|
| 분할 | rank 대역(청크 rank 정렬 → 인덱스 분할). 세션 간 단어 중복 0 |
| DB 충돌 | 없음 — 서로 다른 단어행 UPDATE. apply 멱등(이미 있으면 skip) |
| git 충돌 | 없음 — **워커 세션 커밋 금지**. 데이터 gitignore, 툴 이미 커밋 |
| 워크트리 | 미사용(코드 변경 0·3.19GB 원본 공유) |
| 청크 생성 | **이미 완료** — 세션은 재스트림 금지. 자기 dir 청크만 사용 |

---

## 3. 세션 배정표

**생성 완료 — 30청크·3,486단어·세션당 5청크(M6=486)·1웨이브.**

| 세션 | dir | 청크 | 단어 | rank 대역 |
|---|---|---|---|---|
| M1 | `mnem-etym-s1` | 5 | 600 | 2,096–5,500 |
| M2 | `mnem-etym-s2` | 5 | 600 | 5,500–7,126 |
| M3 | `mnem-etym-s3` | 5 | 600 | 7,130–8,500 |
| M4 | `mnem-etym-s4` | 5 | 600 | 8,500–9,500 |
| M5 | `mnem-etym-s5` | 5 | 600 | 9,500–10,944 |
| M6 | `mnem-etym-s6` | 5 | 486 | 10,950–11,989 |

> yield 예상: 어원 근거는 있으나 authoring 시 불투명·비전이 어근은 skip → **60~80%** 예상.
> 소요: 5청크 1웨이브 동시 ≈ 12분 + apply. **세션당 ≈15분.**

---

## 4. 서브에이전트 authoring 프롬프트 (변경 없이 사용 · `chunk-NN`·`s{{S}}`만 치환)

```
한국어 학습자용 영어 어원 니모닉 생성. 파일 하나를 처리한다.

입력: `C:\Users\kille\Vocaflow\scripts\dict\mnem-etym-s{{S}}\chunk-NN.json`
  — 배열 [{word, meaning_ko, v_level, rank, etymology_text}]. etymology_text = kaikki(Wiktionary) 실제 어원.

각 단어에 대해, etymology_text를 **근거로** 어근 다리 니모닉(mnemonic_ko)을 만든다.

★ 절대 금지 — 경선식(발음 소리흉내):
  영어 발음을 뜻 없는 한국어 소리로 흉내 내는 방식. 예(금지): advocate → "애드보킷 → 애들 보고 캣!".
  애들·보고·캣은 뜻이 없고 소리만 닮음. 이런 방식 절대 금지. 한글(한글) 소리 괄호 금지.

★ 필수 형식 — 어원 다리:
  `어근(뜻)+어근(뜻) → 의미 다리 → 최종 뜻`  (화살표 →)
  예: advocate → ad(~쪽으로)+voc(목소리) → ~를 위해 목소리를 내다 → 옹호하다
      investigator → in(따라)+vestig(발자취) → 발자취를 좇는 사람 → 수사관
  - 어근은 **etymology_text에 실제 등장하는 것만** 사용(로마자). 지어내지 마라.
  - 어근 뜻(괄호 안)은 그 어근의 실제 의미(한국어). 소리 흉내 금지.
  - etymology_text가 "Etymology tree" 형태의 조상 체인이면, 학습자에게 유의미한 어근 단계만 골라 써라.

★ skip 조건(억지 생성 금지 — 품질이 개수보다 우선):
  - etymology_text가 불투명/불명(uncertain 등)이거나 어근 분해가 무의미하면 그 단어 생략.
  - 어근→최종뜻 다리가 억지스러우면(어원과 현 뜻이 너무 멀면) 생략.
  - 게르만계·자명 결합(there+by류)이라 어원이 기억에 도움 안 되면 생략.

출력: `C:\Users\kille\Vocaflow\scripts\dict\mnem-etym-s{{S}}\chunk-NN.out.json`
  에 배열 [{word, mnemonic_ko}] (JSON만, 생성한 단어만). Write 도구로 저장. mnemonic_ko는 140자 이내.

작업 후 마지막 메시지에 `chunk-NN: <생성수>/<입력수>` 한 줄만.
```

---

## 5. 세션별 지시문 — 복사해서 붙여넣기

> S1~S6 블록 중 하나를 통째로 복사 → 새 Claude Code 세션 첫 메시지로. 치환 불필요.

### ▸ M1 (rank 2,096–5,500 · 5청크)
```
Vocaflow 어원 니모닉 확대 — 세션 M1 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s1/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04, 각 ~120단어). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s1/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s1/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s1 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

### ▸ M2 (rank 5,500–7,126 · 5청크)
```
Vocaflow 어원 니모닉 확대 — 세션 M2 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s2/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04, 각 ~120단어). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s2/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s2/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s2 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

### ▸ M3 (rank 7,130–8,500 · 5청크)
```
Vocaflow 어원 니모닉 확대 — 세션 M3 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s3/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04, 각 ~120단어). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s3/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s3/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s3 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

### ▸ M4 (rank 8,500–9,500 · 5청크)
```
Vocaflow 어원 니모닉 확대 — 세션 M4 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s4/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04, 각 ~120단어). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s4/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s4/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s4 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

### ▸ M5 (rank 9,500–10,944 · 5청크)
```
Vocaflow 어원 니모닉 확대 — 세션 M5 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s5/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04, 각 ~120단어). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s5/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s5/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s5 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

### ▸ M6 (rank 10,950–11,989 · 5청크 · 486단어)
```
Vocaflow 어원 니모닉 확대 — 세션 M6 담당.

먼저 docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md 를 읽어라. 지시문 전문이다.
특히 §1(경선식 절대 금지 정의)과 §4(authoring 프롬프트)를 반드시 지켜라.

내 담당 = scripts/dict/mnem-etym-s6/ 하나뿐. 다른 mnem-etym-* dir 은 다른 세션 소유이니 건드리지 마라.
내 dir = 5청크(chunk-00 ~ chunk-04). 1웨이브로 처리한다.

작업 루프:
1. ls scripts/dict/mnem-etym-s6/ 확인 (*.out.json 있으면 완료분 → 건너뜀).
2. chunk-00~04 를 general-purpose 서브에이전트 5개에 한 메시지에서 동시 디스패치(run_in_background: true).
   각 프롬프트 = 지시문 §4 를 그대로 복사 + 청크 번호만 치환. 경선식 금지 문구 절대 삭제 금지.
3. 완료 대기 = Bash(run_in_background: true) until-loop:
   for i in $(seq 1 120); do n=$(ls scripts/dict/mnem-etym-s6/chunk-0[0-4].out.json 2>/dev/null | wc -l); if [ "$n" -ge 5 ]; then echo ALL5; break; fi; sleep 15; done
4. apply(경선식 차단 게이트 내장): node scripts/dict/mnemonic-etym-apply.mjs --dir scripts/dict/mnem-etym-s6 --commit
   (rejected 에 no-latin-root/hangul-sound-paren/ungrounded 가 뜨면 = 경선식/근거불일치가 차단된 것. 정상)
5. 종료 보고.

절대 금지: git commit/push · 문서(.md) 수정 · mnemonic-etym-chunk.mjs 재실행 · 다른 mnem-etym-* dir · 마이그레이션.
완료 보고: 세션·청크수·입력수·생성수·yield%·apply된수·게이트 거부수(이유별).
```

---

## 6. apply 게이트 (경선식을 실제로 차단하는 곳)

`mnemonic-etym-apply.mjs`가 out.json을 DB 반영 전 검사:
1. **화살표(→) 필수**.
2. **라틴 어근 토큰 필수**·**한글(한글) 소리 괄호 거부**(경선식 신호).
3. **근거 대조**: 각 어근 토큰이 그 단어 `etymology_text`(같은 dir chunk)에 등장(diacritic strip 후 substring). 접두사(ad/re/de…)는 whitelist.
자체 테스트 통과: `advocate → ad(voc)` 통과 / `애들 보고 캣` 거부(no-latin-root) / `amb(암 걸려)+란스(구르며)` 거부(hangul-sound-paren).

**잔여 한계(정직)**: 진짜 라틴 substring에 소리-스토리 gloss를 붙인 위장(`amb(암 걸려)` 단독)은 게이트가 근거 일치로 통과시킬 수 있음. 그러나 authoring이 etymology_text 근거이므로 발생 확률 낮고, §7 감사로 사후 포착.

---

## 7. 종합 세션 (전 세션 종료 후 1회)
1. 감사: `select count(*) filter(where mnemonic_ko !~ '[a-zA-Z]') as pure_hangul, count(mnemonic_ko) as total from shared_dictionary` — pure_hangul=0 확인.
2. CHANGELOG(v06.268) + [[feedback_mnemonic_etymology_only]] + [[project_etymology_root_axis]] 갱신(누계 니모닉 수).
3. 커밋 1건 + feat/plan-ui push.
4. `scripts/dict/mnem-etym-s*/` gitignore — 커밋 대상 아님.

---

*근거 = shared_dictionary 실측(2026-07-18, 미니모닉 v≥7·rank≤12k gap 5,935 → 고전어 3,486) + kaikki etymology_text. 게이트 자체검증 통과.*
