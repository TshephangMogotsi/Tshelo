import { View, Text, StyleSheet, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import EventFundHero from './EventFundHero'
import OrganiserSection, { makeOrganiserStyles } from './OrganiserSection'
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
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const organiserStyles = makeOrganiserStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_PURPLE} />

      <EventFundHero stepsDone={3} onBack={onBack} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.organisersScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OrganiserSection
            subtitle="Who's on the planning committee? They'll manage both the event and fund."
            count={3 + pickedOrganisers.length}
            creatorInitials="TM"
            creatorName="Tshephang Moagi"
            search={organiserSearch}
            onSearchChange={onOrganiserSearchChange}
            pickedOrganisers={pickedOrganisers}
            onAddFromContacts={onAddFromContacts}
            onRemoveOrganiser={onRemoveOrganiser}
          >
            <View style={organiserStyles.organiserCard}>
              <View style={organiserStyles.blueAvatar}>
                <Text style={organiserStyles.organiserAvatarText}>MK</Text>
              </View>
              <View style={organiserStyles.organiserBody}>
                <Text style={organiserStyles.organiserName} numberOfLines={1}>Mpho Kgosi</Text>
                <Text style={organiserStyles.organiserPhone} numberOfLines={1}>+267 74 123 456</Text>
              </View>
              <TouchableOpacity style={organiserStyles.organiserRemove} activeOpacity={0.75}>
                <Ionicons name="close" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={organiserStyles.organiserCard}>
              <View style={organiserStyles.orangeAvatar}>
                <Text style={organiserStyles.organiserAvatarText}>KM</Text>
              </View>
              <View style={organiserStyles.organiserBody}>
                <Text style={organiserStyles.organiserName} numberOfLines={1}>Kago Modise</Text>
                <Text style={organiserStyles.organiserPhone} numberOfLines={1}>+267 74 789 012</Text>
              </View>
              <TouchableOpacity style={organiserStyles.organiserRemove} activeOpacity={0.75}>
                <Ionicons name="close" size={28} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </OrganiserSection>

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
      backgroundColor: colors.surface,
      paddingHorizontal: 28,
      paddingTop: 34,
      paddingBottom: 44,
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
