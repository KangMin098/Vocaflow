-- supabase/migrations/20261023100000_csat_item_response_stats.sql
--
-- **문항 응답 통계 원장 — 출처별 전 문항 정답률 · 선지별 선택비율.** (가산: 새 테이블만, 기존 테이블·열 불변)
-- 배경: csat_map_item_rate 는 EBSi 오답률 TOP15 뿐이고(시험당 15문항, 평가원 30회), PK 가 (exam_id, no) 라 출처를 더 담을 수 없다.
--       메가스터디 「정답률」은 수능·모평·학평(고1~3) 전 문항의 정답률 · 선지 1~5 선택비율 · 난이도 · 배점을 준다.
--       둘 다 사설 응답자 집계라 csat_items.official_error_rate(공식값)에는 넣지 않고 출처별 원장으로 둔다.
--   source_id              출처(지금은 'megastudy'). 같은 문항을 여러 출처가 관측할 수 있다 — PK 에 포함
--   correct_rate           정답률 0~1 (오답률 = 1 - correct_rate)
--   choice_rates           선지 1~5 선택비율(길이 5, 원본 반올림 그대로 — 재정규화 안 함)
--   unreported_choice_rate 선택비율 합이 100% 에 모자란 만큼(무응답·반올림)
--   difficulty             출처의 난이도 표기(하·중하·중·중상·상) — 닫힌 값이 아니라 출처 문자열 보존
--   points · answer        출처가 준 배점 · 정답(적재 때 DB 정답 키와 대조해 일치한 회차만 넣는다)
--   paper_form             odd · even · NULL(유형 구분 없음) — DB 수능 일부는 짝수형 키로 들어 있어 어느 쪽과 맞았는지 남긴다
--   verified               false = DB 에 대조할 문항이 없어 날짜로만 대응한 회차
--   source_exam_ref        출처 쪽 시험 식별자(메가스터디 examSeq)
-- 듣기 1~17 처럼 csat_items 에 없는 문항도 담는다 — 외래키는 회차(csat_exams)까지만.
-- 읽기: authenticated SELECT(csat_map_item_rate 와 같음) · 쓰기: service_role 만(정책 없음 = 클라이언트 쓰기 차단).
--
-- 되돌리기: DROP TABLE public.csat_item_response_stats;

CREATE TABLE public.csat_item_response_stats (
  exam_id                text        NOT NULL REFERENCES public.csat_exams (id),
  no                     smallint    NOT NULL CHECK (no BETWEEN 1 AND 45),
  source_id              text        NOT NULL CHECK (source_id IN ('megastudy')),
  correct_rate           numeric     NOT NULL CHECK (correct_rate BETWEEN 0 AND 1),
  choice_rates           numeric[]   NOT NULL CHECK (array_length(choice_rates, 1) = 5),
  unreported_choice_rate numeric     CHECK (unreported_choice_rate BETWEEN 0 AND 1),
  difficulty             text,
  points                 smallint    CHECK (points BETWEEN 1 AND 4),
  answer                 smallint    CHECK (answer BETWEEN 1 AND 5),
  paper_form             text        CHECK (paper_form IN ('odd', 'even')),
  verified               boolean     NOT NULL DEFAULT true,
  source_exam_ref        text,
  retrieved_at           date        NOT NULL,
  PRIMARY KEY (exam_id, no, source_id)
);

COMMENT ON TABLE public.csat_item_response_stats IS
  '출처별 문항 응답 통계(사설 응답자 집계 · 공식값 아님). 오답률 = 1 - correct_rate. 적재: scripts/csat/rates/import-megastudy.mjs';

ALTER TABLE public.csat_item_response_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY csat_item_response_stats_read ON public.csat_item_response_stats FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.csat_item_response_stats FROM anon, authenticated;
GRANT SELECT ON public.csat_item_response_stats TO authenticated;
