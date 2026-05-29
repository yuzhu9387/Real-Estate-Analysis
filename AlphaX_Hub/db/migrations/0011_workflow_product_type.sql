-- db/migrations/0011_workflow_product_type.sql
ALTER TABLE workflow_templates ADD COLUMN product_type text;

ALTER TABLE workflow_templates ADD CONSTRAINT workflow_templates_product_type_check
  CHECK (product_type IS NULL OR product_type IN (
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
    'al_homes_townhouses'
  ));
