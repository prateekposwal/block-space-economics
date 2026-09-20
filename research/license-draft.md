# License — Recommendation & Drafts (Pre-Submission)

**For:** working-paper v2.2.0 (SCCR storage paper, Paper 1 of the **Bitcoin
Resource Accounting** program) + the block-space-economics repo
**Status:** ✅ **RECOMMENDED by Prateek (2026-08-02): MIT (code) + CC BY 4.0
(paper)** — flagged **"recommended, awaiting final go"**: the LICENSE file must
NOT be changed until Prateek explicitly ratifies (his stated recommendation is
recorded; the file change itself needs his final ratification).
**Current state:** `LICENSE` is a stub ("All rights reserved." — 20 bytes).
**Date:** 2026-08-02 (updated 2026-08-02 with Prateek's recommendation)

---

## 1. Recommendation

| Artifact | Recommended license | Why |
|---|---|---|
| **Code** (tools/, research scripts, reproduction kit) | **MIT** | Standard, permissive, maximal reuse — the reproducibility claim depends on others *running* the code. MIT removes every friction point. |
| **Paper** (working-paper.md/.tex, research/*.md analysis docs) | **CC BY 4.0** | Standard for scholarly text; requires attribution (preserves the "Prateek Poswal / Bitcoin Sahi Research" credit) while allowing reuse/derivation. |
| **arXiv submission license** | **CC BY 4.0** (arXiv option) | arXiv's non-exclusive license is the fallback; CC BY 4.0 is the modern default for maximal reuse and is what the paper should carry. |

**What this changes in the repo:**
- `LICENSE` (currently a stub) becomes the **MIT** text for code.
- The paper docs carry a **CC BY 4.0** notice in their headers/footers
  (the paper itself licenses its text; the repo LICENSE covers code).
- README's current "All rights reserved. For licensing inquiries…" block is
  replaced with the chosen license notice.

**arXiv angle:** arXiv requires a license choice at upload. Selecting CC BY 4.0
there is independent of the repo LICENSE but should match the paper's notice.

## 2. Draft — LICENSE (MIT, for code)

```text
MIT License

Copyright (c) 2026 Prateek Poswal (Bitcoin Sahi Research)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 3. Draft — CC BY 4.0 notice (for the paper docs)

Add to the paper header/footer (markdown) and the LaTeX title block:

```text
This work is licensed under a Creative Commons Attribution 4.0
International License (CC BY 4.0). To view a copy of this license, visit
https://creativecommons.org/licenses/by/4.0/.
```

LaTeX variant (needs `\usepackage[utf8]{inputenc}` + hyperref):

```latex
% Title block footer:
\thanks{This work is licensed under a Creative Commons Attribution 4.0
International License (CC BY 4.0).}
```

## 4. arXiv license field

At submission, arXiv asks for a license. Choose **"arXiv perpetual,
non-exclusive license to distribute this article (minimal rights)"** OR
**"Creative Commons Attribution 4.0 (CC BY 4.0)"**. Recommendation: **CC BY 4.0**
— consistent with the paper notice and the maximal-reuse intent.

## 5. DONE vs LEFT

**DONE:** recommendation + exact draft texts (MIT for code, CC BY 4.0 for paper,
arXiv field guidance) — ready to apply. **Prateek's recommendation recorded
2026-08-02: MIT (code) + CC BY 4.0 (paper) — matches the drafted pair.**

**LEFT (Prateek decisions):**
- [x] **RATIFIED (2026-08-04)**: LICENSE updated to MIT text; CC BY 4.0 notice added to working-paper.md/.tex headers + README
- [ ] At arXiv upload: select CC BY 4.0 in the license field

---

*Bitcoin Sahi Research — license recommendation for the SCCR paper + repo
(2026-08-02). Do NOT change LICENSE until Prateek ratifies.*
