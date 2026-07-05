import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Share, Modal, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EventDetail'>
  route: RouteProp<MainStackParamList, 'EventDetail'>
}

const MOCK_EVENT = {
  id: '2',
  title: 'Kago & Lesedi Wedding',
  emoji: '🏠',
  date: 'Sat, 15 Nov',
  venue: 'Cresta Lodge',
  confirmed: 0,
  pending: 0,
  declined: 0,
  rsvpLink: 'tshelo.com/rsvp/kago-lesedi',
}

export default function EventDetailScreen({ navigation, route }: Props) {
  const { eventId } = route.params
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const event = MOCK_EVENT
  const [showShareModal, setShowShareModal] = useState(false)

  const shareMessage = `You're invited to ${event.title}. RSVP here: ${event.rsvpLink}`

  async function handleWhatsAppShare() {
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      Linking.openURL(url)
      setShowShareModal(false)
    } else {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp to share via it.')
    }
  }

  function handleSmsShare() {
    Linking.openURL(`sms:?body=${encodeURIComponent(shareMessage)}`)
    setShowShareModal(false)
  }

  async function handleCopyShare() {
    await Share.share({ message: event.rsvpLink })
    setShowShareModal(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.titleBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.titleBarText}>Event</Text>
        <View style={styles.titleBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.eventSummaryCard}>
          <View style={styles.heroBody}>
            <Text style={styles.heroEmoji}>{event.emoji}</Text>
            <View style={styles.heroCopy}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>{event.date} • {event.venue}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statsRow}>
            <View style={[styles.rsvpStat, styles.confirmedStat]}>
              <Text style={[styles.rsvpValue, { color: '#16A34A' }]}>{event.confirmed}</Text>
              <Text style={[styles.rsvpLabel, { color: '#15803D' }]}>Confirmed</Text>
            </View>
            <View style={[styles.rsvpStat, styles.pendingStat]}>
              <Text style={[styles.rsvpValue, { color: '#F59E0B' }]}>{event.pending}</Text>
              <Text style={[styles.rsvpLabel, { color: '#B45309' }]}>Pending</Text>
            </View>
            <View style={[styles.rsvpStat, styles.declinedStat]}>
              <Text style={[styles.rsvpValue, { color: '#EF4444' }]}>{event.declined}</Text>
              <Text style={[styles.rsvpLabel, { color: '#B91C1C' }]}>Declined</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.eventToolCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('GuestList', { eventId })}
          >
            <View style={styles.toolIconBlue}>
              <Ionicons name="people-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.toolBody}>
              <Text style={styles.toolTitle}>Guest{'\n'}List</Text>
              <Text style={styles.toolSubtitle}>No guests yet</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.eventToolCard, styles.budgetEmptyCard]}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('EventBudget', { eventId })}
          >
            <View style={styles.tapHereBadge}>
              <Text style={styles.tapHereText}>TAP HERE</Text>
            </View>
            <View style={styles.toolIconPurple}>
              <Ionicons name="receipt-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.toolBody}>
              <Text style={styles.toolTitle}>Budget &{'\n'}Expenses</Text>
              <Text style={styles.budgetEmptyText}>Not set yet</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={() => setShowShareModal(true)} activeOpacity={0.86}>
            <Ionicons name="link-outline" size={22} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share RSVP link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalBackdrop}>
          <View style={styles.shareModalCard}>
            <Text style={styles.shareModalTitle}>Share RSVP{'\n'}Link</Text>

            <View style={styles.rsvpLinkBox}>
              <Text style={styles.rsvpLinkLabel}>RSVP Link</Text>
              <Text style={styles.rsvpLinkText}>{event.rsvpLink}</Text>
            </View>

            <Text style={styles.shareViaText}>Share via</Text>

            <View style={styles.shareOptionsRow}>
              <TouchableOpacity style={styles.shareOption} onPress={handleWhatsAppShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.whatsappCircle]}>
                  <Ionicons name="logo-whatsapp" size={34} color="#FFFFFF" />
                </View>
                <Text style={styles.shareOptionLabel}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareOption} onPress={handleSmsShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.smsCircle]}>
                  <Ionicons name="chatbubble-outline" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.shareOptionLabel}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareOption} onPress={handleCopyShare} activeOpacity={0.85}>
                <View style={[styles.shareOptionCircle, styles.copyCircle]}>
                  <Ionicons name="copy-outline" size={32} color={colors.textMuted} />
                </View>
                <Text style={styles.shareOptionLabel}>Copy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelShareButton} onPress={() => setShowShareModal(false)} activeOpacity={0.85}>
              <Text style={styles.cancelShareText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 22,
      paddingBottom: 44,
    },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    titleBarText: {
      flex: 1,
      fontSize: 24,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.heading,
      textAlign: 'center',
    },
    titleBarSpacer: { width: 40 },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventSummaryCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 22,
      marginBottom: 18,
    },
    heroBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 22,
    },
    heroEmoji: {
      width: 74,
      fontSize: 52,
      textAlign: 'center',
    },
    heroCopy: {
      flex: 1,
    },
    eventTitle: {
      fontSize: 23,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 18,
    },
    eventMeta: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: colors.textMuted,
    },
    content: {
      paddingTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
    },
    rsvpStat: {
      flex: 1,
      minHeight: 80,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    confirmedStat: { backgroundColor: '#D1FAE5' },
    pendingStat: { backgroundColor: '#FEF3C7' },
    declinedStat: { backgroundColor: '#FEE2E2' },
    rsvpValue: {
      fontSize: 26,
      lineHeight: 31,
      fontWeight: '900',
    },
    rsvpLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    eventToolCard: {
      minHeight: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 22,
      marginBottom: 16,
    },
    budgetEmptyCard: {
      position: 'relative',
      backgroundColor: colors.primaryLight,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    tapHereBadge: {
      position: 'absolute',
      top: -15,
      right: 28,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 6,
      zIndex: 1,
    },
    tapHereText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    toolIconBlue: {
      width: 70,
      height: 70,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DBEAFE',
    },
    toolIconPurple: {
      width: 70,
      height: 70,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    toolBody: {
      flex: 1,
    },
    toolTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    toolSubtitle: {
      fontSize: 17,
      lineHeight: 22,
      color: colors.textMuted,
    },
    budgetEmptyText: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: '#F59E0B',
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: '#2454D9',
      borderRadius: 28,
      paddingHorizontal: 20,
      paddingVertical: 17,
      marginTop: 8,
    },
    shareButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    shareModalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.48)',
      paddingHorizontal: 28,
    },
    shareModalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 36,
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 42,
      paddingBottom: 28,
      alignItems: 'center',
    },
    shareModalTitle: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 24,
    },
    rsvpLinkBox: {
      width: '100%',
      backgroundColor: '#F4F4F6',
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingVertical: 20,
      marginBottom: 34,
    },
    rsvpLinkLabel: {
      fontSize: 17,
      color: colors.textMuted,
      marginBottom: 10,
    },
    rsvpLinkText: {
      fontSize: 22,
      lineHeight: 30,
      color: colors.textPrimary,
    },
    shareViaText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 24,
    },
    shareOptionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 34,
    },
    shareOption: {
      alignItems: 'center',
      width: 92,
    },
    shareOptionCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    whatsappCircle: {
      backgroundColor: '#25D366',
    },
    smsCircle: {
      backgroundColor: '#29A9E8',
    },
    copyCircle: {
      backgroundColor: '#E5E7EB',
    },
    shareOptionLabel: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
    cancelShareButton: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 28,
      paddingVertical: 17,
    },
    cancelShareText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
  })
}
