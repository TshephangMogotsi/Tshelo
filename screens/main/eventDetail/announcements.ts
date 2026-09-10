export type NativeAnnouncementOrder = {
  isPinned: boolean
  createdAt: string
}

export function sortEventAnnouncements<T extends NativeAnnouncementOrder>(announcements: T[]) {
  return [...announcements].sort((first, second) => (
    Number(second.isPinned) - Number(first.isPinned)
      || Date.parse(second.createdAt) - Date.parse(first.createdAt)
  ))
}
