#!/bin/sh
# Install locked frontend dependencies, build React, and collect Django static files.
set -eu
cd "$(dirname "$0")"

npm --prefix client ci
npm --prefix client run build
"${PYTHON:-python}" manage.py collectstatic --noinput
