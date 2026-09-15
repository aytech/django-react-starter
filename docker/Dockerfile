# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-slim
ARG PYTHON_IMAGE=python:3.14-slim

FROM ${NODE_IMAGE} AS frontend
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM ${PYTHON_IMAGE} AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN python -m venv /opt/venv
COPY requirements.txt ./
COPY docker/requirements.txt ./docker/requirements.txt
RUN pip install --no-cache-dir -r docker/requirements.txt
COPY manage.py ./
COPY config/ ./config/
COPY client/ ./client/
COPY --from=frontend /build/client/dist/ ./client/dist/
# Static collection needs no runtime credentials or database access.
RUN python manage.py collectstatic --noinput --settings=config.settings.development \
    && python -m whitenoise.compress staticfiles

FROM ${PYTHON_IMAGE} AS production
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.container \
    DJANGO_DATABASE_PATH=/data/db.sqlite3 \
    GUNICORN_CMD_ARGS="--workers=2 --timeout=60"
WORKDIR /app
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app \
    && mkdir /data \
    && chown app:app /data
COPY --from=backend /opt/venv/ /opt/venv/
COPY --from=backend /app/manage.py ./
COPY --from=backend /app/config/ ./config/
COPY --from=backend /app/client/ ./client/
COPY --from=backend /app/staticfiles/ ./staticfiles/
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/docker-entrypoint
USER app
EXPOSE 8000
ENTRYPOINT ["docker-entrypoint"]
CMD ["gunicorn", "config.wsgi:application", "--bind=0.0.0.0:8000", "--access-logfile=-", "--error-logfile=-"]
