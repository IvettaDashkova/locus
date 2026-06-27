CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"seq" integer NOT NULL,
	"start_seq" integer NOT NULL,
	"end_seq" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"distance_m" double precision,
	"duration_s" double precision,
	"geom" geometry(Geometry, 4326),
	"properties" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "track_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"geom" geography(Point, 4326) NOT NULL,
	"elevation" double precision,
	"speed" double precision
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"activity" text,
	"source" text NOT NULL,
	"site_id" uuid,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"path" geometry(LineString, 4326),
	"metrics" jsonb,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_points" ADD CONSTRAINT "track_points_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "segments_track_seq" ON "segments" USING btree ("track_id","seq");--> statement-breakpoint
CREATE INDEX "segments_geom_gist" ON "segments" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "track_points_track_seq" ON "track_points" USING btree ("track_id","seq");--> statement-breakpoint
CREATE INDEX "track_points_geom_gist" ON "track_points" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "tracks_path_gist" ON "tracks" USING gist ("path");--> statement-breakpoint
CREATE INDEX "tracks_site_idx" ON "tracks" USING btree ("site_id");