# 도서→만화/웹툰 파이프라인 — 품질 재설계 (RCA + 폐루프 + Claude 검증)

> 배경: A Christmas Carol Stave 1 첫 산출(RunPod 4090, 18패널)이 **형편없이** 나왔다
> (18중 8패널 3~6점: 간판 오타 SCROUGEME·체커보드 무배경·Marley 근육질·빈 말풍선…).
> 본 문서는 **왜 그랬는지(RCA)** 와 **재발을 코드로 막는 폐루프 설계**의 단일 소스다.
> 상태 표기: ✅ 반영됨 · 🟡 부분 · ❌ 미구현(TODO).

---

## 1. 왜 이렇게 처참한가 — 근본 원인 (RCA)

**핵심 한 줄**: 생성 파이프라인이 **열린 회로(open-loop)** 였다. 모델이 굴린 결과를 **아무도 안 보고** 조립했다. `"18 panels, 0 failed"` 의 `0 failed` 는 *크래시 0* 이지 *결함 0* 이 아니었다.

| # | 근본원인 | 증거 | 성격 |
|---|---|---|---|
| **R1** | 검증 게이트가 생성경로 **밖**(휴리스틱·이미지 미검사) | `final-audit`: `images dir not found`, `vision-QC not configured`, story 9.6 추정 | 메타(치명) |
| **R2** | 프롬프트가 결함을 **스스로 요청** | scene에 `sign reading SCROOGE AND MARLEY`(→오타), `red eyes, blue lips`(→컬러), `plain white background`(→체커보드) | 입력 설계 |
| **R3** | Scrooge·Marley가 **시각적으로 안 갈림** + noref 표류 + 다인 패널 참조 1장 | P12/15 정체성 붕괴, P17 noref 근육질, P8 Bob=Fred 복제 | 캐릭터 설계 |
| **R4** | 성공 지표가 학습자와 **어긋남** | `retention band ≥12% verbatim` 이 고어 욱여넣기를 보상 → 인지부하 초과·화자 부재·무주석 | 지표 설계 |

R1이 결함을 **통과**시켰고, R2·R3·R4가 결함을 **생산**했다. 둘 다 고쳐야 한다.

### 1-1. Claude의 역할 오배치 (R2·R3의 뿌리)
Claude는 지금 **author-time 정적 템플릿 작성자**로 앉아 있다. 그런데 특정 확산모델(Qwen)용 프롬프트는 **"한 번 쓰기"가 아니라 "컴파일 + 피드백"** 이다. 우리 메모리엔 이미 "Qwen 결함 6종"이 문서화돼 있었으나 **RunPod 경로가 그 지식을 프롬프트로 적용하지 않았다**. → Claude를 **런타임 per-panel 컴파일러/통합자/검증자**로 옮기는 것이 근본 해결의 알맹이다(§3).

---

## 2. 근본 해결 — 폐루프(closed-loop) 파이프라인

원칙: **본 적 없는 패널은 배포하지 않는다. 모든 패널은 시각 게이트를 통과해야 하고, 불합격은 원인별로 자동 수리한다.**

```
        ┌──────────────────── REPAIR LOOP (≤3) ────────────────────┐
        │                                                          │
[L0 하드닝]→[L1 생성]→[L2 시각 게이트]──pass──►[L4 텍스트층]→[L5 감사]→ SHIP
  scene 정화   gen-comfy   hard-fail 룰        ▲fail          각색·화자      │
  NEG·린트                                     └─원인별 패치→재생성      [L3 교차·독립검증]
```

| 층 | 내용 | 상태 | 위치 |
|---|---|---|---|
| **L0 하드닝** | scene에서 텍스트토큰·색단어 제거, 배경 강제, 캐릭터 차별화; NEG 방어; **scene 린트로 클래스 강제** | 🟡 인스턴스만 (린트 ❌) | `examples/carol-stave1.adapted.json`, `comic-prompt.mjs` NEG |
| **L1 생성** | gen-comfy REST 드라이버, best-of-N | ✅ (best-of-N ❌) | `gen-comfy.mjs` |
| **L2 시각 게이트** | 패널별 hard-fail 루브릭 채점(§3 T1) | 🟡 스캐폴드 | `qc-comfy.mjs` |
| **L3 수리 루프** | 불합격만 원인별 프롬프트 패치 후 재생성, ≤3회 | 🟡 수동(`--panels`) — **자동 오케스트레이션 ❌** | (TODO) `gen-verified.mjs` |
| **L4 텍스트/학습층** | 각색(≤2블록·화자=화면내·아이코닉만 verbatim·gloss·목표어휘) | 🟡 carol만 | `carol-stave1.adapted.json` |
| **L5 수용 감사** | L2 실측결과 소비, 전원 PASS 시 SHIP | ❌ 미연동 | `final-audit-*.md` |

### 2-1. 이미지 결함 → 예방↔포착 대칭 (핵심 설계)
확산모델은 확률적 → 예방만으론 100% 못 막는다. **예방 규칙마다 대칭되는 포착(hard-fail) 규칙**을 둔다.

| 결함 | ① PREVENT | ② CATCH(hard-fail) |
|---|---|---|
| 간판 오타(P2) | 빈 판+HTML 캡션+NEG signboards | `baked_text` |
| 빈 말풍선(P16) | scene "no lettering"+NEG empty balloon | `empty_balloon` |
| 컬러 누출(P3) | 색단어→ink+HARDBW | `colour_leak` |
| 무배경/체커보드(P10) | 배경 강제+NEG checkerboard+noref:false | `no_background` |
| 캐릭터 복제(P8) | 화면 1인 재구성+NEG duplicate | `wrong_or_duplicate_character` |
| Scrooge=Marley(P12/15) | cast distinct_from+Marley 항상 붕대·체인·반투명 | `identity_collapse` |
| 반투명 실패(P15) | scene "see-through" | `text_image_mismatch` |
| Marley 근육질(P17) | scene "gaunt old, never muscular"+noref:false | `wrong_character` |
| 썰매↔손수레(P11) | scene "slides on ice" | `text_image_mismatch` |

---

## 3. Claude 검증 — 3중 (요청하신 핵심)

Claude를 **런타임 3역할**로 앉힌다. 전부 in-loop.

| 역할/계층 | 무엇 | 상태 |
|---|---|---|
| **A 컴파일러** | 중립 의도→Qwen 최적 프롬프트(텍스트strip·색변환·차별화토큰·ref모드·종횡비) | ❌ 정적 1회(수동) |
| **B 통합자** | 캡션↔씬 정합 자가검증, gloss·화자·캡션예산 단위 작성 | ❌ 수동 |
| **T1 인라인 게이트** | 패널마다 이미지 vs 스펙 채점→수리 구동 | 🟡 `qc-comfy.mjs` 스캐폴드 |
| **T2 교차 일관성** | 전 패널 통과 후 Marley 15/17/18 동일?·Scrooge≠Marley? | ❌ |
| **T3 독립 적대감사** | 별도 Claude 에이전트 전수 재검증(self-rubber-stamp 방지) | ❌ (1회 임시만) |

구현: `ANTHROPIC_API_KEY` + `@anthropic-ai/sdk` 있으면 `qc-comfy --sdk` 자동채점, 없으면 Claude(에이전트)가 `qc-manifest.json`→`qc-verdicts.json` 채움. T3는 Claude Code 서브에이전트/워크플로.

---

## 4. 구현 계획 + 목표 지표

| 단계 | 산출 | 상태 |
|---|---|---|
| P1 | L0 하드닝 + carol 각색 스크립트 | 🟡 |
| P2 | `gen-verified.mjs`(강제 폐루프) + **scene 린트** | ❌ |
| P3 | L4 텍스트층 스키마(gloss·화자·target_vocab) 일반화 | 🟡 |
| P4 | T2/T3 + final-audit 실측 연동 + **회귀 픽스처** | ❌ |

**목표 지표(아직 게이트로 인코딩 안 됨 ❌)**: 첫 통과율 55%(10/18) → 폐루프 후 **실질 배포 품질 ≥95%**, `baked_text/no_background/identity_collapse` **hard-fail 0**, 캡션 ≤2/패널, 화면밖 화자 0.

### 4-1. 회귀 픽스처 (재설계가 재난을 막는다는 "증명")
기존 결함 8패널(SCROUGEME·체커보드·Marley근육질·빈말풍선…) + 기대 hard-fail 을 픽스처로 저장 → `qc-comfy` 가 **전부 FAIL 로 잡는지** 자체 검증. ❌ TODO.

---

## 5. 인프라 취약성 (신규 — 설계에 없던 갭)
RunPod Secure Cloud **Stop→Start "GPU 없음"** 으로 생성 전면 중단됨(실측 2026-08). 단일 GPU 의존이 "처참한 결과=배포 불가"를 만든다.
- 폴백: `pod.mjs` 에 start 실패→**다른 호스트 새 pod 생성**, 또는 **Kaggle 무료 T4 경로**(메모리 레시피)로 백엔드 스위치. ❌ TODO.

---

## 6. 반영 상태 요약 (traceability)
- ✅ 커밋됨: 각색 스크립트(`carol-stave1.adapted.json`), NEG 방어(`comic-prompt.mjs`), QC 게이트 스캐폴드(`qc-comfy.mjs`), pod 제어(`runpod/pod.mjs`), 본 설계서.
- ❌ 미구현(다음): `gen-verified.mjs`(강제 폐루프·L3 자동수리), scene 린트, T2/T3 검증, 회귀 픽스처, 목표지표 게이트, 인프라 폴백, **GPU 확보 후 Before/After 실증**.

> 결론: **이미지 품질 해결의 "예방↔포착 설계"는 반영**됐으나, 그것을 **강제·증명·자동화**하는 층(gen-verified·린트·픽스처·3중검증)은 아직 미구현이다. 본 문서가 그 전체를 못박은 단일 소스다.
