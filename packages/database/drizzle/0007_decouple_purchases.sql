ALTER TABLE "booking" DROP CONSTRAINT "booking_intended_package_id_package_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "package_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_package_id_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" DROP COLUMN "intended_package_id";