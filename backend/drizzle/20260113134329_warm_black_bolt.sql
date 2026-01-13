CREATE TABLE "analysis_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"transcription" text NOT NULL,
	"mood" text NOT NULL,
	"setting" text NOT NULL,
	"intensity" numeric(3, 2) NOT NULL,
	"narrative_event" text NOT NULL,
	"soundscape_suggestions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"preset" text DEFAULT 'Fantasy' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "analysis_logs" ADD CONSTRAINT "analysis_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_logs_session_id_idx" ON "analysis_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analysis_logs_timestamp_idx" ON "analysis_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");