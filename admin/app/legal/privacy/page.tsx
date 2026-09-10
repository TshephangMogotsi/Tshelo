import type { Metadata, Route } from 'next'
import { PolicyDocument } from '@/components/account-preferences/policy-document'
import { PRIVACY_POLICY } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: { absolute: 'Tshelo Privacy Policy' },
  description: 'Read how Tshelo collects, uses, shares, and protects account and workspace information.',
}

export default function PublicPrivacyPolicyPage() {
  return (
    <PolicyDocument
      {...PRIVACY_POLICY}
      backHref={'/login' as Route}
      backLabel="Back to Tshelo"
      relatedHref={'/legal/terms' as Route}
      relatedLabel="terms of service"
    />
  )
}
