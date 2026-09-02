type FundWorkspaceChangeListener = () => void

const listenersByFundId = new Map<string, Set<FundWorkspaceChangeListener>>()

/**
 * Lets an open fund workspace reload after a record is saved elsewhere in the
 * mobile app. This works for both standalone and event-linked fund screens.
 */
export function subscribeToFundWorkspaceChanges(
  fundId: string,
  listener: FundWorkspaceChangeListener,
) {
  const listeners = listenersByFundId.get(fundId) ?? new Set<FundWorkspaceChangeListener>()
  listeners.add(listener)
  listenersByFundId.set(fundId, listeners)

  return () => {
    const registered = listenersByFundId.get(fundId)
    if (!registered) return
    registered.delete(listener)
    if (registered.size === 0) listenersByFundId.delete(fundId)
  }
}

export function notifyFundWorkspaceChanged(fundId: string) {
  listenersByFundId.get(fundId)?.forEach(listener => listener())
}
