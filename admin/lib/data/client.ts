import type { createClient } from '@/lib/supabase-server'

export type ServerClient = Awaited<ReturnType<typeof createClient>>
