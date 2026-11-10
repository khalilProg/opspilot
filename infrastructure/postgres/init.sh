#!/bin/sh
set -eu

# Executed by the official Postgres entrypoint only on a fresh data volume.
# Environment variables are provided by the postgres service in Compose.
: "${MONITOR_DB_PASSWORD:?Missing monitor password}"
: "${INCIDENT_DB_PASSWORD:?Missing incident password}"
psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v monitor_password="$MONITOR_DB_PASSWORD" -v incident_password="$INCIDENT_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE monitor_user LOGIN PASSWORD %L', :'monitor_password') \gexec
SELECT format('CREATE ROLE incident_user LOGIN PASSWORD %L', :'incident_password') \gexec
CREATE DATABASE monitor_db OWNER monitor_user;
CREATE DATABASE incident_db OWNER incident_user;
SQL
