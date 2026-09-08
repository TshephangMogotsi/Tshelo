import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')

// Burn-down list: remove a path in the same commit that moves its data calls
// behind lib/api.ts. New direct Supabase data callers are never added here.
const LEGACY_DIRECT_SUPABASE_DATA_FILES = [
  'lib/pushNotifications.ts',
  'lib/smsWatcher.ts',
].sort()

const DIRECT_SUPABASE_DATA = /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/
const SUPABASE_IMPORT = /from\s+['"][^'"]*supabase['"]/
const MOBILE_API_IMPORT = /from\s+['"][^'"]*lib\/api['"]/

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function sourceFiles(relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath)
  const stat = fs.statSync(absolutePath)
  if (stat.isFile()) return [relativePath]

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relativePath, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(child)
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [child] : []
  })
}

function routeFiles(relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath)
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relativePath, entry.name)
    if (entry.isDirectory()) return routeFiles(child)
    return entry.name === 'route.ts' ? [child] : []
  })
}

describe('mobile API migration boundaries', () => {
  const mobileFiles = [
    ...sourceFiles('App.tsx'),
    ...sourceFiles('context'),
    ...sourceFiles('lib'),
    ...sourceFiles('screens'),
  ]

  it('freezes existing direct Supabase data access as a shrinking migration list', () => {
    const directCallers = mobileFiles
      .filter((file) => DIRECT_SUPABASE_DATA.test(read(file)))
      .sort()

    expect(directCallers).toEqual(LEGACY_DIRECT_SUPABASE_DATA_FILES)
  })

  it('blocks new direct Supabase imports outside the permanent auth boundary', () => {
    const permanentImports = new Set([
      'lib/api.ts',
      'context/AuthContext.tsx',
      'screens/auth/LoginScreen.tsx',
      'screens/auth/OTPScreen.tsx',
      'screens/auth/ProfileSetupScreen.tsx',
      'screens/auth/RegisterScreen.tsx',
      'screens/auth/RegistrationSuccessScreen.tsx',
    ])
    const legacyImports = new Set([
      ...LEGACY_DIRECT_SUPABASE_DATA_FILES,
      'screens/main/FundCreatedScreen.tsx',
    ])
    const unexpectedImports = mobileFiles
      .filter((file) => SUPABASE_IMPORT.test(read(file)))
      .filter((file) => !permanentImports.has(file) && !legacyImports.has(file))

    expect(unexpectedImports).toEqual([])
  })

  it('does not let a migrated screen retain a direct Supabase dependency', () => {
    const migratedScreens = sourceFiles('screens').filter((file) => MOBILE_API_IMPORT.test(read(file)))

    for (const file of migratedScreens) {
      const source = read(file)
      const authScreen = file.startsWith('screens/auth/')
      expect({ file, importsSupabase: SUPABASE_IMPORT.test(source) && !authScreen }).toEqual({
        file,
        importsSupabase: false,
      })
      expect({ file, callsSupabaseData: DIRECT_SUPABASE_DATA.test(source) }).toEqual({
        file,
        callsSupabaseData: false,
      })
    }
  })

  it('limits permanent auth-screen Supabase access to auth operations', () => {
    const legacy = new Set(LEGACY_DIRECT_SUPABASE_DATA_FILES)
    const authScreens = sourceFiles('screens/auth').filter((file) => SUPABASE_IMPORT.test(read(file)))

    for (const file of authScreens.filter((candidate) => !legacy.has(candidate))) {
      const source = read(file)
      expect(source).toMatch(/\bsupabase\s*\.\s*auth\b/)
      expect(source).not.toMatch(DIRECT_SUPABASE_DATA)
    }
  })

  it('keeps route handlers thin and caller-scoped', () => {
    for (const file of routeFiles('admin/app/api/v1')) {
      const source = read(file)
      expect({ file, createsClient: source.includes('createClient(') }).toEqual({
        file,
        createsClient: false,
      })
      expect({ file, queriesDatabase: /\bsupabase\s*\.\s*(?:from|rpc)\b/.test(source) }).toEqual({
        file,
        queriesDatabase: false,
      })
    }

    const authentication = read('admin/lib/api/auth.ts')
    expect(authentication).toContain('createCallerClient(accessToken)')
    expect(authentication).toContain('accessToken: async () => accessToken')
  })

  it('never introduces a service-role credential into the mobile or API boundary', () => {
    const boundaryFiles = [
      ...mobileFiles,
      ...sourceFiles('shared/api-client'),
      ...sourceFiles('shared/event-files.ts'),
      ...sourceFiles('admin/components/account-events'),
      ...sourceFiles('admin/lib/api'),
      ...sourceFiles('admin/lib/data').filter((file) => path.basename(file).startsWith('api')),
      ...routeFiles('admin/app/api/v1'),
    ]
    const boundary = boundaryFiles.map(read).join('\n')

    expect(boundary).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(boundary).not.toContain('SUPABASE_SECRET_KEY')
  })

  it('keeps both event Files clients behind typed API calls, with only signed binary storage transfers', () => {
    const callers = [
      'screens/main/eventDetail/useEventFiles.ts',
      'screens/main/eventDetail/attachmentAccess.ts',
      'screens/main/eventDetail/EventFilesPanel.tsx',
      'admin/components/account-events/use-event-files.ts',
      'admin/components/account-events/event-attachment-access.ts',
      'admin/components/account-events/event-files-panel.tsx',
      'admin/components/account-events/event-attachments.tsx',
      'shared/event-files.ts',
    ]
    for (const file of callers) {
      const source = read(file)
      expect({ file, bypass: /supabase-client|from\s+['"][^'"]*supabase|\.storage\s*\.|\.rpc\s*\(|\.from\(['"]event_files/.test(source) }).toEqual({ file, bypass: false })
      expect(source).not.toMatch(/getPublicUrl|\/storage\/v1\/object\/public|\/rest\/v1\/event_files/)
    }
    for (const file of [callers[0], callers[3]]) {
      const source = read(file)
      for (const operation of ['createFileUploadSession', 'finalizeFile', 'removeFile']) expect(source).toContain(`.events.${operation}(`)
      expect(source).toContain('session.upload_url')
      expect(source).toContain("'x-upsert'")
      expect(source).not.toMatch(/Authorization|Bearer|access_token/)
    }
    for (const file of [callers[1], callers[4]]) expect(read(file)).toContain('.events.createFileAccess(eventId, attachment.id, call)')
    expect(read('screens/main/eventDetail/eventFiles.ts')).toContain("export * from '@shared/event-files'")
    expect(read(callers[3])).toContain("from '@shared/event-files'")
  })
})
