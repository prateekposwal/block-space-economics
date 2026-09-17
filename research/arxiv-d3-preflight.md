# arXiv Submission — D3 Preflight (account + endorsement + fields)

**Status:** PREPARED (2026-08-04) — everything below is verified against arXiv's
current policies so Prateek's signup + upload is turnkey. The account itself must
be created by Prateek (needs his email verification); endorsement may need one
outbound email to an established author.

---

## 1. What Prateek does (5 minutes)

1. **Create the account:** https://arxiv.org/user → register with **real name:
   Prateek Poswal** + email (real identity, per D1/D3 directive).
2. **Link ORCID:** in the account profile, enter the ORCID iD
   `0009-0005-2139-1877` (the paper header/LaTeX already carry it).
3. **Start a submission** → select the category. This triggers the endorsement
   flow if needed.

## 2. Category + endorsement (verified 2026-08-04 from arXiv docs)

**Recommended primary:** `econ.GN` (General Economics) — the paper is a
fee-market internalization measurement; econ is the natural home and the
endorsement domain is broad.

**Recommended cross-list:** `cs.CR` (Cryptography and Security) — the block-chain
data/consensus angle.

**Endorsement reality check (from arXiv's endorsement page):**
- First-time submitters need endorsement per category unless they have an
  **institutional email** + claimed papers.
- **Prateek is an independent researcher** — likely NO institutional email, NO
  claimed arXiv papers → **personal endorsement will be required** for the first
  submission.
- The endorsement process: start a submission → arXiv emails an endorsement
  request link → send it to an established author in the domain → they enter a
  6-char code on https://arxiv.org/auth/endorse.

**How to find an endorser (the paper gives us 3 natural candidates):**
1. **Daniel Aronoff** (arXiv:2604.17183 — the fee-market model we cite; he's an
   established author). Already a contact in
   `research/reproduce/external-reproducer-contacts.md` (`daronoff@mit.edu`).
2. The **arXiv:2103.05866** authors (Liu, Fang, Cheung, Cai, Huang — prior work
   we now cite).
3. Use the "Which authors of this paper are endorsers?" link on related paper
   abstract pages.

**Pacing rule (arXiv):** do NOT mass-email potential endorsers or repeatedly
email the same one. One considered request to Aronoff is the clean path — and it
doubles as the tier-2 external-reproducer escalation (T0+14d) already in the
submission timeline.

## 3. Submission fields — pre-filled

| Field | Value (ready) |
|---|---|
| Title | Storage Cost Internalization in Bitcoin's Fee Market: A Reproducible Measurement |
| Authors | Prateek Poswal (ORCID 0009-0005-2139-1877) |
| Category | econ.GN (cross-list cs.CR) |
| License | **CC BY 4.0** (arXiv license field — matches paper notice) |
| Abstract | `research/arxiv-abstract-draft.md` Draft A (~1160 chars) or B (~700) |
| Source | `research/working-paper.tex` (LaTeX preferred over PDF — D6) |
| Comments | model-spec v2.1.1 · SCCR 0.3219 (140 blocks, N=26,586) · 155-block frozen capture · pre-print tag `preprint-2026-09-18` · JS/Python/C reproduction kit: https://github.com/prateekposwal/block-space-economics/tree/main/research/reproduce |

## 4. Pre-upload checks (from the repo's own publication-plan §8)

- [x] D1 identity (real name, ORCID now wired)
- [x] D2 ORCID `0009-0005-2139-1877`
- [x] D4 LICENSE ratified (MIT code + CC BY 4.0 paper)
- [x] D6 LaTeX complete + **compiled** (Tectonic 0.17.0, 2026-09-18) -> research/working-paper.pdf
- [x] D7 companion note (`archival-vs-pruned-note.md`) reviewed
- [x] Abstract drafts (banded claims)
- [ ] **D5 external reproduction** — the GATE (0xB10C reply / tier escalation / 21-day waiver)
- [x] **LaTeX compile pass — DONE 2026-09-18** (Tectonic 0.17.0, no TeX install needed): `research/working-paper.pdf` renders, 147 KiB
- [ ] arXiv account created + endorsement obtained

## 5. DONE vs LEFT

**DONE (this batch):** endorsement policy verified; category recommendation;
endorsement path identified (Aronoff = cleanest, doubles as tier-2 reproducer);
all submission fields pre-filled; license ratified; ORCID wired.

**LEFT (Prateek):**
- [ ] Create the arXiv account (https://arxiv.org/user, real identity)
- [ ] Link ORCID `0009-0005-2139-1877` in the profile
- [ ] Start a submission → get the endorsement request link
- [ ] Send the endorsement request to Daniel Aronoff (established author, already
      in contacts) — one considered email, not mass outreach
- [x] LaTeX compile pass — done via Tectonic (`~/.bsahi/bin/tectonic -X compile research/working-paper.tex`)

---

*Bitcoin Sahi Research — arXiv D3 preflight, verified against current arXiv
policies (2026-08-04).* Companion: `research/publication-plan.md` §8,
`research/arxiv-abstract-draft.md`.
