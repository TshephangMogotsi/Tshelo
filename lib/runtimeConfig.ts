export function requirePublicConfig(name: string, value: string | undefined): string {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`Missing required public configuration: ${name}`)
  }
  return normalized
}
