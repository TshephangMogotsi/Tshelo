import { Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import {
  BRAND_LAVENDER,
  BRAND_PURPLE,
  BRAND_PURPLE_DARK,
  EVENT_TYPES,
  EventTypeOption,
} from './constants'

type Props = {
  eventType: EventTypeOption
  onSelectType: (type: EventTypeOption) => void
  onContinue: () => void
  onBack: () => void
}

export default function EventFundTypeStep({ eventType, onSelectType, onContinue, onBack }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 1 of 4" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.eventFundScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eventFundTitle}>What are you planning?</Text>
        <Text style={styles.eventFundSubtitle}>Choose the event that this fund is for.</Text>

        <View style={styles.eventFundGrid}>
          {EVENT_TYPES.slice(0, 4).map(item => {
            const active = eventType.id === item.id
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.eventFundTypeCard, active && styles.eventFundTypeCardActive]}
                activeOpacity={0.84}
                onPress={() => onSelectType(item)}
              >
                <Text style={styles.eventFundTypeEmoji}>{item.emoji}</Text>
                <Text style={[styles.eventFundTypeLabel, active && styles.eventFundTypeLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={styles.eventFundContinue}
          activeOpacity={0.86}
          onPress={onContinue}
        >
          <Text style={styles.eventFundContinueText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    eventFundScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventFundTitle: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    eventFundSubtitle: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 28,
    },
    eventFundGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 34,
    },
    eventFundTypeCard: {
      width: '48%',
      minHeight: 124,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventFundTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventFundTypeEmoji: {
      fontSize: 38,
      marginBottom: 12,
    },
    eventFundTypeLabel: {
      fontSize: 16,
      lineHeight: 25,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventFundTypeLabelActive: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    eventFundContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
      borderRadius: 28,
      paddingVertical: 17,
      shadowColor: BRAND_PURPLE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 6,
    },
    eventFundContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  })
}
