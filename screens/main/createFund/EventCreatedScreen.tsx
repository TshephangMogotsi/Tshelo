import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { formatEventDateDisplay } from './format'

type Props = {
  eventName: string
  eventDate: Date | null
  eventVenue: string
  onShare: () => void
  onViewEvent: () => void
}

export default function EventCreatedScreen({ eventName, eventDate, eventVenue, onShare, onViewEvent }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow} accessibilityLabel="Event created successfully">
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <Text
            style={styles.heading}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            Event Created!
          </Text>
        </View>
        <Text style={styles.subheading}>{eventName} is ready for guests</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.eventName}>{eventName}</Text>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>DATE</Text>
              <Text style={styles.detailValue}>
                {eventDate ? formatEventDateDisplay(eventDate) : 'To be confirmed'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>VENUE</Text>
              <Text style={styles.detailValue}>{eventVenue.trim() || 'To be confirmed'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.inviteTitle}>Invite your guests</Text>
        <TouchableOpacity
          style={styles.shareButton}
          activeOpacity={0.8}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share RSVP link"
        >
          <Ionicons name="share-outline" size={19} color={colors.primary} />
          <Text style={styles.shareButtonText}>Share RSVP Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewEventButton}
          activeOpacity={0.82}
          onPress={onViewEvent}
          accessibilityRole="button"
          accessibilityLabel="View Event"
        >
          <Text style={styles.viewEventText}>View Event</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 48,
    },
    headingRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 8,
    },
    heading: {
      flexShrink: 1,
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subheading: {
      marginBottom: 28,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
      textAlign: 'center',
    },
    summaryCard: {
      width: '100%',
      marginBottom: 28,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    eventName: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      marginVertical: 16,
      backgroundColor: colors.border,
    },
    detailRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    detailIcon: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      backgroundColor: colors.primaryLight,
    },
    detailCopy: {
      flex: 1,
    },
    detailLabel: {
      marginBottom: 2,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    detailValue: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    inviteTitle: {
      alignSelf: 'flex-start',
      marginBottom: 14,
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    shareButton: {
      width: '100%',
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    shareButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    viewEventButton: {
      width: '100%',
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    viewEventText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
