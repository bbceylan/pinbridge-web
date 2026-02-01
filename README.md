# PinBridge Web

Transfer saved places between Apple Maps and Google Maps.

## Overview

PinBridge Web is a PWA that lets you:
- Import Google Takeout "Saved" files
- Build a canonical place library with deduplication, tagging, and collections
- Create "Transfer Packs" to batch-open places in your target map app
- Export to CSV for backup

**Key principle:** Migration + backup, not automatic sync. You'll still tap "Save" in the target app.

## Current Status

### Working Features
- **Import:** Google Takeout ZIP, CSV files, paste Apple/Google Maps links
- **Library:** View, search, filter places with missing coordinates indicator
- **Collections:** Organize places into named groups
- **Place Detail:** View/edit place info, open in Apple/Google Maps
- **Transfer Packs:** Create packs, guided open-and-save workflow with progress tracking
- **Export:** CSV export with collection metadata
- **Coordinate Resolution:** Manual batch coordinate fixing
- **Settings:** View stats, clear all data

### Planned Features
- Link list pages with QR codes
- KML/GeoJSON/GPX export
- Cross-device sync via shareable links
- PWA offline support improvements

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18 + Tailwind CSS + shadcn/ui
- **Storage:** IndexedDB (via Dexie.js)
- **State:** Zustand + Dexie React Hooks (live queries)
- **Parsing:** Papa Parse (CSV), JSZip (Takeout)

## Getting Started

```bash
# Install dependencies (npm or bun)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Library (home)
│   ├── import/            # Import hub
│   ├── export/            # Export options
│   ├── collections/[id]/  # Collection detail
│   ├── place/[id]/        # Place detail
│   ├── resolve/           # Batch coordinate resolver
│   ├── transfer-packs/    # Transfer pack list, create, run
│   └── settings/          # Settings & privacy
├── components/
│   ├── ui/                # shadcn/ui components
│   └── shared/            # App shell, shared components
├── lib/
│   ├── db/                # Dexie database schema
│   ├── parsers/           # Takeout, CSV parsers
│   ├── links/             # Apple/Google Maps link generation/parsing
│   └── utils/             # Utilities (cn, generateId, normalize, etc.)
├── stores/                # Zustand stores (places, transfer-packs)
└── types/                 # TypeScript interfaces
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Library (all places, search, filters) |
| `/import` | Import hub (Takeout, CSV, paste link) |
| `/export` | Export to CSV |
| `/collections/:id` | Collection detail |
| `/place/:id` | Place detail with open-in-app links |
| `/resolve` | Batch coordinate resolver |
| `/transfer-packs` | Transfer packs list |
| `/transfer-packs/new` | Create transfer pack wizard |
| `/transfer-packs/:id/run` | Run transfer pack workflow |
| `/settings` | Data management & privacy |

## Data Privacy

- **Local-first:** All data stored in browser IndexedDB
- **No accounts required** for core functionality
- **No data sent to servers** - everything stays on your device
- **Clear deletion controls** in settings

## License

MIT
