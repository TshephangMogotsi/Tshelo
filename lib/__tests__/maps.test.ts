import { isMapsUrl, mapsSearchUrl, normalizeMapsUrl } from '../maps'

describe('maps helpers', () => {
  test.each([
    'https://maps.app.goo.gl/abc123',
    'https://goo.gl/maps/abc123',
    'https://www.google.com/maps/place/Gaborone',
    'https://www.google.co.bw/maps/search/Cresta',
    'https://maps.apple.com/?q=Cresta+Lodge',
    'https://www.waze.com/ul?ll=-24.6%2C25.9',
  ])('recognises supported Maps URL %s', value => {
    expect(isMapsUrl(value)).toBe(true)
  })

  it('normalises a supported link pasted without a scheme', () => {
    expect(normalizeMapsUrl('maps.app.goo.gl/abc123')).toBe('https://maps.app.goo.gl/abc123')
  })

  test.each([
    'https://example.com/maps/place/Gaborone',
    'https://www.google.com/search?q=Gaborone',
    'Cresta Lodge, Gaborone',
    'javascript:alert(1)',
  ])('rejects non-Maps value %s', value => {
    expect(normalizeMapsUrl(value)).toBeNull()
  })

  it('builds an Apple Maps search URL on iOS', () => {
    expect(mapsSearchUrl('Cresta Lodge, Gaborone', 'ios'))
      .toBe('https://maps.apple.com/?q=Cresta%20Lodge%2C%20Gaborone')
  })

  it('builds a universal Google Maps search URL elsewhere', () => {
    expect(mapsSearchUrl('Cresta Lodge, Gaborone', 'android'))
      .toBe('https://www.google.com/maps/search/?api=1&query=Cresta%20Lodge%2C%20Gaborone')
  })
})
