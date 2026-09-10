import type { Metadata, Route } from 'next'
import { PolicyDocument } from '@/components/account-preferences/policy-document'
import { PRIVACY_POLICY } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'Read how Tshelo collects, uses, shares, and protects account and workspace information.',
}

export default function PrivacyPolicyPage() {
  return (
    <PolicyDocument
      {...PRIVACY_POLICY}
      relatedHref={'/account/preferences/service-data-processing' as Route}
      relatedLabel="service data processing"
    />
  )
}
