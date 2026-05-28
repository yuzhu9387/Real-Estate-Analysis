-- db/migrations/0010_workflow_task_dates_drop_duration.sql
ALTER TABLE workflow_template_tasks DROP COLUMN default_duration_days;
