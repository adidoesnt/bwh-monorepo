CREATE TABLE "booking_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"proposed_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "booking_proposal_status_check" CHECK ("booking_proposal"."status" in ('pending', 'accepted', 'declined', 'withdrawn')),
	CONSTRAINT "booking_proposal_proposed_by_check" CHECK ("booking_proposal"."proposed_by" in ('client', 'coach'))
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "booking_proposal" ADD CONSTRAINT "booking_proposal_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_proposal_bookingId_idx" ON "booking_proposal" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_proposal_one_pending_uidx" ON "booking_proposal" USING btree ("booking_id") WHERE "booking_proposal"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_cancelled_by_check" CHECK ("booking"."cancelled_by" is null or "booking"."cancelled_by" in ('client', 'coach'));