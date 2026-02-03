// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Import testing library matchers
import '@testing-library/jest-dom';

// Suppress known act(...) warnings from async Dexie liveQuery updates in jsdom.
const originalConsoleError = console.error;
console.error = (...args) => {
  const firstArg = args[0];
  if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
    return;
  }
  originalConsoleError(...args);
};

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

// Mock Worker for jsdom-based tests that import worker pool modules.
if (typeof global.Worker === 'undefined') {
  global.Worker = class MockWorker {
    constructor(script) {
      this.script = script;
      this.onmessage = null;
      this.onerror = null;
    }

    postMessage(message) {
      const respond = () => {
        if (!this.onmessage) {
          return;
        }

        const id = message?.id ?? 'mock';
        let type = 'MATCH_RESULT';
        let payload = {};

        switch (message?.type) {
          case 'CALCULATE_SIMILARITY':
            type = 'SIMILARITY_RESULT';
            payload = 0;
            break;
          case 'BATCH_MATCH':
            type = 'BATCH_RESULT';
            payload = { results: [] };
            break;
          case 'MATCH_PLACES':
            type = 'MATCH_RESULT';
            payload = {
              query: message?.payload,
              matches: [],
              bestMatch: undefined,
              processingTimeMs: 0,
              metadata: {
                totalCandidates: message?.payload?.candidatePlaces?.length ?? 0,
                validMatches: 0,
                averageConfidence: 0,
              },
            };
            break;
          default:
            break;
        }

        this.onmessage({ data: { id, type, payload } });
      };

      setTimeout(respond, 0);
    }

    terminate() {}

    addEventListener() {}

    removeEventListener() {}
  };
}
