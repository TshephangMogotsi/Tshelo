import type { Metadata } from 'next'
import { CreateFundForm } from '@/components/account-funds/create-fund-form'

export const metadata: Metadata = { title: 'Create a fund', description: 'Create a new Tshelo fund.' }

export default function NewFundPage() {
  return <CreateFundForm />
}
