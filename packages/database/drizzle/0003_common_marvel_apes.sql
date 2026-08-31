ALTER TABLE "user" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD COLUMN "timezone" text DEFAULT 'Asia/Singapore' NOT NULL;