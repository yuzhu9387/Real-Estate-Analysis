CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"pm_id" uuid NOT NULL,
	"title_holder" text,
	"project_strategy" text,
	"purchase_date" date,
	"purchase_price" numeric(14, 2),
	"target_exit_quarter" text,
	"target_project_duration_days" integer,
	"target_permit_date" date,
	"target_construction_end_date" date,
	"actual_permit_date" date,
	"actual_construction_end_date" date,
	"actual_duration_days" integer,
	"presale_phase1_date" date,
	"presale_phase2_date" date,
	"presale_phase3_date" date,
	"listing_date" date,
	"sold" boolean DEFAULT false NOT NULL,
	"sold_price" numeric(14, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"kicked_off_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"kicked_off_at" timestamp with time zone,
	"kicked_off_by_id" uuid,
	"marked_complete_at" timestamp with time zone,
	"marked_complete_by_id" uuid,
	CONSTRAINT "project_phases_project_id_sort_order_unique" UNIQUE("project_id","sort_order")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_pm_id_users_id_fk" FOREIGN KEY ("pm_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_kicked_off_by_id_users_id_fk" FOREIGN KEY ("kicked_off_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_marked_complete_by_id_users_id_fk" FOREIGN KEY ("marked_complete_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
