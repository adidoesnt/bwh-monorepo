ALTER TABLE "invoice" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_stripeCheckoutSessionId_uidx" ON "invoice" USING btree ("stripe_checkout_session_id");