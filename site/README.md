# Sift site

The marketing and documentation site: a presentation page, documentation, a
privacy policy, and terms of use. Plain static HTML and CSS, no build step and
no JavaScript, so it is trivial to host and audit.

```
index.html     Landing / presentation
docs.html      Documentation
privacy.html   Privacy policy
terms.html     Terms of use
styles.css     Shared dark theme
assets/        Favicon and product preview images (mockups, from store/assets)
```

## Preview locally

Any static file server works. For example:

```sh
python3 -m http.server 5180 --directory site
# then open http://localhost:5180
```

## Deploy to Vercel (site + online viewer)

The Vercel deploy serves this static site **and** the standalone viewer at
`/app`. That is assembled by [`scripts/build-site.mjs`](../scripts/build-site.mjs),
which builds the standalone and copies it, plus the static pages here, into a
`vercel-out/` directory.

Configure the Vercel project at the **repository root** (not `site/`):

- **Root Directory:** the repo root (leave it empty / default).
- Vercel reads the root [`vercel.json`](../vercel.json), which sets
  `buildCommand` to `pnpm build:site`, `outputDirectory` to `vercel-out`, and
  enables `cleanUrls`. So `privacy.html` is served at `/privacy`, `terms.html`
  at `/terms`, and the standalone viewer at `/app`.
- Or from the CLI at the repo root: `npx vercel deploy --prod`.

Live URLs:

- Site: `https://siftext.vercel.app`
- Online viewer: `https://siftext.vercel.app/app`
- Privacy policy: `https://siftext.vercel.app/privacy` (paste this into the
  Chrome Web Store privacy-policy field)

Build the assembled output locally to check it:

```sh
pnpm build:site
python3 -m http.server 5181 --directory vercel-out   # then open /app, /privacy
```

## Deploy elsewhere

The assembled `vercel-out/` works on any static host (GitHub Pages, Netlify, an
S3 bucket, a plain web server). Without `cleanUrls` support, link to the `.html`
files directly and use `/app/` (with the trailing slash) for the viewer.

## Note on the preview images

`assets/inspector.png` and `assets/response-body.png` are the mockups generated
for the store listing, not captures of the running extension. Replace them with
real screenshots before a public launch for a stronger first impression.
