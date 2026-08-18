import { titleCase } from '@/lib/format'

export function StatusPill({ value }: { value: string | null | undefined }) {
  const normalized = (value ?? 'unknown').toLowerCase()
  const tone = ['active', 'joined', 'resolved', 'completed', 'closed', 'confirmed', 'yes', 'fulfilled', 'funded'].includes(normalized)
    ? 'positive'
    : ['open', 'pending', 'new', 'in_progress'].includes(normalized)
      ? 'warning'
      : ['banned', 'flagged', 'rejected', 'failed', 'no', 'declined', 'cancelled', 'removed'].includes(normalized)
        ? 'danger'
        : 'neutral'

  return <span className={`status-pill ${tone}`}>{titleCase(normalized)}</span>
}
