import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'expect' {
  interface Matchers<R extends void | Promise<void>, T = {}>
    extends TestingLibraryMatchers<ReturnType<typeof expect.stringContaining>, R> {}
}
