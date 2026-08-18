'use client'

import { TsheloApiError, TsheloApiProtocolError, type ApiCallOptions } from '@shared/api-client'

export function apiErrorMessage(error: unknown) {
  if (error instanceof TsheloApiError) return error.message
  if (error instanceof TsheloApiProtocolError) return 'The server returned an unexpected response. Please try again.'
  if (error instanceof TypeError || (error instanceof Error && error.message === 'Tshelo API request timed out.')) return 'Check your connection and try again.'
  if (error instanceof Error && error.name === 'AbortError') return ''
  return 'Something went wrong. Please try again.'
}

function shouldRetry(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) return false
  if (error instanceof TsheloApiError) return error.retryable
  return error instanceof TypeError || (error instanceof Error && error.message === 'Tshelo API request timed out.')
}

function wait(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      window.clearTimeout(timer)
      const error = new Error('Request cancelled.')
      error.name = 'AbortError'
      reject(error)
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, delay)
    if (signal?.aborted) cancel()
    else signal?.addEventListener('abort', cancel, { once: true })
  })
}

/** Retry safe reads once. Mutations deliberately call the API only once. */
export async function runApiRead<T>(
  operation: (call: ApiCallOptions) => Promise<T>,
  signal?: AbortSignal,
) {
  try {
    return await operation({ signal })
  } catch (error) {
    if (!shouldRetry(error, signal)) throw error
    await wait(300, signal)
    return operation({ signal })
  }
}
