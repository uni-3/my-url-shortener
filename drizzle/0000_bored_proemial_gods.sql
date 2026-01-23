CREATE TABLE "urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"long_url" text NOT NULL,
	"short_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "urls_short_code_unique" UNIQUE("short_code")
);
