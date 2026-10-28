CREATE TABLE "availability_exception" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"kind" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_exception_kind_check" CHECK ("availability_exception"."kind" in ('closed', 'open')),
	CONSTRAINT "availability_exception_dates_check" CHECK ("availability_exception"."end_date" >= "availability_exception"."start_date"),
	CONSTRAINT "availability_exception_minutes_check" CHECK ("availability_exception"."start_min" >= 0 and "availability_exception"."end_min" <= 1440 and "availability_exception"."start_min" < "availability_exception"."end_min")
);
--> statement-breakpoint
ALTER TABLE "availability_exception" ADD CONSTRAINT "availability_exception_coach_id_coach_profile_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exception_coachId_endDate_idx" ON "availability_exception" USING btree ("coach_id","end_date");