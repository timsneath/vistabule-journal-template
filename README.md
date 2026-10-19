# Teardrop Travel Journal

A small, self-owned website for logging trips in a teardrop trailer (or any small
camper). Each trip records where and when you went, where you stayed, miles driven,
a **route map that follows real roads**, photos, and notes from two travellers.
There's also an **About** page (your trailer's story + a spec sheet) and an
**Owner's Manual** page (links to the makers and manuals behind your components).

It's a **fully static** website with a friendly **visual editor** built in, so once
it's set up you can add trips from your browser — no code, no monthly fees, and you
own all of it. This repo is a **template**: fork it, replace the demo content with
your own, and publish.

> Built by a [Vistabule](https://vistabule.com) owner, for teardrop owners. The demo
> content features an imaginary trailer named *Itasca* — you'll replace all of it.

**[→ Jump to "Set it up"](#set-it-up-step-by-step)**

---

## What you get

- **A home page** with your trips and a mechanical odometer totalling your miles.
- **A page per trip**: dates, distance, nights out, where you stayed, maps of the
  whole trip and of where you camped (road-following lines, with ferry crossings
  drawn as crossings), a photo gallery with a lightbox, and two "notes" columns (one
  per traveller).
- **An About page** with your trailer's story, a spec sheet, and a photo gallery.
- **An Owner's Manual page**: a tidy directory of your components with links to
  product pages and manuals.
- **A built-in visual editor** at `/admin` — add and edit everything from your browser.
- **Photos optimized automatically** to modern formats at build time.
- **No server, no database, no monthly bill.** It's static files on Cloudflare's free
  tier.

## How it works (the 30-second version)

| Piece | What it is |
| ----- | ---------- |
| [Astro](https://astro.build) | Builds your content into a fast, fully static website. |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | The visual editor at `/admin`. It saves your edits straight to GitHub — nothing runs on a third-party service. |
| [GitHub](https://github.com) | Stores your site and its content. Every edit is a commit. |
| [Cloudflare](https://developers.cloudflare.com/workers/) | Hosts the site for free and rebuilds it automatically whenever content changes. |
| [Leaflet](https://leafletjs.com) + OpenStreetMap | The maps (no API key needed). |

Your content lives as plain text files (`.json`) in the repo, so nothing is locked
away. Photos live in the repo too.

## Prerequisites

You don't need to be a developer, but you'll be comfier if you've used a terminal
before. You need three free accounts and one install:

1. **A [GitHub](https://github.com/signup) account** — stores your site.
2. **A [Cloudflare](https://dash.cloudflare.com/sign-up) account** — hosts it (free).
3. **[Node.js](https://nodejs.org) 22 or newer** — to run the site on your own
   computer while you set it up. Install the "LTS" version.
4. A code editor is handy — [VS Code](https://code.visualstudio.com) is free.

Check Node is installed:

```sh
node --version   # should print v22.x.x or higher
```

---

## Set it up, step by step

### 1. Fork this repo

Click **Fork** at the top of this page. That makes your own copy under your GitHub
account (e.g. `your-username/my-teardrop-journal`). You can rename it during the fork.

### 2. Run it on your computer

Clone your fork and start it locally so you can see your changes as you make them:

```sh
git clone https://github.com/your-username/my-teardrop-journal.git
cd my-teardrop-journal
npm install
npm run dev
```

Open **<http://localhost:4321/>** — you'll see the demo site. The editor is at
**<http://localhost:4321/admin/>** (it won't fully connect until step 4, but the site
itself works now). Leave `npm run dev` running; the page refreshes as you edit files.

### 3. Make it yours

There are a handful of one-time edits. Do these first — most are a single line.

**a. Your site name and identity** — `src/content/site.json`:

```json
{
  "title": "Travels with <your trailer>",
  "tagline": "A short line under the title on the home page.",
  "trailerName": "<your trailer's name>",
  "authors": ["<name>", "<name>"]
}
```

`trailerName` shows up in page titles and captions. `authors` drives the footer
byline and the two note labels on each trip (e.g. `"Alex's notes"` / `"Sam's
notes"`). One author is fine — you'll just get one label.

**b. Point the editor at your repo** — `public/admin/config.yml`, near the top:

```yaml
backend:
  name: github
  repo: your-username/my-teardrop-journal   # ← change to YOUR repo
  branch: main
```

**c. Your public address** — `astro.config.mjs`:

```js
site: 'https://your-domain.com',   // or your Cloudflare *.workers.dev URL for now
base: '/',                          // leave as '/' unless hosting under a sub-path
```

**d. Your Cloudflare worker name** — `wrangler.jsonc`:

```jsonc
"name": "my-teardrop-journal",   // becomes <name>.<subdomain>.workers.dev
```

**e. Replace the demo content.** The easiest way is the visual editor (after step 4),
but you can also edit the files directly:

- **Trips**: delete the two files in `src/content/trips/` and add your own. Each trip
  is one `.json` file. (In the editor: *Trips → New Trip*.)
- **About**: `src/content/about.json` — your trailer's story, specs, gallery.
- **Owner's Manual**: `src/content/manual.json` — links to the makers and manuals
  for a Vistabule's components (the fan, Propex heater, Dometic stove and fridge,
  Victron chargers, and so on). Keep the ones your trailer has and add your own.
- **Photos**: put your own images in `src/assets/trips/` and `src/assets/about/`, then
  reference them from the content. The demo placeholder images can be deleted.

**f. The "build your own" link.** The bottom of the About page links back to this
template so other owners can find it. It's in `src/pages/about.astro` (search for
"build your own logbook") — keep it to pay it forward, change it, or remove it.

**Trip maps.** Each trip's *Waypoints* are the places you went, in order:

- **Camp** — where you slept. The trip page opens a map on your camps and the stops
  around them, beside a map of the whole trip (on phones, one map with a *Whole
  trip* button). If no waypoint is a camp, places named under *Where we stayed* — or
  else the last stop — count as camps.
- **Stop** — somewhere you visited; gets a pin.
- **Via** — no pin; just nudges the line onto the roads you actually took.

*How we got here* says how you travelled the leg **into** a waypoint: *Drive*
(follows the roads) or *Ferry* (drawn as a straight dashed crossing).

After editing trip maps locally, refresh the cached routes once:

```sh
npm run routes
```

(This draws the road-following lines. It also runs automatically on every build, so
it's optional — if you skip it, maps fall back to straight dashed lines until the
next build.)

### 4. Wire up the editor

The editor at `/admin` saves your changes straight to GitHub. There are two ways to
sign in. **Start with the token — it's the simplest.**

#### Option A — Sign in with a token (simplest)

1. Create a **GitHub personal access token**:
   [github.com/settings/tokens](https://github.com/settings/tokens?type=beta) →
   *Fine-grained tokens* → **Generate new token**.
   - **Repository access**: *Only select repositories* → your fork.
   - **Permissions**: *Repository permissions → Contents → Read and write*.
   - Generate, then copy the token (you won't see it again).
2. Go to `/admin` on your site, choose **Sign in with Token**, and paste it.

That's it. The token stays in your browser. (If you clear your browser data you'll
paste it again.)

#### Option B — One-click "Sign in with GitHub" (optional, nicer)

This adds a proper **Sign in with GitHub** button, but needs a tiny one-time OAuth
helper. Follow
[sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) (a small Cloudflare
Worker you deploy once), create a GitHub OAuth app as it describes, then set the
worker's URL in `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: your-username/my-teardrop-journal
  branch: main
  base_url: https://your-oauth-worker.your-subdomain.workers.dev
```

Token sign-in keeps working as a fallback.

### 5. Deploy to Cloudflare

This publishes your site and sets it to **rebuild automatically** every time you (or
the editor) change content.

1. Push your local changes to GitHub:
   ```sh
   git add -A
   git commit -m "Make it mine"
   git push
   ```
2. In the [Cloudflare dashboard](https://dash.cloudflare.com): **Workers & Pages →
   Create → Workers → Import a repository**. Choose your fork.
3. Set the **build command** to `npm run build` and the **deploy command** to
   `npx wrangler deploy`, then deploy. Cloudflare reads `wrangler.jsonc`, builds the
   site, and serves the files in `dist/`.
4. Your site goes live at `https://<your-worker-name>.<your-subdomain>.workers.dev`.

From now on, every push (including edits made in `/admin`) triggers a rebuild — your
site updates itself in about a minute.

#### Use your own domain

In the Cloudflare dashboard, open your worker → **Settings → Domains & Routes → Add**
and point it at a domain (or subdomain) you've added to Cloudflare. Update `site:` in
`astro.config.mjs` to match, and push.

### 6. Edit day-to-day

Once it's live, you rarely touch the code. Go to `https://your-site/admin`, sign in,
and add trips or edit pages. Each save is a commit; Cloudflare rebuilds and publishes
within a minute. That's the whole loop.

---

## Advanced: hosting under a sub-path

Most people should use a subdomain (e.g. `journal.example.com`) and keep `base: '/'`
— it's simpler. But if you specifically want the journal under a **path** of a bigger
site (`example.com/journal/…`), do three things. There's still no worker code: the
site stays plain static files.

**1.** Set the base path in `astro.config.mjs`, and build into a matching folder:

```js
base: '/journal',
outDir: './dist/journal',
```

`base` puts `/journal` in front of every link. `outDir` builds the files into
`dist/journal/`, so each file's location already matches its web address.

**2.** Bind `wrangler.jsonc` to your sub-path routes (keep `"directory": "./dist"`):

```jsonc
{
  "name": "my-teardrop-journal",
  "compatibility_date": "2026-06-22",
  "assets": { "directory": "./dist" },
  "routes": [
    { "pattern": "example.com/journal", "zone_name": "example.com" },
    { "pattern": "example.com/journal/*", "zone_name": "example.com" }
  ]
}
```

You need both routes: the second only matches `/journal/…`, so the bare `/journal`
needs its own. Cloudflare then redirects it to `/journal/`.

**3.** The domain must be on Cloudflare with a **proxied** DNS record on it, so the
routes reach Cloudflare's edge. If the domain has no website yet (e.g. it's only used
for email), add `AAAA  example.com  100::  (Proxied)`. That doesn't affect email.

Replace `journal` with your chosen path throughout. To test locally the way
Cloudflare serves it: `npm run build && npx wrangler dev`, then open
`http://localhost:8787/journal/` and `/journal/admin/`.

## Where things are

```
src/content/            your content (edited by the CMS)
  site.json               site title, tagline, trailer name, authors
  about.json              About page
  manual.json             Owner's manual
  trips/<slug>.json       one file per trip
src/assets/               your photos (optimized at build)
src/pages/                the pages (home, trip, about, manual, admin)
src/components/           map, gallery, trip card, the teardrop mark
src/styles/global.css     the whole look & feel — colors and fonts live at the top
public/admin/config.yml   the editor's form + which repo it saves to
astro.config.mjs          site URL + base path
wrangler.jsonc            Cloudflare worker name + static assets
```

Want to change the colors or fonts? They're all CSS variables at the top of
`src/styles/global.css`.

## Troubleshooting

- **`/admin` won't save / "not authorized".** Re-check `repo:` in
  `public/admin/config.yml` matches your fork exactly, and that your token has
  *Contents: Read and write* on that repo.
- **A bare `/` 404s locally.** If you set a `base` (sub-path hosting), the dev site
  lives at `/your-base/`, not `/`. With `base: '/'` the root works.
- **Maps show straight dashed lines.** The road-following route hasn't been cached
  yet. Run `npm run routes`, or just rebuild — it fetches once and caches the result.
  It never blocks a build; if the routing service is unreachable it falls back to
  straight lines.
- **Photos don't show.** Make sure the path in your content matches the file, e.g.
  `"/src/assets/trips/my-photo.jpg"`, and that the file is in `src/assets/`.
- **Build fails on Cloudflare.** Confirm the build command is `npm run build`. The
  `.node-version` file pins the Node version Cloudflare uses (24).

## Credits & license

Built with [Astro](https://astro.build), [Sveltia CMS](https://github.com/sveltia/sveltia-cms),
and [Leaflet](https://leafletjs.com). Fonts: Bricolage Grotesque, Hanken Grotesk, and
Space Mono (all self-hosted, open source).

This template is offered freely for other teardrop owners to build their own journals.
Make it yours.
