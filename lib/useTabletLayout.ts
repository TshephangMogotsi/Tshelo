import { useWindowDimensions } from 'react-native'

/** A 600dp smallest width is Android's conventional large-screen breakpoint. */
export const TABLET_SMALLEST_WIDTH = 600

export function useTabletLayout() {
  const { width, height } = useWindowDimensions()
  const isTablet = Math.min(width, height) >= TABLET_SMALLEST_WIDTH

  return { width, height, isTablet }
}
