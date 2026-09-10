import { clampFocalCoordinate, containImageFrame, coverImageFrame, focalPointFromPress } from '../banner'

describe('native event banner positioning', () => {
  it('crops a portrait image around its normalized focal point', () => {
    expect(coverImageFrame(
      { width: 400, height: 100 },
      { width: 200, height: 400 },
      0.5,
      0.75,
    )).toEqual({ width: 400, height: 800, left: 0, top: -525 })
  })

  it('fits a full image and maps a press back to source coordinates', () => {
    const frame = containImageFrame({ width: 400, height: 300 }, { width: 400, height: 200 })
    expect(frame).toEqual({ width: 400, height: 200, left: 0, top: 50 })
    expect(focalPointFromPress(100, 100, frame!)).toEqual({ x: 0.25, y: 0.25 })
  })

  it('bounds invalid and out-of-range focal values', () => {
    expect(clampFocalCoordinate(-1)).toBe(0)
    expect(clampFocalCoordinate(2)).toBe(1)
    expect(clampFocalCoordinate(Number.NaN)).toBe(0.5)
  })
})
