# Locus local Postgres: PostGIS base + pgvector layered on top.
# We keep PostGIS as the base image (it ships PostGIS but NOT pgvector) and add pgvector,
# because adding PostGIS onto a pgvector image is harder than the reverse. This mirrors
# Supabase, where both extensions are already available.
FROM postgis/postgis:16-3.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-pgvector \
 && rm -rf /var/lib/apt/lists/*
