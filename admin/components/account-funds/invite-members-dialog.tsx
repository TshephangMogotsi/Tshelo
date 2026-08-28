'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type InviteMembersDialogProps = {
  code: string
  fundTitle: string
  memberCount: number
  onClose: () => void
}

export function InviteMembersDialog({ code, fundTitle, memberCount, onClose }: InviteMembersDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const relativeInviteUrl = useMemo(() => `/account/funds?joinCode=${encodeURIComponent(code)}`, [code])
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
    const inviteUrl = new URL(relativeInviteUrl, window.location.origin).toString()
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function share(channel: 'whatsapp' | 'sms') {
    const inviteUrl = new URL(relativeInviteUrl, window.location.origin).toString()
    const message = encodeURIComponent(`${shareText} ${inviteUrl}`)
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer')
    else window.location.href = `sms:?&body=${message}`
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
              <code>{relativeInviteUrl}</code>
              <button className="copybtn" type="button" onClick={copyInvite}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="sharegrid">
              <button type="button" onClick={() => share('whatsapp')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5l1.4-4.6A8.2 8.2 0 1112 20.2a8.2 8.2 0 01-4.2-1.15z" /></svg>WhatsApp</button>
              <button type="button" onClick={() => share('sms')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>SMS</button>
            </div>
            <div className="mnote"><b>{memberCount} member{memberCount === 1 ? '' : 's'} currently in this fund.</b> Share this invite only with people who should be able to see the fund&apos;s financial activity.</div>
          </div>
          <footer><button className="btn purple" type="button" onClick={onClose}>Done</button></footer>
        </section>
      </div>
    </div>
  )
}
