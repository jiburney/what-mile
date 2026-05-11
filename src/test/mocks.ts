import { vi } from 'vitest'

const photoRows = [
  {
    id: 'test-uuid-1',
    filename: 'test1.webp',
    location_name: 'Springer Mountain, Georgia',
    lat: 34.627,
    lng: -84.193,
    description: 'The southern terminus of the AT.',
    r2_url: 'https://pub-test.r2.dev/approved/test1.webp',
    times_shown: 0,
    is_private: false,
  },
  {
    id: 'test-uuid-2',
    filename: 'test2.webp',
    location_name: 'Blood Mountain, Georgia',
    lat: 34.742,
    lng: -83.935,
    description: 'Rocky summit views.',
    r2_url: 'https://pub-test.r2.dev/approved/test2.webp',
    times_shown: 2,
    is_private: false,
  },
]

export const mockSupabaseGame = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ data: photoRows, error: null }),
}

export const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}
