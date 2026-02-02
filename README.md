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

### Recent Improvements (2026)
- **Performance Optimization:** Refactored transfer packs page with reactive database queries, eliminating redundant queries and improving page responsiveness
- **Comprehensive Test Coverage:** Added property-based testing with fast-check framework for robust validation across all scenarios
- **Query Efficiency:** Implemented consistent reactive architecture using useLiveQuery throughout component tree
- **Progress Calculation Accuracy:** Enhanced progress tracking with precise calculations and edge case handling
- **Interactive Behavior Preservation:** Maintained all existing UI behaviors while improving underlying performance

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
- **Testing:** Jest + React Testing Library + fast-check (property-based testing)
- **Architecture:** Reactive database queries with consistent useLiveQuery patterns

## Getting Started

```bash
# Install dependencies (npm or bun)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

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
├── types/                 # TypeScript interfaces
└── __tests__/             # Comprehensive test suite with property-based testing
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

## Testing & Quality Assurance

PinBridge Web uses a comprehensive testing strategy to ensure reliability and performance:

### Testing Approach
- **Property-Based Testing:** Uses fast-check framework to validate correctness across all possible input combinations
- **Unit Tests:** Focused tests for specific edge cases and component behaviors
- **Integration Tests:** End-to-end testing of complete page functionality
- **Performance Testing:** Query efficiency validation and database optimization verification

### Test Coverage Areas
- **Query Efficiency:** Validates elimination of redundant database queries
- **Automatic Reactivity:** Ensures UI updates automatically when data changes
- **Progress Calculation Accuracy:** Verifies correct progress calculations across all scenarios
- **Interactive Behavior Preservation:** Confirms all user interactions work correctly
- **Completion Status Display:** Validates proper button text and status indicators

### Performance Optimizations
- **Reactive Architecture:** Consistent use of useLiveQuery for automatic data synchronization
- **Query Isolation:** Updates to one component don't trigger unnecessary queries in others
- **Efficient Database Patterns:** Leverages Dexie indexes for optimal query performance
- **Minimal Re-renders:** Eliminates cascading re-render effects that caused performance issues

## License

MIT
