import type { EventFile } from '@shared/contracts'

export type OverviewGuest = {
  id: string
  name: string
  status: 'confirmed' | 'pending' | 'declined'
}

export function guestInitials(name: string) {
  const words = (name || 'Guest').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'G'
}

export function confirmedGuestPreviews(guests: OverviewGuest[], limit = 5) {
  return guests.filter(guest => guest.status === 'confirmed').slice(0, limit)
}

export function overviewGalleryFiles(files: EventFile[], limit = 4) {
  return files
    .filter(file => file.content_type.startsWith('image/'))
    .sort((first, second) => Number(Boolean(first.is_banner)) - Number(Boolean(second.is_banner)))
    .slice(0, limit)
}
