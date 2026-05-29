-- db/migrations/0014_project_schedule_and_team.sql
-- Section 2 (schedule):
--   target_start_date           — anchors the cascade
--   target_permitting_duration_days     — user-supplied, days
--   target_construction_duration_days   — user-supplied, days
--   target_sales_duration_days          — user-supplied, days
--   target_exit_date            — computed (construction_end + sales_duration)
-- Existing columns we re-use as computed milestones:
--   target_permit_date          — computed (start + permitting_duration)
--   target_construction_end_date — computed (permit + construction_duration)
--   target_project_duration_days — computed (sum of the three phase durations)
--
-- Section 3 (team):
--   permitting_pm_id, construction_pm_id, sales_pm_id — optional per-phase owners

ALTER TABLE projects ADD COLUMN target_start_date                  date;
ALTER TABLE projects ADD COLUMN target_permitting_duration_days    integer;
ALTER TABLE projects ADD COLUMN target_construction_duration_days  integer;
ALTER TABLE projects ADD COLUMN target_sales_duration_days         integer;
ALTER TABLE projects ADD COLUMN target_exit_date                   date;

ALTER TABLE projects
  ADD COLUMN permitting_pm_id    uuid REFERENCES users(id),
  ADD COLUMN construction_pm_id  uuid REFERENCES users(id),
  ADD COLUMN sales_pm_id         uuid REFERENCES users(id);
