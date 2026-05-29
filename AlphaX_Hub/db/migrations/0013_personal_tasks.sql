-- db/migrations/0013_personal_tasks.sql
-- Personal tasks: tasks not attached to a project (created from /my-tasks Quick Add).
-- Drop NOT NULL on the project/workflow/sortOrder columns. FK + cascade rules are unchanged
-- (cascade still fires when a referenced project/workflow is deleted; NULL just means the
-- task isn't attached to anything).

ALTER TABLE tasks ALTER COLUMN project_id          DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN project_workflow_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN sort_order          DROP NOT NULL;
