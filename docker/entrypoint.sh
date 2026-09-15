#!/bin/sh
set -eu

# Initialize/update the persistent SQLite database before starting the web server.
# Explicit management commands (for example createsuperuser) run directly.
if [ "${1:-}" = "gunicorn" ]; then
    python manage.py migrate --noinput
fi

exec "$@"
