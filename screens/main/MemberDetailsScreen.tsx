import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ConfettiCannon } from 'confetti-cannon-burst-rn-expo'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { api } from '../../lib/api'
import { runApiRead } from '../../lib/apiScreen'
import type { AppColors } from '../../theme/themes'
import { formatMoney } from './fundDetail/types'
import { initials } from './richAuntie/reasons'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'MemberDetails'>
  route: RouteProp<MainStackParamList, 'MemberDetails'>
}

type AwardSummary = {
  id: string
  reason_label: string
  created_at: string
}

const RICH_AUNTIE_CONFETTI_COLORS = [
  '#7B2CFF',
  '#A86BFF',
  '#F4A300',
  '#FFD84D',
  '#00A676',
  '#5AC8FA',
  '#FF78B7',
]

export default function MemberDetailsScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const {
    fundId,
    fundTitle,
    currencyCode,
    memberUserId,
    memberId,
    memberName,
    memberPhone,
    canAward,
  } = route.params

  const [totalGiven, setTotalGiven] = useState(0)
  const [pledged, setPledged] = useState(0)
  const [awards, setAwards] = useState<AwardSummary[]>([])
  const [sponsoredItems, setSponsoredItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confettiBurstKey, setConfettiBurstKey] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()

    async function load() {
      setIsLoading(true)
      try {
        const details = await runApiRead(call => api.funds.getMember(fundId, memberId, call), { signal: controller.signal })
        if (controller.signal.aborted) return
        setTotalGiven(Number(details.confirmed_total))
        setPledged(Number(details.pledged_total))
        setAwards(details.awards as AwardSummary[])
        setSponsoredItems(details.sponsored_items.map(row => row.title))
        if (details.awards.length > 0) setConfettiBurstKey(previous => previous + 1)
      } catch (error) {
        if (!controller.signal.aborted) Alert.alert('Could not load member details', error instanceof Error ? error.message : 'Please try again.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [fundId, memberId]))

  async function sendWhatsApp() {
    const digits = memberPhone.replace(/\D/g, '')
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${memberName}, regarding ${fundTitle}…`)}`
    const supported = await Linking.canOpenURL(url)
    if (!supported) {
      Alert.alert('WhatsApp unavailable', 'WhatsApp could not be opened on this device.')
      return
    }
    await Linking.openURL(url)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(memberName)}</Text>
          {awards.length > 0 && (
            <View style={styles.crownBadge}><Text style={styles.crownBadgeText}>♛</Text></View>
          )}
        </View>
        <Text style={styles.name}>{memberName}</Text>
        <Text style={styles.phone}>{memberPhone}</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.contributionCard}>
              <Text style={styles.cardEyebrow}>CONTRIBUTION TO THIS FUND</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amount}>{formatMoney(totalGiven, currencyCode)}</Text>
                <Text style={styles.paidStatus}>{pledged > 0 ? `${formatMoney(pledged, currencyCode)} pledged` : 'Recorded'}</Text>
              </View>
            </View>

            {sponsoredItems.length > 0 && (
              <View style={[styles.infoCard, styles.sponsorshipCard]}>
                <Text style={[styles.infoTitle, styles.sponsorshipTitle]}>Sponsorship items</Text>
                <Text style={styles.infoText}>{sponsoredItems.join(' · ')}</Text>
              </View>
            )}

            {awards.length > 0 && (
              <View style={[styles.infoCard, styles.richAuntieCard]}>
                <Text style={[styles.infoTitle, styles.richAuntieTitle]}>Rich Auntie recognition</Text>
                {awards.map(award => (
                  <View key={award.id} style={styles.awardRow}>
                    <Text style={styles.awardCrown}>♛</Text>
                    <Text style={styles.awardReason}>{award.reason_label}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {canAward && (
          <TouchableOpacity
            style={styles.awardButton}
            onPress={() => navigation.navigate('AwardRichAuntie', {
              fundId,
              fundTitle,
              currencyCode,
              memberUserId,
              memberName,
            })}
          >
            <Text style={styles.awardButtonIcon}>♛</Text>
            <Text style={styles.awardButtonText}>Award Rich Auntie</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={sendWhatsApp}>
          <Ionicons name="logo-whatsapp" size={19} color={colors.success} />
          <Text style={styles.actionButtonText}>Send WhatsApp</Text>
        </TouchableOpacity>
      </ScrollView>
      <ConfettiCannon
        burstKey={confettiBurstKey}
        count={100}
        colors={RICH_AUNTIE_CONFETTI_COLORS}
        shapes={['rect']}
      />
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    content: { paddingHorizontal: 22, paddingBottom: 44, alignItems: 'stretch' },
    avatar: {
      alignSelf: 'center',
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    avatarText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
    crownBadge: {
      position: 'absolute',
      right: -3,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#F4A300',
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crownBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    name: { marginTop: 14, textAlign: 'center', fontSize: 21, fontWeight: '800', color: colors.textPrimary },
    phone: { marginTop: 4, marginBottom: 22, textAlign: 'center', fontSize: 13, color: colors.textMuted },
    loader: { marginVertical: 36 },
    contributionCard: {
      backgroundColor: colors.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 17,
      marginBottom: 13,
    },
    cardEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: colors.primary },
    amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
    amount: { fontSize: 24, fontWeight: '900', color: colors.success },
    paidStatus: { fontSize: 12, color: colors.textMuted },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 12,
    },
    sponsorshipCard: {
      backgroundColor: '#DCFCE7',
      borderColor: '#22C55E',
      borderWidth: 1.5,
    },
    sponsorshipTitle: { color: '#15803D' },
    richAuntieCard: {
      backgroundColor: '#FFF3C4',
      borderColor: '#F4A300',
      borderWidth: 1.5,
      shadowColor: '#C77800',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 5,
      elevation: 2,
    },
    infoTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
    richAuntieTitle: { color: '#9A5B00' },
    infoText: { marginTop: 5, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
    awardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
    awardCrown: { color: '#F4A300', fontSize: 16 },
    awardReason: { flex: 1, fontSize: 13, color: colors.textSecondary },
    awardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: '#F4A300',
      backgroundColor: '#FFF7D6',
      paddingVertical: 15,
      marginTop: 5,
    },
    awardButtonIcon: { color: '#F4A300', fontSize: 20, fontWeight: '900' },
    awardButtonText: { color: '#D98A00', fontSize: 15, fontWeight: '900' },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 15,
      marginTop: 12,
    },
    actionButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  })
}
