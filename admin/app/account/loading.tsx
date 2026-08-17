export default function AccountLoading() {
  return (
    <div className="member-route-loading" role="status" aria-label="Loading account section">
      <div className="member-loading-heading" />
      <div className="member-loading-copy" />
      <div className="member-loading-card">
        <div /><div /><div />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
