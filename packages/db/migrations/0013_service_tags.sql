ALTER TABLE "services" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;
