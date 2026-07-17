import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { formatEventDateDisplay } from './format'
import { BRAND_PURPLE } from './constants'

type Props = {
  eventName: string
  eventEmoji: string
  eventDate: Date | null
  eventVenue: string
  onShare: () => void
  onDone: () => void
}

export default function EventCreatedScreen({ eventName, eventEmoji, eventDate, eventVenue, onShare, onDone }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.eventCreatedScreen}>
        <View style={styles.eventCreatedConfetti}>
          <Text style={styles.confettiLeft}>🎉</Text>
          <Text style={styles.confettiMiddle}>🎊</Text>
          <Text style={styles.confettiRight}>✨</Text>
        </View>

        <View style={styles.eventCreatedIconCircle}>
          <Ionicons name="checkmark" size={36} color="#16A34A" />
        </View>

        <Text style={styles.eventCreatedTitle}>Event Created!</Text>

        <View style={styles.eventCreatedCard}>
          <Text style={styles.eventCreatedEmoji}>{eventEmoji}</Text>
          <View style={styles.eventCreatedCardBody}>
            <Text style={styles.eventCreatedName}>{eventName}</Text>
            <View style={styles.eventCreatedMetaRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
              <Text style={styles.eventCreatedMeta}>
                {eventDate ? formatEventDateDisplay(eventDate) : 'Date to be confirmed'}
              </Text>
            </View>
            <View style={styles.eventCreatedMetaRow}>
              <Ionicons name="location-outline" size={15} color={colors.textMuted} />
              <Text style={styles.eventCreatedMeta}>
                {eventVenue.trim() || 'Venue to be confirmed'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.eventCreatedInviteText}>Now invite your guests!</Text>

        <TouchableOpacity
          style={styles.shareRsvpButton}
          activeOpacity={0.86}
          onPress={onShare}
        >
          <Ionicons name="link-outline" size={22} color="#FFFFFF" />
          <Text style={styles.shareRsvpButtonText}>Share RSVP{'\n'}Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.eventCreatedDoneButton}
          activeOpacity={0.78}
          onPress={onDone}
        >
          <Text style={styles.eventCreatedDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    eventCreatedScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 36,
      backgroundColor: colors.background,
    },
    eventCreatedConfetti: {
      width: 190,
      height: 74,
      position: 'relative',
      marginBottom: 8,
    },
    confettiLeft: {
      position: 'absolute',
      left: 12,
      top: 8,
      fontSize: 24,
    },
    confettiMiddle: {
      position: 'absolute',
      left: 84,
      top: 38,
      fontSize: 17,
    },
    confettiRight: {
      position: 'absolute',
      right: 10,
      top: 12,
      fontSize: 22,
    },
    eventCreatedIconCircle: {
      width: 106,
      height: 106,
      borderRadius: 53,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#D1FAE5',
      marginBottom: 28,
    },
    eventCreatedTitle: {
      fontSize: 29,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 26,
    },
    eventCreatedCard: {
      width: '100%',
      maxWidth: 280,
      minHeight: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 22,
      paddingVertical: 18,
      marginBottom: 28,
    },
    eventCreatedEmoji: {
      width: 58,
      fontSize: 40,
      textAlign: 'center',
    },
    eventCreatedCardBody: {
      flex: 1,
    },
    eventCreatedName: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    eventCreatedMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    eventCreatedMeta: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: colors.textMuted,
    },
    eventCreatedInviteText: {
      fontSize: 19,
      lineHeight: 26,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 20,
    },
    shareRsvpButton: {
      width: '100%',
      maxWidth: 280,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 17,
    },
    shareRsvpButtonText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    eventCreatedDoneButton: {
      width: '100%',
      maxWidth: 280,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 15,
      marginTop: 14,
      backgroundColor: colors.surface,
    },
    eventCreatedDoneText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
  })
}
