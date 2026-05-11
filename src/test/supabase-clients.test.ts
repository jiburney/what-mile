import { describe, it, expect } from 'vitest'
import { supabase, supabaseGame } from '../lib/supabase'

describe('Supabase clients', () => {
  it('exports two separate clients', () => {
    expect(supabase).toBeDefined()
    expect(supabaseGame).toBeDefined()
    expect(supabase).not.toBe(supabaseGame)
  })

  it('game client is a separate instance from admin client', () => {
    expect(supabaseGame).toBeDefined()
    expect(supabaseGame).not.toBe(supabase)
  })
})
