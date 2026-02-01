# Agent Learnings - PinBridge Web

This file documents learnings from AI-assisted development sessions.

## Session: 2026-02-01 - Initial Bug Fixes

### TypeScript Errors Fixed

1. **Map Iteration in ES5/ES6 Target**
   - **Issue:** `Type 'Map<K, V>' can only be iterated through when using '--downlevelIteration'`
   - **Solution:** Use `Array.from(map.entries())` instead of iterating the Map directly
   - **File:** `src/app/import/page.tsx`

2. **Zustand Store Function in useEffect Dependencies**
   - **Issue:** Including Zustand store functions (like `getPackProgress`) in useEffect dependency arrays can cause infinite re-renders
   - **Solution:** Remove the function from deps and add eslint-disable comment, since Zustand functions are stable references
   - **File:** `src/app/transfer-packs/page.tsx`

3. **Nullable vs Undefined Return Types**
   - **Issue:** `Promise<T | undefined>` not assignable to `Promise<T | null>`
   - **Solution:** Use `await` + `?? null` instead of `|| null` to properly convert undefined to null
   - **File:** `src/stores/transfer-packs.ts`

4. **Papa Parse Generic Typing**
   - **Issue:** `results.data.forEach` callback receives `unknown` type
   - **Solution:** Add generic type to `Papa.parse<Record<string, string>>(...)` call
   - **File:** `src/lib/parsers/takeout.ts`

5. **Possibly Undefined in JSX**
   - **Issue:** Accessing properties on potentially undefined values in render
   - **Solution:** Add early return guards (e.g., `if (!currentPlace)`) before the JSX that uses it
   - **File:** `src/app/resolve/page.tsx`

6. **Next.js 14 useSearchParams() Build Error**
   - **Issue:** `useSearchParams() should be wrapped in a suspense boundary`
   - **Solution:** Either wrap in Suspense or (if unused) remove the hook entirely
   - **File:** `src/app/import/page.tsx`

### Architecture Patterns

1. **Dexie + React Integration**
   - Use `useLiveQuery` from `dexie-react-hooks` for reactive database queries
   - Returns `undefined` while loading, actual data when ready
   - Always handle the loading state with null checks

2. **Zustand Store Functions**
   - Functions defined inside `create()` are stable references
   - Safe to call in useEffect without including in deps (use eslint-disable comment)
   - For async operations, extract the function and call it

3. **Next.js App Router**
   - Dynamic routes use `[param]` folder naming
   - `useParams()` returns route parameters
   - `useSearchParams()` requires Suspense boundary in Next.js 14 static builds

### Code Quality Patterns

1. **Type Assertions for Spread Objects**
   - When spreading an object and overriding properties, TypeScript may lose type info
   - Use `as Type` assertion when passing to functions expecting the original type
   - Example: `{ ...place, latitude: undefined } as Place`

2. **Error Handling in Parsers**
   - Always type catch block errors: `error: Error` or check `error instanceof Error`
   - Provide fallback messages for non-Error throws

### Project-Specific Notes

1. **No Web Workers Implemented Yet**
   - `src/workers/` directory exists but is empty
   - Heavy parsing currently runs on main thread
   - Consider Web Workers for large Takeout files

2. **Link List Feature**
   - Marked as "Coming soon" in export page
   - Planned feature for shareable link pages with QR codes
