import fs from 'fs'
import path from 'path'

const styles = fs.readFileSync(path.join(__dirname, '../../admin/app/globals.css'), 'utf8')
const eventWorkspace = fs.readFileSync(path.join(__dirname, '../../admin/components/account-events/event-workspace.tsx'), 'utf8')

function tokens(selector: string) {
  const start = styles.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const rule = styles.slice(start, styles.indexOf('}', start))
  return Object.fromEntries([...rule.matchAll(/(--[\w-]+):\s*(#[\da-f]{3,6})\s*;/gi)].map(match => [match[1], match[2]]))
}

function rgb(hex: string) {
  const value = hex.slice(1)
  const expanded = value.length === 3 ? [...value].map(char => char + char).join('') : value
  return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16))
}

function luminance(color: number[]) {
  const linear = color.map(channel => {
    const value = channel / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
}

describe('event list hover contrast', () => {
  it('uses a restrained theme-relative tint and preserves keyboard focus', () => {
    expect(styles).toContain('.member-event-row:hover { background: color-mix(in srgb, var(--paper) 94%, var(--purple) 6%); }')
    expect(styles).toContain('.member-event-row:focus-visible { outline: 3px solid var(--purple-line); outline-offset: 2px; }')
  })

  it.each(['light', 'dark'])('keeps event titles and secondary text readable in %s mode', theme => {
    const palette = {
      ...tokens(':root'), ...tokens('.tshelo-dashboard'),
      ...(theme === 'dark' ? { ...tokens("html[data-account-theme='dark']"), ...tokens("html[data-account-theme='dark'] .tshelo-dashboard") } : {}),
    }
    const paper = rgb(palette['--paper'])
    const accent = rgb(palette['--purple'])
    const hover = paper.map((channel, index) => channel * .94 + accent[index] * .06)
    expect(Math.max(...hover.map((channel, index) => Math.abs(channel - paper[index])))).toBeLessThan(16)
    for (const text of ['--ink', '--muted']) {
      const foreground = luminance(rgb(palette[text]))
      const background = luminance(hover)
      expect((Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('event workspace tab height', () => {
  it('reserves a shared responsive canvas without fixing content height', () => {
    expect(styles).toContain('#event-workspace-panel { min-height: min(620px, 68vh); }')
    expect(styles).toContain('#event-workspace-panel > .member-card:only-child { min-height: min(620px, 68vh); display: grid; grid-template-rows: auto minmax(0, 1fr); }')
    expect(styles).toContain('#event-workspace-panel > .member-card:only-child > .member-card-body:has(> .member-announcement-empty:only-child) { display: grid; place-items: center; }')
    expect(styles).toContain('#event-workspace-panel, #event-workspace-panel > .member-card:only-child { min-height: 0; }')
  })

  it('does not constrain announcements to the event-list two-column layout', () => {
    expect(eventWorkspace).not.toContain('className="member-card-body member-events-workspace"')
  })

  it('uses a restrained brand tint for the event summary strip', () => {
    expect(styles).toContain('.member-event-date-strip { min-height: 48px; display: flex; align-items: center; gap: 0; padding: 0 24px; color: var(--ink-soft); background: color-mix(in srgb, var(--paper) 94%, var(--purple) 6%);')
  })

  it('shows the invitation code once in the top event card', () => {
    expect(eventWorkspace).toContain('className="member-event-invite-code"><span>Invitation code</span><strong>{inviteCode}</strong>')
    expect(eventWorkspace.match(/<span>Invitation code<\/span>/g)).toHaveLength(1)
    expect(eventWorkspace).toContain('navigator.clipboard.writeText(inviteCode)')
    expect(eventWorkspace).toContain('aria-label="Copy invitation code"')
    expect(eventWorkspace).toContain('navigator.share({ title: event.name, url: inviteLink })')
    expect(eventWorkspace).not.toContain('text: `Join ${event.name} on Tshelo`')
    expect(eventWorkspace).not.toContain("'Manage event'")
  })
})

describe('guest search focus styling', () => {
  it('keeps the focus treatment on the rounded search container', () => {
    expect(styles).toContain('.member-guest-toolbar form:focus-within { background: var(--paper); border-color: var(--purple); box-shadow: 0 0 0 3px rgba(112,63,151,.1); }')
    expect(styles).toContain('.member-main .member-guest-toolbar form > input:focus { min-width: 0; min-height: 0; flex: 1; padding: 9px 0; color: var(--ink); background: transparent !important; border: 0; border-radius: 0; outline: 0; box-shadow: none !important;')
  })
})
