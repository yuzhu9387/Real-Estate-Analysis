ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_priority_check" CHECK ("priority" IN ('low','normal','high'));