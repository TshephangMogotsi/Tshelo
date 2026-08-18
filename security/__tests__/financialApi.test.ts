import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('contribution, expense, and receipt API slice', () => {
  const data = read('admin/lib/data/api-financial.ts')
  const client = read('shared/api-client/client.ts')
  const validation = read('admin/lib/api/validation.ts')
  const edgeFunction = read('supabase/functions/parse-receipt/index.ts')
  const mutationRoutes = [
    'admin/app/api/v1/contributions/route.ts',
    'admin/app/api/v1/contributions/[contributionId]/route.ts',
    'admin/app/api/v1/contributions/[contributionId]/refund/route.ts',
    'admin/app/api/v1/contributions/detected-assignment/route.ts',
    'admin/app/api/v1/pledge-allocations/route.ts',
    'admin/app/api/v1/sponsorship-allocations/route.ts',
    'admin/app/api/v1/expenses/route.ts',
    'admin/app/api/v1/expenses/[expenseId]/route.ts',
    'admin/app/api/v1/receipts/upload-session/route.ts',
    'admin/app/api/v1/receipts/parse/route.ts',
  ].map(read)

  it('authenticates before request bodies and path parameters are read', () => {
    for (const route of mutationRoutes) {
      const authentication = route.indexOf('authenticateApiRequest(request)')
      expect(authentication).toBeGreaterThan(-1)
      const body = route.indexOf('readValidatedJson(request')
      if (body >= 0) expect(authentication).toBeLessThan(body)
      const params = route.indexOf('await params')
      if (params >= 0) expect(authentication).toBeLessThan(params)
      expect(route).toContain("export const runtime = 'nodejs'")
    }
  })

  it('keeps caller identity server-owned and business rules in RLS/RPCs', () => {
    expect(data).toContain('tagged_by: actorUserId')
    expect(data).toContain('added_by: actorUserId')
    expect(data).toContain('created_by: actorUserId')
    expect(data).toContain("client.rpc('record_detected_contribution'")
    expect(data).not.toContain('service_role')
    expect(data).not.toContain('createClient(')
  })

  it('uses short-lived direct uploads and caller-scoped parse finalisation', () => {
    expect(data).toContain('createSignedUploadUrl(objectPath)')
    expect(data).toContain('validReceiptPath(objectPath, fundId, actorUserId)')
    expect(data).toContain("client.functions.invoke('parse-receipt'")
    expect(edgeFunction).toContain('body.receiptPath')
    expect(edgeFunction).toContain(".from('receipts')")
    expect(edgeFunction).toContain('.download(receiptPath!)')
    expect(edgeFunction).toContain(".rpc('begin_receipt_parse'")
  })

  it('strictly validates money, UUIDs, batches, media types, and receipt size', () => {
    for (const validator of [
      'validateCreateContributionRequest', 'validateUpdateContributionRequest',
      'validateRefundContributionRequest', 'validateDetectedPaymentAssignmentRequest',
      'validateCreatePledgeAllocationRequest', 'validateCreateSponsorshipAllocationRequest',
      'validateCreateExpensesRequest', 'validateUpdateExpenseRequest',
      'validateCreateReceiptUploadSessionRequest', 'validateParseReceiptRequest',
    ]) expect(validation).toContain(`function ${validator}`)
    expect(validation).toContain('MONEY_PATTERN')
    expect(validation).toContain('RECEIPT_MEDIA_TYPES.includes')
    expect(validation).toContain('5 * 1024 * 1024')
  })

  it('exposes all financial operations through the typed client', () => {
    for (const method of [
      'assignDetected(', 'listContributors(', 'listPledgeBalances(',
      'createPledgeAllocation(', 'createSponsorshipAllocation(',
      'createUploadSession(',
    ]) expect(client).toContain(method)
    expect(client).toContain("'/api/v1/receipts/parse'")
    expect(client).toContain("'/api/v1/expenses'")
  })

  it('removes direct Supabase data access from migrated mobile consumers', () => {
    const migrated = [
      'screens/main/AssignContributionScreen.tsx',
      'screens/main/RecordContributionScreen.tsx',
      'screens/main/RecordExpenseScreen.tsx',
      'screens/main/fundDetail/EditContributionModal.tsx',
      'screens/main/fundDetail/EditExpenseModal.tsx',
      'screens/main/recordExpense/receipt.ts',
    ]
    for (const file of migrated) {
      expect({ file, directData: /\bsupabase\s*\.\s*(?:from|rpc|functions|storage)\b/.test(read(file)) })
        .toEqual({ file, directData: false })
    }
  })
})
