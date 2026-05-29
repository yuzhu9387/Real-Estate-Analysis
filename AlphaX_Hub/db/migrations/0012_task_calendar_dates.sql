-- db/migrations/0012_task_calendar_dates.sql
-- Add calendar-date columns alongside the existing day-offset columns on tasks.
-- target_*_date are populated at project kickoff (kickedOffAt + planned_*_day).
-- actual_*_date are populated when the owner clicks Start / Complete.
-- No backfill — existing rows stay NULL until they are re-saved or the owner manually triggers.

ALTER TABLE tasks ADD COLUMN target_start_date date;
ALTER TABLE tasks ADD COLUMN target_end_date   date;
ALTER TABLE tasks ADD COLUMN actual_start_date date;
ALTER TABLE tasks ADD COLUMN actual_end_date   date;
