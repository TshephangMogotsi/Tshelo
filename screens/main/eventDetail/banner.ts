export type ImageSize = { width: number; height: number }
export type ImageFrame = ImageSize & { left: number; top: number }

export function clampFocalCoordinate(value: number) {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}

export function coverImageFrame(container: ImageSize, source: ImageSize, focalX: number, focalY: number): ImageFrame | null {
  if (container.width <= 0 || container.height <= 0 || source.width <= 0 || source.height <= 0) return null
  const scale = Math.max(container.width / source.width, container.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return {
    width,
    height,
    left: width === container.width ? 0 : -(width - container.width) * clampFocalCoordinate(focalX),
    top: height === container.height ? 0 : -(height - container.height) * clampFocalCoordinate(focalY),
  }
}

export function containImageFrame(container: ImageSize, source: ImageSize): ImageFrame | null {
  if (container.width <= 0 || container.height <= 0 || source.width <= 0 || source.height <= 0) return null
  const scale = Math.min(container.width / source.width, container.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return {
    width,
    height,
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
  }
}

export function focalPointFromPress(locationX: number, locationY: number, frame: ImageFrame) {
  return {
    x: clampFocalCoordinate((locationX - frame.left) / frame.width),
    y: clampFocalCoordinate((locationY - frame.top) / frame.height),
  }
}
