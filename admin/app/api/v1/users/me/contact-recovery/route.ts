import { handleContactRecovery } from '@/lib/contact-recovery-server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handleContactRecovery(request)
}
