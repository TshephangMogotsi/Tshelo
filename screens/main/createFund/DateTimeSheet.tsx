import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { BRAND_PURPLE } from './constants'

type Props = {
  visible: boolean
  mode: 'date' | 'time'
  value: Date | null
  minimumDate?: Date
  onClose: () => void
  onChange: (date: Date) => void
}

export default function DateTimeSheet({ visible, mode, value, minimumDate, onClose, onChange }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  if (Platform.OS === 'android') {
    if (!visible) return null
    return (
      <DateTimePicker
        value={value ?? new Date()}
        mode={mode}
        minimumDate={minimumDate}
        onChange={(_, date) => {
          onClose()
          if (date) onChange(date)
        }}
      />
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.dateModalBackdrop}>
        <View style={[styles.dateModalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.dateModalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.dateModalAction, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.dateModalAction, { color: BRAND_PURPLE, fontWeight: '700' }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            onChange={(_, date) => {
              if (date) onChange(date)
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    dateModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    dateModalSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
    },
    dateModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dateModalAction: {
      fontSize: 16,
    },
  })
}
