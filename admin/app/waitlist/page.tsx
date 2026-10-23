import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/lib/config'
import { CountryWaitlistForm } from '@/components/country-waitlist-form'
import styles from './waitlist.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: { absolute: 'Join the country waitlist · Tshelo' },
  description: 'Ask to hear when Tshelo becomes available in your country.',
}

export default async function CountryWaitlistPage() {
  // The site key is public even when its Vercel entry is stored as sensitive.
  // Never pass the verifier secret or rate-limit key to the client component.
  const siteKey = process.env.TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const enabled = process.env.WAITLIST_ENABLED === 'true'
  const configured = siteKey
    && (process.env.WAITLIST_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY)
    && process.env.WAITLIST_TURNSTILE_HOSTNAME && process.env.WAITLIST_RATE_LIMIT_KEY
  let countries: { code: string; name: string }[] = []
  if (configured) {
    try {
      const { url, key } = getSupabaseConfig()
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      const result = await client.from('countries').select('code,name').eq('is_launch_country', false).order('name')
      if (!result.error) countries = (result.data ?? []).filter(country => typeof country.code === 'string' && typeof country.name === 'string')
    } catch { /* Fail closed without exposing configuration or database details. */ }
  }
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="waitlist-title">
        <p className={styles.brand}>Tshelo</p>
        <p className={styles.eyebrow}>Growing together</p>
        <h1 id="waitlist-title">Let us know where to go next.</h1>
        <p>Choose your country and we’ll let you know when Tshelo is available there.</p>
        {configured && countries.length > 0
          ? <CountryWaitlistForm siteKey={siteKey!} countries={countries} enabled={enabled} />
          : <p role="status">The waitlist is currently unavailable. Please check back later.</p>}
      </section>
    </main>
  )
}
