# Roadmap

MyCaseFiles already imports, sorts and annotates documents and produces paginated, indexed bundles. This is the remaining work to make it dependable for litigants in person, roughly in priority order. Estimates are approximate.

## 1. Finish the core workflow (~8 hours)

- [ ] **Edit existing bundles** – reopen a saved bundle to add, remove or reorder documents and regenerate it, instead of starting again. (~3h)
- [ ] **Section and document ordering** – drag-and-drop ordering within each section, with a sensible default (chronological within section, as courts expect). (~2h)
- [ ] **Bundle page limit warning** – PD27A sets a default 350-page limit for family bundles. Show a running page count in the bundle wizard and warn before it's exceeded. (~1h)
- [ ] **OCR beyond 3 pages** – OCR is currently capped at the first 3 pages for speed. Add an option to OCR whole documents in the background, with progress and cancel. (~2h)

## 2. Reliability and edge cases (~6 hours)

- [ ] **First-call text extraction failure** – `pdf-parse` (which bundles an old PDF.js) sometimes fails on its first call after startup with `bad XRef entry`, then succeeds. The preview copes, but the automatic details are skipped for that file. Add a retry, or replace `pdf-parse` with the current `pdfjs-dist`. (~2h)
- [ ] **Large files** – check behaviour at the 100 MB parse limit and 50 MB OCR limit, and with bundles over 1,000 pages (memory, progress feedback, clear error messages). (~2h)
- [ ] **Awkward PDFs** – encrypted or password-protected files, damaged files, landscape and mixed-size pages, and scanned pages with no text layer. (~2h)

## 3. Tests (~6 hours)

There are currently no automated tests.

- [ ] **Parser unit tests** – case numbers, form types, dates, judge names and section mapping, run against the fictional documents in `samples/`. (~3h)
- [ ] **Bundle generation tests** – page numbering, index page references and hyperlink targets, cover/index offsets. These have regressed several times before. (~2h)
- [ ] **Run tests in CI** – add `npm test` to the GitHub Actions build. (~1h)

## 4. Packaged builds (~5 hours)

- [ ] **macOS build** – `.dmg` via GitHub Actions, including bundling Poppler (currently a separate install on macOS/Linux). (~2h)
- [ ] **Linux AppImage** in the release workflow. (~1h)
- [ ] **Code signing** for Windows and macOS so users don't see SmartScreen/Gatekeeper warnings. (~2h, depending on certificates)

## 5. Documentation (~3 hours)

- [ ] **User guide** – step-by-step for a first-time litigant: importing papers, checking details, building and checking a bundle, with screenshots using the fictional samples. (~2h)
- [ ] **Privacy note in the app** – explain on first launch that everything stays on the user's computer, and how to back up or delete their data. (~1h)

## 6. Bundle templates for other courts (~5 hours)

Bundle sections are already defined in configuration (`src/constants/sectionConfig.ts`), so other courts can be supported without changing the bundle engine.

- [ ] **Template selection** – choose a bundle template when creating a vault or bundle, instead of the fixed child/finance layouts. (~2h)
- [ ] **Civil courts** – trial bundle sections following CPR Practice Direction 39A. (~1h)
- [ ] **Employment Tribunal** – a hearing bundle layout (pleadings, orders, witness statements, documents). (~1h)
- [ ] **Court of Protection** – sections following Practice Direction 13B. (~1h)

Templates should be checked against the current rules for each court before release.

**Total: about 33 hours.**
