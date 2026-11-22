CREATE TYPE "public"."memory_type" AS ENUM('user', 'feedback', 'project', 'reference');--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" text,
	"type" "memory_type" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memories_project_name_key" UNIQUE NULLS NOT DISTINCT("project","name")
);
--> statement-breakpoint
CREATE INDEX "memories_project_type_idx" ON "memories" USING btree ("project","type");