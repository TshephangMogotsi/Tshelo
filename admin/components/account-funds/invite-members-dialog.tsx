'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fundShareUrl } from '@shared/invitations'
import { shareFundCard } from '@/lib/fund-share-card'

type InviteMembersDialogProps = {
  code: string
  fundTitle: string
  memberCount: number
  updatedAt?: string | null
  onClose: () => void
}

export function InviteMembersDialog({ code, fundTitle, memberCount, updatedAt, onClose }: InviteMembersDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const [cardStatus, setCardStatus] = useState('')
  const [preparingCard, setPreparingCard] = useState(false)
  const inviteUrl = useMemo(() => fundShareUrl(code, updatedAt), [code, updatedAt])
  const shareText = `Join ${fundTitle} on Tshelo with invite code ${code}.`

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', escape)
    }
  }, [onClose])

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function share(channel: 'whatsapp' | 'sms') {
    const message = encodeURIComponent(`${shareText} ${inviteUrl}`)
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer')
    else window.location.href = `sms:?&body=${message}`
  }

  async function shareBrandedCard() {
    setPreparingCard(true)
    setCardStatus('')
    try {
      const result = await shareFundCard({ code, fundTitle, updatedAt, text: shareText })
      setCardStatus(result === 'shared'
        ? 'Your branded card and fund link are ready to send.'
        : 'Your branded card was downloaded. Attach it in WhatsApp, then paste the link above.')
    } catch {
      setCardStatus('Could not prepare the branded card. Please try again.')
    } finally {
      setPreparingCard(false)
    }
  }

  return (
    <div className="tshelo-dashboard modal-root">
      <div className="overlay on" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="invite-members-title">
          <header>
            <span className="itile sm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5a6.4 6.4 0 0112.4 0M16.2 6a3.3 3.3 0 010 6M17.4 14.2a6.4 6.4 0 013.8 5.3" /></svg></span>
            <h3 id="invite-members-title">Invite members</h3>
            <button ref={closeButton} className="x" type="button" onClick={onClose} aria-label="Close invite dialog">&times;</button>
          </header>
          <div className="mbody">
            <div className="invite-copy">Members can see every contribution and every expense on this fund. Only invite people who should.</div>
            <div className="linkbox">
              <code>{inviteUrl}</code>
              <button className="copybtn" type="button" onClick={copyInvite}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="sharegrid">
              <button type="button" onClick={shareBrandedCard} disabled={preparingCard}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM7 15l3-3 2 2 3-4 2 5" /></svg>{preparingCard ? 'Preparing…' : 'Share branded card'}</button>
              <button type="button" onClick={() => share('whatsapp')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5l1.4-4.6A8.2 8.2 0 1112 20.2a8.2 8.2 0 01-4.2-1.15z" /></svg>WhatsApp link</button>
              <button type="button" onClick={() => share('sms')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>SMS</button>
            </div>
            {cardStatus && <p className="member-form-note share-card-status" role="status">{cardStatus}</p>}
            <div className="mnote"><b>{memberCount} member{memberCount === 1 ? '' : 's'} currently in this fund.</b> Use Share branded card for a consistent image; WhatsApp link previews can take a moment to load.</div>
          </div>
          <footer><button className="btn purple" type="button" onClick={onClose}>Done</button></footer>
        </section>
      </div>
    </div>
  )
}
