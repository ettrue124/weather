# Storm Dashboard

Storm Dashboard is a personal weather and storm chasing Progressive Web App built with plain HTML, CSS, and JavaScript so it can be developed on Windows and installed on iPhone using `Add to Home Screen`.

## Project file structure

```txt
storm-dashboard/
  index.html
  style.css
  app.js
  manifest.json
  service-worker.js
  assets/
    icon.svg
    icon-192.png
    icon-512.png
    icon-maskable-512.png
```

## Features

- current location weather using Open-Meteo
- hourly and daily forecast panels
- radar map using Leaflet + RainViewer public tiles
- U.S. active weather alerts using `api.weather.gov`
- live mode with interval selection
- unit toggle with localStorage persistence
- installable PWA with offline app shell caching

## Free data sources

- Forecast and current conditions: [Open-Meteo](https://open-meteo.com/en/docs)
- U.S. alerts: [weather.gov alerts API](https://www.weather.gov/documentation/services-web-alerts)
- Radar tiles: [RainViewer Weather Maps API](https://www.rainviewer.com/api/weather-maps-api.html)

## Running locally on Windows

You need to serve the files over HTTP. Opening `index.html` directly from disk is not enough for service workers and some browser APIs.

### Option 1: Python

```bash
python -m http.server 8000
```

Then open:

```txt
http://localhost:8000
```

### Option 2: VS Code Live Server

1. Open the folder in VS Code.
2. Install the `Live Server` extension.
3. Right-click `index.html`.
4. Click `Open with Live Server`.

## Hosting for free

### GitHub Pages

1. Push this repo to GitHub.
2. Open the repo on GitHub.
3. Go to `Settings` -> `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select your main branch and `/root`.
6. Save, then wait for the Pages URL.

### Netlify

1. Create a free Netlify account.
2. Click `Add new site` -> `Import an existing project`.
3. Connect your GitHub repo.
4. Build command: leave blank.
5. Publish directory: `/`
6. Deploy.

### Vercel

1. Create a free Vercel account.
2. Import the GitHub repo.
3. Framework preset: `Other`.
4. Build command: leave blank.
5. Output directory: leave blank.
6. Deploy.

## Adding it to your iPhone Home Screen

1. Open the hosted site in **Safari** on your iPhone.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Edit the name if you want.
5. Tap **Add**.

It will then launch in standalone mode using the manifest and Apple mobile web app tags.

## Changing the app icon later

Replace these files with your own artwork:

- `assets/icon-192.png`
- `assets/icon-512.png`
- `assets/icon-maskable-512.png`
- optionally `assets/icon.svg`

After replacing them:

1. Keep the same filenames, or update the paths in `manifest.json` and `index.html`.
2. Bump the cache name in `service-worker.js` so the new icon and shell assets refresh.
3. Re-deploy the site.
4. Remove and re-add the Home Screen app on iPhone if the old icon is still cached.

## Notes about limitations

- `api.weather.gov` alerts are only used for U.S. locations in this version.
- RainViewer radar coverage and timeliness vary by region.
- iPhone browsers require user permission for location access.
- Service worker caching keeps the app shell available offline, but live weather still depends on network access.
