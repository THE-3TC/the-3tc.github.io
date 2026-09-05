# The 3TC

Blog for The 3TC, built with [Hugo](https://gohugo.io/) and deployed to GitHub Pages
from `main` by `.github/workflows/hugo.yaml`.

## Local development

```sh
hugo server -D
```

## Tests

The interactive posts ship their maths as plain ES modules under `static/js/`.

```sh
node --test tests/*.test.mjs
```
