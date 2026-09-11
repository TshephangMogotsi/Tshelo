import type { EventFile } from '@shared/contracts'
import { confirmedGuestPreviews, guestInitials, overviewGalleryFiles } from '../overview'

function image(id: string, isBanner = false): EventFile {
  return {
    id,
    event_id: 'event-1',
    uploaded_by: 'user-1',
    object_path: `event-1/${id}`,
    file_name: `${id}.jpg`,
    content_type: 'image/jpeg',
    size_bytes: 100,
    is_banner: isBanner,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

describe('native event overview helpers', () => {
  it('generates local guest initials without profile data', () => {
    expect(guestInitials('Neo Kgosietsile')).toBe('NK')
    expect(guestInitials('  Lorato  ')).toBe('L')
    expect(guestInitials('')).toBe('G')
  })

  it('limits attendance previews to five confirmed guests', () => {
    const guests = Array.from({ length: 7 }, (_, index) => ({
      id: `${index}`,
      name: `Guest ${index}`,
      status: index === 1 ? 'pending' as const : 'confirmed' as const,
    }))
    expect(confirmedGuestPreviews(guests).map(guest => guest.id)).toEqual(['0', '2', '3', '4', '5'])
  })

  it('shows at most four images and keeps the already-featured banner last', () => {
    const files: EventFile[] = [
      image('banner', true),
      image('one'),
      { ...image('document'), content_type: 'application/pdf', file_name: 'document.pdf' },
      image('two'),
      image('three'),
      image('four'),
    ]
    expect(overviewGalleryFiles(files).map(file => file.id)).toEqual(['one', 'two', 'three', 'four'])
  })
})
