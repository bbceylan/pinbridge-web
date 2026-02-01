# Implementation Plan: Transfer Packs Performance Fix

## Overview

This implementation refactors the PackCard component to use consistent reactive database queries, eliminating the performance issue caused by mixing `useLiveQuery` with `useEffect` + `useState` patterns. The approach replaces imperative progress fetching with reactive `useLiveQuery` hooks that automatically update when underlying data changes.

## Tasks

- [ ] 1. Refactor PackCard component to use reactive queries
  - [x] 1.1 Replace useEffect + useState with useLiveQuery for progress tracking
    - Remove `useState` for progress state management
    - Remove `useEffect` that calls `getPackProgress`
    - Add `useLiveQuery` to fetch transfer pack items directly
    - Add `useMemo` to calculate progress from live query results
    - Handle loading state when `useLiveQuery` returns `undefined`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3_

  - [ ] 1.2 Write property test for query efficiency
    - **Property 1: Query Efficiency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ] 1.3 Write property test for automatic reactivity
    - **Property 2: Automatic Reactivity**
    - **Validates: Requirements 2.3**

- [ ] 2. Ensure progress calculation accuracy
  - [ ] 2.1 Implement robust progress calculation logic
    - Calculate done count by filtering items with status 'done' or 'skipped'
    - Handle edge cases like empty item arrays
    - Ensure percentage calculation handles division by zero
    - Maintain backward compatibility with existing progress display
    - _Requirements: 3.1, 3.2_

  - [ ] 2.2 Write property test for progress calculation accuracy
    - **Property 3: Progress Calculation Accuracy**
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 2.3 Write unit tests for edge cases
    - Test empty transfer packs (0 items)
    - Test packs with all items complete
    - Test packs with mixed item statuses
    - Test loading state handling
    - _Requirements: 3.1, 3.2_

- [ ] 3. Preserve existing functionality and UI behavior
  - [ ] 3.1 Verify interactive behaviors remain intact
    - Ensure delete functionality works correctly
    - Ensure navigation to pack details works
    - Maintain button text logic (Resume vs Review)
    - Preserve completion status display logic
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ] 3.2 Write property test for interactive behavior preservation
    - **Property 4: Interactive Behavior Preservation**
    - **Validates: Requirements 3.3**

  - [ ] 3.3 Write property test for completion status display
    - **Property 5: Completion Status Display**
    - **Validates: Requirements 3.4, 3.5**

- [ ] 4. Checkpoint - Ensure all tests pass and verify performance improvement
  - Ensure all tests pass, ask the user if questions arise.
  - Verify that page renders without redundant database queries
  - Confirm that progress updates automatically when data changes

- [ ] 5. Clean up unused store methods (optional optimization)
  - [ ] 5.1 Remove or deprecate getPackProgress method from store
    - Mark `getPackProgress` method as deprecated if still used elsewhere
    - Add JSDoc comment explaining the reactive alternative
    - Consider removing if no other components use it
    - _Requirements: 2.1, 2.2_

  - [ ] 5.2 Write integration test for complete page functionality
    - Test multiple PackCard components rendering simultaneously
    - Verify that updates to one pack don't trigger queries for others
    - Test page performance with realistic data loads
    - _Requirements: 1.4, 4.4_

## Notes

- Each task references specific requirements for traceability
- The refactor maintains all existing UI behavior while improving performance
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Focus on leveraging existing Dexie indexes for optimal query performance