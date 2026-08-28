'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  BellRing,
  Check,
  CircleCheck,
  FileCheck2,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  UserRound,
} from 'lucide-react'
import type { User } from '@shared/contracts'
import { createApiClient } from '@/lib/api-client'
import { apiErrorMessage, runApiRead } from '@/lib/api-ui'
import {
  setAccountThemePreference,
  useAccountThemePreference,
  type AccountThemePreference,
} from '@/components/account-theme'
import { formatDate } from '@/lib/format'

type CommunicationDraft = {
  notificationsEnabled: boolean
  marketingEmailEnabled: boolean
  marketingSmsEnabled: boolean
}

const THEME_OPTIONS: Array<{ value: AccountThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

function draftFromUser(user: User): CommunicationDraft {
  return {
    notificationsEnabled: user.notifications_enabled,
    marketingEmailEnabled: user.marketing_email_enabled,
    marketingSmsEnabled: user.marketing_sms_enabled,
  }
}

function ConsentRecord({
  icon: Icon,
  title,
  detail,
  active,
  href,
}: {
  icon: typeof ShieldCheck
  title: string
  detail: string
  active: boolean
  href: Route
}) {
  return (
    <article className="member-preference-record">
      <span><Icon size={17} /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
      <div className="member-preference-record-actions">
        <Link href={href}>Read</Link>
        <i className={active ? 'active' : ''}>{active ? 'Active' : 'Not recorded'}</i>
      </div>
    </article>
  )
}

function PreferenceSwitch({
  icon: Icon,
  title,
  detail,
  checked,
  onChange,
}: {
  icon: typeof BellRing
  title: string
  detail: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <article className="member-preference-switch-row">
      <span><Icon size={17} /></span>
      <div><strong>{title}</strong><p>{detail}</p></div>
      <button type="button" role="switch" aria-checked={checked} className={checked ? 'on' : ''} onClick={() => onChange(!checked)}>
        <i /><span className="sr-only">{checked ? 'Enabled' : 'Disabled'}</span>
      </button>
    </article>
  )
}

export function AccountPreferences() {
  const theme = useAccountThemePreference()
  const [user, setUser] = useState<User | null>(null)
  const [draft, setDraft] = useState<CommunicationDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    runApiRead(call => createApiClient().users.me(call), controller.signal)
      .then(profile => {
        if (controller.signal.aborted) return
        setUser(profile)
        setDraft(draftFromUser(profile))
      })
      .catch(cause => {
        const message = apiErrorMessage(cause)
        if (!controller.signal.aborted && message) setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refreshVersion])

  function retry() {
    setLoading(true)
    setError('')
    setNotice('')
    setRefreshVersion(version => version + 1)
  }

  function chooseTheme(preference: AccountThemePreference) {
    setAccountThemePreference(preference)
    setNotice(`Website appearance set to ${preference}.`)
  }

  async function saveCommunications() {
    if (!user || !draft) return
    const marketingConsent = draft.marketingEmailEnabled || draft.marketingSmsEnabled
    const startedMarketingConsent = marketingConsent && !user.marketing_consent
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const updated = await createApiClient().users.updateMe({
        notifications_enabled: draft.notificationsEnabled,
        marketing_consent: marketingConsent,
        marketing_email_enabled: draft.marketingEmailEnabled,
        marketing_sms_enabled: draft.marketingSmsEnabled,
        ...(startedMarketingConsent ? { marketing_consent_at: new Date().toISOString() } : {}),
      })
      setUser(updated)
      setDraft(draftFromUser(updated))
      setNotice('Communication preferences saved.')
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="member-pagehead">
        <div>
          <h1>Account <em>preferences</em></h1>
        </div>
      </section>

      {notice && <p className="member-success-note" role="status"><CircleCheck size={16} /> {notice}</p>}
      {error && <p className="member-form-error member-preference-error" role="alert">{error}</p>}

      <section className="member-card member-preference-card">
        <header><div className="member-section-title"><span><Monitor size={18} /></span><h2>Website appearance</h2></div></header>
        <div className="member-card-body">
          <div className="member-preference-heading"><div><h3>Theme</h3><p>This applies to the Tshelo website in this browser. Your phone’s device settings are not changed.</p></div></div>
          <div className="member-theme-options" role="radiogroup" aria-label="Website theme">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} className={theme === value ? 'selected' : ''} onClick={() => chooseTheme(value)}>
                <Icon size={18} /><strong>{label}</strong><span>{value === 'system' ? 'Follow this computer' : `${label} website theme`}</span>
                {theme === value && <i><Check size={13} /></i>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && <section className="member-card"><div className="member-api-state"><p>Loading your privacy and communication preferences…</p></div></section>}
      {!loading && error && !user && <section className="member-card"><div className="member-api-state error"><p>Your preferences could not be loaded.</p><button type="button" onClick={retry}><RefreshCw size={14} /> Try again</button></div></section>}

      {!loading && user && draft && (
        <>
          <section className="member-card member-preference-card">
            <header><div className="member-section-title"><span><ShieldCheck size={18} /></span><h2>Privacy &amp; consent</h2></div></header>
            <div className="member-card-body">
              <div className="member-preference-records">
                <ConsentRecord
                  icon={FileCheck2}
                  title="Privacy policy"
                  href={'/account/preferences/privacy-policy' as Route}
                  active={Boolean(user.privacy_accepted_at)}
                  detail={user.privacy_accepted_at
                    ? `Accepted ${formatDate(user.privacy_accepted_at)}${user.privacy_version ? ` · version ${user.privacy_version}` : ''}.`
                    : 'No acceptance record is available for this account.'}
                />
                <ConsentRecord
                  icon={LockKeyhole}
                  title="Service data processing"
                  href={'/account/preferences/service-data-processing' as Route}
                  active={user.data_processing_consent}
                  detail={user.data_processing_consent
                    ? `Active${user.data_processing_consent_at ? ` since ${formatDate(user.data_processing_consent_at)}` : ''}. This is required to provide your Tshelo account and fund records.`
                    : 'No active processing consent is recorded. Please contact support before using account services.'}
                />
              </div>
              <p className="member-preference-note">Optional marketing choices below can be changed at any time. They do not control important fund, account, or security messages.</p>
            </div>
          </section>

          <section className="member-card member-preference-card">
            <header><div className="member-section-title"><span><BellRing size={18} /></span><h2>Communication choices</h2></div></header>
            <div className="member-card-body">
              <div className="member-preference-switches">
                <PreferenceSwitch icon={BellRing} title="Fund and account notifications" detail="Receive useful updates about your funds, events, recognition, and account." checked={draft.notificationsEnabled} onChange={notificationsEnabled => setDraft(current => current ? { ...current, notificationsEnabled } : current)} />
                <PreferenceSwitch icon={Mail} title="Email product updates" detail="Send optional Tshelo news and feature updates to your email address." checked={draft.marketingEmailEnabled} onChange={marketingEmailEnabled => setDraft(current => current ? { ...current, marketingEmailEnabled } : current)} />
                <PreferenceSwitch icon={MessageSquare} title="SMS product updates" detail="Send optional Tshelo news and feature updates by SMS." checked={draft.marketingSmsEnabled} onChange={marketingSmsEnabled => setDraft(current => current ? { ...current, marketingSmsEnabled } : current)} />
              </div>
              <div className="member-preference-actions">
                <p>{draft.marketingEmailEnabled || draft.marketingSmsEnabled ? 'You have opted in to optional Tshelo updates.' : 'You are not opted in to optional Tshelo updates.'}</p>
                <button className="primary" type="button" disabled={saving} onClick={() => void saveCommunications()}>{saving ? 'Saving…' : 'Save communication choices'}</button>
              </div>
            </div>
          </section>

          <section className="member-card member-preference-card">
            <header><div className="member-section-title"><span><LockKeyhole size={18} /></span><h2>Security &amp; account management</h2></div></header>
            <div className="member-card-body">
              <div className="member-preference-security">
                <article><span><Smartphone size={18} /></span><div><strong>Mobile OTP protection</strong><p>Your account uses one-time codes sent to <b>{user.phone}</b> to sign in. Your number is protected account information.</p></div><i>Enabled</i></article>
                <article><span><UserRound size={18} /></span><div><strong>Personal details</strong><p>Update your name, email address, and preferred currency from Account details.</p></div><Link href={'/account#profile' as Route}>Manage</Link></article>
                <article><span><LockKeyhole size={18} /></span><div><strong>Account closure</strong><p>To close an account or discuss your data, contact Tshelo support so we can protect fund records and meet legal obligations.</p></div><a href="mailto:support@tshelo.co.bw">Contact support</a></article>
              </div>
              <div className="member-preference-signout">
                <div><strong>Sign out of this browser</strong><p>End this web session when you are using a shared computer.</p></div>
                <form action="/logout" method="post"><button type="submit"><LogOut size={14} /> Sign out</button></form>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  )
}
