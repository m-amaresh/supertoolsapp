# Silktide Consent Manager (vendored)

`silktide-consent-manager.js` and `silktide-consent-manager.css` are vendored
from [silktide/consent-manager](https://github.com/silktide/consent-manager)
at **v2.0.1**, MIT licensed.

They are committed rather than fetched at build time, and served from this
origin rather than from jsDelivr, because the production CSP allows scripts
only from `'self'`. Loading the banner from a CDN would mean relaxing
`script-src` for the whole site — see `next.config.ts`.

There is no npm package for this project, so updating is manual:

```bash
V=v2.0.1   # bump this
for f in silktide-consent-manager.js silktide-consent-manager.css; do
  curl -sSL -o "public/consent/$f" \
    "https://cdn.jsdelivr.net/gh/silktide/consent-manager@$V/$f"
done
```

Re-run `pnpm test:e2e` afterwards: `tests/e2e/consent.test.ts` drives the real
banner, so an API change in a new version fails there rather than in production.
