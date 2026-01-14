import '@testing-library/jest-dom/vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PASSWORD_HASH = '$2a$10$test-hash';
process.env.NODE_ENV = 'test';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
