import { Image, StyleSheet, View } from 'react-native'

const LOGOS: Record<string, number> = {
  orange_money: require('../assets/mobile_money_providers_logos/orange_money_logo.png'),
  myzaka:       require('../assets/mobile_money_providers_logos/myzaka_logo.png'),
  smega:        require('../assets/mobile_money_providers_logos/smega_logo.png'),
}

export function hasProviderLogo(provider: string | null | undefined): boolean {
  return !!provider && provider in LOGOS
}

type Props = {
  provider: string | null | undefined
  size?: number
  // bare logo without the white chip — for tiny inline placements
  plain?: boolean
}

// Brand marks sit on a white chip so they stay legible in dark mode
// (Orange Money's black arrow disappears on dark backgrounds)
export default function ProviderLogo({ provider, size = 34, plain = false }: Props) {
  if (!provider || !(provider in LOGOS)) return null
  const source = LOGOS[provider]

  if (plain) {
    return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
  }

  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Image
        source={source}
        style={{ width: size * 0.66, height: size * 0.66 }}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
  },
})
