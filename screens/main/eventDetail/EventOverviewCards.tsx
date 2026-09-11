import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { EventFile } from '@shared/contracts'
import { api } from '../../../lib/api'
import { runApiRead } from '../../../lib/apiScreen'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { confirmedGuestPreviews, guestInitials, overviewGalleryFiles } from './overview'

type OverviewAnnouncement = {
  title: string
  body: string
  isPinned: boolean
  authorName: string
  createdAt: string
  attachmentCount: number
}

type Attendance = {
  confirmedPeople: number
  pendingInvitations: number
  invitedPeople: number
}

type Guest = {
  id: string
  name: string
  status: 'confirmed' | 'pending' | 'declined'
}

type Props = {
  eventId: string
  latestAnnouncement: OverviewAnnouncement | null
  attendance: Attendance
  guests: Guest[]
  venue: string
  venueAddress: string | null
  hasVenue: boolean
  files: EventFile[]
  previewBusy: boolean
  onOpenUpdates: () => void
  onOpenGuests: () => void
  onOpenLocation: () => void
  onOpenFiles: () => void
  onPreview: (items: EventFile[], file: EventFile) => void
}

function timelineDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-BW', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function SectionHeader({ icon, title, action, onAction, primaryColor, styles }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  action?: string
  onAction?: () => void
  primaryColor: string
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <View style={styles.header}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}><Ionicons name={icon} size={17} color={primaryColor} /></View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
        >
          <Text style={styles.headerActionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={13} color={primaryColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function GalleryThumbnail({ eventId, file, disabled, onPreview, primaryColor, mutedColor, styles }: {
  eventId: string
  file: EventFile
  disabled: boolean
  onPreview: () => void
  primaryColor: string
  mutedColor: string
  styles: ReturnType<typeof makeStyles>
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setUrl(null)
    setFailed(false)
    void runApiRead(call => api.events.createFileAccess(eventId, file.id, call), { signal: controller.signal })
      .then(access => {
        if (controller.signal.aborted) return
        if (access.thumbnail_url) setUrl(access.thumbnail_url)
        else setFailed(true)
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [attempt, eventId, file.id])

  if (failed) {
    return (
      <TouchableOpacity
        style={styles.galleryThumbnail}
        onPress={() => setAttempt(value => value + 1)}
        accessibilityRole="button"
        accessibilityLabel={`Retry low-data preview for ${file.file_name}`}
      >
        <Ionicons name="image-outline" size={22} color={mutedColor} />
        <Text style={styles.galleryFailure}>Tap to retry</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={styles.galleryThumbnail}
      disabled={disabled || !url}
      onPress={onPreview}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${file.file_name}`}
      accessibilityState={{ disabled: disabled || !url, busy: !url }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.galleryImage}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`Low-data preview: ${file.file_name}`}
        />
      ) : <ActivityIndicator color={primaryColor} />}
    </TouchableOpacity>
  )
}

export default function EventOverviewCards({
  eventId,
  latestAnnouncement,
  attendance,
  guests,
  venue,
  venueAddress,
  hasVenue,
  files,
  previewBusy,
  onOpenUpdates,
  onOpenGuests,
  onOpenLocation,
  onOpenFiles,
  onPreview,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const confirmedGuests = confirmedGuestPreviews(guests)
  const images = overviewGalleryFiles(files)

  return (
    <View style={styles.stack}>
      <View style={[styles.card, latestAnnouncement?.isPinned && styles.pinnedCard]}>
        <SectionHeader
          icon={latestAnnouncement?.isPinned ? 'pin' : 'notifications-outline'}
          title={latestAnnouncement?.isPinned ? 'Pinned update' : 'Latest update'}
          action="View all"
          onAction={onOpenUpdates}
          primaryColor={colors.primary}
          styles={styles}
        />
        {latestAnnouncement ? (
          <TouchableOpacity
            style={styles.updateBody}
            onPress={onOpenUpdates}
            accessibilityRole="button"
            accessibilityLabel={`Open ${latestAnnouncement.isPinned ? 'pinned' : 'latest'} update: ${latestAnnouncement.title}`}
          >
            {latestAnnouncement.isPinned ? <Text style={styles.pinnedLabel}>URGENT UPDATE</Text> : null}
            <View style={styles.updateTitleRow}>
              <Text style={styles.updateTitle} numberOfLines={2}>{latestAnnouncement.title}</Text>
              <Text style={styles.updateDate}>{timelineDate(latestAnnouncement.createdAt)}</Text>
            </View>
            <Text style={styles.updateText} numberOfLines={3}>{latestAnnouncement.body}</Text>
            <View style={styles.updateMeta}>
              <Text style={styles.metaText}>{latestAnnouncement.authorName}</Text>
              {latestAnnouncement.attachmentCount > 0 ? (
                <View style={styles.inlineMeta}>
                  <Ionicons name="attach" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{latestAnnouncement.attachmentCount} attachment{latestAnnouncement.attachmentCount === 1 ? '' : 's'}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.emptyBody} onPress={onOpenUpdates} accessibilityRole="button" accessibilityLabel="Open event updates">
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptyText}>Announcements for everyone attending will appear here.</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <SectionHeader icon="people-outline" title="Attendance" action="Guest list" onAction={onOpenGuests} primaryColor={colors.primary} styles={styles} />
        <View style={styles.attendanceGrid}>
          <View style={styles.attendanceStat}><Text style={styles.attendanceValue}>{attendance.confirmedPeople}</Text><Text style={styles.attendanceLabel}>Confirmed</Text></View>
          <View style={styles.attendanceDivider} />
          <View style={styles.attendanceStat}><Text style={styles.attendanceValue}>{attendance.pendingInvitations}</Text><Text style={styles.attendanceLabel}>Pending</Text></View>
          <View style={styles.attendanceDivider} />
          <View style={styles.attendanceStat}><Text style={styles.attendanceValue}>{attendance.invitedPeople}</Text><Text style={styles.attendanceLabel}>Invited</Text></View>
        </View>
        {confirmedGuests.length > 0 ? (
          <TouchableOpacity style={styles.guestPreview} onPress={onOpenGuests} accessibilityRole="button" accessibilityLabel={`${attendance.confirmedPeople} people attending. Open guest list.`}>
            <View style={styles.initialsRow}>
              {confirmedGuests.map(guest => <View key={guest.id} style={styles.initial}><Text style={styles.initialText}>{guestInitials(guest.name)}</Text></View>)}
            </View>
            <Text style={styles.guestPreviewText}>{attendance.confirmedPeople === 1 ? '1 person is attending' : `${attendance.confirmedPeople} people are attending`}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : <Text style={styles.railNote}>Confirmed guests will appear here.</Text>}
      </View>

      <View style={styles.card}>
        <SectionHeader
          icon="location-outline"
          title="Location"
          action={hasVenue ? 'Open map' : undefined}
          onAction={hasVenue ? onOpenLocation : undefined}
          primaryColor={colors.primary}
          styles={styles}
        />
        <TouchableOpacity
          style={styles.locationBody}
          disabled={!hasVenue}
          onPress={onOpenLocation}
          accessibilityRole={hasVenue ? 'button' : undefined}
          accessibilityLabel={hasVenue ? `Open ${venue} in Maps` : undefined}
          accessibilityState={hasVenue ? undefined : { disabled: true }}
        >
          <View style={styles.locationPin}><Ionicons name="navigate-outline" size={21} color={colors.primary} /></View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationName}>{venue}</Text>
            <Text style={styles.locationHelp}>{venueAddress ?? (hasVenue ? 'Opens in your maps app' : 'The organiser has not added an address yet.')}</Text>
          </View>
          {hasVenue ? <Ionicons name="open-outline" size={17} color={colors.primary} /> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <SectionHeader icon="images-outline" title="Gallery" action="View all" onAction={onOpenFiles} primaryColor={colors.primary} styles={styles} />
        {images.length > 0 ? (
          <View style={styles.gallery}>
            {images.map(file => (
              <GalleryThumbnail
                key={file.id}
                eventId={eventId}
                file={file}
                disabled={previewBusy}
                onPreview={() => onPreview(images, file)}
                primaryColor={colors.primary}
                mutedColor={colors.textSecondary}
                styles={styles}
              />
            ))}
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyBody} onPress={onOpenFiles} accessibilityRole="button" accessibilityLabel="Open event files">
            <Text style={styles.emptyTitle}>No images yet</Text>
            <Text style={styles.emptyText}>Event photos and artwork will appear here.</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    stack: { gap: 12, paddingTop: 10 },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, overflow: 'hidden' },
    pinnedCard: { borderColor: '#BFA2F5', backgroundColor: '#FBF9FF' },
    header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
    headingIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primaryLight },
    title: { flex: 1, minWidth: 0, fontFamily: fonts.inter.bold, fontSize: 14, color: colors.textPrimary },
    headerAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
    headerActionText: { fontFamily: fonts.inter.semiBold, fontSize: 11, color: colors.primary },
    updateBody: { padding: 14, gap: 7 },
    pinnedLabel: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.primaryLight, fontFamily: fonts.inter.black, fontSize: 7, letterSpacing: 0.55, color: colors.primary },
    updateTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    updateTitle: { flex: 1, minWidth: 0, fontFamily: fonts.inter.extraBold, fontSize: 14, lineHeight: 19, color: colors.textPrimary },
    updateDate: { paddingTop: 2, fontFamily: fonts.inter.regular, fontSize: 9, color: colors.textSecondary },
    updateText: { fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
    updateMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 2 },
    inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontFamily: fonts.inter.medium, fontSize: 9, color: colors.textSecondary },
    emptyBody: { minHeight: 92, justifyContent: 'center', padding: 14 },
    emptyTitle: { fontFamily: fonts.inter.bold, fontSize: 13, color: colors.textPrimary },
    emptyText: { marginTop: 4, fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 17, color: colors.textSecondary },
    attendanceGrid: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
    attendanceStat: { flex: 1, alignItems: 'center' },
    attendanceValue: { fontFamily: fonts.inter.extraBold, fontSize: 20, color: colors.textPrimary },
    attendanceLabel: { marginTop: 3, fontFamily: fonts.inter.medium, fontSize: 9, color: colors.textSecondary },
    attendanceDivider: { width: 1, height: 32, backgroundColor: colors.border },
    guestPreview: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 12, padding: 9, borderRadius: 12, backgroundColor: colors.background },
    initialsRow: { flexDirection: 'row', paddingLeft: 3 },
    initial: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', marginLeft: -3, borderWidth: 2, borderColor: colors.surface, borderRadius: 999, backgroundColor: colors.primaryLight },
    initialText: { fontFamily: fonts.inter.bold, fontSize: 8, color: colors.primary },
    guestPreviewText: { flex: 1, minWidth: 0, fontFamily: fonts.inter.semiBold, fontSize: 10, color: colors.textPrimary },
    railNote: { margin: 12, padding: 12, borderRadius: 12, backgroundColor: colors.background, fontFamily: fonts.inter.regular, fontSize: 10, color: colors.textSecondary },
    locationBody: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
    locationPin: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
    locationCopy: { flex: 1, minWidth: 0 },
    locationName: { fontFamily: fonts.inter.bold, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
    locationHelp: { marginTop: 3, fontFamily: fonts.inter.regular, fontSize: 10, color: colors.textSecondary },
    gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
    galleryThumbnail: { width: '48.5%', aspectRatio: 1.25, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.background },
    galleryImage: { width: '100%', height: '100%' },
    galleryFailure: { fontFamily: fonts.inter.semiBold, fontSize: 9, color: colors.primary },
  })
}
