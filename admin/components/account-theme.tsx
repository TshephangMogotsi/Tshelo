'use client'

import { useEffect, useSyncExternalStore } from 'react'

export const ACCOUNT_THEME_PREFERENCES = ['light', 'system', 'dark'] as const
export type AccountThemePreference = (typeof ACCOUNT_THEME_PREFERENCES)[number]

const STORAGE_KEY = 'tshelo.account.theme'
const CHANGE_EVENT = 'tshelo-account-theme-change'

function validThemePreference(value: string | null): value is AccountThemePreference {
  return value !== null && ACCOUNT_THEME_PREFERENCES.includes(value as AccountThemePreference)
}

function readThemePreference(): AccountThemePreference {
  if (typeof window === 'undefined') return 'system'
  const value = window.localStorage.getItem(STORAGE_KEY)
  return validThemePreference(value) ? value : 'system'
}

function subscribeToThemePreference(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

export function useAccountThemePreference() {
  return useSyncExternalStore(subscribeToThemePreference, readThemePreference, () => 'system')
}

export function setAccountThemePreference(preference: AccountThemePreference) {
  window.localStorage.setItem(STORAGE_KEY, preference)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function AccountTheme() {
  const preference = useAccountThemePreference()

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      root.dataset.accountTheme = preference === 'system'
        ? (media.matches ? 'dark' : 'light')
        : preference
    }

    applyTheme()
    if (preference === 'system') media.addEventListener('change', applyTheme)
    return () => {
      media.removeEventListener('change', applyTheme)
      delete root.dataset.accountTheme
    }
  }, [preference])

  return null
}
