# 만화 저작·하드닝 규칙 원장 (self-improving ratchet)

> 평가(lint·preflight·QC·교차·T3)에서 나온 교훈을 **매번 이 원장에 규칙으로 승격**한다.
> 다음 스크립트는 이 규칙을 **처음부터** 적용하므로, 스테이지가 쌓일수록 시작 품질이 올라간다.
> "발견 → 규칙화 → 가능하면 lint/NEG/코드로 자동화 → 버전업."

## 규칙 (버전 누적)

### v1 — Stave 1 에서 승격 (전부 lint/NEG/코드로 자동화됨)
- **R1 색상어 금지**(scene): red/blue/… → 잉크 표현. *(lint-script 자동)*
- **R2 베이크 텍스트 금지**(scene): "reading X"·따옴표·ALLCAPS 간판 금지 → 빈 판 + HTML 캡션. *(lint 자동)*
- **R3 무배경 금지**: "plain white background"·isolated·checkerboard 금지, 구체 배경 강제. *(lint + NEG)*
- **R4 메타 프리픽스 금지**: scene 은 "drawn as…" 로 시작 금지(INK/HARDBW 가 담당). *(lint 자동)*
- **R5 화자=화면 내 인물**: 모든 speech 의 화자는 그 패널에 등장. 화면 밖 화자는 narration 으로. *(lint 자동)*
- **R6 캡션 ≤2 블록/패널** (인지부하). *(lint warn)*
- **R7 edit 참조 = 단일뷰 + 중앙 자동크롭**: 다중뷰 시트는 2번째 인물 누출 → 단일 전신 1인 + buildRef 중앙 52% 크롭. *(comic-prompt + gen-comfy 자동)*
- **R8 seed 랜덤화**: 재생성이 다른 이미지가 되도록(교정수리 전제). *(gen-comfy 자동)*
- **R9 캐릭터 차별화 락**: 헷갈리는 두 인물은 canonical + distinct_from 로 시각 분리(예: Scrooge 불투명·대머리 vs Marley 반투명·턱붕대·돈사슬).

### v2 — Stave 2 에서 승격 (신규)
- **R10 나이 변형 = 별도 캐스트**: 같은 인물의 다른 生涯 단계(늙은 Scrooge vs 젊은 Scrooge)는 **별개 cast 항목**(`young_scrooge`)으로 둔다. 하나의 참조로 두 나이를 못 낸다. distinct_from 에 "젊고 머리 있음 — 늙은 대머리 아님" 명시.
- **R11 추상/비인간 캐릭터 시그니처 락**: 유령·정령은 **재현 불가한 2~3개 표식**을 canonical 에 고정하고 등장 패널마다 주입(예: 과거의 유령 = 머리 정수리에서 솟는 촛불 + 순백 로브 + child-old). 표식이 흔들리면 정체성 붕괴.
- **R12 소품 정합(prop coherence)**: 캡션이 언급한 소품(홀리·사슬·촛불끄개)은 scene 에도 반드시 존재해야 한다. 캡션 "holly branch in its hand" ↔ scene "빈 손" 같은 모순 금지. *(preflight S0.5 가 생성 전 검출)*
- **R13 단역(minor) 화자 처리**: cast 참조가 없는 단역(Fan·남편·Mrs Fezziwig)이 말하면 → 그 단역을 **scene 에 그려서 화면에 있게 하고**(t2i/noref 로) 화자로 두거나, 대사를 narration 으로 전환. (R5 의 확장.)
- **R15 플랫 잉크 강제 · 스타일 일관성**: 하프톤/벤데이 점묘/스크린톤/반실사 렌더 금지 — 개별 패널로는 grayscale 라 통과되지만 **책 전체 플랫잉크 톤과 이질적**이면 결함(Stave2 p14/p15 실측: 패널게이트가 "경미"로 통과 → 책-레벨 검증이 최우선 결함으로 포착). *(NEG 에 halftone/benday/screentone/semi-realistic 추가 + qc-comfy hard-fail `style_drift`.)* **일관성은 상대적 속성이라 패널 단위 게이트로는 원리상 불충분** → 아래 S3.5 필요.
  - **S3.5 책-레벨 스타일 게이트(신규 스테이지)**: 전 스테이지의 모든 패널을 **함께** 놓고 톤/선/렌더 아웃라이어를 찾는다. 패널·교차(캐릭터) 게이트가 못 보는 "나머지와 다르다"를 잡는 유일한 계층. Claude vision 으로 전체를 대조.
- **R14 2인 패널 의상 명시**: 한 패널에 **의상이 다른 두 인물**(예: 백로브 유령 + 줄무늬 잠옷 Scrooge)이 나오면, 단일 참조 edit 이 **의상을 엉뚱한 인물에 입힌다**(Stave2 P4 실측). scene/힌트에 "왼쪽 X는 A를 입고, 오른쪽 Y는 B를 입는다 — 서로 바꾸지 말 것"을 **위치와 함께 명시**. 근본 해결은 다중참조(image1/2/3) — 그 전까지 이 명시로 우회. S2.5 교정수리에서 이 힌트가 특히 효과적.

### v3 — 독자-경험 검증에서 승격 (신규, 텍스트 축)
- **R16 내러티브 흐름·재미** (S4 게이트가 검사; 수정은 대부분 narration 한 줄 — 아트 고정): 기술 게이트(결함·일관성)를 다 통과해도 **이야기가 안 읽히거나 밋밋할 수 있다**(실측: Stave2 P14가 옆 청년을 Scrooge로 안 밝혀 최대 혼란). 규칙:
  1. **첫 등장 명명**: 인물, 특히 **나이변형/과거 자아**는 처음 나올 때 narration 이 "이 사람은 …다"라고 밝힌다(P14 "옆 청년이 곧 Scrooge").
  2. **장면 전환 다리**: 새 장소/시점 점프엔 bridge 한 줄. 기계적 "NEXT:" 금지("The Spirit carried him on to…").
  3. **스테이지 끝 훅**: 각 스테이지는 **다음을 당기는 한 줄**로 끝낸다(다음 유령 예고).
  4. **스테이지 간 설정 심기**: 페이오프 전에 힌지를 심어라(Marley "clock strikes one"을 S1 끝에 → S2 시작 "1시" 가 이어짐).
  5. **반복 금지·전진**: 같은 정보를 3연속 패널로 되풀이 말고(춥다×3) 다음을 가리켜라.
  6. **문화어 인라인 gloss**: workhouse·apprentice·snuffer-cap 등은 narration 안에서 짧게 풀어준다.

### v4 — 4권 종합 검증에서 승격 (신규)
- **R17 시대 앵커(period anchor)**: 시대착오(현대 부엌·복장·조명·건물)가 특히 **t2i 군중/장면**("family dinner", "party", "classroom", "office")에서 체계적으로 샌다 — NEG만으론 부족. 그래서 **모든 패널 프롬프트에 "Victorian London around 1843, period-accurate; NO modern objects/clothing/lighting/furniture" 포지티브 앵커**를 상시 주입(comic-prompt panelPromptText). NEG(modern kitchen/clothing/…)와 이중 방어. (4권 검증: S2 P7/8·S3 P8/15·S1 P8·S4 P8/10 실측.)
- **R18 부재의 묘사**: 인물의 **부재/죽음**을 그릴 땐 scene 에 "그 인물이 없음"을 **명시**한다. "empty stool + crutch"만 쓰면 모델이 살아있는 아이를 채워 넣는다(S4 P9 Tim 실측: 죽었는데 살아있게 그려짐 → 스토리 힌지 붕괴). scene: "no child on the stool — he is gone".

### v5 — 레벨 적응형 레지스터 (신규, 핵심)
- **R19 레벨 적응형 레지스터(art·text·story)**: 산출물의 **사실감/정교함을 도서 레벨(target_v_level 0~11)에 맞추되 "약간 상향"**(존중·비유아틱). 상급 도서인데 유아·초등 스타일 이미지면 부적합.
  - **아트 사다리**(흑백 유지 — 사실감=디테일·해칭·정확한 비례에서, 색 아님):
    | eff level(=vlevel+1.5) | register | 느낌 |
    |---|---|---|
    | ≤4 | **cartoon** | 두꺼운 단순 선·둥근 형태, 유아용 |
    | ≤7 | **comic** | 펜·잉크 만화, 성인 비례(비-chibi), 가벼운 해칭 (Gonick↑) |
    | ≤10 | **graphic-novel** | 사실적 비례+해칭+절제된 screentone, 문학적 그래픽노블/판화 |
    | >10 | **realistic** | 사실적 에칭·명암, 성인 고급 |
    구현: `comic-prompt.styleForLevel(vlevel)` → {ink, negExtra}. `gen-comfy --vlevel N` 강제. NEG도 **레벨-상대**: 저레벨은 halftone/사실주의 차단, 고레벨은 chibi/유아틱 차단(그래서 예전 "halftone 결함"이 고레벨에선 정상). QC `style_drift`도 레지스터 기준(`qc-comfy` 매니페스트에 expected_art_register).
  - **텍스트 레지스터**: 어휘 난이도·문장 복잡도·문체를 레벨(+약간)에 맞춘다. 저레벨=짧고 쉬운 문장, 고레벨=풍부한 어휘·복문·문학적 뉘앙스 유지(무조건 쉽게 X). 아이코닉 원문 보존 비율도 레벨↑일수록↑.
  - **스토리 레지스터**: 주제의 미묘함·아이러니·도덕적 복잡성을 레벨에 맞춘다. 저레벨=명시적·직접적, 고레벨=암시·여백 허용.
  - Carol=V7 → 기대 register "graphic-novel"(약간 상향). 기존 flat 카툰본은 V7엔 다소 유아틱 → 상향 재렌더 권장.

### v6 — 교정 루프 수렴(whack-a-mole 탈출) (신규, 프로세스 핵심)
Carol graphic-novel 마감에서 재생성이 수렴하지 않은 실측(교정 17 → 미착지 6 + 신규 11)에서 도출.
- **R20 레지스터별 결함 프로파일**: 각 아트 레지스터는 **고유 실패모드**가 있다. flat-cartoon = 빈풍선·halftone 누출 / **graphic-novel(realistic) = 묘비·간판에 글자 새김·금속 색-틴트·얼굴없는데 눈·투명한데 불투명·과한 배경 디테일**. 레지스터 선택 시 그에 맞는 NEG·힌트·"난제 목록"을 함께 적용한다(styleForLevel 에 결함프로파일 부속).
- **R21 검증 게이트형 교정(fire-and-forget 금지)**: 패널 재생성 후 **그 패널만 즉시 재검증**(Claude vision)해 통과할 때만 채택. 실패면 **best-of-N**(N개 후보 생성→Claude가 클린 선택)로 재시도, ≤K회 후에도 실패면 **사람 플래그**. 통과 패널은 **동결**(재생성 금지 — 새 결함 유입 차단). ⇒ `gen-verified` 의 S2→S2.5 루프를 **패널 단위 폐쇄**로. (지금까진 재생성만 하고 재검증을 안 해 미착지가 누적.)
- **R22 힌트-저항 결함은 `noref t2i` 재생성이 1차 해법**(2026-08-06 Carol 마감에서 실증): 힌트-저항 결함 대부분의 **근본 원인은 참조시트(ref) 조건화**다 — 그 패널만 **`--noref`(t2i)** 로 돌리면 한 번에 풀린다. Carol 마감 실측:
  - **elfin/뾰족 귀**(Scrooge) → edit 2롤 실패 → **noref 1롤에 정상 귀**.
  - **현재 유령 노화 실패** → 젊은-유령 ref 저항 → **noref + 강한 "aged/white beard" 힌트로 명확히 노화**.
  - **faceless 후드에 얼굴 생김**(Yet-to-Come) → scrooge ref가 얼굴 유입 → **noref t2i 로 완벽한 순흑 void**.
  - **묘비/간판 baked 글자** → **noref + "all signs blank, no letters, NO speech balloons" 복합 NEG**. (단 "blank sign" 힌트가 **빈 말풍선을 유발**하는 whack-a-mole 있음 → 말풍선 금지를 같은 힌트에 병기.)
  - **반투명**(Marley) → realistic은 불투명하게 그림. 리터럴 투명이 안 되면 **스펙트럴 글로우 관례**로 채택(유령감은 전달) = 정당한 채택-한계.
  - 순서: **① 힌트 재생성(edit) → ② 안 되면 그 패널만 noref t2i → ③ 그래도 안 되면 채택-한계/사람 플래그**. post-fix는 그 다음.
- **R22b post-fix(`post-fix.mjs`)는 최후·용도 한정**(사각 fill의 한계 실증): 좌표 기반 결정적 3연산 `void`/`blank`/`translucent` 은 **균일 배경 위 직사각 영역**에만 적합. **유기적 실루엣(후드)·라인아트 텍스처(간판)에는 쓰지 말 것** — 후드 void는 하늘로 삐져나온 검은 사각형, 간판 blank은 라인아트 위 회색 검열박스가 되어 **원 결함보다 나쁨**. 이 경우 R22 ①②(noref 재생성)로 대체. post-fix는 원본을 `qc/prefix-backup/` 에 백업(가역)하므로 실패 시 즉시 revert. `gen-verified --post-fix` 배선은 유지하되 **기본 비활성**.
- **R23 게이트 없이 SHIP 선언 금지(프로세스 규율)**: 수동 조립·게시로 게이트를 **우회하지 말 것**. 항상 `gen-verified` 강제 경로(전원 PASS 시에만 assemble) + 게시 전 **릴리스 게이트(qc + 스토리 + 책)** 통과 필수. **스팟체크로 "완료" 선언 금지** — 엄격 게이트가 진실. (이번 세션 최대 실패요인 = 내 규율.)
- **R24 릴리스 게이트는 전수(全 패널)여야 한다**(실증 도출 2026-08-06): 스팟-교정한 "플래그 N패널"만 재검증하면 **한 번도 플래그된 적 없는 패널의 신규 결함을 놓친다**. Carol 마감에서 19패널만 고치고 근접-마감으로 판단했으나, 전수 재게이트(90패널)가 **never-flagged 패널 7건의 하드페일**(S1 P18·S2 P6·S3 P6/17/18·S4 P7·S5 P15)을 드러냄. ⇒ 게시 전 반드시 **전 패널** Claude vision(스테이브당 1 에이전트 병렬)로 재게이트. 교정은 국소, **검증은 전역**.
- **R25 scene 에 의도가 있으면 프롬프트가 스스로 강제한다(scene-aware 방어)**: 수동 힌트에 의존하면 반복 결함이 샌다. `comic-prompt.mjs::sceneClauses(scene)` 가 scene 키워드로 자동 절 주입 — **반투명**(see-through/translucent→불투명 금지), **노화 연속성**(aged/grey→young 금지), **이탈-중복**(floating/through window→단일 인물). 또한 **캐릭터 소품 상시 재명시**(`propLines`): edit 모드에서 anchor(스카프·목발·보조기·쇠사슬)가 프롬프트에 안 실려 소품이 탈락하던 것을 두 모드 모두 강제. NEG_BASE 에 "same character twice/cloned/ghostly double" 추가.

## 자동화 상태
| 규칙 | 자동 강제 | 수단 |
|---|---|---|
| R1–R6, R10(부분) | ✅ | `lint-script.mjs` |
| R3 | ✅ | NEG(`comic-prompt.mjs`) |
| R7,R8 | ✅ | `gen-comfy.mjs` |
| R12 | ✅ | `preflight.mjs`(S0.5) |
| R9,R11,R13 | 🟡 저작 규율(부분 lint) | 저자/Claude 준수 |
| R21 | ✅ | `repair-loop.mjs`(2R+ 자동 noref) |
| R22 | ✅ noref 승격 · 🟡 채택한계 판단 | `repair-loop.mjs` / Claude |
| R24 전수 재게이트 | 🟡 프로세스 규율 | 스테이브별 병렬 Claude vision |
| R25 scene-aware 방어 | ✅ | `sceneClauses`+`propLines`(`comic-prompt.mjs`) |

## 다음 승격 후보 (열려 있음)
- R11 을 lint 로: 스테이지의 각 유령/정령 cast 에 signature 표식 필드 필수화.
- 다중 인물 패널 = 다중 참조(image1/2/3) 지원(현재 단일 참조 → 2인 비트는 R13 로 우회).
- R24 를 코드로: `qc-book.mjs` 를 전 패널 강제(부분 재검증 차단) + 스테이브별 에이전트 팬아웃 오케스트레이션.
