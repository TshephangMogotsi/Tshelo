import { Alert, Clipboard, Linking, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import type { AppColors } from '../theme/themes'
import { fonts } from '../theme/typography'

type Props = {
  visible: boolean
  inviteType: 'Event' | 'Fund'
  title: string
  inviteValue: string
  helpText: string
  shareMessage: string
  onClose: () => void
}

export default function InviteDetailsModal({
  visible,
  inviteType,
  title,
  inviteValue,
  helpText,
  shareMessage,
  onClose,
}: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(colors)

  async function shareToWhatsApp() {
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`
    if (!(await Linking.canOpenURL(url))) {
      Alert.alert('WhatsApp not found', 'Please install WhatsApp to share the invite with it.')
      return
    }
    onClose()
    await Linking.openURL(url)
  }

  async function shareBySms() {
    onClose()
    await Linking.openURL(`sms:?body=${encodeURIComponent(shareMessage)}`)
  }

  function copyInvite() {
    Clipboard.setString(inviteValue)
    onClose()
    Alert.alert('Copied', `${inviteType} invite code copied.`)
  }

  async function shareMore() {
    onClose()
    await Share.share({ message: shareMessage })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close invite details" />
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>{inviteType.toUpperCase()} INVITE DETAILS</Text>
              <Text style={styles.title}>Invite people to {title}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel={`Close ${inviteType.toLowerCase()} invite details`}>
              <Ionicons name="close" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.help}>{helpText}</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{inviteType.toUpperCase()} INVITE CODE</Text>
            <Text style={styles.codeText} selectable numberOfLines={2}>{inviteValue}</Text>
          </View>

          <View style={styles.options}>
            <TouchableOpacity style={styles.option} onPress={() => { void shareToWhatsApp() }}>
              <View style={[styles.optionIcon, styles.whatsappIcon]}><Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" /></View>
              <Text style={styles.optionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => { void shareBySms() }}>
              <View style={[styles.optionIcon, styles.smsIcon]}><Ionicons name="chatbubble-outline" size={21} color="#FFFFFF" /></View>
              <Text style={styles.optionText}>SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={copyInvite}>
              <View style={styles.optionIcon}><Ionicons name="copy-outline" size={21} color={colors.textPrimary} /></View>
              <Text style={styles.optionText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => { void shareMore() }}>
              <View style={styles.optionIcon}><Ionicons name="ellipsis-horizontal" size={21} color={colors.textPrimary} /></View>
              <Text style={styles.optionText}>More</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 10, 28, 0.46)' },
    card: { paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
    handle: { alignSelf: 'center', width: 42, height: 4, marginBottom: 14, borderRadius: 999, backgroundColor: colors.border },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    headingCopy: { flex: 1, minWidth: 0 },
    eyebrow: { marginBottom: 4, fontSize: 8, fontFamily: fonts.inter.black, color: colors.primary, letterSpacing: 0.65 },
    title: { fontSize: 18, lineHeight: 23, fontFamily: fonts.inter.extraBold, color: colors.textPrimary },
    closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    help: { marginTop: 12, fontSize: 10, lineHeight: 16, fontFamily: fonts.inter.regular, color: colors.textSecondary },
    codeBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border },
    codeLabel: { marginBottom: 4, fontSize: 8, fontFamily: fonts.inter.black, color: colors.primary, letterSpacing: 0.55 },
    codeText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.inter.extraBold, color: colors.textPrimary, letterSpacing: 0.4 },
    options: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    option: { width: '24%', alignItems: 'center' },
    optionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    whatsappIcon: { backgroundColor: '#25D366' },
    smsIcon: { backgroundColor: '#29A9E8' },
    optionText: { marginTop: 7, fontSize: 9, fontFamily: fonts.inter.medium, color: colors.textSecondary },
  })
}
