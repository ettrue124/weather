const DEFAULT_SETTINGS = {
  liveMode: false,
  intervalMs: 60000,
  units: "us"
};

const WEATHER_CACHE_TTL_MS = 120000;
const ALERTS_CACHE_TTL_MS = 300000;
const GEOCODE_CACHE_TTL_MS = 3600000;

const state = {
  settings: loadSettings(),
  currentScreen: "home",
  position: null,
  placeLabel: "Locating you...",
  weather: null,
  weatherMeta: null,
  alerts: [],
  alertsMeta: null,
  reverseLookup: null,
  radarMap: null,
  radarLayer: null,
  radarMarker: null,
  radarFrameLabel: "Loading radar...",
  liveTimer: null,
  online: navigator.onLine
};

const elements = {
  tabs: [...document.querySelectorAll(".tab-button")],
  screens: [...document.querySelectorAll(".screen")],
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
  severeIndicators: document.getElementById("severe-indicators"),
  hourlyForecast: document.getElementById("hourly-forecast"),
  dailyForecast: document.getElementById("daily-forecast"),
  radarStatus: document.getElementById("radar-status"),
  alertsStatus: document.getElementById("alerts-status"),
  alertsList: document.getElementById("alerts-list"),
  homeError: document.getElementById("home-error"),
  liveModeToggle: document.getElementById("live-mode-toggle"),
  intervalSelect: document.getElementById("interval-select"),
  unitsButtons: [...document.querySelectorAll(".segment")],
  cacheNote: document.getElementById("cache-note"),
  chaseScore: document.getElementById("chase-score"),
  chaseWindow: document.getElementById("chase-window"),
  chaseLinks: document.getElementById("chase-links")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  applySettingsToUi();
  initMap();
  registerServiceWorker();
  refreshDashboard({ forceFresh: false, reason: "initial" });
  syncLiveMode();
});

function bindEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => switchScreen(button.dataset.screen));
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshDashboard({ forceFresh: true, reason: "manual" });
  });

  elements.locateButton.addEventListener("click", () => {
    refreshDashboard({ forceFresh: true, reason: "location-button" });
  });

  elements.centerRadarButton.addEventListener("click", () => centerRadarOnPosition());

  elements.liveModeToggle.addEventListener("change", (event) => {
    state.settings.liveMode = event.target.checked;
    saveSettings(state.settings);
    syncLiveMode();
    renderCacheNote();
  });

  elements.intervalSelect.addEventListener("change", (event) => {
    state.settings.intervalMs = Number(event.target.value);
    saveSettings(state.settings);
    syncLiveMode();
    renderCacheNote();
  });

  elements.unitsButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.units = button.dataset.units;
      saveSettings(state.settings);
      applySettingsToUi();
      renderCacheNote();
      refreshDashboard({ forceFresh: true, reason: "units-change" });
    });
  });

  window.addEventListener("online", () => {
    state.online = true;
    showBanner("Back online. Refreshing weather data.", false);
    refreshDashboard({ forceFresh: false, reason: "online" });
  });

  window.addEventListener("offline", () => {
    state.online = false;
    showBanner("You are offline. Cached weather will remain available when possible.", true);
  });
}

function switchScreen(screenName) {
  state.currentScreen = screenName;

  elements.tabs.forEach((button) => {
    const active = button.dataset.screen === screenName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  elements.screens.forEach((screen) => {
    const active = screen.id === `screen-${screenName}`;
    screen.classList.toggle("active", active);
    screen.hidden = !active;
  });

  if (screenName === "radar" && state.radarMap) {
    setTimeout(() => state.radarMap.invalidateSize(), 120);
  }
}

async function refreshDashboard({ forceFresh = false, reason = "manual" } = {}) {
  clearHomeError();

  try {
    const position = await getCurrentPosition();
    state.position = position;
    renderLocationHeader();
    updateRadarPosition(position);

    let placeValue = null;
    try {
      placeValue = await loadPlaceLabel(position, forceFresh);
      if (placeValue) {
        state.placeLabel = placeValue;
        renderLocationHeader();
      }
    } catch {
      state.placeLabel = buildCoordinateLabel(position.coords.latitude, position.coords.longitude);
      renderLocationHeader();
    }

    const lookups = [
      loadWeather(position, forceFresh),
      loadAlerts(position, forceFresh),
      refreshRadarLayer()
    ];

    const [weatherResult, alertsResult] = await Promise.allSettled(lookups);

    if (weatherResult.status === "rejected") {
      renderHomeError(weatherResult.reason.message || "Weather data is currently unavailable.");
    }

    if (alertsResult.status === "rejected") {
      renderAlertsError(alertsResult.reason.message || "Weather alerts are currently unavailable.");
    }

    if (reason === "manual") {
      showBanner("Weather data refreshed.", false, 2200);
    }
  } catch (error) {
    handleLocationError(error);
  }
}

async function loadPlaceLabel(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `geocode:${roundCoordinate(lat, 2)},${roundCoordinate(lon, 2)}`;
  const cached = readCache(cacheKey, GEOCODE_CACHE_TTL_MS);

  if (cached && !forceFresh) {
    state.reverseLookup = cached.data;
    return cached.data.label;
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
  const firstResult = payload.results && payload.results[0];
  if (!firstResult) {
    return buildCoordinateLabel(lat, lon);
  }

  const parts = [firstResult.name, firstResult.admin1].filter(Boolean);
  const label = parts.length ? parts.join(", ") : buildCoordinateLabel(lat, lon);
  const data = {
    label,
    countryCode: firstResult.country_code || null
  };

  state.reverseLookup = data;
  writeCache(cacheKey, data);
  return data.label;
}

async function loadWeather(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const units = getUnitConfig();
  const cacheKey = `weather:${roundCoordinate(lat, 2)},${roundCoordinate(lon, 2)}:${state.settings.units}`;
  const weatherTtl = state.settings.liveMode
    ? Math.max(25000, state.settings.intervalMs - 5000)
    : WEATHER_CACHE_TTL_MS;
  const cached = readCache(cacheKey, weatherTtl);

  if (cached && !forceFresh) {
    state.weather = cached.data;
    state.weatherMeta = {
      source: "cache",
      fetchedAt: cached.savedAt
    };
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
      "wind_speed_10m",
      "weather_code"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_gusts_10m_max"
    ].join(","),
    temperature_unit: units.temperatureApi,
    wind_speed_unit: units.windApi,
    precipitation_unit: units.precipitationApi,
    timezone: "auto",
    forecast_days: "7"
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Weather provider returned an unexpected response.");
    }

    const payload = await response.json();
    state.weather = payload;
    state.weatherMeta = {
      source: "fresh",
      fetchedAt: Date.now()
    };
    writeCache(cacheKey, payload);
    renderWeather();
    return payload;
  } catch (error) {
    const staleCache = readCache(cacheKey);
    if (staleCache) {
      state.weather = staleCache.data;
      state.weatherMeta = {
        source: "stale-cache",
        fetchedAt: staleCache.savedAt
      };
      renderWeather();
      return staleCache.data;
    }

    throw error;
  }
}

async function loadAlerts(position, forceFresh) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const cacheKey = `alerts:${roundCoordinate(lat, 2)},${roundCoordinate(lon, 2)}`;
  const cached = readCache(cacheKey, ALERTS_CACHE_TTL_MS);
  const countryCode = state.reverseLookup && state.reverseLookup.countryCode;

  if (countryCode && countryCode !== "US") {
    state.alerts = [];
    state.alertsMeta = {
      source: "unsupported-region",
      fetchedAt: Date.now()
    };
    renderAlerts();
    return [];
  }

  if (cached && !forceFresh) {
    state.alerts = cached.data;
    state.alertsMeta = {
      source: "cache",
      fetchedAt: cached.savedAt
    };
    renderAlerts();
    return cached.data;
  }

  const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/geo+json"
      }
    });

    if (!response.ok) {
      throw new Error("Alerts service is temporarily unavailable.");
    }

    const payload = await response.json();
    const features = Array.isArray(payload.features) ? payload.features : [];
    state.alerts = features;
    state.alertsMeta = {
      source: "fresh",
      fetchedAt: Date.now()
    };
    writeCache(cacheKey, features);
    renderAlerts();
    return features;
  } catch (error) {
    const staleCache = readCache(cacheKey);
    if (staleCache) {
      state.alerts = staleCache.data;
      state.alertsMeta = {
        source: "stale-cache",
        fetchedAt: staleCache.savedAt
      };
      renderAlerts();
      return staleCache.data;
    }

    throw error;
  }
}

async function refreshRadarLayer() {
  if (!state.radarMap) {
    return;
  }

  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!response.ok) {
    elements.radarStatus.textContent = "Radar unavailable";
    return;
  }

  const payload = await response.json();
  const latestFrame = payload.radar && payload.radar.past && payload.radar.past[payload.radar.past.length - 1];

  if (!latestFrame) {
    elements.radarStatus.textContent = "No radar frames found";
    return;
  }

  const tileUrl = `${payload.host}${latestFrame.path}/256/{z}/{x}/{y}/6/1_1.png`;
  elements.radarStatus.textContent = `Radar frame ${formatFrameTime(latestFrame.time)}`;

  if (state.radarLayer) {
    state.radarMap.removeLayer(state.radarLayer);
  }

  /* RainViewer's free public tiles are suitable for personal use, but coverage
     and availability can vary by region and provider uptime. */
  state.radarLayer = L.tileLayer(tileUrl, {
    opacity: 0.72,
    attribution: '&copy; OpenStreetMap contributors | Radar &copy; RainViewer'
  }).addTo(state.radarMap);
}

function renderLocationHeader() {
  if (!state.position) {
    return;
  }

  elements.locationLabel.textContent = state.placeLabel || buildCoordinateLabel(
    state.position.coords.latitude,
    state.position.coords.longitude
  );
}

function renderWeather() {
  if (!state.weather) {
    return;
  }

  const { current, hourly, daily } = state.weather;
  const units = getUnitConfig();
  const condition = describeWeatherCode(current.weather_code, current.is_day === 1);
  const summary = buildSummary(current, daily);
  const severeIndicators = buildSevereIndicators(current, hourly, daily);

  elements.currentTemp.textContent = `${Math.round(current.temperature_2m)}°`;
  elements.currentCondition.textContent = condition.label;
  elements.currentSummary.textContent = summary;
  elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}${units.temperatureSymbol}`;
  elements.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} ${units.windLabel}`;
  elements.windDirection.textContent = `${degreesToCompass(current.wind_direction_10m)} ${Math.round(current.wind_direction_10m)}°`;
  elements.humidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  elements.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;
  elements.lastUpdated.textContent = `Last updated: ${formatClock(state.weatherMeta && state.weatherMeta.fetchedAt)}`;
  elements.dataSourceChip.textContent = buildSourceLabel();
  elements.dataSourceChip.className = `chip ${buildSourceClass()}`;

  renderSevereIndicators(severeIndicators);
  renderHourlyForecast(hourly);
  renderDailyForecast(daily);
  renderChaseTools(current, hourly, daily);
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

function renderHourlyForecast(hourly) {
  const hours = hourly.time.slice(0, 12).map((time, index) => ({
    time,
    temperature: hourly.temperature_2m[index],
    precipitationProbability: hourly.precipitation_probability[index],
    windGust: hourly.wind_gusts_10m[index],
    weatherCode: hourly.weather_code[index]
  }));

  elements.hourlyForecast.classList.remove("loading-strip");
  elements.hourlyForecast.innerHTML = hours.map((hour) => {
    const condition = describeWeatherCode(hour.weatherCode, true);
    return `
      <article class="hour-card">
        <div class="hour-time">${formatHour(hour.time)}</div>
        <div class="hour-temp">${Math.round(hour.temperature)}°</div>
        <div class="hour-meta">${condition.label}</div>
        <div class="hour-meta">${hour.precipitationProbability || 0}% precip</div>
        <div class="hour-meta">Gust ${Math.round(hour.windGust || 0)} ${getUnitConfig().windLabel}</div>
      </article>
    `;
  }).join("");
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

  elements.dailyForecast.innerHTML = days.map((day) => {
    const condition = describeWeatherCode(day.code, true);
    return `
      <article class="daily-row">
        <div class="day-name">${formatDay(day.time)}</div>
        <div>
          <div class="daily-summary">${condition.label}</div>
          <div class="day-meta">${day.precip || 0}% precip • Gust ${Math.round(day.gust || 0)} ${getUnitConfig().windLabel}</div>
        </div>
        <div class="day-temps">${Math.round(day.max)}° / ${Math.round(day.min)}°</div>
      </article>
    `;
  }).join("");
}


function renderChaseTools(current, hourly, daily) {
  const scoreData = calculateChaseScore(current, hourly, daily);
  elements.chaseScore.textContent = `Chase score: ${scoreData.score}/100 (${scoreData.level})`;
  elements.chaseWindow.textContent = `Best chase window: ${scoreData.window}`;

  if (!state.position) {
    elements.chaseLinks.innerHTML = "";
    return;
  }

  const lat = state.position.coords.latitude.toFixed(2);
  const lon = state.position.coords.longitude.toFixed(2);
  const links = [
    { label: "SPC Outlook", href: "https://www.spc.noaa.gov/products/outlook/" },
    { label: "Mesoanalysis", href: `https://www.spc.noaa.gov/exper/mesoanalysis/new/viewsector.php?sector=17&parm=mlcape` },
    { label: "NWS Forecast", href: `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}` },
    { label: "Pivotal Weather", href: `https://www.pivotalweather.com/maps.php?ds=rtma&lat=${lat}&lon=${lon}&zoom=7` }
  ];

  elements.chaseLinks.innerHTML = links
    .map((item) => `<a class="quick-link" href="${item.href}" target="_blank" rel="noopener noreferrer">${item.label}</a>`)
    .join("");
}

function calculateChaseScore(current, hourly, daily) {
  const thunderCodes = new Set([95, 96, 99]);
  const convectiveCodes = new Set([80, 81, 82, 95, 96, 99]);
  const unitWindThreshold = state.settings.units === "metric" ? 60 : 40;

  let score = 15;
  let bestIndex = 0;
  let bestValue = -1;

  for (let i = 0; i < Math.min(12, hourly.time.length); i += 1) {
    const gust = hourly.wind_gusts_10m[i] || 0;
    const precip = hourly.precipitation_probability[i] || 0;
    const code = hourly.weather_code[i];
    let risk = precip * 0.4 + gust * 0.8;
    if (convectiveCodes.has(code)) risk += 30;
    if (thunderCodes.has(code)) risk += 45;
    if (risk > bestValue) {
      bestValue = risk;
      bestIndex = i;
    }
  }

  if (thunderCodes.has(current.weather_code)) score += 35;
  const maxGust = Math.max(...daily.wind_gusts_10m_max.filter(Number.isFinite));
  const precipMax = Math.max(...daily.precipitation_probability_max.filter(Number.isFinite));
  if (maxGust >= unitWindThreshold) score += 20;
  if (precipMax >= 60) score += 15;
  if (current.surface_pressure <= 1002) score += 15;
  if (bestValue > 80) score += 20;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 75 ? "High potential" : score >= 45 ? "Conditional" : "Low-end";
  const window = `${formatHour(hourly.time[bestIndex])} - ${formatHour(hourly.time[Math.min(bestIndex + 2, hourly.time.length - 1)])}`;

  return { score, level, window };
}

function renderAlerts() {
  const metaSource = state.alertsMeta && state.alertsMeta.source;

  if (metaSource === "unsupported-region") {
    elements.alertsStatus.textContent = "U.S. weather.gov alerts only";
    elements.alertsList.innerHTML = '<div class="empty-state">Active alerts are only wired to the U.S. National Weather Service feed in this version.</div>';
    return;
  }

  elements.alertsStatus.textContent = state.alerts.length
    ? `${state.alerts.length} active alert${state.alerts.length === 1 ? "" : "s"}`
    : "No active alerts";

  if (!state.alerts.length) {
    elements.alertsList.innerHTML = '<div class="empty-state">No active alerts were returned for your current area.</div>';
    return;
  }

  elements.alertsList.innerHTML = state.alerts.map((feature) => {
    const props = feature.properties || {};
    const severity = props.severity || "Unknown";
    const urgency = props.urgency || "Unknown";
    const expires = props.expires ? new Date(props.expires) : null;
    const cssClass = severityToClass(severity, props.event);
    const description = props.description
      ? escapeHtml(props.description.slice(0, 280)) + (props.description.length > 280 ? "..." : "")
      : "No description provided.";

    return `
      <article class="alert-card ${cssClass}">
        <h3 class="alert-title">${escapeHtml(props.headline || props.event || "Weather Alert")}</h3>
        <p class="alert-meta">${escapeHtml(severity)} severity • ${escapeHtml(urgency)} urgency • Expires ${expires ? formatDateTime(expires) : "Unknown"}</p>
        <p class="alert-description">${description}</p>
      </article>
    `;
  }).join("");
}

function renderAlertsError(message) {
  elements.alertsStatus.textContent = "Alerts unavailable";
  elements.alertsList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderHomeError(message) {
  elements.homeError.textContent = message;
  elements.homeError.classList.remove("hidden");
}

function clearHomeError() {
  elements.homeError.textContent = "";
  elements.homeError.classList.add("hidden");
}

function handleLocationError(error) {
  const message = error && error.code === 1
    ? "Location permission was denied. Enable location access in Safari or your browser settings."
    : "Unable to read your location right now. Check GPS permissions and try again.";

  renderHomeError(message);
  showBanner(message, true);
  elements.locationLabel.textContent = "Location unavailable";
  elements.currentCondition.textContent = "Location required";
  elements.currentSummary.textContent = "This app needs your location to load local weather, radar, and alerts.";
  elements.alertsStatus.textContent = "Waiting for location";
  elements.alertsList.innerHTML = '<div class="empty-state">Grant location access to load alerts for your area.</div>';
}

function applySettingsToUi() {
  elements.liveModeToggle.checked = state.settings.liveMode;
  elements.intervalSelect.value = String(state.settings.intervalMs);
  elements.unitsButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.units === state.settings.units);
  });
  renderCacheNote();
}

function renderCacheNote() {
  const intervalLabel = intervalToLabel(state.settings.intervalMs);
  elements.cacheNote.textContent = state.settings.liveMode
    ? `Live mode checks your location every ${intervalLabel}. Forecast responses are cached between runs when still fresh.`
    : "Manual refresh mode is active. Cached data is reused briefly so repeated taps do not spam public APIs.";
}

function syncLiveMode() {
  if (state.liveTimer) {
    clearInterval(state.liveTimer);
    state.liveTimer = null;
  }

  if (!state.settings.liveMode) {
    return;
  }

  state.liveTimer = setInterval(() => {
    refreshDashboard({ forceFresh: false, reason: "live-mode" });
  }, state.settings.intervalMs);
}

function initMap() {
  if (typeof L === "undefined") {
    elements.radarStatus.textContent = "Leaflet failed to load";
    return;
  }

  state.radarMap = L.map("radar-map", {
    zoomControl: false,
    attributionControl: true
  }).setView([39.5, -98.35], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 12,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.radarMap);
}

function updateRadarPosition(position) {
  if (!state.radarMap) {
    return;
  }

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  if (!state.radarMarker) {
    state.radarMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: "",
        html: '<div class="radar-marker"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }).addTo(state.radarMap);
  } else {
    state.radarMarker.setLatLng([lat, lon]);
  }

  if (state.currentScreen === "radar") {
    state.radarMap.setView([lat, lon], 7);
  }
}

function centerRadarOnPosition() {
  if (!state.radarMap || !state.position) {
    return;
  }

  state.radarMap.setView([state.position.coords.latitude, state.position.coords.longitude], 7);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      showBanner("Service worker registration failed. Offline shell support is unavailable.", true);
    });
  });
}

function loadSettings() {
  const raw = localStorage.getItem("storm-dashboard-settings");
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem("storm-dashboard-settings", JSON.stringify(settings));
}

function readCache(key, maxAgeMs = Number.POSITIVE_INFINITY) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const age = Date.now() - parsed.savedAt;
    if (age > maxAgeMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify({
    savedAt: Date.now(),
    data
  }));
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: state.settings.liveMode,
      maximumAge: 15000,
      timeout: 12000
    });
  });
}

function getUnitConfig() {
  if (state.settings.units === "metric") {
    return {
      temperatureApi: "celsius",
      windApi: "kmh",
      precipitationApi: "mm",
      temperatureSymbol: "°C",
      windLabel: "km/h"
    };
  }

  return {
    temperatureApi: "fahrenheit",
    windApi: "mph",
    precipitationApi: "inch",
    temperatureSymbol: "°F",
    windLabel: "mph"
  };
}

function buildSummary(current, daily) {
  const todayHigh = daily.temperature_2m_max[0];
  const todayLow = daily.temperature_2m_min[0];
  const precipChance = daily.precipitation_probability_max[0];
  const condition = describeWeatherCode(current.weather_code, current.is_day === 1).label;
  return `${condition}. High ${Math.round(todayHigh)}°, low ${Math.round(todayLow)}°, ${precipChance || 0}% precip chance today.`;
}

function buildSevereIndicators(current, hourly, daily) {
  const items = [];
  const maxGustToday = Math.max(...daily.wind_gusts_10m_max.filter(Number.isFinite));
  const maxPrecipToday = Math.max(...daily.precipitation_probability_max.filter(Number.isFinite));
  const thunderCodes = [95, 96, 99];
  const showerCodes = [80, 81, 82];

  if (thunderCodes.includes(current.weather_code) || hourly.weather_code.some((code) => thunderCodes.includes(code))) {
    items.push({ label: "Thunderstorm signal in forecast", level: "severe" });
  }

  if (maxGustToday >= (state.settings.units === "metric" ? 60 : 40)) {
    items.push({ label: `Strong gusts up to ${Math.round(maxGustToday)} ${getUnitConfig().windLabel}`, level: "watch" });
  }

  if (maxPrecipToday >= 70 && hourly.weather_code.some((code) => showerCodes.includes(code))) {
    items.push({ label: "Heavy shower potential", level: "watch" });
  }

  if (current.surface_pressure <= 1005) {
    items.push({ label: "Lower pressure environment", level: "watch" });
  }

  return items.slice(0, 4);
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

  if (state.weatherMeta.source === "stale-cache") {
    return `Offline cache ${formatRelativeTime(state.weatherMeta.fetchedAt)}`;
  }

  return "Weather data ready";
}

function buildSourceClass() {
  if (!state.weatherMeta) {
    return "chip-muted";
  }

  return state.weatherMeta.source === "fresh" ? "chip-fresh" : "chip-cached";
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
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };

  return {
    label: table[code] || "Conditions unavailable"
  };
}

function degreesToCompass(degrees) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8];
}

function severityToClass(severity, eventName = "") {
  const normalized = `${severity} ${eventName}`.toLowerCase();
  if (normalized.includes("extreme") || normalized.includes("severe") || normalized.includes("warning")) {
    return "warning";
  }
  if (normalized.includes("watch")) {
    return "watch";
  }
  return "advisory";
}

function showBanner(message, isError = false, timeoutMs = 3200) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.remove("hidden");
  elements.statusBanner.style.background = isError
    ? "rgba(251, 113, 133, 0.14)"
    : "rgba(110, 231, 183, 0.14)";
  elements.statusBanner.style.borderColor = isError
    ? "rgba(251, 113, 133, 0.28)"
    : "rgba(110, 231, 183, 0.28)";

  clearTimeout(showBanner.timerId);
  showBanner.timerId = setTimeout(() => {
    elements.statusBanner.classList.add("hidden");
  }, timeoutMs);
}

function roundCoordinate(value, digits) {
  return Number(value).toFixed(digits);
}

function buildCoordinateLabel(lat, lon) {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function formatHour(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric"
  });
}

function formatDay(isoString) {
  return new Date(isoString).toLocaleDateString([], {
    weekday: "short"
  });
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

function formatDateTime(date) {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatRelativeTime(timestamp) {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.round(deltaSeconds / 60)}m ago`;
  }
  return `${Math.round(deltaSeconds / 3600)}h ago`;
}

function formatFrameTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function intervalToLabel(intervalMs) {
  const seconds = intervalMs / 1000;
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = seconds / 60;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
