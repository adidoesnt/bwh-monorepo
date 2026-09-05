-- Phase 5.5: breaking billing-model change (global credits → coach packages).
-- No production data yet; the seed is the source of truth. Clear the affected
-- tables so the new NOT NULL columns can be added.
DELETE FROM "invoice";--> statement-breakpoint
DELETE FROM "booking";--> statement-breakpoint
DELETE FROM "package_purchase";--> statement-breakpoint
DELETE FROM "package";--> statement-breakpoint
CREATE TABLE "session_ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"booking_id" text,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "credit_ledger_entry" CASCADE;--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "coach_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "session_length_min" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "price_per_session_cents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "package" ADD COLUMN "validity_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "package_purchase" ADD COLUMN "sessions_granted" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "package_purchase" ADD COLUMN "session_length_min" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "package_purchase_id" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "intended_package_id" text;--> statement-breakpoint
ALTER TABLE "session_ledger_entry" ADD CONSTRAINT "session_ledger_entry_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_ledger_entry" ADD CONSTRAINT "session_ledger_entry_purchase_id_package_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."package_purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_ledger_entry" ADD CONSTRAINT "session_ledger_entry_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_ledger_entry_clientId_idx" ON "session_ledger_entry" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "session_ledger_entry_purchaseId_idx" ON "session_ledger_entry" USING btree ("purchase_id");--> statement-breakpoint
ALTER TABLE "package" ADD CONSTRAINT "package_coach_id_coach_profile_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profile"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_package_purchase_id_package_purchase_id_fk" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_intended_package_id_package_id_fk" FOREIGN KEY ("intended_package_id") REFERENCES "public"."package"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_coachId_idx" ON "package" USING btree ("coach_id");--> statement-breakpoint
ALTER TABLE "package" DROP COLUMN "price_cents";--> statement-breakpoint
ALTER TABLE "package" DROP COLUMN "credit_expiry_months";--> statement-breakpoint
ALTER TABLE "package_purchase" DROP COLUMN "credits_granted";--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "credit_cost";--> statement-breakpoint
ALTER TABLE "coach_profile" DROP COLUMN "rate_from_cents";