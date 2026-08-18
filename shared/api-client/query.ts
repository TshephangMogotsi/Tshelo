import type { JsonPrimitive } from '../contracts/common'

type QueryValue = JsonPrimitive | readonly JsonPrimitive[] | undefined

/**
 * Serializes shared list contracts without inventing API-specific aliases.
 * Arrays are repeated query parameters, which the v1 route parsers accept.
 */
export function toQueryString(input: object | undefined) {
  if (!input) return ''

  const params = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(input as Record<string, QueryValue>)) {
    if (rawValue === undefined || rawValue === null) continue
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const value of values) {
      if (value !== undefined && value !== null) params.append(key, String(value))
    }
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}
