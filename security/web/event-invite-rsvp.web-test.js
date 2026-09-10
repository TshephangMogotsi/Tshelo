jest.mock('@/lib/api-client', () => ({ createApiClient: () => ({ events: mockEvents }) }))
jest.mock('@/lib/home-summary-cache', () => ({ invalidateHomeSummary: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { JoinEventDialog } = require('@/components/account-events/join-event-dialog')
const { invalidateHomeSummary: mockInvalidateHomeSummary } = require('@/lib/home-summary-cache')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockEvents = { previewInvite: jest.fn(), respondRsvp: jest.fn() }
const mockReplace = jest.fn()
const code = 'INVITE-ABC123'
const preview = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Garden celebration',
  event_type: 'wedding',
  event_emoji: '💍',
  event_date: '2026-09-19',
  event_time: '14:30:00',
  venue_name: 'Garden Hall',
  status: 'active',
  organiser_name: 'Kago',
  has_linked_fund: false,
  already_joined: false,
  allowed_plus_ones: 2,
}

let root
let container
const button = name => [...document.querySelectorAll('button')].find(node => node.textContent.trim().startsWith(name))

async function render(value = preview) {
  mockEvents.previewInvite.mockResolvedValue(value)
  await act(async () => { root.render(<JoinEventDialog initialCode={code} onClose={jest.fn()} />) })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockEvents.respondRsvp.mockResolvedValue({ id: 'guest-1' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it('shows the personal allowance and submits no more than the available plus-ones', async () => {
  await render()
  expect(document.body.textContent).toContain('This invitation is for you and up to 2 additional guests.')

  await act(async () => button('Yes').click())
  const select = document.querySelector('.member-rsvp-plus-ones select')
  expect([...select.options].map(option => option.value)).toEqual(['0', '1', '2'])

  await act(async () => {
    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(document.querySelectorAll('.member-rsvp-plus-ones input')).toHaveLength(2)

  await act(async () => button('Save RSVP and open event').click())
  expect(mockEvents.respondRsvp).toHaveBeenCalledWith(preview.id, {
    code,
    status: 'yes',
    plus_ones: 2,
    plus_ones_names: [],
  })
  expect(mockReplace).toHaveBeenCalledWith(`/account/events/${preview.id}?joined=1`)
})

it('makes a zero allowance clear and does not offer a guest selector', async () => {
  await render({ ...preview, allowed_plus_ones: 0 })
  expect(document.body.textContent).toContain('This invitation is for you only.')
  await act(async () => button('Yes').click())
  expect(document.querySelector('.member-rsvp-plus-ones')).toBeNull()
})
