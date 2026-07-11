# Studio crash reporting — self-hosted GlitchTip

GlitchTip is Sentry-API-compatible. UltraThink Studio's `report_error` Tauri
command emits a Sentry-shape envelope; pointing `ULTRATHINK_TELEMETRY_DSN` at a
GlitchTip instance is all the wiring we need.

## Bring it up

```sh
cd docker
# Create a `.env` file in this directory (not committed) with the values
# from the "Required env" section below.
docker compose -f glitchtip-compose.yml up -d
open http://localhost:8000
```

Sign up locally, create an "UltraThink Studio" project, copy the DSN. Then on
the box that runs Studio:

```sh
export ULTRATHINK_TELEMETRY_DSN="http://<key>@localhost:8000/<id>"
```

The DSN is only consulted when the user has `telemetry: opt-in` set during
onboarding — empty DSN or `opt-out` means no events leave the local process.

## Required env

Drop these into `docker/.env` before `up -d`:

```
SECRET_KEY=<run: openssl rand -hex 32>
GLITCHTIP_DOMAIN=http://localhost:8000
EMAIL_URL=consolemail://
DEFAULT_FROM_EMAIL=noreply@localhost
```

For SMTP signup emails, swap `EMAIL_URL` for
`smtp+tls://user:pass@smtp.example.com:587`.

## Resource footprint

~700MB RAM idle; comfortable on a $5 VPS. Postgres + Redis + GlitchTip web +
GlitchTip worker.

## Why GlitchTip over Sentry SaaS

- Self-hosted: crash reports never leave infrastructure you control.
- API-compatible: we ship the same envelope shape, so we can move to Sentry
  SaaS later by changing the DSN.
- BSL/AGPL — free for our scale.

## Production checklist

- [ ] Reverse proxy with TLS (Caddy / nginx) in front of port 8000
- [ ] Postgres backups (pg_dump nightly to S3 / Backblaze)
- [ ] Email transport configured (SMTP) for password resets
- [ ] DSN set as a managed secret on the host running Studio
