-- supabase/migrations/20260926120000_spelling_canonical.sql
--
-- **영/미 철자 중복을 표제어 차원에서 통합한다** — 구조 · 데이터 · 동작을 한 번에 켠다(#105).
-- 설계 원안: `_pending_spelling_canonical.sql`(이 파일이 대체한다).
--
-- ── 문제 ────────────────────────────────────────────────────────────
-- `resolve_dict_headword` 의 L5 는 영/미 철자를 양방향으로 해석하지만 **L1(정확 일치)이 먼저다.**
-- 두 철자가 모두 표제어면 각자 L1 에서 자기 자신에 걸린다(colour → colour · color → color).
-- 그래서 학습자는 같은 낱말을 두 항목으로 만나고, 난이도까지 갈린다(neighbor V2 / neighbour V1).
--
-- ── 결정 (사용자 승인 2026-09-26) ───────────────────────────────────
-- 정본 = **미국식**(국내 영어 교육 표준). 영국식 행은 지우지 않는다 — 발행 세트가 참조한다
-- (labour 5개 세트). 행은 남기고 `variant_of` 로 정본만 표시하고, 해석기가 정본으로 모은다.
--
-- ── 짝 187 (2026-09-26 실측) ────────────────────────────────────────
-- 규칙(-ise/-isation/-yse · -our · -tre · -logue · -ence · -ll-)으로 뽑은 뒤 뜻을 눈으로 대조했다.
-- **뺀 17** — 철자 변이가 아니라 다른 낱말이거나, 미국에서도 영국식이 표준이다:
--   다른 낱말: prise/prize · seise/seize · dour/dor · four/for · tour/tor · tenour/tenor(음악)
--              entre/enter · lettre/letter · outre/outer · mitre/miter(주교관 ≠ 연귀)
--              analogue/analog(사전 뜻이 갈렸다)
--   미국도 영국식이 표준: merchandise · exorcise · dialogue · epilogue · monologue · prologue
--
-- ── 동작 변화 ───────────────────────────────────────────────────────
-- 본체 5계층(L1~L5)은 **한 글자도 바꾸지 않았다.** 결과를 한 번 감싸 `variant_of` 가 있으면
-- 정본을 돌려준다 — 그래서 L1 만이 아니라 굴절형(colours → colour → color)도 정본으로 모인다.
-- 되돌리기: 이 파일 끝의 「되돌리기」 절.

-- ── 1) 정본 표시 ────────────────────────────────────────────────────
ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS variant_of text;

COMMENT ON COLUMN public.shared_dictionary.variant_of IS
  '이 표제어가 다른 표제어의 철자 변이일 때 그 정본(예: colour.variant_of = ''color''). '
  'NULL 이면 자신이 정본이다. resolve_dict_headword 가 결과를 이 값으로 모은다. '
  '행을 지우지 않는 이유: 기존 발행 세트가 변이 표제어를 참조하고 있다(labour 5개 세트).';

ALTER TABLE public.shared_dictionary
  DROP CONSTRAINT IF EXISTS shared_dictionary_variant_not_self;
ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_variant_not_self
  CHECK (variant_of IS NULL OR variant_of <> word);

CREATE INDEX IF NOT EXISTS idx_shared_dictionary_variant_of
  ON public.shared_dictionary (variant_of) WHERE variant_of IS NOT NULL;

-- ── 2) 백필 — 명시 목록만 (규칙으로 다시 뽑지 않는다: 오탐 17을 눈으로 뺐다) ──
WITH pairs(uk, us) AS (VALUES
  ('acclimatise','acclimatize'), ('agonised','agonized'), ('amphitheatre','amphitheater'), ('anaesthetise','anaesthetize'), ('analyse','analyze'), ('antagonise','antagonize'), ('anthropomorphise','anthropomorphize'), ('apologise','apologize'), ('arbour','arbor'), ('ardour','ardor'), ('armour','armor'), ('authorisation','authorization'), ('authorise','authorize'), ('baptise','baptize'), ('behaviour','behavior'), ('bejewelled','bejeweled'), ('belabour','belabor'), ('candour','candor'), ('canonise','canonize'), ('capitalise','capitalize'), ('catalogue','catalog'), ('categorisation','categorization'), ('categorise','categorize'), ('centralisation','centralization'), ('centre','center'), ('characterisation','characterization'), ('characterise','characterize'), ('civilisation','civilization'), ('civilise','civilize'), ('clamour','clamor'), ('clangour','clangor'), ('colonisation','colonization'), ('colour','color'), ('coloured','colored'), ('colourful','colorful'), ('colouring','coloring'), ('colourless','colorless'), ('commercialisation','commercialization'), ('councillor','councilor'), ('counsellor','counselor'), ('criticise','criticize'), ('decentralisation','decentralization'), ('decolonise','decolonize'), ('defence','defense'), ('dehumanise','dehumanize'), ('demeanour','demeanor'), ('democratisation','democratization'), ('demoralise','demoralize'), ('destabilise','destabilize'), ('dioptre','diopter'), ('discolour','discolor'), ('disfavour','disfavor'), ('dishevelled','disheveled'), ('dishonour','dishonor'), ('dishonourable','dishonorable'), ('emphasise','emphasize'), ('enamoured','enamored'), ('endeavour','endeavor'), ('epicentre','epicenter'), ('equalise','equalize'), ('familiarise','familiarize'), ('favour','favor'), ('favourable','favorable'), ('favourite','favorite'), ('fertilisation','fertilization'), ('fervour','fervor'), ('flavour','flavor'), ('generalisation','generalization'), ('generalise','generalize'), ('glamour','glamor'), ('harbour','harbor'), ('harmonisation','harmonization'), ('harmonise','harmonize'), ('honour','honor'), ('honourable','honorable'), ('humour','humor'), ('hybridisation','hybridization'), ('hypnotise','hypnotize'), ('industrialisation','industrialization'), ('internationalisation','internationalization'), ('jeopardise','jeopardize'), ('jeweller','jeweler'), ('kilometre','kilometer'), ('labour','labor'), ('laboured','labored'), ('labouring','laboring'), ('legitimise','legitimize'), ('liberalisation','liberalization'), ('licence','license'), ('litre','liter'), ('localisation','localization'), ('lustre','luster'), ('materialise','materialize'), ('maximisation','maximization'), ('maximise','maximize'), ('mechanisation','mechanization'), ('memorise','memorize'), ('metre','meter'), ('millimetre','millimeter'), ('minimise','minimize'), ('misdemeanour','misdemeanor'), ('mobilisation','mobilization'), ('mobilise','mobilize'), ('modernisation','modernization'), ('modernise','modernize'), ('monetise','monetize'), ('multicoloured','multicolored'), ('nationalisation','nationalization'), ('naturalise','naturalize'), ('neighbour','neighbor'), ('neutralise','neutralize'), ('normalisation','normalization'), ('odour','odor'), ('of colour','of color'), ('offence','offense'), ('optimisation','optimization'), ('organisation','organization'), ('organise','organize'), ('paralyse','paralyze'), ('parlour','parlor'), ('pasteurise','pasteurize'), ('patronise','patronize'), ('pedestrianisation','pedestrianization'), ('penalise','penalize'), ('polarisation','polarization'), ('pretence','pretense'), ('prioritisation','prioritization'), ('privatisation','privatization'), ('privatise','privatize'), ('publicise','publicize'), ('pulverise','pulverize'), ('rancour','rancor'), ('rationalisation','rationalization'), ('rationalise','rationalize'), ('realisation','realization'), ('realise','realize'), ('recognise','recognize'), ('reorganisation','reorganization'), ('reorganise','reorganize'), ('revolutionise','revolutionize'), ('rigour','rigor'), ('rumour','rumor'), ('saltpetre','saltpeter'), ('saviour','savior'), ('savour','savor'), ('sceptre','scepter'), ('scrutinise','scrutinize'), ('socialisation','socialization'), ('socialise','socialize'), ('specialisation','specialization'), ('specialise','specialize'), ('splendour','splendor'), ('squalour','squalor'), ('stabilisation','stabilization'), ('stabilise','stabilize'), ('standardisation','standardization'), ('standardise','standardize'), ('stigmatise','stigmatize'), ('subsidise','subsidize'), ('succour','succor'), ('summarise','summarize'), ('symbolise','symbolize'), ('sympathise','sympathize'), ('synchronise','synchronize'), ('synthesise','synthesize'), ('tantalise','tantalize'), ('temporise','temporize'), ('tenderise','tenderize'), ('theatre','theater'), ('theorise','theorize'), ('titre','titer'), ('traumatise','traumatize'), ('traveller','traveler'), ('tumour','tumor'), ('tyrannise','tyrannize'), ('unfavourable','unfavorable'), ('urbanisation','urbanization'), ('utilisation','utilization'), ('utilise','utilize'), ('valour','valor'), ('vapour','vapor'), ('victimisation','victimization'), ('vigour','vigor'), ('visualisation','visualization'), ('visualise','visualize'), ('vocalise','vocalize'), ('watercolour','watercolor')
)
UPDATE public.shared_dictionary d
   SET variant_of = p.us
  FROM pairs p
 WHERE d.word = p.uk
   AND d.variant_of IS DISTINCT FROM p.us
   -- 정본이 실재하고 그 자신은 변이가 아닐 때만(사슬 금지)
   AND EXISTS (SELECT 1 FROM public.shared_dictionary s WHERE s.word = p.us AND s.variant_of IS NULL);

-- ── 3) 해석기 — 결과를 정본으로 모은다 ─────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_dict_headword(p_surface text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH q AS (SELECT lower(trim(p_surface)) AS s),
  r AS (
  SELECT COALESCE(
    -- L1 정확 일치
    (SELECT d.word FROM shared_dictionary d, q WHERE d.word=q.s
       AND d.classified_by IS NOT NULL AND NOT d.archived AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0 LIMIT 1),
    -- L2 사전 등재 굴절형
    (SELECT d.word FROM shared_dictionary d, q WHERE d.inflected_forms @> ARRAY[q.s]
       AND d.classified_by IS NOT NULL AND NOT d.archived AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1),
    -- L3 규칙 기반 굴절 역생성
    (SELECT d.word FROM q, unnest(en_inflection_bases(q.s)) c(c) JOIN shared_dictionary d ON d.word=c.c
       WHERE d.classified_by IS NOT NULL AND NOT d.archived AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1),
    -- L4 파생 접미사 — 뜻을 뒤집지 않는 것만 ('less'/'iless' 는 극성 반전이라 제외)
    (SELECT d.word FROM q, unnest(array_remove(ARRAY[
        CASE WHEN q.s ~ 'ically$' THEN regexp_replace(q.s,'ically$','ic') END,
        CASE WHEN q.s ~ 'ily$'   THEN regexp_replace(q.s,'ily$','y') END,
        CASE WHEN q.s ~ 'ly$'    THEN regexp_replace(q.s,'ly$','') END,
        CASE WHEN q.s ~ 'iness$' THEN regexp_replace(q.s,'iness$','y') END,
        CASE WHEN q.s ~ 'ness$'  THEN regexp_replace(q.s,'ness$','') END,
        CASE WHEN q.s ~ 'fully$' THEN regexp_replace(q.s,'fully$','') END,
        CASE WHEN q.s ~ 'ful$'   THEN regexp_replace(q.s,'ful$','') END,
        CASE WHEN q.s ~ 'ish$'   THEN regexp_replace(q.s,'ish$','') END,
        CASE WHEN q.s ~ 'like$'  THEN regexp_replace(q.s,'like$','') END,
        CASE WHEN q.s ~ 'wise$'  THEN regexp_replace(q.s,'wise$','') END
      ], NULL)) c(cand) JOIN shared_dictionary d ON d.word=c.cand
       WHERE length(c.cand)>=4 AND d.classified_by IS NOT NULL AND NOT d.archived AND d.meaning_ko IS NOT NULL
         AND length(d.meaning_ko)>0 AND d.meaning_ko <> 'foreign_word_proxy'
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1),
    -- L5 영/미 철자 변이 — **양방향**. 의미 위험 0.
    (SELECT d.word
       FROM q,
            LATERAL (SELECT unnest(array_append(en_inflection_bases(q.s), q.s)) AS base) bb,
            LATERAL (SELECT unnest(array_remove(ARRAY[
              CASE WHEN bb.base ~ 'izations$' THEN regexp_replace(bb.base,'izations$','isations') END,
              CASE WHEN bb.base ~ 'ization$'  THEN regexp_replace(bb.base,'ization$','isation')   END,
              CASE WHEN bb.base ~ 'izing$'    THEN regexp_replace(bb.base,'izing$','ising')       END,
              CASE WHEN bb.base ~ 'ized$'     THEN regexp_replace(bb.base,'ized$','ised')         END,
              CASE WHEN bb.base ~ 'izes$'     THEN regexp_replace(bb.base,'izes$','ises')         END,
              CASE WHEN bb.base ~ 'ize$'      THEN regexp_replace(bb.base,'ize$','ise')           END,
              CASE WHEN bb.base ~ 'yzing$'    THEN regexp_replace(bb.base,'yzing$','ysing')       END,
              CASE WHEN bb.base ~ 'yzed$'     THEN regexp_replace(bb.base,'yzed$','ysed')         END,
              CASE WHEN bb.base ~ 'yzes$'     THEN regexp_replace(bb.base,'yzes$','yses')         END,
              CASE WHEN bb.base ~ 'yze$'      THEN regexp_replace(bb.base,'yze$','yse')           END,
              CASE WHEN bb.base ~ 'ors$'      THEN regexp_replace(bb.base,'ors$','ours')          END,
              CASE WHEN bb.base ~ 'or$'       THEN regexp_replace(bb.base,'or$','our')            END,
              CASE WHEN bb.base ~ 'logs$'     THEN regexp_replace(bb.base,'logs$','logues')       END,
              CASE WHEN bb.base ~ 'log$'      THEN regexp_replace(bb.base,'log$','logue')         END,
              CASE WHEN bb.base ~ 'ense$'     THEN regexp_replace(bb.base,'ense$','ence')         END,
              CASE WHEN bb.base ~ 'ters$'     THEN regexp_replace(bb.base,'ters$','tres')         END,
              CASE WHEN bb.base ~ 'ter$'      THEN regexp_replace(bb.base,'ter$','tre')           END,
              CASE WHEN bb.base ~ 'isations$' THEN regexp_replace(bb.base,'isations$','izations') END,
              CASE WHEN bb.base ~ 'isation$'  THEN regexp_replace(bb.base,'isation$','ization')   END,
              CASE WHEN bb.base ~ 'ising$'    THEN regexp_replace(bb.base,'ising$','izing')       END,
              CASE WHEN bb.base ~ 'ised$'     THEN regexp_replace(bb.base,'ised$','ized')         END,
              CASE WHEN bb.base ~ 'ises$'     THEN regexp_replace(bb.base,'ises$','izes')         END,
              CASE WHEN bb.base ~ 'ise$'      THEN regexp_replace(bb.base,'ise$','ize')           END,
              CASE WHEN bb.base ~ 'ysing$'    THEN regexp_replace(bb.base,'ysing$','yzing')       END,
              CASE WHEN bb.base ~ 'ysed$'     THEN regexp_replace(bb.base,'ysed$','yzed')         END,
              CASE WHEN bb.base ~ 'yse$'      THEN regexp_replace(bb.base,'yse$','yze')           END,
              CASE WHEN bb.base ~ 'ours$'     THEN regexp_replace(bb.base,'ours$','ors')          END,
              CASE WHEN bb.base ~ 'our$'      THEN regexp_replace(bb.base,'our$','or')            END,
              CASE WHEN bb.base ~ 'logues$'   THEN regexp_replace(bb.base,'logues$','logs')       END,
              CASE WHEN bb.base ~ 'logue$'    THEN regexp_replace(bb.base,'logue$','log')         END,
              CASE WHEN bb.base ~ 'ence$'     THEN regexp_replace(bb.base,'ence$','ense')         END,
              CASE WHEN bb.base ~ 'tres$'     THEN regexp_replace(bb.base,'tres$','ters')         END,
              CASE WHEN bb.base ~ 'tre$'      THEN regexp_replace(bb.base,'tre$','ter')           END
            ], NULL)) AS cand) cc
       JOIN shared_dictionary d ON d.word = cc.cand
      WHERE length(cc.cand) >= 4 AND d.classified_by IS NOT NULL AND NOT d.archived
        AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0
        AND d.meaning_ko <> 'foreign_word_proxy'
      ORDER BY d.frequency_rank NULLS LAST LIMIT 1)
  ) AS w)
  -- 정본 모으기: 결과가 변이 표제어면 정본으로(사슬은 백필이 막는다 — 한 단계면 충분)
  SELECT COALESCE(v.variant_of, r.w)
    FROM r LEFT JOIN shared_dictionary v ON v.word = r.w
$function$;

-- ── 되돌리기 ────────────────────────────────────────────────────────
-- 동작만 끄기: UPDATE public.shared_dictionary SET variant_of = NULL WHERE variant_of IS NOT NULL;
--   (함수는 variant_of 가 전부 NULL 이면 이전과 같은 값을 돌려준다)
-- 전부: 위 UPDATE 뒤 함수 본문을 20260926 이전 정의로 되돌리고
--   ALTER TABLE public.shared_dictionary DROP COLUMN variant_of;
