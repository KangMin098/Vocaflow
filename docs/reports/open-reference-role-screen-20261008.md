# Open-reference role screen (2026-10-08)

This run applies the structural/calibration role split to four existing source candidates. It does not modify NASA's admission or any sealed selection, screening, manifest, rights, or calibration decision. Input and metadata-only output remain outside Git under `C:\Users\Administrator\Documents\영어\공개참조\open-reference-screen-20261008`:

- `role-screen-r1.input.json`: SHA-256 `5bf2857979158ca0fbb8c800e7300e965f28d1e81c1287647b0293ed239761cc`
- `role-screen-r1.out.json`: SHA-256 `2bd8ee70fd9af6926e43e0f3fe77a0823c8b0830147b598f9c915888617a4a99`; decision `screen_hash=fac7020a8a86e176ffbbd0d4d5c08abd9c0b6da84c15e570e7950ccbcc420d83`

The runner rereads each source snapshot and rights-evidence file and checks the exact bytes before recording a role. `authorized_internal_analysis` is a local operator decision about the captured text only. It does not certify publisher permission, permit republication, clear unexamined images, or map a reading level to a Korean grade.

| Source | Structural role | Calibration role | Evidence boundary |
| --- | --- | --- | --- |
| [NASA quadcopter reader](https://www.nasa.gov/stem-content/the-science-behind-quadcopters/) | `hold` | `hold` | Existing passage-level employee authorship/third-party rights hold; existing admission N=1 remains separate. |
| [FYM, *What Does It Mean to Choose Rationally?*](https://kids.frontiersin.org/articles/10.3389/frym.2019.00162) | `eligible` for internal passage-structure analysis | `hold` | The specific article page states CC BY; individual target age, source item set, Korean mapping, and independent admission/rating are not established. |
| [African Storybook, *Kgothatso Montjane, Tennis Queen*](https://www.africanstorybook.org/newviewer/index.php?bt=5&dual=false&id=452401) | `eligible` for internal level/format analysis | `hold` | The specific viewer states Attribution CC BY; its reader level is not a school grade. A scoring key and Korean mapping are unverified. The downloaded HTML is the analyzed object; linked illustrations are not included. |
| [EIA, *Petroleum Scavenger Hunt*](https://www.eia.gov/kids/for-teachers/lesson-plans/pdfs/lesson_petro_scavhunt.pdf) | `hold` | `hold` | General [EIA reuse guidance](https://www.eia.gov/about/copyrights_reuse.php) has a third-party caveat; the referenced passage version is not bound to the questions. |

Result: four screened, **structural reference corpus N=2** (metadata only), calibration-eligible N=0, Korean-grade distribution N=0. FYM and African Storybook may inform structure characterization under their recorded CC BY attribution. Their source text, illustrations, or derived measurements were not imported into Git or the benchmark distribution. No new nine-axis rating, benchmark admission, Gold-S, or DB seed occurred. Reuse of this role result requires rechecking current file hashes; changed evidence needs a new immutable screen revision.
