CREATE TYPE "public"."brief_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('held', 'released', 'refunded', 'split', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."health_state" AS ENUM('on_track', 'at_risk', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'funded', 'in_progress', 'submitted', 'revision_requested', 'approved', 'released', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('buyer', 'buyer_member', 'seller', 'seller_member', 'admin_observer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_rail" AS ENUM('stripe_connect', 'stripe_global_payouts', 'payoneer', 'manual_bank');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'requirements_submitted', 'active', 'completed', 'reviewed', 'paused', 'cancellation_requested', 'cancelled', 'disputed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('sent', 'withdrawn', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE SEQUENCE "public"."project_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."invoice_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_id" uuid NOT NULL,
	"org_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"structured" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_min_amount" bigint,
	"budget_max_amount" bigint,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"status" "brief_status" DEFAULT 'open' NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"title" text NOT NULL,
	"acceptance_criteria" text,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"planned_start" date,
	"planned_due" date,
	"actual_submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"auto_approve_at" timestamp with time zone,
	"revision_count" smallint DEFAULT 0 NOT NULL,
	"submission_note" text,
	"revision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_participants" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_participants_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text DEFAULT 'GW-' || lpad(nextval('project_code_seq')::text, 4, '0') NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_org_id" uuid,
	"seller_id" uuid NOT NULL,
	"service_id" uuid,
	"package_id" uuid,
	"proposal_id" uuid,
	"title" text NOT NULL,
	"status" "project_status" DEFAULT 'requirements_submitted' NOT NULL,
	"status_before_side" "project_status",
	"health" "health_state" DEFAULT 'on_track' NOT NULL,
	"health_reason" text,
	"total_amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brief_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"cover_letter" text NOT NULL,
	"milestone_plan" jsonb NOT NULL,
	"total_amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "proposal_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_holds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"milestone_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "escrow_status" DEFAULT 'held' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_holds_milestoneId_unique" UNIQUE("milestone_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" bigint,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_scope_key_pk" PRIMARY KEY("user_id","scope","key")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text DEFAULT 'GW-INV-' || extract(year from now())::int || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0') NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"line_items" jsonb NOT NULL,
	"total_amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_paymentId_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid,
	"description" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_transactions_idempotencyKey_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"milestone_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"buyer_fee_amount" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"checkout_url" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"idempotency_key" text NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_providerRef_unique" UNIQUE("provider_ref"),
	CONSTRAINT "payments_idempotencyKey_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" uuid NOT NULL,
	"rail" "payout_rail" NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"provider_ref" text,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"approved_by" uuid,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"escrow_hold_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"gross_amount" bigint NOT NULL,
	"seller_fee_amount" bigint NOT NULL,
	"net_amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "transfer_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_escrowHoldId_unique" UNIQUE("escrow_hold_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "service_packages" ADD COLUMN "milestone_template" jsonb;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_buyer_org_id_organizations_id_fk" FOREIGN KEY ("buyer_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_escrow_hold_id_escrow_holds_id_fk" FOREIGN KEY ("escrow_hold_id") REFERENCES "public"."escrow_holds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "briefs_status_idx" ON "briefs" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "briefs_buyer_idx" ON "briefs" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milestones_project_position_uq" ON "milestones" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "project_events_project_idx" ON "project_events" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "project_participants_user_idx" ON "project_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_buyer_idx" ON "projects" USING btree ("buyer_id","id");--> statement-breakpoint
CREATE INDEX "projects_seller_idx" ON "projects" USING btree ("seller_id","id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_brief_idx" ON "proposals" USING btree ("brief_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_one_active_per_seller_uq" ON "proposals" USING btree ("brief_id","seller_id") WHERE "proposals"."status" in ('sent', 'accepted');--> statement-breakpoint
CREATE INDEX "invoices_user_idx" ON "invoices" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "ledger_entries_tx_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_tx_reference_idx" ON "ledger_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "payments_milestone_idx" ON "payments" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "payments_payer_idx" ON "payments" USING btree ("payer_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_open_per_milestone_uq" ON "payments" USING btree ("milestone_id") WHERE "payments"."status" in ('pending', 'succeeded');--> statement-breakpoint
CREATE INDEX "payouts_seller_idx" ON "payouts" USING btree ("seller_id","id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_seller_idx" ON "transfers" USING btree ("seller_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
-- Money integrity (docs/ERD.md integrity rules): ledger entries of one transaction must sum to zero per currency,
-- checked at COMMIT; the ledger and the project activity feed are append-only.
CREATE OR REPLACE FUNCTION ledger_check_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM ledger_entries WHERE transaction_id = NEW.transaction_id
    GROUP BY currency HAVING SUM(amount) <> 0;
  IF FOUND THEN
    RAISE EXCEPTION 'ledger transaction % does not balance', NEW.transaction_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_append_only
  BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER project_events_append_only
  BEFORE UPDATE OR DELETE ON project_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
