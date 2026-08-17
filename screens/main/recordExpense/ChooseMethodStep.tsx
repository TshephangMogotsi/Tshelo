import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { makeCommonStyles } from './common'

type Props = {
  fundTitle: string
  onScan: () => void
  onUpload: () => void
  onManual: () => void
}

export default function ChooseMethodStep({ fundTitle, onScan, onUpload, onManual }: Props) {
  const { colors } = useTheme()
  const common = makeCommonStyles(colors)
  const styles = makeStyles(colors)

  return (
    <>
      <View style={common.header}>
        <Text style={common.heading}>Record Expense</Text>
        <Text style={common.subheading} numberOfLines={1}>{fundTitle}</Text>
      </View>

      <Text style={common.label}>How do you want to add this?</Text>

      <TouchableOpacity style={styles.methodCard} onPress={onScan} activeOpacity={0.85}>
        <View style={[styles.methodIconWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.methodBody}>
          <Text style={styles.methodTitle}>Scan Receipt</Text>
          <Text style={styles.methodHint}>Take a photo, then add up the items yourself</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.methodCard} onPress={onUpload} activeOpacity={0.85}>
        <View style={[styles.methodIconWrap, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.methodBody}>
          <Text style={styles.methodTitle}>Upload Receipt</Text>
          <Text style={styles.methodHint}>From your gallery</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.methodCard} onPress={onManual} activeOpacity={0.85}>
        <View style={[styles.methodIconWrap, { backgroundColor: colors.accentLight }]}>
          <Ionicons name="create-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.methodBody}>
          <Text style={styles.methodTitle}>Manual Entry</Text>
          <Text style={styles.methodHint}>No receipt? Enter it yourself</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          💡 Attach a receipt photo so contributors can see proof of spend in the fund's audit log.
        </Text>
      </View>
    </>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    methodCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    methodIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    methodBody: {
      flex: 1,
    },
    methodTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    methodHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    tipCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: 14,
      marginTop: 12,
    },
    tipText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  })
}
