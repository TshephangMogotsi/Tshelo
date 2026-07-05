import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { BACK_HIT_SLOP } from './constants'

type Props = {
  title: string
  step?: string
  centered?: boolean
  large?: boolean
  onBack: () => void
}

export default function FlowHeader({ title, step, centered, large, onBack }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  if (centered) {
    return (
      <View style={styles.centeredHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={BACK_HIT_SLOP}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.centeredTitle, large && styles.centeredTitleLarge]}>{title}</Text>
        <View style={styles.spacer} />
      </View>
    )
  }

  return (
    <View style={styles.stepHeader}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={BACK_HIT_SLOP}>
        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.stepHeaderText}>
        <Text style={styles.stepHeaderTitle}>{title}</Text>
        {step ? <Text style={styles.stepHeaderStep}>{step}</Text> : null}
      </View>
      <View style={styles.spacer} />
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    centeredHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },
    centeredTitle: {
      flex: 1,
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    centeredTitleLarge: {
      fontSize: 34,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 22,
      paddingTop: 14,
      paddingBottom: 12,
    },
    stepHeaderText: {
      flex: 1,
      paddingLeft: 8,
    },
    stepHeaderTitle: {
      fontSize: 26,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.heading,
      marginBottom: 4,
    },
    stepHeaderStep: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.textMuted,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spacer: { width: 36 },
  })
}
