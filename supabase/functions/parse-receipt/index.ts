import Anthropic from 'npm:@anthropic-ai/sdk'

// Parses a receipt photo into structured expense data using Claude vision.
// Called from the app via supabase.functions.invoke('parse-receipt') with
// { image: <base64 jpeg/png>, mediaType: 'image/jpeg' | 'image/png' }.
// Requires the ANTHROPIC_API_KEY function secret.

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

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

  let image: string, mediaType: string
  try {
    const body = await req.json()
    image = body.image
    mediaType = body.mediaType ?? 'image/jpeg'
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof image !== 'string' || image.length === 0) {
    return json({ error: 'Missing image' }, 400)
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
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
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
