'use client'

import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'

type CopyLinkButtonProps = {
  href: string
  label: string
}

export function CopyLinkButton({ href, label }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button className="member-copy-link" type="button" onClick={copy} aria-label={label}>
      {copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
