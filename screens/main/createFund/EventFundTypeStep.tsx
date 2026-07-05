import { Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import EventFundHero from './EventFundHero'
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
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

      <EventFundHero stepsDone={1} large onBack={onBack} />

      <ScrollView contentContainerStyle={styles.eventFundScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eventFundTitle}>Event type</Text>
        <Text style={styles.eventFundSubtitle}>What are you planning?</Text>

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
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 38,
      paddingBottom: 44,
    },
    eventFundTitle: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    eventFundSubtitle: {
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 28,
    },
    eventFundGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 20,
      marginBottom: 34,
    },
    eventFundTypeCard: {
      width: '47%',
      minHeight: 164,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 24,
    },
    eventFundTypeCardActive: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: BRAND_PURPLE,
    },
    eventFundTypeEmoji: {
      fontSize: 48,
      marginBottom: 20,
    },
    eventFundTypeLabel: {
      fontSize: 20,
      lineHeight: 25,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    eventFundTypeLabelActive: {
      color: BRAND_PURPLE,
      fontWeight: '900',
    },
    eventFundContinue: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE_DARK,
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
