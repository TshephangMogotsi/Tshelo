import { sortEventAnnouncements } from '../announcements'

describe('native event announcement order', () => {
  it('keeps the single pinned update first and the remaining timeline newest-first', () => {
    const result = sortEventAnnouncements([
      { id: 'new', isPinned: false, createdAt: '2026-09-10T12:00:00Z' },
      { id: 'pinned', isPinned: true, createdAt: '2026-09-08T12:00:00Z' },
      { id: 'old', isPinned: false, createdAt: '2026-09-09T12:00:00Z' },
    ])
    expect(result.map(item => item.id)).toEqual(['pinned', 'new', 'old'])
  })
})
