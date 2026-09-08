'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TsheloApiError } from '@shared/api-client'
import type { EventFile } from '@shared/contracts'
import { eventFileError, EventFileInputError, runEventFileUpload, validateEventFile, validateEventFileCount, type EventFileOperations, type FileRemoval, type FileUpload } from '@shared/event-files'
import { createApiClient } from '@/lib/api-client'

export const transferEventFile: EventFileOperations['transfer'] = (asset, session, progress) => new Promise((resolve, reject) => {
  if (!asset.file) { reject(new EventFileInputError('Choose this file again to upload it.')); return }
  const request = new XMLHttpRequest()
  request.open('PUT', session.upload_url)
  request.timeout = 120_000
  request.withCredentials = false
  request.setRequestHeader('content-type', session.content_type)
  request.setRequestHeader('x-upsert', 'false')
  request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.min(100, Math.round(event.loaded / event.total * 100))) }
  request.onload = () => request.status >= 200 && request.status < 300
    ? resolve() : reject(new EventFileInputError('The upload did not finish. Check your connection and retry.'))
  request.onerror = () => reject(new TypeError('Upload connection failed.'))
  request.ontimeout = () => reject(new EventFileInputError('The upload timed out. Please retry.'))
  request.onabort = () => reject(new EventFileInputError('The upload was interrupted. Please retry.'))
  request.send(asset.file)
})

export function useEventFiles(eventId: string, canManage: boolean) {
  const [files, setFiles] = useState<EventFile[]>([])
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [removals, setRemovals] = useState<FileRemoval[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  const allowed = useRef(canManage)
  useEffect(() => { allowed.current = canManage }, [canManage])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const replaceFiles = useCallback((next: EventFile[]) => {
    setFiles(next)
    setUploads(current => current.filter(task => !next.some(file => file.id === task.uploadId)))
  }, [])

  const pending = busy || uploads.some(task => task.uploadId) || removals.length > 0
  useEffect(() => {
    if (!pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])

  useEffect(() => {
    if (!busy) return
    const preventNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const target = new URL(link.href, window.location.href)
      if (target.origin === window.location.origin && target.pathname === window.location.pathname) return
      event.preventDefault()
      setError('Please wait for the file operation to finish before leaving this event. You can switch event tabs while files upload.')
    }
    document.addEventListener('click', preventNavigation, true)
    return () => document.removeEventListener('click', preventNavigation, true)
  }, [busy])

  const operations: EventFileOperations = {
    createSession: input => createApiClient().events.createFileUploadSession(eventId, input),
    transfer: transferEventFile,
    finalize: upload_id => createApiClient().events.finalizeFile(eventId, { upload_id }),
    remove: id => createApiClient().events.removeFile(eventId, id),
  }

  async function work(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try { await action() } catch (cause) { if (mounted.current) setError(eventFileError(cause)) }
    finally { locked.current = false; if (mounted.current) setBusy(false) }
  }

  async function upload(task: FileUpload) {
    const saved = await runEventFileUpload(task, eventId, operations, () => allowed.current && mounted.current, next => {
      if (mounted.current) setUploads(current => current.map(item => item.key === task.key ? next : item))
    })
    if (!saved || !mounted.current) return
    setFiles(current => [saved, ...current.filter(file => file.id !== saved.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)))
    setUploads(current => current.filter(item => item.key !== task.key))
  }

  function addFiles(selected: File[]) {
    if (!allowed.current || !selected.length) return
    return work(async () => {
      validateEventFileCount(files.length + uploads.length, selected.length)
      const tasks = selected.map((file, index): FileUpload => {
        const asset = { name: file.name, size: file.size, mimeType: file.type, uri: '', file }
        return { key: `${Date.now()}-${index}`, asset, input: validateEventFile(asset), step: 'upload', status: 'queued' }
      })
      setUploads(current => [...current, ...tasks])
      for (const task of tasks) await upload(task)
    })
  }

  function retryUpload(task: FileUpload) {
    if (task.step === 'upload' && !allowed.current) return
    return work(() => upload(task))
  }

  function dismissUpload(task: FileUpload) {
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
          setRemovals(current => current.filter(item => item.file.id !== file.id))
          if (cause.code === 'NOT_FOUND') setFiles(current => current.filter(item => item.id !== file.id))
          setError(eventFileError(cause))
        } else setRemovals(current => current.map(item => item.file.id === file.id ? { file, error: eventFileError(cause) } : item))
      }
    })
  }

  function confirmRemove(file: EventFile) {
    if (!allowed.current || locked.current) return
    if (window.confirm(`Delete “${file.file_name}” from this event? Everyone will lose access. This cannot be undone.`) && allowed.current) return remove(file)
  }

  return { files, uploads, removals, busy, error, replaceFiles, addFiles, retryUpload, dismissUpload, confirmRemove, retryRemove: remove }
}
