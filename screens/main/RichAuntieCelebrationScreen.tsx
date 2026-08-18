import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import type { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { api } from '../../lib/api'
import { runApiRead } from '../../lib/apiScreen'
import { initials } from './richAuntie/reasons'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RichAuntieCelebration'>
  route: RouteProp<MainStackParamList, 'RichAuntieCelebration'>
}

type Celebration = {
  recipientName: string
  fundTitle: string
  reason: string
  organiserName: string
  isRecipient: boolean
}

export default function RichAuntieCelebrationScreen({ navigation, route }: Props) {
  const { colors } = useTheme()
  const [details, setDetails] = useState<Celebration | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    async function load() {
      try {
        const celebration = await runApiRead(
          call => api.richAuntie.celebration(route.params.awardId, call),
          { signal: controller.signal },
        )
        if (!active) return
        setDetails({
          recipientName: celebration.award.recipient_name,
          fundTitle: celebration.award.fund_title,
          reason: celebration.award.reason_label,
          organiserName: celebration.award.awarded_by_name,
          isRecipient: celebration.is_recipient,
        })
      } catch {
        if (active) setLoadFailed(true)
      }
    }
    load()
    return () => { active = false; controller.abort() }
  }, [route.params.awardId])

  function done() {
    if (details?.isRecipient || route.params.recipientView) {
      navigation.replace('RichAuntieStatus')
      return
    }
    navigation.goBack()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#7652DC" />
      {!details && !loadFailed ? (
        <ActivityIndicator size="large" color="#FFFFFF" />
      ) : loadFailed ? (
        <>
          <Text style={styles.title}>Award unavailable</Text>
          <Text style={styles.subtitle}>This Rich Auntie award could not be loaded.</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneText}>Go back</Text>
          </TouchableOpacity>
        </>
      ) : details ? (
        <>
          <View style={styles.center}>
            <Text style={styles.largeCrown}>♛</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(details.recipientName)}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>♛</Text></View>
            </View>
            <Text style={styles.title}>
              {details.isRecipient ? 'You’re a Rich Auntie!' : 'Rich Auntie Awarded!'}
            </Text>
            <Text style={styles.subtitle}>
              {details.isRecipient
                ? `${details.organiserName} recognised you in ${details.fundTitle}`
                : `${details.recipientName} is now recognised in ${details.fundTitle}`
              }
            </Text>
            <View style={styles.reasonCard}>
              <Text style={styles.reason}>{details.reason}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={done}>
            <Text style={styles.doneText}>{details.isRecipient ? 'View my status' : 'Done'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#7652DC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 22,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  largeCrown: { color: '#F4A300', fontSize: 66, lineHeight: 70, marginBottom: 18 },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#7652DC', fontSize: 31, fontWeight: '900' },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4A300',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7652DC',
  },
  badgeText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  title: { marginTop: 28, fontSize: 25, lineHeight: 32, fontWeight: '900', textAlign: 'center', color: '#FFFFFF' },
  subtitle: { marginTop: 12, maxWidth: 310, fontSize: 15, lineHeight: 23, textAlign: 'center', color: '#E8DEFF' },
  reasonCard: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  reason: { color: '#FFD05A', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  doneButton: {
    width: '100%',
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 16,
  },
  doneText: { color: '#7652DC', fontSize: 16, fontWeight: '900' },
})
