/**
 * Product types a workflow template can be associated with.
 * The identifier is what we store in the DB; the label is what the UI shows.
 *
 * The order here determines the order in the editor select and the list filter.
 * Identifiers are grouped by brand prefix (adu_, alera_, al_homes_).
 */
export const PRODUCT_TYPES = [
  'adu_pre_approved_program',
  'adu_site_specific_custom',
  'adu_site_specific_pre_approved_with_masterfile',
  'adu_site_specific_pre_approved_without_masterfile',
  'alera_remodel_addition_over_the_counter',
  'alera_remodel_addition_san_jose_5_day',
  'alera_remodel_addition_expedited',
  'alera_remodel_addition_regular_no_planning',
  'alera_remodel_addition_regular_with_planning',
  'al_homes_single_lot_sfh_no_planning',
  'al_homes_sfh_with_planning',
  'al_homes_sb9_no_lot_split',
  'al_homes_sb9_with_lot_split',
  'al_homes_lot_subdivision',
  'al_homes_duplex',
  'al_homes_townhouses',
] as const

export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  adu_pre_approved_program: 'ADU - Pre-Approved Program',
  adu_site_specific_custom: 'ADU - Site Specific Custom',
  adu_site_specific_pre_approved_with_masterfile:
    'ADU - Site Specific Pre-approved Model (with Masterfile #)',
  adu_site_specific_pre_approved_without_masterfile:
    'ADU - Site Specific Pre-approved Model (without Masterfile #)',
  alera_remodel_addition_over_the_counter: 'Alera - Remodel & Addition - Over the Counter',
  alera_remodel_addition_san_jose_5_day: 'Alera - Remodel & Addition - San Jose 5-Day Program',
  alera_remodel_addition_expedited: 'Alera - Remodel & Addition - Expedited Plan Check',
  alera_remodel_addition_regular_no_planning:
    'Alera - Remodel & Addition - Regular Plan Check (without planning review)',
  alera_remodel_addition_regular_with_planning:
    'Alera - Remodel & Addition - Regular Plan Check (with planning review)',
  al_homes_single_lot_sfh_no_planning:
    'AL Homes - Single Lot Single Family without planning review',
  al_homes_sfh_with_planning: 'AL Homes - SFH - With Planning Review',
  al_homes_sb9_no_lot_split:
    'AL Homes - Single Family New Construction: SB9 multi-units without lot split (3-4 units)',
  al_homes_sb9_with_lot_split:
    'AL Homes - Single Family New Construction: SB9 multi-units with lot split',
  al_homes_lot_subdivision: 'AL Homes - Lot Subdivision with Multiple Lots',
  al_homes_duplex: 'AL Homes - Multi-Families: Duplex',
  al_homes_townhouses: 'AL Homes - Multi-Families: Townhouses',
}

/** Short group label, useful for grouping in selects or badges. */
export function productTypeGroup(t: ProductType): 'ADU' | 'Alera' | 'AL Homes' {
  if (t.startsWith('adu_')) return 'ADU'
  if (t.startsWith('alera_')) return 'Alera'
  return 'AL Homes'
}

export function formatProductType(t: ProductType | null | undefined): string {
  if (!t) return '—'
  return PRODUCT_TYPE_LABELS[t] ?? t
}

export function isProductType(v: unknown): v is ProductType {
  return typeof v === 'string' && (PRODUCT_TYPES as readonly string[]).includes(v)
}
