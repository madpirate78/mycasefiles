# MyCaseFiles

**A desktop app that helps people representing themselves in the UK family court organise their documents and build court bundles.**

Litigants in person often have hundreds of pages of applications, orders, statements and reports, and are expected to turn them into a paginated, indexed bundle in the format the court requires. MyCaseFiles sorts documents into the standard bundle sections, reads key details (case number, judge, document type) from file names and PDF text, and produces a bundle with page numbers, section dividers and a hyperlinked index.

> ⚠️ **Not legal advice.** MyCaseFiles is an organisational tool. It does not give legal advice, and it does not guarantee that a bundle meets the requirements of your court or judge. Always check the current rules (for example [Practice Direction 27A of the Family Procedure Rules](https://www.justice.gov.uk/courts/procedure-rules/family/practice_directions/pd_part_27a)) and any directions in your own case.

## Your documents never leave your computer

- **Local only.** Files are stored in the app's local database (IndexedDB) on your own machine.
- **No uploads, no server, no account.** The app has no backend and makes no network requests with your data.
- **No telemetry or analytics.**
- **Works offline.** PDF rendering and OCR (text recognition for scanned documents) run on your machine. The OCR language data is bundled with the app.

## Features

- **Document vault** – sorts documents into bundle sections: Preliminary Documents; Applications, Orders & Judgments; Statements and Affidavits; Care Plans; Experts' Reports; Other Documents
- **Separate vaults** for children and financial proceedings (the financial vault adds Financial Disclosure, Property Valuations and Correspondence)
- **Automatic details** – reads case numbers (e.g. `AB12C34567`), form types (C100, FL401), dates and judge titles (HHJ, DJ, DDJ) from file names and PDF text
- **OCR** for scanned documents, producing searchable PDFs
- **Page selection** – include only the pages you need
- **Bundle builder** – cover page, hyperlinked index, section dividers, continuous page numbering and PDF bookmarks
- **Folder import** – import an existing folder of documents with automatic section mapping

## Try it with sample documents

The [`samples/`](samples/) folder contains **fictional** documents (a C100 summary, witness statement, position statement, order, Cafcass letter and chronology) for a made-up case, `AB12C34567`. Every name, court and address in them is invented. Import the folder to try the app without using real papers.

To regenerate them: `node scripts/generate-samples.js`

## Install

### Windows
Download the latest installer from [Releases](../../releases) and run `My Case Files Setup X.X.X.exe`. The installer is not yet code-signed, so Windows SmartScreen may warn you: click **More info → Run anyway**.

### macOS / Linux
There are no packaged builds yet. Run from source (below).

## Run from source

Requirements: Node.js 18+. For OCR on Linux or macOS, also install Poppler (`sudo apt install poppler-utils` or `brew install poppler`); Windows binaries are included.

```bash
git clone https://github.com/madpirate78/mycasefiles.git
cd mycasefiles
npm install
npm run dev-electron   # builds the React app and launches Electron
```

Use `npm run dev-electron`, not `npm start`: PDF text extraction and OCR run in Electron's main process and won't work in a plain browser.

### Commands

| Command | What it does |
|---|---|
| `npm run dev-electron` | Build and launch the desktop app |
| `npm run electron` | Launch using the existing build |
| `npm run build` | Build the React app |
| `npm run dist` | Build a Windows installer locally |
| `npm run version-patch` | Tag a release (GitHub Actions builds and publishes it) |

### Linux / WSL dependencies for Electron

```bash
sudo apt install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon-dev libxcomposite-dev libxdamage-dev libxrandr-dev libgbm-dev libxss-dev libasound2-dev
```

## Built with

- **Electron** – desktop shell; PDF and OCR work runs in the main process and reaches the UI through a secure `contextBridge` IPC layer
- **React + TypeScript** – user interface
- **IndexedDB** – local storage
- **pdf-parse**, **PDF.js**, **pdf-lib** – text extraction, rendering and bundle generation
- **Tesseract.js** and **Poppler** – OCR for scanned documents

```
src/
├── components/            # React UI (documents, bundles, layout)
├── services/
│   ├── documentParser/    # UK court document parsing
│   └── indexedDBService.ts
└── constants/sectionConfig.ts   # bundle sections and metadata fields
public/
├── electron.js            # Electron main process
├── electron/              # PDF, OCR and bundle services
└── preload.js             # IPC bridge
resources/tessdata/        # bundled OCR language data
samples/                   # fictional test documents
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Contributing

Issues and pull requests are welcome. **Never attach or commit real court documents.** Family proceedings are confidential, so use the fictional files in `samples/` (or add new fictional ones) to reproduce problems. The repository's `.gitignore` blocks PDFs outside `samples/` for this reason.

## Licence

[MIT](LICENSE)
