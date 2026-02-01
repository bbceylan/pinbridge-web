// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Import testing library matchers
import '@testing-library/jest-dom';

// Polyfill for structuredClone (required for fake-indexeddb)
if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

// Mock IntersectionObserver for testing
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }

  observe() {
    // Mock implementation - immediately trigger callback
    setTimeout(() => {
      this.callback([{ isIntersecting: true }]);
    }, 0);
  }

  unobserve() {
    // Mock implementation
  }

  disconnect() {
    // Mock implementation
  }
};