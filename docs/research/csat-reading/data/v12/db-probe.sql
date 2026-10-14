-- docs/research/csat-reading/data/v12/db-probe.sql
-- Read-only aggregate reproduced 2026-10-14: csat_items,802,774,24.
-- No passage, choice, answer, URL or credential output; source snapshot is still pinned separately.
select to_regclass('public.csat_items')::text as relation,
 count(*) filter(where id ~ '^(201[4-9]|202[0-7])[AB]?#'
   or id ~ '^M(1[4-9]|2[0-7])(06|09)[AB]?#') as stored_reading_ids,
 count(*) filter(where id ~ '^(201[4-9]|202[0-6])[AB]?#'
   or id ~ '^M(1[4-9]|2[0-6])(06|09)[AB]?#') as core_2014_2026,
 count(*) filter(where id=any(array[
 '2014A#36','2024#21','2016#30','2021#42','2018#19','2020#20',
 '2019#44','2023#41','2021#40','2014B#45','2018#43','2019#25',
 '2023#29','2015#30','2017#21','2014A#39','2024#34','2014B#34',
 '2018#36','2023#39','2019#23','2021#26','2016#29','2015#24'
 ])) as restoration_rows
from public.csat_items;
