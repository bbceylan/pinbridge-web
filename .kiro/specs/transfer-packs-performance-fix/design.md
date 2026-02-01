# Design Document: Transfer Packs Performance Fix

## Overview

This design addresses the performance issue in the transfer-packs page by replacing the mixed reactive/imperative pattern with a consistent reactive architecture. The core problem is that PackCard components use `useEffect` + `useState` to fetch progress data, which re-executes every time the parent's `useLiveQuery` triggers a re-render.

The solution replaces the imperative progress fetching with reactive `useLiveQuery` hooks that automatically update when the underlying data changes, eliminating redundant queries and creating a more predictable data flow.

## Architecture

### Current Architecture (Problematic)
```
TransferPacksPage
├── useLiveQuery(transferPacks) → triggers re-renders
└── PackCard[] (re-rendered on every parent update)
    └── useEffect(getPackProgress) → executes on every re-render
        └── Manual setState(progress) → imperative state management
```

### New Architecture (Reactive)
```
TransferPacksPage
├── useLiveQuery(transferPacks) → triggers re-renders
└── PackCard[] (re-rendered on parent update)
    └── useLiveQuery(transferPackItems) → reactive, only updates when data changes
        └── Computed progress → derived from live query result
```

### Key Architectural Changes

1. **Eliminate Mixed Patterns**: Remove `useEffect` + `useState` pattern from PackCard
2. **Consistent Reactivity**: Use `useLiveQuery` throughout the component tree
3. **Derived State**: Calculate progress directly from live query results
4. **Optimized Queries**: Use indexed queries for efficient progress calculation

## Components and Interfaces

### PackCard Component Refactor

**Current Interface:**
```typescript
function PackCard({ pack }: { pack: TransferPack }) {
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { getPackProgress } = useTransferPacksStore();
  
  useEffect(() => {
    getPackProgress(pack.id).then(setProgress);
  }, [pack.id]);
  // ...
}
```

**New Interface:**
```typescript
function PackCard({ pack }: { pack: TransferPack }) {
  const items = useLiveQuery(
    () => db.transferPackItems.where('packId').equals(pack.id).toArray(),
    [pack.id]
  );
  
  const progress = useMemo(() => {
    if (!items) return { done: 0, total: 0 };
    const done = items.filter(item => 
      item.status === 'done' || item.status === 'skipped'
    ).length;
    return { done, total: items.length };
  }, [items]);
  // ...
}
```

### Database Query Optimization

**Current Query Pattern:**
- Parent: `useLiveQuery(() => db.transferPacks.orderBy('updatedAt').reverse().toArray())`
- Each Child: `getPackProgress(packId)` via `useEffect`

**Optimized Query Pattern:**
- Parent: Same `useLiveQuery` for transfer packs
- Each Child: `useLiveQuery(() => db.transferPackItems.where('packId').equals(pack.id).toArray())`

### Performance Benefits

1. **Reduced Query Frequency**: Progress queries only execute when transferPackItems data actually changes
2. **Eliminated Cascading Effects**: Parent re-renders don't trigger child database queries
3. **Leveraged Indexing**: Uses existing `packId` index for efficient filtering
4. **Automatic Reactivity**: Progress updates automatically when items are marked complete

## Data Models

### Existing Data Models (No Changes Required)

**TransferPack:**
```typescript
interface TransferPack {
  id: string;
  name: string;
  target: TransferTarget;
  scopeType: 'library' | 'collection' | 'filtered';
  scopeId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**TransferPackItem:**
```typescript
interface TransferPackItem {
  id: string;
  packId: string;
  placeId: string;
  status: PackItemStatus; // 'pending' | 'done' | 'skipped' | 'mismatch'
  completedAt?: Date;
  mismatchReason?: string;
  mismatchNotes?: string;
}
```

### Database Schema (Existing)

The current schema already supports efficient queries:
- `transferPackItems: 'id, packId, placeId, status, [packId+status]'`
- The `packId` index enables efficient filtering by pack
- The compound `[packId+status]` index could be used for further optimization

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties validate the key functional requirements:

**Property 1: Query Efficiency**
*For any* transfer pack page load and subsequent data changes, the system should execute the minimum number of database queries necessary, with no redundant queries triggered by re-renders or cascading effects.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

**Property 2: Automatic Reactivity**
*For any* change to transfer pack item status in the database, the corresponding PackCard component should automatically update its progress display without manual state synchronization.
**Validates: Requirements 2.3**

**Property 3: Progress Calculation Accuracy**
*For any* transfer pack with a known set of items and their completion statuses, the displayed progress information (done/total count and percentage) should accurately reflect the actual data.
**Validates: Requirements 3.1, 3.2**

**Property 4: Interactive Behavior Preservation**
*For any* PackCard component, the delete and navigation interactions should function identically to the original implementation.
**Validates: Requirements 3.3**

**Property 5: Completion Status Display**
*For any* transfer pack, the button text should display "Review" when all items are complete (done/skipped) and "Resume" when any items remain pending.
**Validates: Requirements 3.4, 3.5**

## Error Handling

### Database Query Failures
- `useLiveQuery` returns `undefined` during loading states
- Components must handle `undefined` gracefully with loading indicators or default values
- Database connection errors are handled by Dexie's built-in error handling

### Data Consistency
- Progress calculations handle edge cases (empty item arrays, invalid statuses)
- Component renders gracefully when transfer pack items are not yet loaded
- Maintains backward compatibility with existing data structures

## Testing Strategy

### Dual Testing Approach
The testing strategy combines unit tests for specific scenarios with property-based tests for comprehensive validation:

**Unit Tests:**
- Specific examples of progress calculations with known data sets
- Edge cases like empty transfer packs or all-complete packs
- Interactive behavior testing (delete, navigation clicks)
- Loading state handling when `useLiveQuery` returns `undefined`

**Property-Based Tests:**
- Generate random transfer packs with varying item counts and statuses
- Verify progress calculations across all possible combinations
- Test reactivity by modifying database state and verifying UI updates
- Validate query efficiency by monitoring database call counts

**Property Test Configuration:**
- Use React Testing Library with custom property test utilities
- Minimum 100 iterations per property test for thorough coverage
- Each property test references its design document property
- Tag format: **Feature: transfer-packs-performance-fix, Property {number}: {property_text}**

**Integration Testing:**
- Test the complete page rendering with multiple transfer packs
- Verify that changes to one pack don't affect others (isolation)
- Test database query patterns under realistic data loads
- Validate performance improvements through query count monitoring