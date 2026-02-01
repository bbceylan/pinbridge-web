# PinBridge Web

Transfer saved places between Apple Maps and Google Maps.

## Overview

PinBridge Web is a PWA that lets you:
- Import Google Takeout "Saved" files
- Build a canonical place library with deduplication, tagging, and collections
- Create "Transfer Packs" to batch-open places in your target map app
- Export to CSV, link lists, and more

**Key principle:** Migration + backup, not automatic sync. You'll still tap "Save" in the target app.

## Features

### Import
- Google Takeout ZIP or CSV files
- Paste Apple Maps / Google Maps links
- Import CSV (PinBridge format)

### Library Management
- Canonical place records with title, address, coordinates, notes, tags
- Collections (list equivalents)
- Duplicate detection and merge tools
- Manual coordinate resolution

### Transfer Packs
- Guided "open and save" workflow
- Progress tracking with resume support
- Works across devices via shareable links

### Export
- CSV (round-trippable)
- Link list pages with QR codes
- KML/GeoJSON/GPX (planned)

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React + Tailwind CSS + shadcn/ui
- **Storage:** IndexedDB (via Dexie.js)
- **State:** Zustand
- **Parsing:** Papa Parse (CSV), JSZip (Takeout)

## Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun build

# Run production build
bun start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Library (home)
│   ├── import/
│   ├── collections/
│   ├── place/
│   ├── resolve/
│   ├── transfer-packs/
│   ├── export/
│   └── settings/
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── library/
│   ├── import/
│   ├── transfer/
│   └── shared/
├── lib/
│   ├── db/                # Dexie database schema
│   ├── parsers/           # Takeout, CSV, URL parsers
│   ├── links/             # Apple/Google Maps link generation
│   └── utils/
├── stores/                # Zustand stores
├── types/                 # TypeScript types
└── workers/               # Web Workers for heavy parsing
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Library (all places) |
| `/import` | Import hub |
| `/collections/:id` | Collection detail |
| `/place/:id` | Place detail |
| `/resolve` | Batch coordinate resolver |
| `/transfer-packs` | Transfer packs list |
| `/transfer-packs/new` | Create transfer pack |
| `/transfer-packs/:id/run` | Run transfer pack |
| `/export` | Export options |
| `/settings` | Settings & privacy |

## Data Privacy

- **Local-first:** All data stored in browser IndexedDB by default
- **No accounts required** for core functionality
- **Clear deletion controls** in settings

## License

MIT
