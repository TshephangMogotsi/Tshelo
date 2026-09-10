import type { Metadata, Route } from 'next'
import { PolicyDocument } from '@/components/account-preferences/policy-document'
import { TERMS_OF_SERVICE } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: { absolute: 'Tshelo Terms of Service' },
  description: 'Read the terms that apply when using Tshelo to organise funds, events, and shared records.',
}

export default function TermsOfServicePage() {
  return (
    <PolicyDocument
      {...TERMS_OF_SERVICE}
      backHref={'/login' as Route}
      backLabel="Back to Tshelo"
      eyebrow="Tshelo legal"
      contactPrompt="Questions about these terms?"
      relatedHref={'/legal/privacy' as Route}
      relatedLabel="privacy policy"
    />
  )
}
