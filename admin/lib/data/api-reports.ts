import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateFundExportRequest,
  FundExport,
  FundReportBundle,
} from '@shared/contracts/reports'
import { dataFailure, dataSuccess, type ApiDataResult } from './api-pagination'

function reportBundle(value: unknown): FundReportBundle | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as FundReportBundle
}

function exportRecord(value: unknown): FundExport | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return row as FundExport
}

export async function getApiFundReport(
  client: SupabaseClient,
  fundId: string,
): Promise<ApiDataResult<FundReportBundle | null>> {
  const result = await client.rpc('get_fund_report_bundle', { p_fund_id: fundId })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(reportBundle(result.data))
}

export async function createApiFundExport(
  client: SupabaseClient,
  fundId: string,
  input: CreateFundExportRequest,
): Promise<ApiDataResult<FundExport>> {
  const result = await client.rpc('log_fund_export', {
    p_fund_id: fundId,
    p_export_type: input.export_type,
  })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const created = exportRecord(result.data)
  if (!created) return dataFailure({ kind: 'database', error: { message: 'Export record was not returned.' } })
  return dataSuccess(created)
}
