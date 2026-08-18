import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { runApiRead } from '../../lib/apiScreen'
import type { AppColors } from '../../theme/themes'
import { formatMoney } from './fundDetail/types'
import { initials } from './richAuntie/reasons'
import { richAuntieHeroTitle } from './richAuntie/status'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RichAuntieStatus'>
}

type Award = {
  id: string
  fund_id: string
  reason_label: string
  created_at: string
  fundTitle: string
}

export default function RichAuntieStatusScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { userName } = useAuth()
  const styles = makeStyles(colors)
  const [cashGiven, setCashGiven] = useState(0)
  const [fundCount, setFundCount] = useState(0)
  const [awards, setAwards] = useState<Award[]>([])
  const [awardCount, setAwardCount] = useState(0)
  const [isConsistentContributor, setIsConsistentContributor] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useFocusEffect(useCallback(() => {
    let active = true
    const controller = new AbortController()
    async function load() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const status = await runApiRead(
          call => api.richAuntie.status(call),
          { signal: controller.signal },
        )
        if (!active) return
        setCashGiven(Number(status.cash_given))
        setFundCount(status.fund_count)
        setIsConsistentContributor(status.is_consistent_contributor)
        setAwardCount(status.award_count)
        setAwards(status.awards.map(award => ({
          id: award.id,
          fund_id: award.fund_id,
          reason_label: award.reason_label,
          created_at: award.created_at,
          fundTitle: award.fund_title,
        })))
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => { active = false; controller.abort() }
  }, []))

  async function shareStatus() {
    await Share.share({
      message: `♛ I’ve been recognised as a Rich Auntie on Tshelo — ${awardCount} award${awardCount === 1 ? '' : 's'} across ${fundCount} fund${fundCount === 1 ? '' : 's'}.`,
    })
  }

  const isRichAuntie = awardCount > 0

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#7652DC" />
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.backButton} />
        </View>
        {isRichAuntie
          ? <Text style={styles.crown}>♛</Text>
          : <Ionicons name="ribbon-outline" size={40} color="#E8DEFF" />
        }
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(userName)}</Text>
          {isRichAuntie && (
            <View style={styles.badge}><Text style={styles.badgeText}>♛</Text></View>
          )}
        </View>
        <Text style={styles.heroTitle}>{richAuntieHeroTitle(isLoading, awardCount)}</Text>
        {!isLoading && !isRichAuntie && !loadError && (
          <Text style={styles.heroSubtitle}>Awards from your fund organisers will appear here.</Text>
        )}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
        ) : loadError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Couldn’t load your status</Text>
            <Text style={styles.emptyText}>Check your connection and try opening this page again.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsCard}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{formatMoney(cashGiven, 'BWP')}</Text>
                <Text style={styles.statLabel}>Cash given</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.success }]}>{fundCount}</Text>
                <Text style={styles.statLabel}>Funds helped</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: '#F4A300' }]}>{awardCount}</Text>
                <Text style={styles.statLabel}>Awards</Text>
              </View>
            </View>

            {isRichAuntie && (
              <TouchableOpacity style={styles.shareButton} onPress={shareStatus}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share my status</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Your achievements</Text>
            {isConsistentContributor && (
              <View style={styles.achievement}>
                <View style={[styles.achievementIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="repeat-outline" size={19} color={colors.primary} />
                </View>
                <Text style={styles.achievementText}>Consistent Contributor</Text>
                <View style={styles.autoBadge}><Text style={styles.autoBadgeText}>AUTO</Text></View>
              </View>
            )}
            {awards.map(award => (
              <View key={award.id} style={styles.achievement}>
                <View style={[styles.achievementIcon, { backgroundColor: '#FFF1CC' }]}>
                  <Text style={styles.smallCrown}>♛</Text>
                </View>
                <View style={styles.achievementBody}>
                  <Text style={styles.achievementText}>{award.reason_label}</Text>
                  <Text style={styles.achievementFund}>{award.fundTitle}</Text>
                </View>
                <View style={styles.awardedBadge}><Text style={styles.awardedBadgeText}>AWARDED</Text></View>
              </View>
            ))}
            {awards.length === 0 && !isConsistentContributor && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No Rich Auntie awards yet.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#7652DC' },
    hero: { backgroundColor: '#7652DC', alignItems: 'center', paddingBottom: 20 },
    heroHeader: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 13,
    },
    backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    crown: { color: '#F4A300', fontSize: 42, lineHeight: 46 },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 5,
    },
    avatarText: { color: '#7652DC', fontSize: 24, fontWeight: '900' },
    badge: {
      position: 'absolute',
      right: -3,
      bottom: 1,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#F4A300',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#7652DC',
    },
    badgeText: { color: '#FFFFFF', fontWeight: '900' },
    heroTitle: { marginTop: 10, fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
    heroSubtitle: {
      marginTop: 7,
      maxWidth: 290,
      paddingHorizontal: 16,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      color: '#E8DEFF',
    },
    body: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    content: { padding: 18, paddingBottom: 42 },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 16,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 17, fontWeight: '900' },
    statLabel: { marginTop: 4, fontSize: 10, color: colors.textMuted },
    divider: { width: 1, height: 35, backgroundColor: colors.border },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 24,
      backgroundColor: '#25D366',
      paddingVertical: 14,
      marginTop: 15,
    },
    shareButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    sectionTitle: { marginTop: 24, marginBottom: 10, fontSize: 15, fontWeight: '900', color: colors.textPrimary },
    achievement: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 12,
    },
    achievementIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallCrown: { color: '#F4A300', fontSize: 20, fontWeight: '900' },
    achievementBody: { flex: 1 },
    achievementText: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textPrimary },
    achievementFund: { marginTop: 2, fontSize: 11, color: colors.textMuted },
    autoBadge: { borderRadius: 10, backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4 },
    autoBadgeText: { fontSize: 9, fontWeight: '900', color: colors.primary },
    awardedBadge: { borderRadius: 10, backgroundColor: '#FFF1CC', paddingHorizontal: 8, paddingVertical: 4 },
    awardedBadgeText: { fontSize: 9, fontWeight: '900', color: '#D98A00' },
    empty: { alignItems: 'center', paddingVertical: 30 },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  })
}
