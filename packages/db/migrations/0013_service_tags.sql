ALTER TABLE "services" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
INSERT INTO "categories" ("id", "parent_id", "slug", "name", "sort_order")
SELECT gen_random_uuid(), p."id", v.slug, v.name, v.ord
FROM (VALUES
  ('web-development', 'landing-pages', 'Websites & landing pages', 0),
  ('web-development', 'ecommerce', 'Online shops', 1),
  ('web-development', 'web-apps', 'Web apps & dashboards', 2),
  ('web-development', 'wordpress', 'WordPress & CMS', 3),
  ('mobile-apps', 'flutter-apps', 'Flutter apps', 0),
  ('mobile-apps', 'react-native-apps', 'React Native apps', 1),
  ('mobile-apps', 'native-ios-android', 'Native iOS & Android', 2),
  ('ai-ml', 'chatbots', 'Chatbots & assistants', 0),
  ('ai-ml', 'ai-integration', 'Add AI to my product', 1),
  ('ai-ml', 'computer-vision', 'Image & video AI', 2),
  ('saas', 'apis-backend', 'APIs & backend', 0),
  ('saas', 'saas-mvp', 'SaaS MVP', 1),
  ('saas', 'integrations', 'Integrations & automation', 2),
  ('design', 'ui-ux-design', 'App & web design', 0),
  ('design', 'branding-logos', 'Logo & branding', 1),
  ('design', 'prototypes', 'Clickable prototypes', 2),
  ('devops', 'cloud-setup', 'Cloud setup & hosting', 0),
  ('devops', 'ci-cd', 'Automatic deployments', 1),
  ('qa-testing', 'manual-testing', 'Manual testing', 0),
  ('qa-testing', 'test-automation', 'Automated tests', 1),
  ('data', 'dashboards', 'Dashboards & reports', 0),
  ('data', 'data-pipelines', 'Data pipelines', 1)
) AS v(parent_slug, slug, name, ord)
JOIN "categories" p ON p."slug" = v.parent_slug
ON CONFLICT ("slug") DO NOTHING;
