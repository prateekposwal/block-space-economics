# Author Identity & ORCID — Recommendation (Pre-Submission)

**For:** arXiv submission of working-paper v2.2.0 (SCCR storage paper, Paper 1 of
the **Bitcoin Resource Accounting** program)
**Status:** **RECOMMENDED (Prateek's choice recorded 2026-08-02)** — author
identity and arXiv real-identity are RESOLVED by Prateek's directive; ORCID is an
ACTION (create before submission). See DECISIONS NEEDED below.
**Date:** 2026-08-02 (updated 2026-08-02 with Prateek's decision)

---

## 1. Author identity — the three options

| Option | Author line | Standard? | Notes |
|---|---|---|---|
| **A. Independent researcher (RECOMMENDED)** | **Prateek Poswal**, Independent Researcher | ✅ Standard for solo research projects | Clean, honest, no affiliation to maintain. arXiv allows "Independent Researcher" or no affiliation at all. Matches the reality: this is a solo research effort. |
| B. Bitcoin Sahi Research | Prateek Poswal, Bitcoin Sahi Research | Acceptable | Reads like a lab/company; on arXiv most such affiliations are universities. "Bitcoin Sahi Research" is not a legal entity with a stable identity record — could raise "who is this?" friction with moderators. |
| C. Bitcoin Sahi Research Council | Prateek Poswal, Bitcoin Sahi Research Council | Not recommended for the arXiv byline | The Council is the repo's internal research body (the paper's own footer names it). Using it as an arXiv affiliation conflates the internal authoring process with an external identity. Keep it as a *research program* mention in the acknowledgements, not the byline. |

**Recommendation: Option A** — `Prateek Poswal, Independent Researcher`.
Solo research projects submit this way routinely; it is the least friction and
the most honest. The Council can be acknowledged in the paper body ("Prepared
within the Bitcoin Sahi Research Council program") without being the byline.

**Consistency rule:** whatever is chosen must be identical in (a) arXiv byline,
(b) working-paper.md header, (c) working-paper.html header, (d) README © line
(already "Prateek Poswal"), (e) publication-plan.md, (f) the LaTeX source.
Currently the paper header says "Bitcoin Sahi Research Council · 2026-08-02" —
under Option A this becomes "Prateek Poswal · Independent Researcher · 2026-08-02"
(or a footer line "Prepared within the Bitcoin Sahi Research Council program").

## 2. Why ORCID matters

- **Identity disambiguation** — ORCID is the researcher identifier used by
  arXiv, journals, Crossref, and databases. "Prateek Poswal" is not unique;
  ORCID makes *this* author unambiguous.
- **arXiv requires or strongly recommends it** — a submitter profile with an
  ORCID iD is the norm; some categories flag submissions without one.
- **Auto-linking** — arXiv links your ORCID to the preprint; the DOI registration
  (if the paper later gets a journal DOI) ties back to the same profile.
- **Future papers** — the roadmap's Paper 2/3/4 (UTXO, validation, framework)
  will accumulate on one profile, building citation credit.

## 3. ORCID signup — exact steps (5 minutes)

1. Go to **https://orcid.org/register**.
2. Create an account (email + password) — personal email recommended (not a
   work email that could vanish).
3. Verify the email via the confirmation link.
4. In the profile, add **name**: Prateek Poswal. (Optionally add country and
   keywords — not required for arXiv.)
5. Optional but recommended: link **Google Scholar** and/or **Scopus** (Profile →
   "Works" → "Link works"). This is where future citations aggregate.
6. Note the 16-digit iD (format `0000-0001-XXXX-XXXX`). Add it to
   `research/publication-plan.md` §2 and the LaTeX source (`\author` block) once
   you have it.
7. When submitting to arXiv, enter the ORCID iD in the author profile field.

## 4. Where the identity must be applied (once decided)

- [x] **ORCID RESOLVED (2026-08-04):** `https://orcid.org/0009-0005-2139-1877`
  (16-digit iD `0009-0005-2139-1877`) — Prateek created the ORCID; the iD is now
  wired into publication-plan.md §2, working-paper.tex \author block, and this
  file. Use this iD at arXiv upload.

- [x] `research/working-paper.tex` (`\author` block) — already
  `Prateek Poswal / Independent Researcher (Bitcoin Sahi Research)` — matches
  Prateek's directive
- [ ] `research/working-paper.md` header line (title block) — program-name
  context added in the companion `future-directions-v3.md` §2 addendum; full byline application LEFT until ORCID lands
- [ ] `research/working-paper.html` (regenerate via `tools/generate_research_pages.py`)
- [ ] `research/publication-plan.md` §2 (author list item)
- [ ] README.md © line (already correct: Prateek Poswal)
- [ ] arXiv submission account (new account: real identity, per Prateek)

---

## DECISIONS NEEDED (Prateek) — status per Prateek's 2026-08-02 directive

- **D1 — Author identity:** ✅ **RESOLVED (RECOMMENDED)** — Prateek directed:
  **Prateek Poswal (Independent Researcher, Bitcoin Sahi Research)** — the
  program name "Bitcoin Sahi Research" is carried as program context, with
  "Independent Researcher" as the arXiv-standard byline. The byline is
  `Prateek Poswal, Independent Researcher`; "Bitcoin Sahi Research" appears as
  the program line/acknowledgement (matching the LaTeX uthor block already in
  `research/working-paper.tex`). Apply across (a) arXiv byline, (b)
  working-paper.md header, (c) working-paper.html, (d) README © line, (e)
  publication-plan.md, (f) LaTeX source. DONE in .tex; .md header update is
  LEFT (paper title block keeps "Bitcoin Sahi Research Council" as program
  footer per the paper's own convention).
- **D2 — ORCID:** ✅ **RESOLVED (2026-08-04)** — iD `0009-0005-2139-1877`
  (https://orcid.org/0009-0005-2139-1877). Wired into publication-plan.md §2 +
  LaTeX \author block. Enter this iD at arXiv upload.
- **D3 — arXiv account:** ✅ **RESOLVED (RECOMMENDED)** — Prateek directed:
  **use his real identity** (no pseudonym). Create the submitter account at
  https://arxiv.org/user with the real name + email. Note: first submissions to
  cs.* may require endorsement by an existing arXiv author; check at submission.

**Other publication decisions (Prateek's directive 2026-08-02):**
- **D4 — License:** ✅ **RECOMMENDED (awaiting final ratification before the
  LICENSE file changes)** — MIT (code) + CC BY 4.0 (paper); see
  `research/license-draft.md`. The LICENSE file itself stays untouched until
  Prateek's explicit final go ("recommended, awaiting final go").
- **D5 — External reproducer:** 🚨 **CRITICAL PATH** — Prateek: the external
  reproduction is *the only thing worth delaying submission for*. Protocol +
  log in `research/reproduce/`; do NOT submit until an uninvolved reproducer
  has run it (or the delay is explicitly waived).
- **D6 — Source format:** ✅ **RESOLVED (RECOMMENDED)** — **submit LaTeX, not
  PDF-only** (`research/working-paper.tex`; compile pass on a machine with
  pdflatex still required — toolchain absent locally).
- **D7 — Companion note:** ✅ **RESOLVED (RECOMMENDED)** — **publish the
  archival-vs-pruned companion note simultaneously** with the paper (as
  appendix or separate posting).

---

*Bitcoin Sahi Research — author identity recommendation for working-paper v2.2.0
(2026-08-02). Extends publication-plan.md §2.*
