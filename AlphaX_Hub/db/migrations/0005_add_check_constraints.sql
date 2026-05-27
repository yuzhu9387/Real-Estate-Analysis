-- Add CHECK constraints that Drizzle Kit did not emit from the schema.

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('owner','pm','ic')),
  ADD CONSTRAINT "users_team_check" CHECK ("team" IS NULL OR "team" IN ('design','construction','sales'));

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_brand_check" CHECK ("brand" IN ('al_homes','alera','apex')),
  ADD CONSTRAINT "projects_status_check" CHECK ("status" IN ('draft','in_progress','complete','archived'));

ALTER TABLE "project_phases"
  ADD CONSTRAINT "project_phases_name_check" CHECK ("name" IN ('Permitting','Construction','Sale')),
  ADD CONSTRAINT "project_phases_status_check" CHECK ("status" IN ('pending','in_progress','complete'));

ALTER TABLE "project_workflows"
  ADD CONSTRAINT "project_workflows_status_check" CHECK ("status" IN ('pending','in_progress','complete'));

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_status_check" CHECK ("status" IN ('not_started','started','pending_review','approved','complete','wont_do'));

ALTER TABLE "workflow_template_task_deps"
  ADD CONSTRAINT "wt_no_self_dep" CHECK ("from_task_id" <> "to_task_id"),
  ADD CONSTRAINT "workflow_template_task_deps_dep_type_check" CHECK ("dependency_type" IN ('finish_to_start'));

ALTER TABLE "task_deps"
  ADD CONSTRAINT "td_no_self_dep" CHECK ("from_task_id" <> "to_task_id"),
  ADD CONSTRAINT "task_deps_dep_type_check" CHECK ("dependency_type" IN ('finish_to_start'));

ALTER TABLE "task_comments"
  ADD CONSTRAINT "task_comments_kind_check" CHECK ("kind" IN ('discussion','review_request','review_approve','review_revision'));
