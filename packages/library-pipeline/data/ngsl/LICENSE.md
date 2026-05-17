# NGSL Data Attribution

This directory contains data from the **New General Service List (NGSL)** project.

## Citation

> Browne, C., Culligan, B., and Phillips, J. (2013). The New General Service List.
> https://www.newgeneralservicelist.com

## License

CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/

## Files

- `NGSL_1.2_stats.csv` — Core 2,809 headwords with rank and SFI
- `NGSL_1.2_lemmatized_for_research.csv` — Lemma family mapping
- `NGSL+with+SFI+(31K).xlsx` — Extended 31K word list with rank and SFI
- `TSL_1.2_*.csv` — TOEIC Service List (Browne & Culligan 2016)
- `NAWL_1.2_*.csv` — New Academic Word List (Browne, Culligan & Phillips 2013)
- `NDL_1.1_*.csv` — New Dolch List (Phillips, Browne & Culligan 2017)
- `BSL_1.20_*.csv` — Business Service List (Browne & Culligan 2013)
- `NGSL-Spoken_1.2_*.csv` — NGSL-Spoken (Browne, Culligan & Phillips 2013)
- `NGSL-GR_rank.csv` — NGSL Graded Reader rank
- `FEL_1.2_*.csv` / `BEL_1.0_*.csv` — Fitness / Bible (Tier 3, optional)

All NGSL-Project lists are © Browne / Culligan / Phillips, CC BY-SA 4.0.

## Usage in Vocaflow

NGSL frequency data is imported into `shared_dictionary.frequency_rank` and
`shared_dictionary.ngsl_sfi` to compute the global frequency signal of the
Learning Value (LV) score in the Library Content Pipeline (LCP v2.0).
The list itself is not redistributed.
