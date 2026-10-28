# Load tests (k6)

k6 runs from its Docker image: no install, no sudo.

```
# stack must be up with demo data (pnpm dev:up && pnpm db:seed:demo)
docker run --rm -i -e WEB=http://host.docker.internal:3000 -e API=http://host.docker.internal:4000 grafana/k6 run - < infra/load/public.js
docker run --rm -i -e API=http://host.docker.internal:4000 grafana/k6 run - < infra/load/authed.js
```

The local stack runs with raised rate limits (`RATE_LIMIT_PER_MINUTE`, `WRITE_RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_MAX`); for the sign-in test set
`AUTH_RATE_LIMIT_MAX=100000` in `.env` first, otherwise 429s on login are accepted and counted as ok. Results from the last run are in
`docs/PHASE9_REPORT.md`. Run against staging/production with `-e API=https://api.<domain>` only with the owner's permission.
