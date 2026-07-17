import { Text, StyleSheet, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import FlowHeader from './FlowHeader'
import OrganiserSection from './OrganiserSection'
import { BRAND_PURPLE, BRAND_PURPLE_DARK, PickedOrganiser } from './constants'

type Props = {
  organiserSearch: string
  onOrganiserSearchChange: (text: string) => void
  pickedOrganisers: PickedOrganiser[]
  onAddFromContacts: () => void
  onRemoveOrganiser: (id: string) => void
  onContinue: () => void
  onBack: () => void
}

export default function EventFundOrganisersStep({
  organiserSearch,
  onOrganiserSearchChange,
  pickedOrganisers,
  onAddFromContacts,
  onRemoveOrganiser,
  onContinue,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <FlowHeader title="Event + Fund" step="Step 3 of 4" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.organisersScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OrganiserSection
            subtitle="Who's on the planning committee? They'll manage both the event and fund."
            count={1 + pickedOrganisers.length}
            creatorInitials="ME"
            creatorName="You"
            search={organiserSearch}
            onSearchChange={onOrganiserSearchChange}
            pickedOrganisers={pickedOrganisers}
            onAddFromContacts={onAddFromContacts}
            onRemoveOrganiser={onRemoveOrganiser}
          />

          <TouchableOpacity style={styles.eventFundContinue} activeOpacity={0.86} onPress={onContinue}>
            <Text style={styles.eventFundContinueText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    organisersScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
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
