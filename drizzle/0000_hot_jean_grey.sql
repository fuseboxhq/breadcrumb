CREATE TABLE "command_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" text NOT NULL,
	"command_name" text NOT NULL,
	"count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" text NOT NULL,
	"version" text NOT NULL,
	"os" text NOT NULL,
	"platform" text NOT NULL,
	"arch" text,
	"project_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"os" text,
	"arch" text,
	"version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "heartbeats_machine_date_idx" ON "heartbeats" USING btree ("machine_id","created_at");