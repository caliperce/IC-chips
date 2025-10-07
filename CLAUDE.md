# AOI + Document-AI: IC Top Marking Verification (Prototype Spec)

---

## 1. Problem Statement

Factories buy lots of IC chips from many suppliers. Each chip has tiny top markings (like device code, date/lot, sometimes a logo). Right now, QA staff only check a few chips by hand using OEM PDFs. This means counterfeits or re-marked parts can slip through, causing failures and delays.

**Goal:**  
Build an agent that reads a chip image, finds the correct OEM marking info, and outputs a verdict with evidence.

---

## 2. What Does a Good Solution Look Like?

- Take a photo of the chip’s top (phone or line camera is fine).
- Agent reads the image (no external OCR needed for this prototype).
- Extract visible text/logo.
- Figure out likely brand/MPN.
- Fetch the OEM datasheet section that defines the top-marking for that package.
- Compare what’s on the chip vs. what’s expected.
- Return one of: **PASS / FAIL / REVIEW / INDETERMINATE**  
  (plus a short explanation, parsed fields, and citations to the OEM source).

---

## 3. How the Agent Works (Step-by-Step)

**a) Read Image**  
- **Input:** One or more top-view photos.  
- **Output:** Best-guess text lines (e.g., `["LM324N", "HLF", "2419"]`) and any logo cue (e.g., "ON", "ti", "winbond").

**b) Brand + MPN Candidate Generation**  
- If a logo is seen, use that brand.
- Use the first line as a candidate device code (e.g., 4N35, NE555P, 25Q64FVSIG).
- Keep multiple candidates if ambiguous (e.g., LM324N made by TI/ST/onsemi/UTC).

**c) Datasheet Retrieval (Document-AI)**  
- Search OEM domains first (ti.com, onsemi.com, winbond.com, microchip.com, st.com).
- Pull the section titled “Package/Device/Part Marking”, “Marking Diagram”, or “Valid Part Numbers and Top-Side Marking.”
- Cache a normalized marking spec for the MPN+package: exact strings and/or regex patterns (YYWW, AWLYWW, VXYYD, etc.).

**d) Comparison**  
- If the spec gives an exact device string → require that text (e.g., LM324N, NE555P).
- If it gives a pattern → validate length/charset/field ranges (e.g., YYWW week 01–53).
- Package sanity: observed package (DIP/SOIC/QFN) must match the orderable/package code in the sheet.
- Logo is optional unless the OEM explicitly requires it.
- If brand is unknown but the marking matches any OEM’s rule for that generic part, mark PASS (generic) with a note.

**e) Verdict + Record**  
- Emit a human-readable card and a JSON blob with: observed lines, parsed fields, expected rule, decision, confidence, and citations (links to the exact datasheet pages used).

---

## 4. What the Agent Checks (General Rules & Example References)

**General Rules (Apply to Any Brand/Part):**
- **Device string:** Must match the datasheet’s stated top-side/device marking for that package.
- **Date/lot formats:** Accept the specific pattern the OEM defines (e.g., YYWW, VXYYD, AWLYWW, YYWWNNN). Validate digits/lengths/ranges.
- **Package sanity:** The physical body (DIP/SOIC/etc.) must agree with the orderable code (e.g., TI P=PDIP, D=SOIC; Winbond SS=SOIC-8 208-mil).
- **Logos:** Helpful cue; treat as optional unless explicitly required by the OEM.
- **If the datasheet is missing:** Try another likely OEM of the same generic part; if still missing, return INDETERMINATE with what was tried.

**Example OEM References:**
- **Texas Instruments — NE555 / LM324:**  
  TI’s Package Option Addendum lists Part/Device marking per package (e.g., NE555P for PDIP; SOIC entries differ; LM324N for PDIP-14).
<!-- - **onsemi — 4N35 optocoupler:**  
  Marking Diagram shows: ON logo + 4N35 + pattern V X YY D (V=option, X=year digit, YY=work week, D=assembly code). -->
- **Winbond — W25Q64FV serial flash:**  
  Datasheet table “Valid Part Numbers and Top-Side Marking” maps orderables (e.g., W25Q64FVSSIG) to abbreviated on-package text 25Q64FVSIG; also defines package codes (SS=SOIC-8 208-mil, ST=VSOP-8, DA=PDIP-8, etc.).
- **Microchip — 24LC256 EEPROM:**  
  Package Marking Information: first line part code; second line YY/WW/NNN (year/week/traceability). Use those patterns for regex checks.

---
