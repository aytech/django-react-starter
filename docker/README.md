# Docker workflows

Run these commands from the project root. Docker Engine (or Docker Desktop / a
running Colima instance) and Docker Compose are required. Python and Node.js run
inside the containers.

## Development with hot reload

```sh
docker compose -f docker/docker-compose-dev.yaml up
```

Open <http://127.0.0.1:5173/> for the React app. Django's admin is available at
<http://127.0.0.1:8000/admin/>. The first start downloads images and installs
dependencies; Vite starts once Django is healthy.

- `api` mounts the project source, applies migrations, and starts Django's
  development server with Python file reloading.
- `ui` mounts `client/` and starts Vite on all container interfaces. Polling once
  per second picks up host edits on Docker Desktop and Linux, triggering React
  Fast Refresh.
- Vite proxies backend routes to `http://api:8000` over the Compose network.
- Linux `node_modules` and pip/npm caches live in named volumes, separate from
  host dependencies. Development SQLite data lives in its own `dev_data` volume.

The development frontend uses source files directly, so no frontend build is
required. Use port 5173 for the app: Django's root URL on port 8000 still expects
a previously built `client/dist/index.html`.

Useful commands:

```sh
docker compose -f docker/docker-compose-dev.yaml exec api python manage.py createsuperuser
docker compose -f docker/docker-compose-dev.yaml exec api python manage.py makemigrations
docker compose -f docker/docker-compose-dev.yaml exec api python manage.py migrate
docker compose -f docker/docker-compose-dev.yaml exec api python manage.py test --settings=config.settings.testing
docker compose -f docker/docker-compose-dev.yaml logs -f
docker compose -f docker/docker-compose-dev.yaml down
```

After changing Python dependencies, restart `api`; after changing frontend
dependencies and the lockfile, restart `ui`. Both reinstall their dependencies
on startup. Ordinary source edits require no restart. `down` preserves the
database and caches; adding `--volumes` also deletes those volumes and their data.

## Production build

```sh
docker compose -f docker/docker-compose-build.yaml build
```

This creates the hosting image `django-react-starter:latest`. Set
`DJANGO_REACT_IMAGE` to choose another image name/tag, such as one in your own
registry. The build does not require production secrets or a database.

The multi-stage Dockerfile:

1. Installs the locked frontend dependencies and builds React with Vite.
2. Installs Django, Gunicorn, and WhiteNoise, collects static files, and generates
   gzip versions of compressible assets.
3. Packages the application, built HTML, and static assets into a Python runtime
   image with no Node.js runtime or `node_modules`, running as UID/GID 10001.

Gunicorn listens on container port 8000. WhiteNoise serves React and Django admin
assets from the same image; a separate static-file server is optional. Existing
Vite asset names are retained so the generated HTML resolves correctly.

To export the image as a hosting artifact:

```sh
docker image save --output django-react-starter.tar django-react-starter:latest
```

Build for the host's architecture. For example, when hosting on an amd64 Linux
server from an Apple Silicon machine:

```sh
docker buildx build --platform linux/amd64 --load \
  --file docker/Dockerfile --target production \
  --tag django-react-starter:latest .
```

## Configure and run the production image

```sh
cp docker/.env.example docker/.env
openssl rand -base64 48
```

Put the generated value into `DJANGO_SECRET_KEY` in `docker/.env`, and set
`DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` for your domain. Keep the
secret stable across deployments. Local `.env` files and SQLite databases are
excluded from Git and the Docker build context.

Run the image:

```sh
docker compose --env-file docker/.env -f docker/docker-compose-build.yaml up -d
docker compose --env-file docker/.env -f docker/docker-compose-build.yaml logs -f web
docker compose --env-file docker/.env -f docker/docker-compose-build.yaml exec web python manage.py createsuperuser
```

The entrypoint applies migrations before Gunicorn starts. This starter uses a
single app container with a persistent `production_data` volume mounted at
`/data`; its database is separate from development. When using another hosting
platform, provide persistent storage at `/data`, writable by UID/GID 10001, or
set `DJANGO_DATABASE_PATH` to another persistent location. Scaling to multiple
app containers requires a shared database and a separate migration release step.

The image selects `config.settings.container`, which extends production settings.
Secrets are supplied at runtime, never during the build. Tune Gunicorn with
`GUNICORN_CMD_ARGS`, which defaults to two workers and a 60-second timeout.

For hosting, place the app behind your platform's HTTPS gateway or a reverse
proxy. Compose publishes port 8000 only on the host's loopback interface. Set
`DJANGO_TRUST_PROXY_HEADERS=1` only when that trusted proxy overwrites
`X-Forwarded-Proto` and clients cannot bypass it. Keep
`DJANGO_SECURE_SSL_REDIRECT=1` for hosting. Secure cookies remain enabled.

For a local HTTP preview of the built frontend, after configuring the secret:

```sh
APP_PORT=8080 DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
  DJANGO_SECURE_SSL_REDIRECT=0 \
  docker compose --env-file docker/.env -f docker/docker-compose-build.yaml up -d
```

Open <http://127.0.0.1:8080/>. This changes only the HTTPS redirect for the local
preview; hosting should use HTTPS. Rebuild the image to include source changes
in production. Production has no source mounts or hot reload.

## Validate configuration

```sh
docker compose -f docker/docker-compose-dev.yaml config --quiet
docker compose -f docker/docker-compose-build.yaml config --quiet
```

For the container-specific Python tests on the host, install
`docker/requirements.txt` into the virtual environment first. The ordinary
development requirements remain in the root `requirements.txt`.
