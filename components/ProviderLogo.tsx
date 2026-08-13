import { Image, View } from 'react-native'

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
  variant?: 'wordmark' | 'mark'
}

export default function ProviderLogo({ provider, size = 34, width, variant = 'wordmark' }: Props) {
  if (!provider || !(provider in LOGOS)) return null

  const ratio = ASPECT_RATIO[provider]
  if (variant === 'mark') {
    const markBackground = provider === 'myzaka' ? '#FFE100' : '#FFFFFF'
    const imageStyle = provider === 'smega'
      ? { width: size * ratio, height: size, left: 0, top: 0 }
      : provider === 'orange_money'
        ? { width: size * 1.88, height: size * 0.5, left: 0, top: size * 0.25 }
        : { width: size * 0.84, height: size * 0.28, left: size * 0.08, top: size * 0.36 }

    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: markBackground }}>
        <Image source={LOGOS[provider]} style={[{ position: 'absolute' }, imageStyle]} resizeMode="contain" />
      </View>
    )
  }

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
