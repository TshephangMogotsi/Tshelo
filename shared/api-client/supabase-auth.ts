export type SupabaseSessionLike = {
  access_token: string
}

export type SupabaseAuthLike = {
  getSession(): Promise<{
    data: { session: SupabaseSessionLike | null }
    error: unknown
  }>
  refreshSession(): Promise<{
    data: { session: SupabaseSessionLike | null }
    error: unknown
  }>
}

/** Keeps Supabase refresh-token handling inside Supabase while exposing only
 * short-lived access tokens to the API client. */
export function createSupabaseTokenProvider(auth: SupabaseAuthLike) {
  return {
    async getAccessToken() {
      const { data, error } = await auth.getSession()
      return error ? null : data.session?.access_token ?? null
    },
    async refreshAccessToken() {
      const { data, error } = await auth.refreshSession()
      return error ? null : data.session?.access_token ?? null
    },
  }
}
