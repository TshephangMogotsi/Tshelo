import { Image } from 'react-native'

const LOGOS: Record<string, number> = {
  orange_money: require('../assets/mobile_money_providers_logos/orange_money_logo.png'),
  myzaka:       require('../assets/mobile_money_providers_logos/myzaka_logo.png'),
  smega:        require('../assets/mobile_money_providers_logos/smega_logo.png'),
}

// Source PNGs are wide wordmark lockups, not square — size by width and
// let height follow the real aspect ratio instead of forcing a square box.
const ASPECT_RATIO: Record<string, number> = {
  orange_money: 500 / 134,
  myzaka:       240 / 80,
  smega:        500 / 161,
}

export function hasProviderLogo(provider: string | null | undefined): boolean {
  return !!provider && provider in LOGOS
}

type Props = {
  provider: string | null | undefined
  size?: number
  // fix the width instead of the height — height then follows the aspect
  // ratio, so wide banner-style logos (MyZaka) end up short and square-ish
  // ones (Smega) end up tall, all sharing the same footprint in a row
  width?: number
  // kept for call-site compatibility — logos are always rendered bare now
  plain?: boolean
}

export default function ProviderLogo({ provider, size = 34, width }: Props) {
  if (!provider || !(provider in LOGOS)) return null

  const ratio = ASPECT_RATIO[provider]
  // Precompute both dimensions as plain numbers rather than leaning on the
  // `aspectRatio` layout property with only one side pinned — that combo is
  // unreliable inside a flex row (the derived side can resolve before the
  // row has settled, clipping tall/narrow logos like Smega and Orange Money).
  const resolvedWidth  = width != null ? width : size * ratio
  const resolvedHeight = width != null ? width / ratio : size

  return (
    <Image
      source={LOGOS[provider]}
      style={{ width: resolvedWidth, height: resolvedHeight }}
      resizeMode="contain"
    />
  )
}
