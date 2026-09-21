import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicFundPreview, normalizePreviewVersion, normalizePublicFundCode } from '@/lib/public-fund-preview'
import styles from './share-page.module.css'

const SITE_URL = 'https://app.tshelo.com'

type SharePageProps = {
  params: Promise<{ code: string }>
  searchParams: Promise<{ v?: string | string[] }>
}

function shareUrl(code: string, version: string | null) {
  const url = new URL(`/share/f/${encodeURIComponent(code)}`, SITE_URL)
  if (version) url.searchParams.set('v', version)
  return url.toString()
}

function imageUrl(code: string, version: string | null) {
  return `${SITE_URL}/share/f/${encodeURIComponent(code)}/image/${version ?? 'current'}`
}

export async function generateMetadata({ params, searchParams }: SharePageProps): Promise<Metadata> {
  const { code: rawCode } = await params
  const { v } = await searchParams
  const code = normalizePublicFundCode(rawCode)
  const version = normalizePreviewVersion(v)
  const preview = code ? await getPublicFundPreview(code, version) : null
  if (!preview) return { title: 'Fund unavailable · Tshelo', robots: { index: false, follow: false } }

  const title = `Contribute to ${preview.title} · Tshelo`
  const url = shareUrl(preview.code, version)
  return {
    title: { absolute: title },
    description: preview.description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      url,
      siteName: 'Tshelo',
      title,
      description: preview.description,
      images: [{ url: imageUrl(preview.code, version), width: 1200, height: 630, alt: `${preview.title} fund summary` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: preview.description,
      images: [imageUrl(preview.code, version)],
    },
  }
}

export default async function FundSharePage({ params, searchParams }: SharePageProps) {
  const { code: rawCode } = await params
  const { v } = await searchParams
  const code = normalizePublicFundCode(rawCode)
  const preview = code ? await getPublicFundPreview(code, normalizePreviewVersion(v)) : null
  if (!preview) notFound()

  const goal = preview.goalAmount === null
    ? 'Community fund'
    : new Intl.NumberFormat('en-BW', { style: 'currency', currency: preview.currencyCode, maximumFractionDigits: 0 }).format(Number(preview.goalAmount))

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Tshelo home">Tshelo</Link>
        <p className={styles.eyebrow}>Community fund</p>
        <h1>{preview.title}</h1>
        <p className={styles.description}>{preview.description}</p>
        <dl className={styles.stats}>
          <div><dt>Fund goal</dt><dd>{goal}</dd></div>
          <div><dt>Members</dt><dd>{preview.memberCount}</dd></div>
        </dl>
        <a className={styles.cta} href={preview.invitationUrl}>Open fund in Tshelo</a>
        <p className={styles.note}>Organised by {preview.organiserName}. You can review the fund before joining.</p>
      </section>
    </main>
  )
}
