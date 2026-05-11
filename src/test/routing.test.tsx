import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { mockSupabase, mockSupabaseGame } from './mocks'

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
  supabaseGame: mockSupabaseGame,
}))

const { default: App } = await import('../App')
const { AdminApp } = await import('../admin/AdminApp')

describe('App routing', () => {
  it('renders the game at / without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(document.body).toBeTruthy()
  })

  it('renders admin login at /admin without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminApp />
      </MemoryRouter>,
    )
    expect(document.body).toBeTruthy()
  })
})
