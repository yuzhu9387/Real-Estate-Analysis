-- db/migrations/0009_workflow_task_dates_add.sql
-- Add per-task start/end day columns (half-open, 1-indexed); add workflow-level aggregates.
-- Backfill from existing default_duration_days + FS deps.

ALTER TABLE workflow_template_tasks
  ADD COLUMN default_start_day integer,
  ADD COLUMN default_end_day   integer;

ALTER TABLE workflow_templates
  ADD COLUMN total_start_day    integer NOT NULL DEFAULT 0,
  ADD COLUMN total_end_day      integer NOT NULL DEFAULT 0,
  ADD COLUMN total_duration_days integer NOT NULL DEFAULT 0;

-- Backfill per-task dates by topo-sorting deps inside each template.
DO $$
DECLARE
  tpl_row RECORD;
  task_row RECORD;
  pred_end integer;
  computed_start integer;
BEGIN
  FOR tpl_row IN SELECT id FROM workflow_templates LOOP
    -- Fixed-point: keep looping until no task changes.
    LOOP
      DECLARE changed boolean := false;
      BEGIN
        FOR task_row IN
          SELECT id, default_duration_days
          FROM workflow_template_tasks
          WHERE workflow_template_id = tpl_row.id
            AND default_start_day IS NULL
        LOOP
          -- Are all predecessors of this task already backfilled?
          IF NOT EXISTS (
            SELECT 1 FROM workflow_template_task_deps d
            JOIN workflow_template_tasks t ON t.id = d.from_task_id
            WHERE d.to_task_id = task_row.id
              AND t.default_end_day IS NULL
          ) THEN
            -- Compute start = max(predecessor.end + lag) OR 1 if none.
            SELECT COALESCE(MAX(t.default_end_day + d.lag_days), 1)
              INTO computed_start
              FROM workflow_template_task_deps d
              JOIN workflow_template_tasks t ON t.id = d.from_task_id
              WHERE d.to_task_id = task_row.id;
            UPDATE workflow_template_tasks
               SET default_start_day = computed_start,
                   default_end_day   = computed_start + task_row.default_duration_days
             WHERE id = task_row.id;
            changed := true;
          END IF;
        END LOOP;
        EXIT WHEN NOT changed;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Lock down per-task columns.
ALTER TABLE workflow_template_tasks
  ALTER COLUMN default_start_day SET NOT NULL,
  ALTER COLUMN default_end_day   SET NOT NULL;

ALTER TABLE workflow_template_tasks
  ADD CONSTRAINT chk_default_end_after_start CHECK (default_end_day >= default_start_day);

-- Backfill workflow-level aggregates.
UPDATE workflow_templates t SET
  total_start_day    = COALESCE(sub.min_s, 0),
  total_end_day      = COALESCE(sub.max_e, 0),
  total_duration_days = COALESCE(sub.max_e - sub.min_s, 0)
FROM (
  SELECT workflow_template_id, MIN(default_start_day) AS min_s, MAX(default_end_day) AS max_e
  FROM workflow_template_tasks
  GROUP BY workflow_template_id
) sub
WHERE t.id = sub.workflow_template_id;
