import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { EVENT_MAX_FILES, type EventFile } from '@shared/contracts'
import { api } from '../../../lib/api'
import { runApiRead, toApiUiError } from '../../../lib/apiScreen'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import type { useEventFiles } from './useEventFiles'
import {
  clampFocalCoordinate,
  containImageFrame,
  coverImageFrame,
  focalPointFromPress,
  type ImageSize,
} from './banner'

type Props = {
  eventId: string
  manager: ReturnType<typeof useEventFiles>
  canManage: boolean
  inactive: boolean
  onViewFull: (file: EventFile) => void
}

type EditorMode = 'choose' | 'position' | null

function focalValue(value: number | undefined) {
  return clampFocalCoordinate(value ?? 0.5)
}

function useRemoteImageSize(url: string | null) {
  const [size, setSize] = useState<ImageSize | null>(null)
  useEffect(() => {
    setSize(null)
    if (!url) return
    let active = true
    Image.getSize(url, (width, height) => {
      if (active) setSize({ width, height })
    }, () => {
      if (active) setSize(null)
    })
    return () => { active = false }
  }, [url])
  return size
}

function BannerCrop({ url, file, onError }: { url: string; file: EventFile; onError: () => void }) {
  const [container, setContainer] = useState<ImageSize>({ width: 0, height: 0 })
  const source = useRemoteImageSize(url)
  const frame = source ? coverImageFrame(
    container,
    source,
    focalValue(file.banner_focal_x),
    focalValue(file.banner_focal_y),
  ) : null
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={event => setContainer(event.nativeEvent.layout)}
    >
      {frame ? (
        <Image
          source={{ uri: url }}
          style={{ position: 'absolute', ...frame }}
          resizeMode="stretch"
          onError={onError}
          accessibilityLabel={`Event banner: ${file.file_name}`}
        />
      ) : <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" />}
    </View>
  )
}

function FocalPointPicker({ url, x, y, onChange, styles }: {
  url: string
  x: number
  y: number
  onChange: (point: { x: number; y: number }) => void
  styles: ReturnType<typeof makeStyles>
}) {
  const [container, setContainer] = useState<ImageSize>({ width: 0, height: 0 })
  const source = useRemoteImageSize(url)
  const frame = source ? containImageFrame(container, source) : null
  const move = (dx: number, dy: number) => onChange({
    x: clampFocalCoordinate(x + dx),
    y: clampFocalCoordinate(y + dy),
  })
  return (
    <>
      <Pressable
        style={styles.focalPreview}
        onLayout={event => setContainer(event.nativeEvent.layout)}
        onPress={event => {
          if (frame) onChange(focalPointFromPress(event.nativeEvent.locationX, event.nativeEvent.locationY, frame))
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Banner focal point preview"
        accessibilityHint="Tap the important part of the full image, or use the arrow buttons below."
      >
        {frame ? (
          <>
            <Image source={{ uri: url }} style={{ position: 'absolute', ...frame }} resizeMode="stretch" />
            <View
              pointerEvents="none"
              style={[
                styles.focalMarker,
                { left: frame.left + x * frame.width - 13, top: frame.top + y * frame.height - 13 },
              ]}
            >
              <View style={styles.focalMarkerDot} />
            </View>
          </>
        ) : <ActivityIndicator color="#FFFFFF" />}
      </Pressable>
      <View style={styles.focalControls}>
        {([
          ['arrow-back', 'Move focal point left', -0.05, 0],
          ['arrow-up', 'Move focal point up', 0, -0.05],
          ['arrow-down', 'Move focal point down', 0, 0.05],
          ['arrow-forward', 'Move focal point right', 0.05, 0],
        ] as const).map(([icon, label, dx, dy]) => (
          <TouchableOpacity
            key={label}
            style={styles.focalControl}
            onPress={() => move(dx, dy)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Ionicons name={icon} size={19} color="#0D0D0D" />
          </TouchableOpacity>
        ))}
        <Text style={styles.focalPercent}>{Math.round(x * 100)}% · {Math.round(y * 100)}%</Text>
      </View>
    </>
  )
}

export default function EventBanner({ eventId, manager, canManage, inactive, onViewFull }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const banner = manager.files.find(file => file.is_banner) ?? null
  const images = manager.files.filter(file => file.content_type.startsWith('image/'))
  const [attempt, setAttempt] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [candidate, setCandidate] = useState<EventFile | null>(null)
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null)
  const [candidateFailed, setCandidateFailed] = useState(false)
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 })
  const [isPreparing, setIsPreparing] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setPreviewUrl(null)
    setPreviewFailed(false)
    if (!banner) return () => controller.abort()
    void runApiRead(call => api.events.createFileAccess(eventId, banner.id, call), { signal: controller.signal })
      .then(access => {
        if (controller.signal.aborted) return
        if (access.banner_thumbnail_url) setPreviewUrl(access.banner_thumbnail_url)
        else setPreviewFailed(true)
      })
      .catch(() => { if (!controller.signal.aborted) setPreviewFailed(true) })
    return () => controller.abort()
  }, [eventId, banner?.id, attempt])

  async function editCandidate(file: EventFile) {
    setCandidate(file)
    setCandidateUrl(null)
    setCandidateFailed(false)
    setFocal({ x: focalValue(file.banner_focal_x), y: focalValue(file.banner_focal_y) })
    setEditorMode('position')
    setIsPreparing(true)
    try {
      const access = await api.events.createFileAccess(eventId, file.id)
      if (access.banner_thumbnail_url) setCandidateUrl(access.banner_thumbnail_url)
      else setCandidateFailed(true)
    } catch {
      setCandidateFailed(true)
    } finally {
      setIsPreparing(false)
    }
  }

  async function uploadBanner() {
    if (!canManage || manager.busy) return
    setIsPreparing(true)
    const uploaded = await manager.addBannerImage()
    setIsPreparing(false)
    if (uploaded) await editCandidate(uploaded)
  }

  async function saveCandidate() {
    if (!candidate || manager.busy) return
    const result = await manager.updateBanner(candidate.id, focal.x, focal.y)
    if (!result) {
      Alert.alert('Banner not changed', 'The image remains in Files. Retry selecting it when your connection is stable.')
      return
    }
    setEditorMode(null)
    setCandidate(null)
  }

  function removeBanner() {
    if (!banner || manager.busy) return
    Alert.alert(
      'Remove event banner?',
      'The image will stay in Files and can be selected again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove banner', style: 'destructive', onPress: () => { void manager.updateBanner(null) } },
      ],
    )
  }

  if (!banner && !canManage) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        {banner && previewUrl && !previewFailed ? (
          <BannerCrop url={previewUrl} file={banner} onError={() => setPreviewFailed(true)} />
        ) : banner && previewFailed ? (
          <View style={styles.failure}>
            <Ionicons name="image-outline" size={23} color="#FFFFFF" />
            <Text style={styles.failureText}>Low-data banner preview unavailable</Text>
            <TouchableOpacity onPress={() => setAttempt(value => value + 1)} accessibilityLabel="Retry banner preview">
              <Text style={styles.failureAction}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : banner ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderIcon}>
              <Ionicons name="image-outline" size={23} color={colors.primary} />
            </View>
            <View style={styles.placeholderCopy}>
              <Text style={styles.placeholderTitle}>Add an event banner</Text>
              <Text style={styles.placeholderText}>Choose a private event image and set its important point.</Text>
            </View>
            <TouchableOpacity
              style={[styles.placeholderAction, manager.busy && styles.disabled]}
              onPress={() => setEditorMode('choose')}
              disabled={manager.busy}
              accessibilityRole="button"
              accessibilityLabel="Choose event banner"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.placeholderActionText}>Choose image</Text>
            </TouchableOpacity>
          </View>
        )}
        {banner ? <View style={styles.scrim} pointerEvents="none" /> : null}
        {banner ? (
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.bannerAction} onPress={() => onViewFull(banner)} accessibilityLabel="View full banner image">
              <Ionicons name="expand-outline" size={17} color="#FFFFFF" />
              <Text style={styles.bannerActionText}>View full</Text>
            </TouchableOpacity>
            {canManage ? (
              <TouchableOpacity style={styles.bannerAction} onPress={() => setEditorMode('choose')} disabled={manager.busy} accessibilityLabel="Change event banner">
                <Ionicons name="create-outline" size={17} color="#FFFFFF" />
                <Text style={styles.bannerActionText}>Change</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {banner && canManage ? (
        <View style={styles.manageRow}>
          <TouchableOpacity onPress={() => { void editCandidate(banner) }} disabled={manager.busy} accessibilityLabel="Adjust banner focal point">
            <Text style={styles.manageAction}>Adjust focal point</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={removeBanner} disabled={manager.busy} accessibilityLabel="Remove event banner">
            <Text style={styles.removeAction}>Remove banner</Text>
          </TouchableOpacity>
        </View>
      ) : banner && inactive ? <Text style={styles.readOnly}>Completed event · banner is read-only</Text> : null}

      <Modal visible={editorMode !== null} transparent animationType="slide" onRequestClose={() => setEditorMode(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditorMode(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>{editorMode === 'choose' ? 'Choose event banner' : 'Set focal point'}</Text>
                <Text style={styles.modalSubtitle}>{editorMode === 'choose'
                  ? 'Use an existing event image or upload one new image.'
                  : 'Tap the most important part of the full image. Every crop will keep it in view.'}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setEditorMode(null)} accessibilityLabel="Close banner editor">
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {editorMode === 'choose' ? (
              <ScrollView style={styles.choices} contentContainerStyle={styles.choiceContent}>
                <TouchableOpacity
                  style={[styles.uploadChoice, (manager.busy || isPreparing || manager.files.length >= EVENT_MAX_FILES) && styles.disabled]}
                  onPress={() => { void uploadBanner() }}
                  disabled={manager.busy || isPreparing || manager.files.length >= EVENT_MAX_FILES}
                  accessibilityLabel="Upload new banner image"
                >
                  {isPreparing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />}
                  <Text style={styles.uploadChoiceText}>{isPreparing ? 'Uploading…' : 'Upload new image'}</Text>
                </TouchableOpacity>
                {manager.files.length >= EVENT_MAX_FILES ? <Text style={styles.noImages}>The event already has {EVENT_MAX_FILES} files. You can still select an existing image, or delete a file first.</Text> : null}
                {manager.error ? <Text style={styles.error} accessibilityRole="alert">{manager.error}</Text> : null}
                {images.map(file => (
                  <TouchableOpacity key={file.id} style={styles.fileChoice} onPress={() => { void editCandidate(file) }} disabled={manager.busy} accessibilityLabel={`Use ${file.file_name} as banner`}>
                    <Ionicons name={file.is_banner ? 'checkmark-circle' : 'image-outline'} size={21} color={colors.primary} />
                    <Text style={styles.fileChoiceText} numberOfLines={2}>{file.file_name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
                {images.length === 0 ? <Text style={styles.noImages}>There are no images in Files yet. Upload one to continue.</Text> : null}
              </ScrollView>
            ) : candidate ? (
              <View>
                {candidateUrl && !candidateFailed ? (
                  <FocalPointPicker url={candidateUrl} x={focal.x} y={focal.y} onChange={setFocal} styles={styles} />
                ) : (
                  <View style={styles.editorFailure}>
                    {isPreparing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />}
                    <Text style={styles.editorFailureText}>{isPreparing ? 'Loading low-data preview…' : 'The low-data preview is unavailable. You can use the centred focal point or go back and retry.'}</Text>
                  </View>
                )}
                <View style={styles.editorActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditorMode('choose')} disabled={manager.busy}>
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, manager.busy && styles.disabled]} onPress={() => { void saveCandidate() }} disabled={manager.busy} accessibilityLabel="Save event banner">
                    {manager.busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    <Text style={styles.saveButtonText}>{manager.busy ? 'Saving…' : 'Save banner'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { marginBottom: 10 },
  banner: {
    width: '100%',
    height: 104,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#352D42',
    justifyContent: 'center',
  },
  placeholder: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F8F6FC' },
  placeholderIcon: { width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.primaryLight },
  placeholderCopy: { flex: 1, minWidth: 0 },
  placeholderTitle: { fontFamily: fonts.inter.bold, fontSize: 13, color: colors.textPrimary },
  placeholderText: { marginTop: 3, fontFamily: fonts.inter.regular, fontSize: 10, lineHeight: 14, color: colors.textSecondary },
  placeholderAction: { minHeight: 38, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.primary },
  placeholderActionText: { fontFamily: fonts.inter.bold, fontSize: 10, color: '#FFFFFF' },
  failure: { alignItems: 'center', justifyContent: 'center', gap: 3, padding: 8 },
  failureText: { fontFamily: fonts.inter.semiBold, fontSize: 10, color: '#FFFFFF' },
  failureAction: { fontFamily: fonts.inter.bold, fontSize: 10, color: '#DCC9FF' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  bannerActions: { position: 'absolute', right: 9, bottom: 8, flexDirection: 'row', gap: 6 },
  bannerAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 10, backgroundColor: 'rgba(20,16,25,0.68)' },
  bannerActionText: { fontFamily: fonts.inter.bold, fontSize: 10, color: '#FFFFFF' },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 7 },
  manageAction: { fontFamily: fonts.inter.semiBold, fontSize: 9, color: colors.primary },
  removeAction: { fontFamily: fonts.inter.semiBold, fontSize: 9, color: colors.error },
  readOnly: { paddingTop: 6, paddingHorizontal: 4, fontFamily: fonts.inter.regular, fontSize: 9, color: colors.textMuted },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13,13,13,0.46)' },
  modalDismiss: { flex: 1 },
  modalCard: { maxHeight: '82%', padding: 20, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  modalHeading: { flex: 1 },
  modalTitle: { fontFamily: fonts.inter.extraBold, fontSize: 19, color: colors.textPrimary },
  modalSubtitle: { marginTop: 4, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.background },
  choices: { maxHeight: 440 },
  choiceContent: { gap: 9, paddingBottom: 12 },
  uploadChoice: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: colors.primary },
  uploadChoiceText: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#FFFFFF' },
  fileChoice: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  fileChoiceText: { flex: 1, fontFamily: fonts.inter.semiBold, fontSize: 12, color: colors.textPrimary },
  noImages: { padding: 18, textAlign: 'center', fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  error: { paddingHorizontal: 8, fontFamily: fonts.inter.regular, fontSize: 11, lineHeight: 16, color: colors.error },
  focalPreview: { width: '100%', aspectRatio: 1.4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#17131D' },
  focalMarker: { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(123,47,255,0.52)' },
  focalMarkerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  focalControls: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  focalControl: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  focalPercent: { flex: 1, textAlign: 'right', fontFamily: fonts.inter.semiBold, fontSize: 11, color: colors.textSecondary },
  editorFailure: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, borderRadius: 14, backgroundColor: colors.background },
  editorFailureText: { textAlign: 'center', fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  editorActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  secondaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { fontFamily: fonts.inter.bold, fontSize: 13, color: colors.textPrimary },
  saveButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: colors.primary },
  saveButtonText: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
})
