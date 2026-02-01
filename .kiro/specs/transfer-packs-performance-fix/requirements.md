# Requirements Document

## Introduction

The transfer-packs page currently has a performance issue where mixing reactive database queries (`useLiveQuery`) with imperative state management (`useEffect` + `useState`) creates a cascade of unnecessary database queries. Each time the parent component's live query updates, all PackCard components re-render and trigger their useEffect hooks, causing repeated database calls and network requests to load manifest.json files.

## Glossary

- **Transfer_Pack**: A collection of places to be migrated to a target mapping application
- **Pack_Progress**: The completion status of a transfer pack (done/total items)
- **Live_Query**: A reactive database query using Dexie's `useLiveQuery` hook
- **Pack_Card**: Individual UI component displaying transfer pack information and progress
- **Transfer_Pack_Items**: Database records representing individual places within a transfer pack

## Requirements

### Requirement 1: Eliminate Redundant Database Queries

**User Story:** As a user viewing the transfer packs page, I want the page to load efficiently without repeated database queries, so that the interface is responsive and doesn't waste system resources.

#### Acceptance Criteria

1. WHEN the transfer packs page loads, THE System SHALL query each transfer pack's progress exactly once per data change
2. WHEN a transfer pack's progress updates, THE System SHALL only re-query that specific pack's progress
3. WHEN the page re-renders due to parent state changes, THE System SHALL NOT trigger additional database queries for unchanged data
4. WHEN multiple PackCard components are displayed, THE System SHALL NOT cause cascading re-renders that trigger redundant queries

### Requirement 2: Implement Consistent Reactive Architecture

**User Story:** As a developer maintaining the codebase, I want consistent reactive patterns throughout the component tree, so that the code is predictable and follows established architectural patterns.

#### Acceptance Criteria

1. THE Pack_Card SHALL use reactive database queries for progress tracking
2. THE Pack_Card SHALL NOT mix reactive queries with imperative state management
3. WHEN database data changes, THE Pack_Card SHALL automatically reflect updates without manual state synchronization
4. THE System SHALL follow the established Dexie + React integration patterns documented in the codebase

### Requirement 3: Maintain Current User Experience

**User Story:** As a user of the transfer packs page, I want the same functionality and visual behavior as before, so that the performance improvements don't disrupt my workflow.

#### Acceptance Criteria

1. THE Pack_Card SHALL display the same progress information (done/total places)
2. THE Pack_Card SHALL show the same visual progress bar and completion status
3. THE Pack_Card SHALL maintain the same interactive behaviors (delete, navigation)
4. WHEN a pack is complete, THE Pack_Card SHALL display "Complete" status and "Review" button text
5. WHEN a pack is incomplete, THE Pack_Card SHALL display "Resume" button text

### Requirement 4: Optimize Database Query Patterns

**User Story:** As a system administrator, I want efficient database usage, so that the application scales well with larger datasets and doesn't consume excessive resources.

#### Acceptance Criteria

1. THE System SHALL use indexed database queries for optimal performance
2. THE System SHALL leverage the existing `[packId+status]` compound index for progress calculations
3. WHEN calculating progress, THE System SHALL use efficient counting queries rather than loading full record sets
4. THE System SHALL minimize the number of database transactions per page load
