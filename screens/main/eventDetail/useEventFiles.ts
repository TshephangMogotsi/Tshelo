import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { TsheloApiError } from '@shared/api-client'
import { EVENT_FILE_MEDIA_TYPES, type EventFile } from '@shared/contracts'
import { api } from '../../../lib/api'
import {
  eventFileError, EventFileInputError, runEventFileUpload, validateEventFile, validateEventFileCount,
  type EventFileOperations, type FileRemoval, type FileUpload,
} from './eventFiles'

const transfer: EventFileOperations['transfer'] = async (asset, session, progress) => {
  const headers = { 'content-type': session.content_type, 'x-upsert': 'false' }
  let status: number | undefined
  if (Platform.OS === 'web') {
    const body = asset.file ?? await fetch(asset.uri).then(response => response.blob())
    status = (await fetch(session.upload_url, { method: 'PUT', headers, body })).status
  } else {
    const task = FileSystem.createUploadTask(session.upload_url, asset.uri, {
      httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers,
    }, data => {
      if (data.totalBytesExpectedToSend > 0) progress(Math.min(100, Math.round(data.totalBytesSent / data.totalBytesExpectedToSend * 100)))
    })
    status = (await task.uploadAsync())?.status
  }
  if (status == null || status < 200 || status >= 300) throw new EventFileInputError('The upload did not finish. Check your connection and retry.')
}

export function useEventFiles(eventId: string, canManage: boolean) {
  const [files, setFiles] = useState<EventFile[]>([])
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [removals, setRemovals] = useState<FileRemoval[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  const allowed = useRef(canManage)
  allowed.current = canManage
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const replaceFiles = useCallback((next: EventFile[]) => {
    setFiles(next)
    // Reconcile a successful finalisation whose response was lost.
    setUploads(current => current.filter(task => !next.some(file => file.id === task.uploadId)))
  }, [])

  const operations: EventFileOperations = {
    createSession: input => api.events.createFileUploadSession(eventId, input),
    transfer,
    finalize: upload_id => api.events.finalizeFile(eventId, { upload_id }),
    remove: id => api.events.removeFile(eventId, id),
  }

  async function work<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try { return await action() } catch (cause) { if (mounted.current) setError(eventFileError(cause)) }
    finally { locked.current = false; if (mounted.current) setBusy(false) }
  }

  async function upload(task: FileUpload) {
    const saved = await runEventFileUpload(task, eventId, operations, () => allowed.current && mounted.current, next => {
      if (mounted.current) setUploads(current => current.map(item => item.key === next.key ? next : item))
    })
    if (saved && mounted.current) {
      setFiles(current => [saved, ...current.filter(file => file.id !== saved.id)]
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)))
      setUploads(current => current.filter(item => item.key !== task.key))
    }
    return saved
  }

  function addFiles() {
    if (!allowed.current) return
    return work(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: [...EVENT_FILE_MEDIA_TYPES], copyToCacheDirectory: true, multiple: true })
      if (result.canceled) return
      validateEventFileCount(files.length + uploads.length, result.assets.length)
      const tasks = await Promise.all(result.assets.map(async (asset, index): Promise<FileUpload> => {
        const info = asset.size == null && !asset.file ? await FileSystem.getInfoAsync(asset.uri) : null
        const size = asset.size ?? asset.file?.size ?? (info?.exists && 'size' in info ? info.size : undefined)
        return { key: `${Date.now()}-${index}`, asset, input: validateEventFile({ ...asset, size }), step: 'upload', status: 'queued' }
      }))
      if (!mounted.current) return
      setUploads(current => [...current, ...tasks])
      // Keep successful files even if another file fails; retries target only failed items.
      for (const task of tasks) await upload(task)
    })
  }

  function addBannerImage() {
    if (!allowed.current) return Promise.resolve(null)
    return work(async () => {
      validateEventFileCount(files.length + uploads.length, 1)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled) return null
      const asset = result.assets[0]
      const info = asset.size == null && !asset.file ? await FileSystem.getInfoAsync(asset.uri) : null
      const size = asset.size ?? asset.file?.size ?? (info?.exists && 'size' in info ? info.size : undefined)
      const task: FileUpload = {
        key: `${Date.now()}-banner`,
        asset,
        input: validateEventFile({ ...asset, size }),
        step: 'upload',
        status: 'queued',
      }
      if (!task.input.content_type.startsWith('image/')) {
        throw new EventFileInputError('Choose a JPG, PNG, or WEBP image for the event banner.')
      }
      if (!mounted.current) return null
      setUploads(current => [...current, task])
      return await upload(task)
    }).then(result => result ?? null)
  }

  function updateBanner(fileId: string | null, focalX = 0.5, focalY = 0.5) {
    if (!allowed.current) return Promise.resolve(null)
    return work(async () => {
      const result = await api.events.updateBanner(eventId, {
        file_id: fileId,
        ...(fileId ? { focal_x: focalX, focal_y: focalY } : {}),
      })
      if (mounted.current) {
        setFiles(current => current.map(file => ({
          ...file,
          is_banner: result.file_id === file.id,
          ...(result.file_id === file.id
            ? { banner_focal_x: result.focal_x, banner_focal_y: result.focal_y }
            : {}),
        })))
      }
      return result
    }).then(result => result ?? null)
  }

  function retryUpload(task: FileUpload) {
    if (task.step === 'upload' && !allowed.current) return
    return work(() => upload(task))
  }

  function dismissUpload(task: FileUpload) {
    // An uncertain finalisation must be reconciled, never silently discarded/deleted.
    if (locked.current || task.uploadId) return
    setUploads(current => current.filter(item => item.key !== task.key))
  }

  function remove(file: EventFile) {
    return work(async () => {
      setRemovals(current => [...current.filter(item => item.file.id !== file.id), { file }])
      try {
        await operations.remove(file.id)
        if (!mounted.current) return
        setFiles(current => current.filter(item => item.id !== file.id))
        setRemovals(current => current.filter(item => item.file.id !== file.id))
      } catch (cause) {
        if (!mounted.current) return
        if (cause instanceof TsheloApiError && ['FORBIDDEN', 'CONFLICT', 'NOT_FOUND'].includes(cause.code)) {
          // A definitive rejection happened before deletion. Keep remaining files readable.
          setRemovals(current => current.filter(item => item.file.id !== file.id))
          if (cause.code === 'NOT_FOUND') setFiles(current => current.filter(item => item.id !== file.id))
          setError(eventFileError(cause))
        } else {
          setRemovals(current => current.map(item => item.file.id === file.id ? { file, error: eventFileError(cause) } : item))
        }
      }
    })
  }

  function confirmRemove(file: EventFile) {
    if (!allowed.current || locked.current) return
    const bannerWarning = file.is_banner
      ? ' This is the event banner, so deleting it will also remove the banner from the event.'
      : ''
    Alert.alert('Delete file?', `Remove “${file.file_name}” from this event? Everyone will lose access.${bannerWarning} This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete file', style: 'destructive', onPress: () => { if (allowed.current) return remove(file) } },
    ])
  }

  return {
    files, uploads, removals, busy, error, replaceFiles,
    addFiles, addBannerImage, updateBanner, retryUpload, dismissUpload,
    confirmRemove, retryRemove: remove,
  }
}
