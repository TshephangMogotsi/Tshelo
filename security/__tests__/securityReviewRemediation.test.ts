import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('5 October security review remediation', () => {
  const migration = read('supabase/migrations/20261009110000_close_profile_receipt_and_membership_gaps.sql')
  const encryptionMigration = read('supabase/migrations/20261013100000_encrypt_payment_identifiers.sql')
  const parser = read('supabase/functions/parse-receipt/index.ts')
  const financialApi = read('admin/lib/data/api-financial.ts')

  it('removes direct payment, consent, and consent-log mutation privileges', () => {
    expect(migration).toContain('REVOKE UPDATE (')
    for (const field of ['mobile_money_number', 'bank_account_number', 'terms_accepted_at', 'marketing_consent_at', 'data_processing_consent_at']) {
      expect(migration).toContain(field)
    }
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.consent_log FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('mobile_money_verified = CASE WHEN mobile_changed THEN false')
    expect(migration).toContain('bank_account_verified = CASE WHEN bank_changed THEN false')
    expect(migration).toContain("'Payment details changed'")
  })

  it('keeps receipt model results server-authored and user edits immutable', () => {
    expect(migration).toContain('CREATE TABLE public.receipt_scan_audit_log')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
    expect(migration).toContain('AND completed_at IS NULL')
    expect(parser).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")
    expect(parser).toContain('p_user_id: userId')
    expect(parser).toContain('modelVersion = MODEL')
    expect(financialApi).toContain("typeof parsed.audit_id === 'string'")
  })

  it('replaces every assessed legacy membership policy', () => {
    const policies = [
      'contribution_edits_select', 'contribution_reminders_select', 'expense_edits_select',
      'expense_queries_insert', 'expense_queries_select', 'fund_announcements_select',
      'fund_exports_select', 'fund_milestones_select', 'ownership_history_select',
      'fund_shares_insert', 'fund_shares_select', 'succession_requests_insert',
      'succession_requests_select', 'succession_votes_insert', 'succession_votes_select',
      'fund_reports_insert', 'rich_auntie_insert', 'rich_auntie_select',
      'vouches_insert', 'vouches_select',
    ]
    for (const policy of policies) {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${policy}`)
      const start = migration.indexOf(`CREATE POLICY ${policy}`)
      expect(start).toBeGreaterThanOrEqual(0)
      expect(migration.slice(start, start + 500)).toMatch(/is_fund_(?:member|owner)\(/)
    }
    expect(migration).toContain('reported_by = auth.uid()')
    expect(migration).toContain('voter_user_id = auth.uid()')
    expect(migration).toContain('voucher_user_id = auth.uid()')
  })

  it('encrypts payment identifiers with a Vault-owned key and removes plaintext', () => {
    expect(encryptionMigration).toContain("payment_identifiers_encryption_v1")
    expect(encryptionMigration).toContain('extensions.gen_random_bytes(32)')
    expect(encryptionMigration).toContain('extensions.pgp_sym_encrypt')
    expect(encryptionMigration).toContain('cipher-algo=aes256')
    expect(encryptionMigration).toContain('mobile_money_number_ciphertext')
    expect(encryptionMigration).toContain('bank_account_number_ciphertext')
    expect(encryptionMigration).toContain('mobile_money_number = NULL')
    expect(encryptionMigration).toContain('bank_account_number = NULL')
    expect(encryptionMigration).toContain("auth.role() IS DISTINCT FROM 'service_role'")
    expect(encryptionMigration).toContain('REVOKE ALL ON FUNCTION public.decrypt_payment_identifier(bytea)')
    expect(encryptionMigration).not.toContain('GRANT EXECUTE ON FUNCTION public.decrypt_payment_identifier')
  })
})
