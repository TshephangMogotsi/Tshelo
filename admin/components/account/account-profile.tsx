'use client'

import { useState, type FormEvent } from 'react'
import { Check, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AppUser } from '@/lib/app-user'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage } from '@/lib/api-ui'
import { formatDate, titleCase } from '@/lib/format'

export function AccountProfile({ user }: { user: AppUser }) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email ?? '')
  const [preferredCurrency, setPreferredCurrency] = useState(user.preferredCurrency ?? 'BWP')
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.notificationsEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    const nextEmail = email.trim()

    if (nextName.length < 2) {
      setError('Enter your name using at least 2 characters.')
      setSaved(false)
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      await createApiClient().users.updateMe({
        name: nextName,
        email: nextEmail || null,
        preferred_currency: preferredCurrency || 'BWP',
        notifications_enabled: notificationsEnabled,
      })
      setName(nextName)
      setEmail(nextEmail)
      setSaved(true)
      router.refresh()
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="member-form member-profile-form" onSubmit={save}>
      <div className="member-form-grid">
        <label>
          <span>Full name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          <span>Email address</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={255}
            placeholder="you@example.com"
          />
        </label>
        <label>
          <span>Preferred currency</span>
          <select value={preferredCurrency} onChange={(event) => setPreferredCurrency(event.target.value)}>
            <option value="BWP">BWP — Botswana pula</option>
            <option value="ZAR">ZAR — South African rand</option>
            <option value="USD">USD — US dollar</option>
          </select>
        </label>
      </div>

      <label className="member-check">
        <input
          type="checkbox"
          checked={notificationsEnabled}
          onChange={(event) => setNotificationsEnabled(event.target.checked)}
        />
        <span>
          <strong>Keep me up to date</strong>
          Receive account and fund notifications when they are available.
        </span>
      </label>

      <div className="member-profile-grid member-profile-meta" aria-label="Account status">
        <div><span>Phone</span><strong className="mono">{user.phone || 'Not set'}</strong></div>
        <div><span>Trust level</span><strong>{titleCase(user.trustLevel)}</strong></div>
        <div><span>Trust points</span><strong>{user.trustScore.toLocaleString('en-BW')}</strong></div>
        <div><span>Member since</span><strong>{formatDate(user.createdAt)}</strong></div>
        <div><span>Profile</span><strong>{user.profileCompleted ? 'Complete' : 'Incomplete'}</strong></div>
      </div>

      {error && <p className="member-form-error" role="alert">{error}</p>}
      {saved && <p className="member-profile-saved" role="status"><Check size={14} /> Profile saved.</p>}

      <div className="member-form-actions">
        <span className="member-form-note">Phone and trust details are protected account information.</span>
        <button className="primary" type="submit" disabled={saving}>
          <Save size={14} />
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
