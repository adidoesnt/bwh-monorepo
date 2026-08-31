CREATE TABLE "credit_ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"booking_id" text,
	"purchase_id" text,
	"delta" numeric(5, 2) NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"client_id" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"purchase_id" text,
	"booking_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"session_count" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"credit_expiry_months" integer DEFAULT 3 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"package_id" text NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"price_paid_cents" integer NOT NULL,
	"credits_granted" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"coach_id" text NOT NULL,
	"type" text NOT NULL,
	"location" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"duration_min" integer NOT NULL,
	"credit_cost" numeric(4, 2) NOT NULL,
	"status" text NOT NULL,
	"client_note" text,
	"session_notes" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"speciality" text NOT NULL,
	"tagline" text NOT NULL,
	"bio" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"rate_from_cents" integer NOT NULL,
	"locations" text[] DEFAULT '{}' NOT NULL,
	"coaching_since" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_response" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"coach_id" text,
	"parq_answers" jsonb NOT NULL,
	"parq_flag" boolean NOT NULL,
	"goals" text[] DEFAULT '{}' NOT NULL,
	"training_experience" text,
	"injuries_text" text,
	"weekly_target" text,
	"signature" text,
	"consent_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"taken_on" date NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"metric" text NOT NULL,
	"recorded_on" date NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"escalated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_purchase_id_package_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."package_purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_purchase_id_package_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."package_purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchase" ADD CONSTRAINT "package_purchase_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchase" ADD CONSTRAINT "package_purchase_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_coach_id_coach_profile_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slot" ADD CONSTRAINT "availability_slot_coach_id_coach_profile_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profile" ADD CONSTRAINT "coach_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_response" ADD CONSTRAINT "intake_response_coach_id_coach_profile_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entry" ADD CONSTRAINT "progress_entry_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_entry_clientId_idx" ON "credit_ledger_entry" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_uidx" ON "invoice" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoice_clientId_idx" ON "invoice" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "package_purchase_clientId_idx" ON "package_purchase" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "booking_clientId_idx" ON "booking" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "booking_coachId_idx" ON "booking" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "booking_startsAt_idx" ON "booking" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "availability_slot_coachId_idx" ON "availability_slot" USING btree ("coach_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_profile_userId_uidx" ON "coach_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_profile_slug_uidx" ON "coach_profile" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_response_clientId_uidx" ON "intake_response" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "measurement_clientId_kind_idx" ON "measurement" USING btree ("client_id","kind");--> statement-breakpoint
CREATE INDEX "progress_entry_clientId_metric_idx" ON "progress_entry" USING btree ("client_id","metric");--> statement-breakpoint
CREATE INDEX "chat_message_clientId_createdAt_idx" ON "chat_message" USING btree ("client_id","created_at");