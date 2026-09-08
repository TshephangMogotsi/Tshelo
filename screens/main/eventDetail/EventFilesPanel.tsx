import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { EVENT_MAX_FILES, type EventFile } from '@shared/contracts'
import { api } from '../../../lib/api'
import { runApiRead } from '../../../lib/apiScreen'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'
import { formatEventFileSize } from './eventFiles'
import type { useEventFiles } from './useEventFiles'

type Props = {
  eventId: string
  manager: ReturnType<typeof useEventFiles>
  canManage: boolean
  inactive: boolean
  actionPath: string | null
  onPreview: (items: EventFile[], file: EventFile) => void
  onDownload: (file: EventFile) => void
}

function FileThumbnail({ eventId, file, disabled, onPreview }: {
  eventId: string; file: EventFile; disabled: boolean; onPreview: () => void
}) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setUrl(null)
    setFailed(false)
    void runApiRead(call => api.events.createFileAccess(eventId, file.id, call), { signal: controller.signal })
      .then(access => { if (!controller.signal.aborted) setUrl(access.download_url) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [eventId, file.id, attempt])

  if (failed) return (
    <TouchableOpacity style={styles.thumbnail} onPress={() => setAttempt(value => value + 1)} accessibilityRole="button" accessibilityLabel={`Retry thumbnail for ${file.file_name}`}>
      <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
      <Text style={styles.hint}>Preview unavailable</Text>
      <Text style={styles.actionText}>Tap to retry</Text>
    </TouchableOpacity>
  )
  return (
    <TouchableOpacity style={styles.thumbnail} disabled={disabled} onPress={onPreview} accessibilityRole="button" accessibilityLabel={`Preview ${file.file_name}`} accessibilityState={{ disabled }}>
      {url ? <Image source={{ uri: url }} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} /> : <ActivityIndicator color={colors.primary} />}
    </TouchableOpacity>
  )
}

export default function EventFilesPanel({ eventId, manager, canManage, inactive, actionPath, onPreview, onDownload }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { files, uploads, removals, busy } = manager
  const visible = files.filter(file => !removals.some(item => item.file.id === file.id))
  const images = visible.filter(file => file.content_type !== 'application/pdf')
  const documents = visible.filter(file => file.content_type === 'application/pdf')
  const atLimit = files.length + uploads.length >= EVENT_MAX_FILES

  function actions(file: EventFile, items: EventFile[]) {
    const acting = actionPath === file.object_path
    return (
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => onPreview(items, file)} disabled={actionPath !== null} accessibilityRole="button" accessibilityLabel={`Preview ${file.file_name}`} accessibilityState={{ disabled: actionPath !== null }}>
          {acting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="eye-outline" size={20} color={colors.primary} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onDownload(file)} disabled={actionPath !== null} accessibilityRole="button" accessibilityLabel={`Download or share ${file.file_name}`} accessibilityState={{ disabled: actionPath !== null }}>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        {canManage ? (
          <TouchableOpacity style={[styles.action, busy && styles.disabled]} onPress={() => manager.confirmRemove(file)} disabled={busy || actionPath !== null} accessibilityRole="button" accessibilityLabel={`Delete ${file.file_name}`} accessibilityState={{ disabled: busy || actionPath !== null }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">Event files</Text>
          <Text style={styles.hint}>{visible.length} of {EVENT_MAX_FILES} files · 10 MB each</Text>
        </View>
        {canManage ? (
          <TouchableOpacity style={[styles.addButton, (busy || atLimit) && styles.disabled]} onPress={manager.addFiles} disabled={busy || atLimit} accessibilityRole="button" accessibilityLabel="Add files" accessibilityState={{ disabled: busy || atLimit, busy }}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add" size={19} color="#FFFFFF" />}
            <Text style={styles.addText}>Add files</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.hint}>Images and PDFs shared with everyone in this event.</Text>
      {!canManage ? (
        <View style={styles.notice}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.noticeText}>{inactive
            ? 'This event is read-only. You can still preview, download, and share its files.'
            : 'Only organisers with file-management access can add or delete files. You can preview, download, and share them.'}</Text>
        </View>
      ) : <Text style={styles.hint}>{atLimit ? 'File limit reached. Remove a file or dismiss a failed upload to make room.' : 'PDF, JPG, PNG, or WEBP. Choose one or more files.'}</Text>}
      {manager.error ? <Text style={styles.error} accessibilityRole="alert">{manager.error}</Text> : null}
      {uploads.map(task => (
        <View key={task.key} style={styles.card}>
          <Text style={styles.fileName} numberOfLines={2}>{task.input.file_name}</Text>
          {task.status === 'failed' ? (
            <>
              <Text style={styles.error} accessibilityRole="alert">{task.error}</Text>
              {task.step === 'finalize' ? <Text style={styles.hint}>The save result is unconfirmed. Check again to avoid uploading a duplicate.</Text> : null}
              <View style={styles.actions}>
                {canManage || task.step !== 'upload' ? <TouchableOpacity style={styles.textAction} disabled={busy} onPress={() => manager.retryUpload(task)} accessibilityRole="button" accessibilityState={{ disabled: busy }}>
                  <Text style={styles.actionText}>{task.step === 'cleanup' ? 'Retry cleanup' : task.step === 'finalize' ? 'Check upload' : 'Retry upload'}</Text>
                </TouchableOpacity> : null}
                {!task.uploadId ? <TouchableOpacity style={styles.textAction} disabled={busy} onPress={() => manager.dismissUpload(task)} accessibilityRole="button" accessibilityLabel={`Dismiss failed upload ${task.input.file_name}`} accessibilityState={{ disabled: busy }}><Text style={styles.hint}>Dismiss</Text></TouchableOpacity> : null}
              </View>
            </>
          ) : (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.hint}>{task.status === 'queued' ? 'Waiting…' : task.step === 'finalize' ? 'Saving file…' : task.step === 'cleanup' ? 'Cleaning up unfinished upload…' : task.progress == null ? 'Preparing upload…' : `Uploading… ${task.progress}%`}</Text>
            </View>
          )}
        </View>
      ))}
      {removals.map(item => (
        <View key={item.file.id} style={styles.card}>
          <Text style={styles.fileName} numberOfLines={2}>{item.file.file_name}</Text>
          {item.error ? <>
            <Text style={styles.error} accessibilityRole="alert">Could not finish deleting. {item.error}</Text>
            <TouchableOpacity style={styles.textAction} disabled={busy} onPress={() => manager.retryRemove(item.file)} accessibilityRole="button" accessibilityLabel={`Retry deleting ${item.file.file_name}`} accessibilityState={{ disabled: busy }}><Text style={styles.actionText}>Retry deletion</Text></TouchableOpacity>
          </> : <View style={styles.status}><ActivityIndicator color={colors.primary} /><Text style={styles.hint}>Deleting file…</Text></View>}
        </View>
      ))}
      {visible.length === 0 && uploads.length === 0 && removals.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name="folder-open-outline" size={32} color={colors.primary} /></View>
          <Text style={styles.title}>No event files yet</Text>
          <Text style={styles.emptyText}>{canManage ? 'Add a programme, venue map, or photos for everyone to find in one place.' : inactive ? 'No files were added to this event.' : 'When an organiser adds images or documents, they’ll appear here.'}</Text>
        </View>
      ) : null}
      {images.length > 0 ? <>
        <Text style={styles.sectionTitle} accessibilityRole="header">Images · {images.length}</Text>
        <View style={styles.gallery}>{images.map(file => (
          <View key={file.id} style={styles.imageCard}>
            <FileThumbnail eventId={eventId} file={file} disabled={actionPath !== null} onPreview={() => onPreview(images, file)} />
            <View style={styles.imageCaption}>
              <Text style={styles.fileName} numberOfLines={2}>{file.file_name}</Text>
              <Text style={styles.hint}>{formatEventFileSize(file.size_bytes)}</Text>
              {actions(file, images)}
            </View>
          </View>
        ))}</View>
      </> : null}
      {documents.length > 0 ? <>
        <Text style={styles.sectionTitle} accessibilityRole="header">Documents · {documents.length}</Text>
        {documents.map(file => <View key={file.id} style={styles.card}>
          <View style={styles.documentHeading}>
            <Ionicons name="document-text-outline" size={28} color={colors.primary} />
            <View style={styles.heading}><Text style={styles.fileName} numberOfLines={2}>{file.file_name}</Text><Text style={styles.hint}>PDF · {formatEventFileSize(file.size_bytes)}</Text></View>
          </View>
          {actions(file, documents)}
        </View>)}
      </> : null}
    </View>
  )
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  panel: { gap: 12, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  heading: { flex: 1, minWidth: 100, gap: 4 },
  title: { fontFamily: fonts.inter.bold, fontSize: 18, color: colors.textPrimary },
  hint: { fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12 },
  addText: { fontFamily: fonts.inter.bold, fontSize: 13, color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.background },
  noticeText: { flex: 1, fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  card: { padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14 },
  fileName: { fontFamily: fonts.inter.semiBold, fontSize: 13, color: colors.textPrimary },
  error: { fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 18, color: colors.error },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontFamily: fonts.inter.semiBold, fontSize: 12, color: colors.primary },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon: { padding: 18, backgroundColor: colors.primaryLight, borderRadius: 24 },
  emptyText: { textAlign: 'center', fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  sectionTitle: { fontFamily: fonts.inter.bold, fontSize: 14, color: colors.textPrimary, marginTop: 8 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  imageCard: { width: '48%', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  thumbnail: { width: '100%', aspectRatio: 1.2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 4 },
  image: { width: '100%', height: '100%' },
  imageCaption: { paddingHorizontal: 8, paddingTop: 10, gap: 5 },
  documentHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
})
