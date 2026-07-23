-- eye-dialect·고어 정규화 맵 — 규칙화 불가한 불규칙 방언을 표준 표제어로 큐레이션.
-- variant(방언 표면형) → standard(표준 lemma). lookup_word_meaning dialect tier가 소비.
-- 근거: 200권 평가 체계적 잔여 ~85%가 방언(-in 규칙 외 불규칙분).
create table if not exists dialect_map (
  variant text primary key,
  standard text not null,
  note text
);
insert into dialect_map (variant, standard, note) values
  ('gwine','go','going (방언)'),('agin','again','again (방언)'),('twas','be','it was (고어)'),
  ('twere','be','it were (고어)'),('twould','would','it would (고어)'),('tis','be','it is (고어)'),
  ('dunno','know','don''t know (방언)'),('yaller','yellow','yellow (방언)'),('brung','bring','brought (방언)'),
  ('heerd','hear','heard (방언)'),('drownded','drown','drowned (방언)'),('swaller','swallow','swallow (방언)'),
  ('tobacker','tobacco','tobacco (방언)'),('furder','further','further (방언)'),('widder','widow','widow (방언)'),
  ('natur','nature','nature (방언)'),('dooty','duty','duty (방언)'),('argyment','argument','argument (방언)'),
  ('critter','creature','creature (방언)'),('cretur','creature','creature (방언)'),('feller','fellow','fellow (방언)'),
  ('haid','head','head (방언)'),('sence','since','since (방언)'),('mebbe','maybe','maybe (방언)'),
  ('plentee','plenty','plenty (방언)'),('moch','much','much (방언)'),('feex','fix','fix (방언)'),
  ('nevaire','never','never (방언)'),('allus','always','always (방언)'),('lemme','let','let me (방언)'),
  ('gimme','give','give me (방언)'),('meself','myself','myself (방언)'),('theirselves','themselves','themselves (방언)'),
  ('hisself','himself','himself (방언)'),('thar','there','there (방언)'),('whar','where','where (방언)'),
  ('jest','just','just (방언)'),('jes','just','just (방언)'),('ef','if','if (방언)'),('wid','with','with (방언)'),
  ('ole','old','old (방언)'),('chile','child','child (방언)'),('outa','out','out of (방언)'),('fust','first','first (방언)'),
  ('wust','worst','worst (방언)'),('pizen','poison','poison (방언)'),('varmint','vermin','vermin (방언)'),
  ('methought','think','I thought (고어)'),('couldst','could','could (고어)'),('wouldst','would','would (고어)'),
  ('shouldst','should','should (고어)'),('didst','do','did (고어)'),('hast','have','have (고어)'),('hath','have','has (고어)'),
  ('doth','do','does (고어)'),('dost','do','do (고어)'),('spake','speak','spoke (고어)'),('clomb','climb','climbed (방언)'),
  ('holp','help','helped (고어)'),('gainsaid','gainsay','gainsaid (부정하다)'),('ye','you','you (고어)'),
  ('thee','you','you (고어)'),('thou','you','you (고어)'),('thy','your','your (고어)'),('thine','your','your (고어)'),
  ('prithee','pray','pray (고어)'),('yourn','your','yours (방언)'),('hisn','his','his (방언)'),
  ('sartin','certain','certain (방언)'),('ketch','catch','catch (방언)'),('reckon','reckon',null),
  ('kinder','kind','kind of (방언)'),('sorter','sort','sort of (방언)'),('useter','use','used to (방언)')
on conflict (variant) do update set standard=excluded.standard, note=excluded.note;
