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

## Deploy

Upload the contents of `site/` to any static host (GitHub Pages, Netlify,
Vercel, an S3 bucket, a plain web server). There is nothing to build.

## Note on the preview images

`assets/inspector.png` and `assets/response-body.png` are the mockups generated
for the store listing, not captures of the running extension. Replace them with
real screenshots before a public launch for a stronger first impression.
