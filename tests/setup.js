// tests/setup.js
// ==============
// Setup global pour les tests Jest

// Augmenter le timeout pour les opérations async
jest.setTimeout(30000);

// Mock console.error pour les tests attendus
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = (...args) => {
        // Filtrer les erreurs SQLite attendues pendant les tests
        if (args[0] && args[0].includes && args[0].includes('SQL run() error')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});