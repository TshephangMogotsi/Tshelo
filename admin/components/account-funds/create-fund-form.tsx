'use client'

import { useState, type FormEvent } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HandCoins } from 'lucide-react'
import type { CreateFundRequest, CurrencyCode, FundType } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'

const FUND_TYPES = [
  ['funeral', 'Funeral'], ['tombstone', 'Tombstone'], ['lobola', 'Lobola'],
  ['graduation', 'Graduation'], ['baby_shower', 'Baby shower'], ['kitchen_party', 'Kitchen party'],
  ['stokvel', 'Stokvel'], ['other', 'Other'],
] as const

export function CreateFundForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const request: CreateFundRequest = {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim() || null,
      fund_type: String(form.get('fund_type') ?? 'other') as FundType,
      fund_emoji: String(form.get('fund_emoji') ?? '').trim() || null,
      currency_code: String(form.get('currency_code') ?? 'BWP') as CurrencyCode,
      goal_amount: String(form.get('goal_amount') ?? '').trim() || null,
      contribution_deadline: String(form.get('contribution_deadline') ?? '') || null,
      is_private: form.get('is_private') === 'on',
    }

    setSubmitting(true)
    setError('')
    try {
      const fund = await createApiClient().funds.create(request)
      router.replace(`/account/funds/${fund.id}?created=1` as Route)
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="member-pagehead">
        <div><h1>Create a <em>fund</em></h1><p>Set the purpose, target, privacy, and contribution deadline. You can change these later.</p></div>
        <div className="member-page-actions"><Link href="/account/funds">Cancel</Link></div>
      </section>
      <section className="member-card member-form-card">
        <header><div className="member-section-title"><span><HandCoins size={18} /></span><h2>Fund details</h2></div></header>
        <form className="member-form" onSubmit={submit}>
          <div className="member-form-grid">
            <label className="wide"><span>Fund name</span><input name="title" required minLength={3} maxLength={200} placeholder="e.g. Mma's 70th birthday" /></label>
            <label><span>Fund type</span><select name="fund_type" defaultValue="other">{FUND_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Emoji</span><input name="fund_emoji" maxLength={16} placeholder="💜" /></label>
            <label><span>Goal amount</span><input name="goal_amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" /></label>
            <label><span>Currency</span><select name="currency_code" defaultValue="BWP"><option value="BWP">BWP — Pula</option><option value="ZAR">ZAR — Rand</option><option value="USD">USD — Dollar</option></select></label>
            <label><span>Contribution deadline</span><input name="contribution_deadline" type="date" /></label>
            <label className="wide"><span>Description</span><textarea name="description" maxLength={4000} rows={5} placeholder="Tell members what the fund is for." /></label>
          </div>
          <label className="member-check"><input type="checkbox" name="is_private" /><span><strong>Private fund</strong>People can preview it with the invite code, but joining requires organiser approval.</span></label>
          {error && <p className="member-form-error" role="alert">{error}</p>}
          <div className="member-form-actions"><Link href="/account/funds">Cancel</Link><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create fund'}</button></div>
        </form>
      </section>
    </>
  )
}
