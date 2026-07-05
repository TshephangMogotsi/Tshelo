import { StyleSheet } from 'react-native'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'

export function makeCommonStyles(colors: AppColors) {
  return StyleSheet.create({
    header: {
      marginBottom: 28,
    },
    heading: {
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
      marginBottom: 4,
    },
    subheading: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    field: {
      marginBottom: 22,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optional: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'none',
      fontWeight: '400',
      letterSpacing: 0,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontSize: 16,
      color: colors.textPrimary,
    },
    textArea: {
      minHeight: 88,
      paddingTop: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    primaryButton: {
      backgroundColor: colors.disabled,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
    },
    buttonActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonText: {
      color: colors.disabledText,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    primaryButtonTextActive: {
      color: '#FFFFFF',
    },
  })
}
