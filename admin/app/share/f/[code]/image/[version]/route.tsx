import { ImageResponse } from 'next/og'
import { getPublicFundPreview, normalizePreviewVersion, normalizePublicFundCode } from '@/lib/public-fund-preview'

type ImageRouteProps = { params: Promise<{ code: string; version: string }> }

export async function GET(_request: Request, { params }: ImageRouteProps) {
  const { code: rawCode, version: rawVersion } = await params
  const code = normalizePublicFundCode(rawCode)
  const version = rawVersion === 'current' ? null : normalizePreviewVersion(rawVersion)
  const preview = code ? await getPublicFundPreview(code, version) : null
  const title = preview?.title ?? 'Tshelo fund'
  const goal = preview?.goalAmount === null || !preview
    ? 'Community fund'
    : new Intl.NumberFormat('en-BW', { style: 'currency', currency: preview.currencyCode, maximumFractionDigits: 0 }).format(Number(preview.goalAmount))

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: '#ffffff', background: 'linear-gradient(135deg, #30106d 0%, #6925d2 58%, #8d4bf2 100%)', padding: '64px 72px' }}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: '-1px' }}>Tshelo</div>
      <div style={{ display: 'flex', marginTop: 80, fontSize: 24, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '4px', color: '#dfd1ff' }}>Community fund</div>
      <div style={{ display: 'flex', marginTop: 18, maxWidth: 940, fontSize: 72, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-3px' }}>{title}</div>
      <div style={{ display: 'flex', marginTop: 'auto', gap: 64 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ display: 'flex', fontSize: 21, color: '#dfd1ff' }}>Fund goal</span><strong style={{ display: 'flex', marginTop: 8, fontSize: 38 }}>{goal}</strong></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ display: 'flex', fontSize: 21, color: '#dfd1ff' }}>Members</span><strong style={{ display: 'flex', marginTop: 8, fontSize: 38 }}>{preview?.memberCount ?? '—'}</strong></div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  )
}
