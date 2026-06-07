// Global test setup file that mocks common dependencies
// This file should be preloaded before all tests to ensure mocks are set up properly
import { mock } from 'bun:test';

console.log('🔧 Setting up test mocks...');

// Mock toast to avoid UI dependencies
mock.module('@onlook/ui/sonner', () => ({
    toast: {
        success: mock(() => {}),
        error: mock(() => {}),
        info: mock(() => {}),
        warning: mock(() => {}),
        promise: mock(() => {})
    }
}));

// Mock MobX to avoid strict mode issues in tests
mock.module('mobx', () => ({
    makeAutoObservable: mock(() => {}),
    reaction: mock(() => () => {}),
    runInAction: mock((fn: any) => fn()),
    action: mock((fn: any) => fn),
    observable: mock((obj: any) => obj),
    computed: mock((fn: any) => ({ get: fn }))
}));

// Mock localforage to avoid browser storage dependencies
mock.module('localforage', () => ({
    getItem: mock(async () => null),
    setItem: mock(async () => undefined),
    removeItem: mock(async () => undefined),
    clear: mock(async () => undefined)
}));
