export type CategoryOption = { value: string; label: string }

export const CATEGORIES: CategoryOption[] = [
  { value: 'casket_coffin',     label: 'Casket / Coffin' },
  { value: 'burial_site',       label: 'Burial Site' },
  { value: 'hearse_transport',  label: 'Hearse & Transport' },
  { value: 'mortuary_fees',     label: 'Mortuary Fees' },
  { value: 'death_certificate', label: 'Death Certificate' },
  { value: 'grave_preparation', label: 'Grave Preparation' },
  { value: 'tombstone',         label: 'Tombstone' },
  { value: 'flowers_wreaths',   label: 'Flowers & Wreaths' },
  { value: 'church_fees',       label: 'Church Fees' },
  { value: 'venue_hire',        label: 'Venue Hire' },
  { value: 'tent_marquee',      label: 'Tent / Marquee' },
  { value: 'chairs_tables',     label: 'Chairs & Tables' },
  { value: 'sound_system',      label: 'Sound System' },
  { value: 'generator',         label: 'Generator' },
  { value: 'catering_full',     label: 'Catering (Full)' },
  { value: 'catering_tea',      label: 'Catering (Tea)' },
  { value: 'meat_livestock',    label: 'Meat & Livestock' },
  { value: 'groceries',         label: 'Groceries' },
  { value: 'drinks_beverages',  label: 'Drinks & Beverages' },
  { value: 'cooking_equipment', label: 'Cooking Equipment' },
  { value: 'transport_family',  label: 'Family Transport' },
  { value: 'transport_general', label: 'General Transport' },
  { value: 'accommodation',     label: 'Accommodation' },
  { value: 'fuel',              label: 'Fuel' },
  { value: 'photography',       label: 'Photography' },
  { value: 'videography',       label: 'Videography' },
  { value: 'programs_printing', label: 'Programs & Printing' },
  { value: 'decorations',       label: 'Decorations' },
  { value: 'lobola_cattle',     label: 'Lobola – Cattle' },
  { value: 'lobola_cash',       label: 'Lobola – Cash' },
  { value: 'lobola_gifts',      label: 'Lobola – Gifts' },
  { value: 'baby_gifts',        label: 'Baby Gifts' },
  { value: 'baby_essentials',   label: 'Baby Essentials' },
  { value: 'kitchen_items',     label: 'Kitchen Items' },
  { value: 'graduation_gown',   label: 'Graduation Gown' },
  { value: 'graduation_photos', label: 'Graduation Photos' },
  { value: 'miscellaneous',     label: 'Miscellaneous' },
  { value: 'other',             label: 'Other' },
]

const CATEGORY_DOT_COLORS = ['#DC2626', '#D97706', '#059669', '#7B2FFF', '#2563EB', '#92400E', '#0D9488', '#71717A']

export function categoryColor(index: number): string {
  return CATEGORY_DOT_COLORS[index % CATEGORY_DOT_COLORS.length]
}

export const MAX_EXPENSE_BWP = 10000
