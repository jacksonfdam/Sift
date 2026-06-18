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

## Deploy to Vercel

This site is meant to be hosted on Vercel. It is plain static files with no
build step.

- In the Vercel project settings, set **Root Directory** to `site`. Leave the
  build command empty and the output directory as the root; Vercel serves the
  files as-is.
- [`vercel.json`](vercel.json) enables `cleanUrls`, so `privacy.html` is served
  at `/privacy` and `terms.html` at `/terms`. Use those clean paths in the
  Chrome Web Store privacy-policy field.
- Or from the CLI: `cd site && npx vercel deploy --prod`.

After the first deploy, the privacy policy lives at
`https://<your-domain>/privacy` (or `https://<project>.vercel.app/privacy`).
Paste that URL into the store listing's Privacy policy field.

## Deploy elsewhere

The contents of `site/` work on any static host (GitHub Pages, Netlify, an S3
bucket, a plain web server). Without `cleanUrls` support, link to the `.html`
files directly.

## Note on the preview images

`assets/inspector.png` and `assets/response-body.png` are the mockups generated
for the store listing, not captures of the running extension. Replace them with
real screenshots before a public launch for a stronger first impression.
