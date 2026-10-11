CREATE TYPE "public"."change_request_status" AS ENUM('proposed', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."dispute_outcome" AS ENUM('release', 'refund', 'split');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'under_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('message', 'deliverable', 'approval', 'change_request', 'timeline', 'upload', 'note');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('user', 'service', 'message', 'review');--> statement-breakpoint
CREATE TYPE "public"."review_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."verification_kind" AS ENUM('identity', 'github', 'play_store', 'app_store', 'portfolio', 'skill_test');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price_delta_amount" bigint DEFAULT 0 NOT NULL,
	"days_delta" integer DEFAULT 0 NOT NULL,
	"milestone_changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "change_request_status" DEFAULT 'proposed' NOT NULL,
	"responded_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dispute_id" uuid NOT NULL,
	"submitted_by" uuid,
	"kind" "evidence_kind" NOT NULL,
	"ref_id" uuid,
	"note" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"outcome" "dispute_outcome",
	"refund_amount" bigint,
	"resolution_note" text,
	"resolved_by" uuid,
	"case_file" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_note" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_replies" (
	"review_id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid,
	"author_id" uuid NOT NULL,
	"subject_seller_id" uuid NOT NULL,
	"visibility" "review_visibility" NOT NULL,
	"rating_overall" smallint NOT NULL,
	"rating_communication" smallint,
	"rating_quality" smallint,
	"rating_timeliness" smallint,
	"body" text DEFAULT '' NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "verification_kind" NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_file_id" uuid,
	"reviewed_by" uuid,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("subject_seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_seller_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_evidence_file_id_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_requests_project_idx" ON "change_requests" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_idx" ON "dispute_evidence" USING btree ("dispute_id","id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "disputes_project_idx" ON "disputes" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_open_per_milestone_uq" ON "disputes" USING btree ("milestone_id") WHERE "disputes"."status" <> 'resolved';--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_final_uq" ON "reviews" USING btree ("project_id","author_id") WHERE "reviews"."milestone_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_milestone_uq" ON "reviews" USING btree ("milestone_id","author_id") WHERE "reviews"."milestone_id" is not null;--> statement-breakpoint
CREATE INDEX "reviews_subject_idx" ON "reviews" USING btree ("subject_seller_id","visibility","id");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_user_kind_uq" ON "verifications" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "verifications" USING btree ("status");