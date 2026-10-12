CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status","created_at");
--> statement-breakpoint
-- Reference data: subcategories (real, not demo data).
INSERT INTO "categories" ("id", "parent_id", "slug", "name", "sort_order") VALUES
  (gen_random_uuid(), (select id from "categories" where slug = 'web-development'), 'landing-pages', 'Landing pages & websites', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'web-development'), 'ecommerce', 'E-commerce stores', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'web-development'), 'web-apps', 'Web applications', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'web-development'), 'cms-wordpress', 'CMS & WordPress', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'mobile-apps'), 'ios', 'iOS apps', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'mobile-apps'), 'android', 'Android apps', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'mobile-apps'), 'cross-platform', 'Cross-platform (Flutter, React Native)', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'mobile-apps'), 'app-maintenance', 'App updates & maintenance', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'ai-ml'), 'chatbots', 'Chatbots & assistants', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'ai-ml'), 'llm-integration', 'LLM integration', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'ai-ml'), 'computer-vision', 'Computer vision', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'ai-ml'), 'ml-models', 'Custom ML models', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'saas'), 'saas-mvp', 'SaaS MVPs', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'saas'), 'apis', 'APIs & integrations', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'saas'), 'payments-billing', 'Payments & billing', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'saas'), 'auth-security', 'Auth & security', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'design'), 'ui-design', 'UI design', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'design'), 'ux-research', 'UX research', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'design'), 'design-systems', 'Design systems', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'design'), 'branding', 'Branding & logos', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'devops'), 'ci-cd', 'CI/CD pipelines', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'devops'), 'cloud-infra', 'Cloud infrastructure', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'devops'), 'containers', 'Docker & Kubernetes', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'devops'), 'monitoring', 'Monitoring & reliability', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'qa-testing'), 'test-automation', 'Test automation', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'qa-testing'), 'manual-qa', 'Manual QA', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'qa-testing'), 'performance-testing', 'Performance testing', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'qa-testing'), 'security-testing', 'Security testing', 3),
  (gen_random_uuid(), (select id from "categories" where slug = 'data'), 'dashboards', 'Dashboards & BI', 0),
  (gen_random_uuid(), (select id from "categories" where slug = 'data'), 'data-pipelines', 'Data pipelines', 1),
  (gen_random_uuid(), (select id from "categories" where slug = 'data'), 'analytics', 'Product analytics', 2),
  (gen_random_uuid(), (select id from "categories" where slug = 'data'), 'data-collection', 'Data collection', 3)
ON CONFLICT ("slug") DO NOTHING;
