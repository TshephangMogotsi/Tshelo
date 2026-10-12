import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
import { getSupabaseAdminConfig } from '@/lib/config'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  const secret = process.env.WAITLIST_CLEANUP_SECRET
  const supplied = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) {
    return new Response(null,{status:403})
  }
  try {
    const {url,key}=getSupabaseAdminConfig()
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
    const {error}=await client.rpc('purge_expired_country_waitlist')
    return new Response(null,{status:error?503:204})
  } catch { return new Response(null,{status:503}) }
}
