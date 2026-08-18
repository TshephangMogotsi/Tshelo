import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Parses a receipt photo into structured expense data using Claude vision.
// Called by the authenticated API with a caller-owned private Storage path.
// Legacy base64 input remains accepted temporarily for deployed older clients.
// Requires the ANTHROPIC_API_KEY function secret.

const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('Tshelo_key')
const anthropic = new Anthropic({ apiKey: anthropicKey })
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const MAX_REQUEST_BYTES = 7_000_000
const MAX_IMAGE_BYTES = 5_000_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function base64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

// Mirrors CATEGORIES in screens/main/recordExpense/categories.ts
const CATEGORY_VALUES = [
  'casket_coffin', 'burial_site', 'hearse_transport', 'mortuary_fees',
  'death_certificate', 'grave_preparation', 'tombstone', 'flowers_wreaths',
  'church_fees', 'venue_hire', 'tent_marquee', 'chairs_tables', 'sound_system',
  'generator', 'catering_full', 'catering_tea', 'meat_livestock', 'groceries',
  'drinks_beverages', 'cooking_equipment', 'transport_family', 'transport_general',
  'accommodation', 'fuel', 'photography', 'videography', 'programs_printing',
  'decorations', 'lobola_cattle', 'lobola_cash', 'lobola_gifts', 'baby_gifts',
  'baby_essentials', 'kitchen_items', 'graduation_gown', 'graduation_photos',
  'miscellaneous', 'other',
]

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_receipt', 'vendor', 'date', 'total', 'items'],
  properties: {
    is_receipt: {
      type: 'boolean',
      description: 'False when the image is not a readable receipt or invoice',
    },
    vendor: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Shop or vendor name as printed on the receipt',
    },
    date: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Receipt date in YYYY-MM-DD format if visible',
    },
    total: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
      description: 'Grand total amount as printed',
    },
    items: {
      type: 'array',
      description: 'Line items; empty when unreadable',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount', 'category'],
        properties: {
          name: { type: 'string', description: 'Item description, cleaned up for display' },
          amount: { type: 'number', description: 'Line total for this item' },
          category: {
            type: 'string',
            enum: CATEGORY_VALUES,
            description: 'Best-fit expense category; use "other" when unsure',
          },
        },
      },
    },
  },
}

const PROMPT = `Extract the data from this receipt photo for an expense tracker used by community savings groups in Botswana.

- Amounts are in Botswana Pula unless clearly stated otherwise; return plain numbers without currency symbols.
- Receipts may be thermal-printed, faded, crumpled, handwritten, or mix English and Setswana — do your best.
- Combine quantity lines into a single item with the line total (e.g. "2 x Chibuku 15.00" -> name "Chibuku x2", amount 30).
- Skip non-purchase lines (change, cash tendered, VAT breakdowns, loyalty points).
- If the image is not a receipt or is too unreadable to extract anything, set is_receipt to false and return an empty items array.`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!anthropicKey || !supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Receipt parsing is not configured' }, 503)
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Image is too large' }, 413)
  }

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let image: string | undefined, mediaType: string, fundId: string, receiptPath: string | undefined
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType ?? 'image/jpeg'
    fundId = body.fundId
    receiptPath = body.receiptPath
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof fundId !== 'string' || !UUID_PATTERN.test(fundId)) {
    return json({ error: 'Invalid fund' }, 400)
  }
  const expectedPrefix = `${fundId}/${user.id}/`
  const usesStoredReceipt = typeof receiptPath === 'string' && receiptPath.length > 0
  if (usesStoredReceipt && (
    !receiptPath!.startsWith(expectedPrefix)
    || !/^[0-9a-f/-]+\.(?:jpg|png)$/i.test(receiptPath!)
  )) return json({ error: 'Invalid receipt path' }, 400)
  if (!usesStoredReceipt && (typeof image !== 'string' || image.length === 0)) {
    return json({ error: 'Missing image' }, 400)
  }
  if (!usesStoredReceipt && (image!.startsWith('data:') || Math.floor(image!.length * 3 / 4) > MAX_IMAGE_BYTES)) {
    return json({ error: 'Image is too large' }, 413)
  }

  const { data: allowed, error: allowanceError } = await callerClient
    .rpc('begin_receipt_parse', { p_fund_id: fundId })
  if (allowanceError) {
    console.error('receipt allowance check failed', allowanceError.code)
    return json({ error: 'Could not authorize receipt scan' }, 503)
  }
  if (!allowed) return json({ error: 'Receipt scan limit reached or fund access denied' }, 429)

  if (usesStoredReceipt) {
    const { data: storedReceipt, error: downloadError } = await callerClient.storage
      .from('receipts')
      .download(receiptPath!)
    if (downloadError || !storedReceipt) return json({ error: 'Receipt upload was not found' }, 404)
    if (storedReceipt.size > MAX_IMAGE_BYTES) return json({ error: 'Image is too large' }, 413)
    mediaType = storedReceipt.type || (receiptPath!.endsWith('.png') ? 'image/png' : 'image/jpeg')
    image = base64(new Uint8Array(await storedReceipt.arrayBuffer()))
  }
  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png') {
    return json({ error: 'Unsupported media type' }, 400)
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image! } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return json({ is_receipt: false, vendor: null, date: null, total: null, items: [] })
    }

    const text = response.content.find((block) => block.type === 'text')?.text
    if (!text) return json({ error: 'Empty model response' }, 502)

    return json(JSON.parse(text))
  } catch (error) {
    console.error('parse-receipt failed', error)
    return json({ error: 'Could not read the receipt' }, 502)
  }
})
