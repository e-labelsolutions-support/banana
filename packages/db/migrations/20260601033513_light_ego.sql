CREATE TYPE "public"."user_type" AS ENUM('human', 'bot');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_daily_quest" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"date" date NOT NULL,
	"category" varchar(20) NOT NULL,
	"action" varchar(200) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_daily_quest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_energy_checkin" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"date" date NOT NULL,
	"energyLevel" smallint NOT NULL,
	"note" varchar(280),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_energy_checkin" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_side_quest" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"text" varchar(200) NOT NULL,
	"explored" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"exploredAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_side_quest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_win" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"date" date NOT NULL,
	"text" varchar(500) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_win" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "type" "user_type" DEFAULT 'human' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_daily_quest" ADD CONSTRAINT "user_daily_quest_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_energy_checkin" ADD CONSTRAINT "user_energy_checkin_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_side_quest" ADD CONSTRAINT "user_side_quest_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_win" ADD CONSTRAINT "user_win_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_daily_quest_user_date_cat_idx" ON "user_daily_quest" USING btree ("userId","date","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_daily_quest_user_date_idx" ON "user_daily_quest" USING btree ("userId","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_energy_checkin_user_date_idx" ON "user_energy_checkin" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_side_quest_user_explored_idx" ON "user_side_quest" USING btree ("userId","explored","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_win_user_date_idx" ON "user_win" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_win_user_created_idx" ON "user_win" USING btree ("userId","createdAt");