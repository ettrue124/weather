const DEGREE = "\u00B0";
const WEATHER_CACHE_TTL_MS = 120000;
const ALERTS_CACHE_TTL_MS = 300000;
const RADAR_CACHE_TTL_MS = 300000;
const HERO_DEFAULT_VIEW = [36.5, -89.5];

const featureGroups = [
  {
    title: "Radar Products",
    icon: "RD",
    items: [
      "National Radar Composite Imagery",
      "Rain/Mix/Snow Intensity Algorithm",
      "Super-Res Reflectivity",
      "Super-Res Velocity",
      "Super-Res Storm-Relative Velocity",
      "Correlation Coefficient",
      "Differential Reflectivity",
      "Specific Differential Phase",
      "Super-Res Spectrum Width*",
      "Super-Res Dual-Pol Products (CC, ZDR, and KDP)*",
      "Upload Custom Colormaps",
      "Enhanced Echo Tops*",
      "Vertically Integrated Liquid*",
      "Rotation Tracks*",
      "Hail Swaths*",
      "80+ Multi-Radar/Multi-Sensor (MRMS) Algorithms*",
      "Dual-Pane Mode",
      "24-Hour Radar Loops"
    ]
  },
  {
    title: "NWS / NOAA Products",
    icon: "NW",
    items: [
      "SPC Convective and Fire Weather Outlooks",
      "Mesoscale Discussions",
      "NHC Outlooks",
      "WPC Excessive Rainfall Outlooks",
      "CPC Temperature and Precipitation Outlooks",
      "Tropical cones of uncertainty, wind speed probabilities, and time of arrival",
      "60+ NWS watches, warnings, and advisories",
      "Area Forecast Discussions",
      "County Warning Area boundaries and Weather Forecast Office contact information",
      "Overlay watches, warnings, advisories, discussions, and outlooks on any tab",
      "Local Storm Reports"
    ]
  },
  {
    title: "Models",
    icon: "MD",
    items: [
      "HRRR and GFS",
      "15-minute HRRR*",
      "RRFS (hourly and 15-minute)*",
      "GSL RRFS-MPAS",
      "HREF and REFS ensembles*",
      "NCEP and NSSL CAMs*",
      "RAP, 3 km and 12 km NAM*",
      "ECMWF open data*",
      "German ICON and Canadian GEM*",
      "ECMWF-AIFS, GraphCast GFS, and AIGFS*",
      "GEFS, AIGEFS, HGEFS, EPS, and EPS-AI ensembles*",
      "Point Soundings*",
      "Mesoanalysis sounding tool on radar and satellite tabs"
    ]
  },
  {
    title: "Satellite",
    icon: "ST",
    items: [
      "GOES-19 Geocolor",
      "GOES-19 ABI and RGB products*",
      "Full-resolution CONUS sectors*",
      "Full disk sectors for North, Central, and South America (10-minute)*",
      "Rapid scan meso sectors (1-minute)*",
      "Up to 12-hour satellite loops"
    ]
  },
  {
    title: "Mapping",
    icon: "MP",
    items: [
      "Street-level mapping",
      "Offline maps*",
      "SpotterNetwork integration",
      "Route planning*"
    ]
  },
  {
    title: "Observations",
    icon: "OB",
    items: [
      "METAR station plots (animated)",
      "RTMA surface analysis*",
      "HRRR analysis*",
      "Observed soundings*"
    ]
  }
];

const state = {
  position: null,
  placeLabel: "Locating...",
  weather: null,
  weatherMeta: null,
  alerts: [],
  alertsMeta: null,
  heroMap: null,
  heroMarker: null,
  heroRadarLayer: null,
  radarMap: null,
  radarMarker: null,
  radarLayer: null,
  pointsMeta: null,
  observation: null,
  satelliteIndex: 0,
  isRefreshing: false
};

const elements = {
  featureGrid: document.getElementById("feature-grid"),
  navToggle: document.getElementById("nav-toggle"),
  siteNav: document.getElementById("site-nav"),
  overlayTabs: [...document.querySelectorAll(".overlay-tab")],
  previewCards: [...document.querySelectorAll(".preview-card")],
  refreshButton: document.getElementById("refresh-button"),
  locateButton: document.getElementById("locate-button"),
  centerRadarButton: document.getElementById("center-radar-button"),
  statusBanner: document.getElementById("status-banner"),
  locationLabel: document.getElementById("location-label"),
  currentTemp: document.getElementById("current-temp"),
  currentCondition: document.getElementById("current-condition"),
  currentSummary: document.getElementById("current-summary"),
  dataSourceChip: document.getElementById("data-source-chip"),
  lastUpdated: document.getElementById("last-updated"),
  feelsLike: document.getElementById("feels-like"),
  windSpeed: document.getElementById("wind-speed"),
  windDirection: document.getElementById("wind-direction"),
  humidity: document.getElementById("humidity"),
  pressure: document.getElementById("pressure"),
  homeError: document.getElementById("home-error"),
  radarStatus: document.getElementById("radar-status"),
  severeIndicators: document.getElementById("severe-indicators"),
  alertsStatus: document.getElementById("alerts-status"),
  alertsList: document.getElementById("alerts-list"),
  hourlyForecast: document.getElementById("hourly-forecast"),
  dailyForecast: document.getElementById("daily-forecast"),
  spcStatus: document.getElementById("spc-status"),
  spcLinks: document.getElementById("spc-links"),
  modelLinks: document.getElementById("model-links"),
  satelliteStatus: document.getElementById("satellite-status"),
  satelliteImage: document.getElementById("satellite-image"),
  satelliteLinks: document.getElementById("satellite-links"),
  obsStatus: document.getElementById("obs-status"),
  obsSummary: document.getElementById("obs-summary"),
  obsLinks: document.getElementById("obs-links"),
  heroRunLabel: document.getElementById("hero-run-label"),
  heroRunMeta: document.getElementById("hero-run-meta"),
  heroOutlookTitle: document.getElementById("hero-outlook-title"),
  heroOutlookLevel: document.getElementById("hero-outlook-level"),
  heroCategoryTitle: document.getElementById("hero-category-title"),
  heroCategoryLevel: document.getElementById("hero-category-level"),
  heroTornadoLevel: document.getElementById("hero-tornado-level"),
  heroWindLevel: document.getElementById("hero-wind-level"),
  heroHailLevel: document.getElementById("hero-hail-level"),
  heroFooterLabel: document.getElementById("hero-footer-label")
};

initialize();

function initialize() {
  renderFeatureGrid();
  bindNavigation();
  bindPreviewTabs();
  initMaps();
  renderStaticProductLinks();
  refreshDesk({ forceFresh: true, reason: "initial" });
}

function renderFeatureGrid() {
  elements.featureGrid.innerHTML = featureGroups.map((group) => `
    <article>
      <div class="card-icon" aria-hidden="true">${group.icon}</div>
      <h3>${group.title}</h3>
      <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function bindNavigation() {
  elements.navToggle.addEventListener("click", () => {
    const expanded = elements.navToggle.getAttribute("aria-expanded") === "true";
    elements.navToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    elements.siteNav.classList.toggle("open", !expanded);
  });

  elements.siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elements.navToggle.setAttribute("aria-expanded", "false");
      elements.siteNav.classList.remove("open");
    });
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshDesk({ forceFresh: true, reason: "manual" });
  });

  elements.locateButton.addEventListener("click", () => {
    refreshDesk({ forceFresh: true, reason: "location" });
  });

  elements.centerRadarButton.addEventListener("click", centerRadarOnPosition);
}

function bindPreviewTabs() {
  elements.overlayTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      elements.overlayTabs.forEach((button) => button.classList.remove("active"));
      elements.previewCards.forEach((card) => card.classList.remove("active"));
      tab.classList.add("active");
      elements.previewCards[index]?.classList.add("active");
    });
  });
}

function initMaps() {
  if (typeof L === "undefined") {
    elements.radarStatus.textContent = "Map engine unavailable";
    elements.heroRunMeta.textContent = "Map engine unavailable";
    return;
  }

  state.heroMap = L.map("hero-map", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
    touchZoom: false
  }).setView(HERO_DEFAULT_VIEW, 5);

  state.radarMap = L.map("radar-map", {
    zoomControl: false,
    attributionControl: true
  }).setView(HERO_DEFAULT_VIEW, 5);

  const baseLayerOptions = {
    maxZoom: 12,
    attribution: "&copy; OpenStreetMap contributors"
  };

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", baseLayerOptions).addTo(state.heroMap);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", baseLayerOptions).addTo(state.radarMap);
}

async function refreshDesk({ forceFresh = false, reason = "manual" } = {}) {
  if (state.isRefreshing) {
    return;
  }

  state.isRefreshing = true;
  clearHomeError();
  setLoadingState(true);

  try {
    state.position = await getCurrentPosition();
    state.placeLabel = buildCoordinateLabel(state.position.coords.latitude, state.position.coords.longitude);
    updateMapMarkers();

    const [placeLabel, weatherResult, alertsResult, pointsResult, radarResult] = await Promise.allSettled([
      loadPlaceLabel(state.position, forceFresh),
      loadWeather(state.position, forceFresh),
      loadAlerts(state.position, forceFresh),
      loadPointsMetadata(state.position, forceFresh),
      refreshRadarLayer(forceFresh)
    ]);

    if (placeLabel.status === "fulfilled") {
      state.placeLabel = placeLabel.value;
    }

    renderLocation();

    if (weatherResult.status === "rejected") {
      renderHomeError(weatherResult.reason?.message || "Weather data is unavailable.");
    }

    if (alertsResult.status === "rejected") {
      renderAlertsError(alertsResult.reason?.message || "Alert feed unavailable.");
    }

    if (pointsResult.status === "fulfilled") {
      await loadLatestObservation(forceFresh);
    }

    if (radarResult.status === "rejected") {
      elements.radarStatus.textContent = "Radar unavailable";
    }

    renderHeroLabels();
    renderObservations();

    if (reason === "manual") {
      showBanner("Live desk refreshed.", false);
    }
  } catch (error) {
    handleLocationError(error);
  } finally {
    state.isRefreshing = false;
    setLoadingState(false);
  }
}

async function loadPlaceLabel(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `place:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(cacheKey, WEATHER_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    return cached.data;
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    language: "en",
    format: "json"
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not look up your place name.");
  }

  const payload = await response.json();
  const firstResult = payload.results?.[0];
  const label = firstResult
    ? [firstResult.name, firstResult.admin1].filter(Boolean).join(", ")
    : buildCoordinateLabel(lat, lon);

  writeCache(cacheKey, label);
  return label;
}

async function loadWeather(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(cacheKey, WEATHER_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    state.weather = cached.data;
    state.weatherMeta = { source: "cache", fetchedAt: cached.savedAt };
    renderWeather();
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "weather_code",
      "is_day"
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "wind_gusts_10m",
      "weather_code"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_gusts_10m_max"
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "7"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Weather provider returned an unexpected response.");
  }

  const payload = await response.json();
  state.weather = payload;
  state.weatherMeta = { source: "fresh", fetchedAt: Date.now() };
  writeCache(cacheKey, payload);
  renderWeather();
  return payload;
}

async function loadAlerts(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `alerts:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(cacheKey, ALERTS_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    state.alerts = cached.data;
    state.alertsMeta = { source: "cache", fetchedAt: cached.savedAt };
    renderAlerts();
    return cached.data;
  }

  const response = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, {
    headers: { Accept: "application/geo+json" }
  });

  if (!response.ok) {
    throw new Error("Alerts service is temporarily unavailable.");
  }

  const payload = await response.json();
  state.alerts = Array.isArray(payload.features) ? payload.features : [];
  state.alertsMeta = { source: "fresh", fetchedAt: Date.now() };
  writeCache(cacheKey, state.alerts);
  renderAlerts();
  return state.alerts;
}

async function loadPointsMetadata(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `points:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache(cacheKey, WEATHER_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    state.pointsMeta = cached.data;
    renderStaticProductLinks();
    return cached.data;
  }

  const response = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  if (!response.ok) {
    throw new Error("Could not load local NWS metadata.");
  }

  const payload = await response.json();
  state.pointsMeta = payload.properties || null;
  writeCache(cacheKey, state.pointsMeta);
  renderStaticProductLinks();
  return state.pointsMeta;
}

async function loadLatestObservation(forceFresh) {
  if (!state.pointsMeta?.observationStations) {
    renderObservations();
    return null;
  }

  const cacheKey = `obs:${state.pointsMeta.cwa || "local"}:${state.position.coords.latitude.toFixed(2)},${state.position.coords.longitude.toFixed(2)}`;
  const cached = readCache(cacheKey, WEATHER_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    state.observation = cached.data;
    renderObservations();
    return cached.data;
  }

  const stationsResponse = await fetch(state.pointsMeta.observationStations);
  if (!stationsResponse.ok) {
    renderObservations();
    return null;
  }

  const stationsPayload = await stationsResponse.json();
  const firstStation = stationsPayload.observationStations?.[0];
  if (!firstStation) {
    renderObservations();
    return null;
  }

  const latestResponse = await fetch(`${firstStation}/observations/latest`);
  if (!latestResponse.ok) {
    renderObservations();
    return null;
  }

  const latestPayload = await latestResponse.json();
  state.observation = latestPayload.properties || null;
  writeCache(cacheKey, state.observation);
  renderObservations();
  return state.observation;
}

async function refreshRadarLayer(forceFresh) {
  if (!state.radarMap || !state.heroMap) {
    return null;
  }

  const cacheKey = "rainviewer:latest";
  const cached = readCache(cacheKey, RADAR_CACHE_TTL_MS);
  let payload = null;

  if (cached && !forceFresh) {
    payload = cached.data;
  } else {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!response.ok) {
      throw new Error("Radar service unavailable.");
    }
    payload = await response.json();
    writeCache(cacheKey, payload);
  }

  const latestFrame = payload.radar?.past?.[payload.radar.past.length - 1];
  if (!latestFrame) {
    throw new Error("No radar frames found.");
  }

  const tileUrl = `${payload.host}${latestFrame.path}/256/{z}/{x}/{y}/6/1_1.png`;

  [state.radarLayer, state.heroRadarLayer].forEach((layer, index) => {
    if (layer) {
      (index === 0 ? state.radarMap : state.heroMap).removeLayer(layer);
    }
  });

  state.radarLayer = L.tileLayer(tileUrl, {
    opacity: 0.74,
    attribution: "&copy; OpenStreetMap contributors | Radar &copy; RainViewer"
  }).addTo(state.radarMap);

  state.heroRadarLayer = L.tileLayer(tileUrl, {
    opacity: 0.7
  }).addTo(state.heroMap);

  elements.radarStatus.textContent = `Radar frame ${formatClock(latestFrame.time * 1000)}`;
  elements.heroRunMeta.textContent = `Radar frame ${formatClock(latestFrame.time * 1000)}`;
  return tileUrl;
}

function updateMapMarkers() {
  if (!state.position || !state.radarMap || !state.heroMap) {
    return;
  }

  const lat = state.position.coords.latitude;
  const lon = state.position.coords.longitude;

  if (!state.radarMarker) {
    state.radarMarker = buildMarker([lat, lon], "radar-marker").addTo(state.radarMap);
  } else {
    state.radarMarker.setLatLng([lat, lon]);
  }

  if (!state.heroMarker) {
    state.heroMarker = buildMarker([lat, lon], "hero-radar-marker").addTo(state.heroMap);
  } else {
    state.heroMarker.setLatLng([lat, lon]);
  }

  state.radarMap.setView([lat, lon], 7);
  state.heroMap.setView([lat, lon], 6);
}

function buildMarker(latLng, className) {
  return L.marker(latLng, {
    icon: L.divIcon({
      className: "",
      html: `<div class="${className}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    })
  });
}

function centerRadarOnPosition() {
  if (!state.position || !state.radarMap) {
    return;
  }

  state.radarMap.setView([state.position.coords.latitude, state.position.coords.longitude], 7);
}

function renderLocation() {
  elements.locationLabel.textContent = state.placeLabel;
}

function renderWeather() {
  if (!state.weather) {
    return;
  }

  const { current, hourly, daily } = state.weather;
  elements.currentTemp.textContent = `${Math.round(current.temperature_2m)}${DEGREE}`;
  elements.currentCondition.textContent = describeWeatherCode(current.weather_code, current.is_day === 1);
  elements.currentSummary.textContent = buildSummary(current, daily);
  elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}${DEGREE}F`;
  elements.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} mph`;
  elements.windDirection.textContent = `${degreesToCompass(current.wind_direction_10m)} ${Math.round(current.wind_direction_10m)}${DEGREE}`;
  elements.humidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  elements.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;
  elements.lastUpdated.textContent = `Last updated: ${formatClock(state.weatherMeta?.fetchedAt)}`;
  elements.dataSourceChip.textContent = buildSourceLabel();
  elements.dataSourceChip.className = `chip ${buildSourceClass()}`;

  renderSevereIndicators(buildSevereIndicators(current, hourly, daily));
  renderHourlyForecast(hourly);
  renderDailyForecast(daily);
}

function renderSevereIndicators(indicators) {
  if (!indicators.length) {
    elements.severeIndicators.innerHTML = '<span class="tag tag-muted">No obvious severe signals in the current forecast.</span>';
    return;
  }

  elements.severeIndicators.innerHTML = indicators
    .map((item) => `<span class="tag ${item.level === "severe" ? "tag-severe" : "tag-watch"}">${escapeHtml(item.label)}</span>`)
    .join("");
}

function renderAlerts() {
  elements.alertsStatus.textContent = state.alerts.length
    ? `${state.alerts.length} active alert${state.alerts.length === 1 ? "" : "s"}`
    : "No active alerts";

  if (!state.alerts.length) {
    elements.alertsList.innerHTML = '<div class="empty-state">No active alerts returned for this area.</div>';
    return;
  }

  elements.alertsList.innerHTML = state.alerts.slice(0, 4).map((feature) => {
    const props = feature.properties || {};
    const severity = props.severity || "Unknown";
    const urgency = props.urgency || "Unknown";
    const cssClass = severityToClass(severity, props.event || "");
    return `
      <article class="alert-card ${cssClass}">
        <h4 class="alert-title">${escapeHtml(props.headline || props.event || "Weather Alert")}</h4>
        <p class="alert-meta">${escapeHtml(severity)} severity | ${escapeHtml(urgency)} urgency</p>
        <p class="alert-copy">${escapeHtml((props.description || "No description provided.").slice(0, 220))}${props.description && props.description.length > 220 ? "..." : ""}</p>
      </article>
    `;
  }).join("");
}

function renderAlertsError(message) {
  elements.alertsStatus.textContent = "Alerts unavailable";
  elements.alertsList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderHourlyForecast(hourly) {
  const hours = hourly.time.slice(0, 12).map((time, index) => ({
    time,
    temperature: hourly.temperature_2m[index],
    precip: hourly.precipitation_probability[index],
    gust: hourly.wind_gusts_10m[index],
    code: hourly.weather_code[index]
  }));

  elements.hourlyForecast.classList.remove("loading-strip");
  elements.hourlyForecast.innerHTML = hours.map((hour) => `
    <article class="hour-card">
      <div class="hour-time">${formatHour(hour.time)}</div>
      <div class="hour-temp">${Math.round(hour.temperature)}${DEGREE}</div>
      <div class="hour-meta">${describeWeatherCode(hour.code, true)}</div>
      <div class="hour-meta">${hour.precip || 0}% precip</div>
      <div class="hour-meta">Gust ${Math.round(hour.gust || 0)} mph</div>
    </article>
  `).join("");
}

function renderDailyForecast(daily) {
  const days = daily.time.map((time, index) => ({
    time,
    max: daily.temperature_2m_max[index],
    min: daily.temperature_2m_min[index],
    precip: daily.precipitation_probability_max[index],
    gust: daily.wind_gusts_10m_max[index],
    code: daily.weather_code[index]
  }));

  elements.dailyForecast.innerHTML = days.map((day) => `
    <article class="daily-row">
      <div class="day-name">${formatDay(day.time)}</div>
      <div>
        <div>${describeWeatherCode(day.code, true)}</div>
        <div class="daily-meta">${day.precip || 0}% precip | Gust ${Math.round(day.gust || 0)} mph</div>
      </div>
      <div class="day-temps">${Math.round(day.max)}${DEGREE} / ${Math.round(day.min)}${DEGREE}</div>
    </article>
  `).join("");
}

function renderStaticProductLinks() {
  const runInfo = getModelRunInfo();
  const points = state.pointsMeta;
  const officeSlug = points?.forecastOffice?.split("/").pop() || "";
  const countyUrl = points?.county || "";
  const radarLat = state.position?.coords.latitude?.toFixed(2) || "35.47";
  const radarLon = state.position?.coords.longitude?.toFixed(2) || "-97.52";

  const spcProducts = [
    ["SPC Day 1 Outlook", "Latest categorical convective outlook.", "https://www.spc.noaa.gov/products/outlook/day1otlk.html"],
    ["SPC Mesoscale Discussions", "Active mesoscale discussions.", "https://www.spc.noaa.gov/products/md/"],
    ["SPC Watches", "Current severe thunderstorm and tornado watches.", "https://www.spc.noaa.gov/products/watch/"],
    ["WPC Excessive Rainfall", "Current WPC ERO products.", "https://www.wpc.ncep.noaa.gov/qpf/excessive_rainfall_outlook_ero.php"],
    ["NHC Tropical Outlooks", "Atlantic and Pacific tropical outlooks.", "https://www.nhc.noaa.gov/gtwo.php"],
    ["CPC Outlooks", "Temperature and precipitation outlooks.", "https://www.cpc.ncep.noaa.gov/"]
  ];

  const modelProducts = [
    [`HRRR ${runInfo.shortRun}`, "Open the latest HRRR run at pivotalweather.com.", `https://www.pivotalweather.com/model.php?rh=${runInfo.mainCycle}&fh=0&dpdt=&mc=&r=us_ne&mdl=hrrr&p=sfct&pd=zcape`],
    [`GFS ${runInfo.mainRun}`, "Open the latest GFS run at pivotalweather.com.", `https://www.pivotalweather.com/model.php?rh=${runInfo.mainCycle}&fh=0&dpdt=&mc=&r=us_ne&mdl=gfs&p=sfct&pd=tmp2m`],
    ["NOMADS Model Access", "Official NOAA model data access.", "https://nomads.ncep.noaa.gov/"],
    ["Point Soundings", "SPC observed and forecast sounding tools.", "https://www.spc.noaa.gov/exper/soundings/"],
    ["NCEP Ensemble Products", "Operational ensemble product portals.", "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/"]
  ];

  const satelliteProducts = [
    ["GOES Geocolor", "Latest CONUS geocolor imagery.", "https://www.star.nesdis.noaa.gov/GOES/conus_band.php?sat=G19&band=GEOCOLOR&length=24"],
    ["GOES Air Mass", "Air mass and RGB product viewer.", "https://rammb-slider.cira.colostate.edu/?sat=goes-19&sec=conus&p[0]=geocolor&x=10603&y=16228&z=3&im=24&ts=1&st=0&et=0&speed=130&motion=loop"],
    ["Full Disk", "Latest full disk imagery sectors.", "https://www.star.nesdis.noaa.gov/GOES/fulldisk.php?sat=G19&band=GEOCOLOR&length=24"],
    ["Meso Sectors", "Rapid scan mesosector imagery.", "https://www.star.nesdis.noaa.gov/GOES/meso_index.php?sat=G19"]
  ];

  const observationProducts = [
    ["Local NWS Forecast", "Weather.gov point forecast for your current location.", `https://forecast.weather.gov/MapClick.php?lat=${radarLat}&lon=${radarLon}`],
    ["Aviation Weather METAR", "Official METAR and TAF portal.", "https://aviationweather.gov/data/metar/"],
    ["Area Forecast Discussion", "Local Weather Forecast Office discussion.", officeSlug ? `https://forecast.weather.gov/product.php?site=${officeSlug}&issuedby=${officeSlug}&product=AFD&format=CI&version=1&glossary=1` : "https://forecast.weather.gov/product_types.php?site=NWS&prodtype=AFD"],
    ["County / Zone Data", "Local county or zone metadata.", countyUrl || "https://api.weather.gov/"]
  ];

  elements.spcLinks.innerHTML = spcProducts.map(buildProductLink).join("");
  elements.modelLinks.innerHTML = modelProducts.map(buildProductLink).join("");
  elements.satelliteLinks.innerHTML = satelliteProducts.map(buildProductLink).join("");
  elements.obsLinks.innerHTML = observationProducts.map(buildProductLink).join("");
}

function buildProductLink([title, summary, href]) {
  return `
    <a class="product-link" href="${href}" target="_blank" rel="noopener noreferrer">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(summary)}</span>
    </a>
  `;
}

function renderObservations() {
  if (!state.observation) {
    elements.obsSummary.textContent = state.pointsMeta?.relativeLocation?.properties?.city
      ? `Nearest observation feed available through ${state.pointsMeta.cwa || "NWS"} office metadata.`
      : "Waiting for location.";
    return;
  }

  const tempC = state.observation.temperature?.value;
  const windKt = state.observation.windSpeed?.value;
  const text = [
    state.observation.station ? `Station ${state.observation.station.split("/").pop()}` : null,
    Number.isFinite(tempC) ? `${Math.round((tempC * 9) / 5 + 32)}${DEGREE}F` : null,
    Number.isFinite(windKt) ? `Wind ${Math.round(windKt * 1.94384)} kt` : null,
    state.observation.textDescription || null
  ].filter(Boolean).join(" | ");

  elements.obsSummary.textContent = text || "Observation feed available.";
}

function renderHeroLabels() {
  const runInfo = getModelRunInfo();
  const alertsCount = state.alerts.length;
  elements.heroRunLabel.textContent = `${runInfo.weekday} ${runInfo.mainRun}`;
  elements.heroRunMeta.textContent = state.weatherMeta
    ? `Updated ${formatClock(state.weatherMeta.fetchedAt)}`
    : "Waiting for live data";
  elements.heroOutlookTitle.textContent = state.placeLabel;
  elements.heroOutlookLevel.textContent = alertsCount ? `${alertsCount} active local alerts` : "Latest SPC convective outlook";
  elements.heroCategoryTitle.textContent = "Category";
  elements.heroCategoryLevel.textContent = buildHeroCategory();
  elements.heroTornadoLevel.textContent = buildHeroThreat("tornado");
  elements.heroWindLevel.textContent = buildHeroThreat("wind");
  elements.heroHailLevel.textContent = buildHeroThreat("hail");
  elements.heroFooterLabel.textContent = state.pointsMeta?.cwa ? `${state.pointsMeta.cwa} operations desk` : "Convective Outlook";
}

function buildHeroCategory() {
  if (!state.weather) {
    return "Awaiting forecast";
  }

  const precip = state.weather.daily.precipitation_probability_max[0] || 0;
  const gust = state.weather.daily.wind_gusts_10m_max[0] || 0;
  if (gust >= 45 || precip >= 70) {
    return "Elevated";
  }
  if (gust >= 30 || precip >= 50) {
    return "Watch";
  }
  return "Low-end";
}

function buildHeroThreat(type) {
  if (!state.weather) {
    return "Updating";
  }

  const gust = state.weather.daily.wind_gusts_10m_max[0] || 0;
  const precip = state.weather.daily.precipitation_probability_max[0] || 0;
  const thunder = state.weather.hourly.weather_code.slice(0, 12).some((code) => [95, 96, 99].includes(code));

  if (type === "tornado") {
    return thunder ? "Thunder signal" : "Monitor";
  }
  if (type === "wind") {
    return gust >= 40 ? `${Math.round(gust)} mph` : "Below threshold";
  }
  return precip >= 60 ? `${precip}% precip` : "Limited";
}

function buildSummary(current, daily) {
  const high = daily.temperature_2m_max[0];
  const low = daily.temperature_2m_min[0];
  const precip = daily.precipitation_probability_max[0] || 0;
  return `${describeWeatherCode(current.weather_code, current.is_day === 1)}. High ${Math.round(high)}${DEGREE}, low ${Math.round(low)}${DEGREE}, ${precip}% precip chance today.`;
}

function buildSevereIndicators(current, hourly, daily) {
  const indicators = [];
  const maxGust = Math.max(...daily.wind_gusts_10m_max.filter(Number.isFinite));
  const maxPrecip = Math.max(...daily.precipitation_probability_max.filter(Number.isFinite));
  const thunderSignal = hourly.weather_code.some((code) => [95, 96, 99].includes(code)) || [95, 96, 99].includes(current.weather_code);

  if (thunderSignal) {
    indicators.push({ label: "Thunderstorm signal in forecast", level: "severe" });
  }
  if (maxGust >= 40) {
    indicators.push({ label: `Strong gusts up to ${Math.round(maxGust)} mph`, level: "watch" });
  }
  if (maxPrecip >= 70) {
    indicators.push({ label: "Heavy precipitation potential", level: "watch" });
  }
  if (current.surface_pressure <= 1005) {
    indicators.push({ label: "Lower pressure environment", level: "watch" });
  }

  return indicators.slice(0, 4);
}

function getModelRunInfo() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const mainCycleHour = utcHour >= 18 ? 18 : utcHour >= 12 ? 12 : utcHour >= 6 ? 6 : 0;
  const runStamp = `${String(mainCycleHour).padStart(2, "0")}z`;
  return {
    weekday: now.toLocaleDateString([], { weekday: "short", month: "2-digit", day: "2-digit" }),
    mainRun: `Run ${runStamp}`,
    shortRun: `Run ${runStamp}`,
    mainCycle: `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(mainCycleHour).padStart(2, "0")}`
  };
}

function setLoadingState(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.textContent = isLoading ? "Refreshing..." : "Refresh";
  elements.locateButton.disabled = isLoading;
}

function handleLocationError(error) {
  const message = error?.code === 1
    ? "Location permission was denied. Enable location access to load local weather products."
    : "Unable to read your location right now. Check permissions and try again.";

  renderHomeError(message);
  renderLocationFallback(message);
  showBanner(message, true);
}

function renderLocationFallback(message) {
  elements.locationLabel.textContent = "Location unavailable";
  elements.currentCondition.textContent = "Location required";
  elements.currentSummary.textContent = "This live desk uses your location for local forecast, radar centering, alerts, and observations.";
  elements.alertsStatus.textContent = "Waiting for location";
  elements.alertsList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.obsSummary.textContent = "Location is required for local observation and mapping links.";
  renderHeroLabels();
}

function renderHomeError(message) {
  elements.homeError.textContent = message;
  elements.homeError.classList.remove("hidden");
}

function clearHomeError() {
  elements.homeError.textContent = "";
  elements.homeError.classList.add("hidden");
}

function buildSourceLabel() {
  if (!state.weatherMeta) {
    return "No data";
  }

  if (state.weatherMeta.source === "fresh") {
    return "Fresh weather data";
  }

  if (state.weatherMeta.source === "cache") {
    return `Cached ${formatRelativeTime(state.weatherMeta.fetchedAt)}`;
  }

  return "Weather ready";
}

function buildSourceClass() {
  if (!state.weatherMeta) {
    return "chip-muted";
  }
  return state.weatherMeta.source === "fresh" ? "chip-fresh" : "chip-cached";
}

function readCache(key, maxAgeMs) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 12000
    });
  });
}

function describeWeatherCode(code, isDay) {
  const table = {
    0: isDay ? "Clear sky" : "Clear night",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };

  return table[code] || "Conditions unavailable";
}

function degreesToCompass(degrees) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8];
}

function severityToClass(severity, eventName) {
  const normalized = `${severity} ${eventName}`.toLowerCase();
  if (normalized.includes("warning") || normalized.includes("severe") || normalized.includes("extreme")) {
    return "warning";
  }
  if (normalized.includes("watch")) {
    return "watch";
  }
  return "advisory";
}

function showBanner(message, isError) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.remove("hidden");
  elements.statusBanner.style.borderColor = isError
    ? "rgba(239, 106, 97, 0.34)"
    : "rgba(115, 183, 255, 0.34)";
  elements.statusBanner.style.background = isError
    ? "rgba(239, 106, 97, 0.12)"
    : "rgba(115, 183, 255, 0.12)";

  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => {
    elements.statusBanner.classList.add("hidden");
  }, 3000);
}

function buildCoordinateLabel(lat, lon) {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function formatHour(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric" });
}

function formatDay(isoString) {
  return new Date(isoString).toLocaleDateString([], { weekday: "short" });
}

function formatClock(timestamp) {
  if (!timestamp) {
    return "--";
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatRelativeTime(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ago`;
  }
  return `${Math.round(seconds / 3600)}h ago`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loadSatelliteImage();

function loadSatelliteImage() {
  const sources = [
    "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/1250x750.jpg",
    "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/CONUS/GEOCOLOR/1250x750.jpg"
  ];

  elements.satelliteImage.src = sources[state.satelliteIndex];
  elements.satelliteImage.addEventListener("error", rotateSatelliteFallback, { once: true });
}

function rotateSatelliteFallback() {
  state.satelliteIndex = Math.min(state.satelliteIndex + 1, 1);
  elements.satelliteStatus.textContent = state.satelliteIndex === 1 ? "Fallback GOES source" : "Latest image";
  elements.satelliteImage.src = state.satelliteIndex === 1
    ? "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/CONUS/GEOCOLOR/1250x750.jpg"
    : elements.satelliteImage.src;
}
