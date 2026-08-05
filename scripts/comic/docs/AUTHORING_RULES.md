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

## 자동화 상태
| 규칙 | 자동 강제 | 수단 |
|---|---|---|
| R1–R6, R10(부분) | ✅ | `lint-script.mjs` |
| R3 | ✅ | NEG(`comic-prompt.mjs`) |
| R7,R8 | ✅ | `gen-comfy.mjs` |
| R12 | ✅ | `preflight.mjs`(S0.5) |
| R9,R11,R13 | 🟡 저작 규율(부분 lint) | 저자/Claude 준수 |

## 다음 승격 후보 (열려 있음)
- R11 을 lint 로: 스테이지의 각 유령/정령 cast 에 signature 표식 필드 필수화.
- 다중 인물 패널 = 다중 참조(image1/2/3) 지원(현재 단일 참조 → 2인 비트는 R13 로 우회).
