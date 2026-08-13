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
  connectionResults: PickedOrganiser[]
  isSearchingConnections: boolean
  onAddConnection: (person: PickedOrganiser) => void
  pickedOrganisers: PickedOrganiser[]
  onAddFromContacts: () => void
  onRemoveOrganiser: (id: string) => void
  isCreatingEvent: boolean
  onCreateEvent: () => void
  onBack: () => void
}

export default function EventOrganisersStep({
  organiserSearch,
  onOrganiserSearchChange,
  connectionResults,
  isSearchingConnections,
  onAddConnection,
  pickedOrganisers,
  onAddFromContacts,
  onRemoveOrganiser,
  isCreatingEvent,
  onCreateEvent,
  onBack,
}: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <FlowHeader title="Add Organisers" step="Step 3 of 3" onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.eventOnlyOrganisersScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OrganiserSection
            subtitle="Who's on the planning committee? They'll help manage your event."
            count={1 + pickedOrganisers.length}
            creatorInitials="ME"
            creatorName="You"
            search={organiserSearch}
            onSearchChange={onOrganiserSearchChange}
            connectionResults={connectionResults}
            isSearchingConnections={isSearchingConnections}
            onAddConnection={onAddConnection}
            pickedOrganisers={pickedOrganisers}
            onAddFromContacts={onAddFromContacts}
            onRemoveOrganiser={onRemoveOrganiser}
          />

          <TouchableOpacity
            style={[styles.eventContinueButton, isCreatingEvent && styles.eventContinueDisabled]}
            activeOpacity={isCreatingEvent ? 1 : 0.86}
            onPress={onCreateEvent}
          >
            <Text style={styles.eventContinueText}>{isCreatingEvent ? 'Creating...' : 'Create Event'}</Text>
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
    eventOnlyOrganisersScroll: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 44,
    },
    eventContinueButton: {
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
    eventContinueText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    eventContinueDisabled: {
      backgroundColor: colors.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },
  })
}
