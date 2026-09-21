import { fundShareUrl } from '@shared/invitations'

type FundShareCardOptions = {
  code: string
  fundTitle: string
  updatedAt?: string | null
  text: string
}

function imageUrl(code: string, updatedAt?: string | null) {
  const shareUrl = new URL(fundShareUrl(code, updatedAt))
  const version = shareUrl.searchParams.get('v') ?? 'current'
  return `${shareUrl.origin}${shareUrl.pathname}/image/${encodeURIComponent(version)}`
}

function filename(title: string) {
  const safeTitle = title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${safeTitle || 'tshelo-fund'}-share-card.png`
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Prefer a file share over a link-only share so WhatsApp receives an actual
 * branded image instead of having to finish its own link-preview request.
 */
export async function shareFundCard(options: FundShareCardOptions): Promise<'shared' | 'downloaded'> {
  const response = await fetch(imageUrl(options.code, options.updatedAt), { cache: 'no-store' })
  if (!response.ok) throw new Error('The branded fund card could not be prepared.')

  const file = new File([await response.blob()], filename(options.fundTitle), { type: 'image/png' })
  const shareData = {
    title: options.fundTitle,
    text: `${options.text} ${fundShareUrl(options.code, options.updatedAt)}`,
    files: [file],
  }

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(shareData)
    return 'shared'
  }

  download(file)
  return 'downloaded'
}
