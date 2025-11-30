// ---------------------------
// SkySense Advanced - script.js
// ---------------------------

// Your gemini_api_key (kept as requested; not used for weather)
const gemini_api_key = "AIzaSyBrNsMK0-XiUADpFw3CRsjNQHuIsoa1Ybw";

/*
  This script:
  - Geocodes the city via Open-Meteo geocoding API
  - Fetches weather forecast (current_weather + hourly precipitation_probability & humidity)
  - Fetches air quality from Open-Meteo Air Quality endpoint
  - Renders temperature, humidity, precip chance, wind, AQI and sets a theme (sunny/rainy/snowy/etc.)
  - Adds animated visual elements (sun, clouds, raindrops, snowflakes)
*/

// DOM elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const cityName = document.getElementById('cityName');
const temperature = document.getElementById('temperature');
const feels = document.getElementById('feels');
const desc = document.getElementById('desc');
const updated = document.getElementById('updated');

const humidityEl = document.getElementById('humidity');
const precipEl = document.getElementById('precip');
const windEl = document.getElementById('wind');
const aqiEl = document.getElementById('aqi');

const visual = document.getElementById('visual');
const sunEl = document.getElementById('sun');
const cloud1 = document.getElementById('cloud1');
const cloud2 = document.getElementById('cloud2');
const raindrops = document.getElementById('raindrops');
const snowEl = document.getElementById('snow');

// Default
const DEFAULT_CITY = "New Delhi";

// --- Geocoding ---
async function geocodeCity(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Geocode failed');
    const data = await r.json();
    if (data && data.results && data.results.length > 0) {
      const res = data.results[0];
      return {
        latitude: res.latitude,
        longitude: res.longitude,
        name: res.name,
        country: res.country
      };
    }
    return null;
  } catch (e) {
    console.error("Geocode error", e);
    return null;
  }
}

// --- Fetch weather & hourly (precip prob, humidity) ---
async function fetchWeatherWithHourly(lat, lon) {
  // Request current weather and hourly precipitation probability & relative humidity
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability,relativehumidity_2m,temperature_2m&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather fetch failed');
  return await r.json();
}

// --- Fetch air quality (Open-Meteo Air Quality API) ---
async function fetchAirQuality(lat, lon) {
  // Air quality endpoint (Open-Meteo)
  // Request US AQI and particulate matter
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi,pm2_5,pm10&timezone=auto`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Air quality fetch failed');
    return await r.json();
  } catch (e) {
    console.warn("Air quality fetch failed", e);
    return null;
  }
}

// --- Utility: find index for current hour in hourly.time array --- 
function findHourIndex(hourly, targetISO) {
  if (!hourly || !hourly.time) return -1;
  return hourly.time.indexOf(targetISO);
}

// --- Map weather code to theme & description ---
// We map Open-Meteo weather codes to simple categories.
// For exact code table see Open-Meteo docs; here we map common groups.
function mapWeatherCodeToTheme(code) {
  // code is integer
  // 0: clear
  // 1-3: partly cloudy / mainly clear
  // 45-48: fog
  // 51-67: drizzle / rain
  // 71-77,85,86: snow
  // 80-82,95-99: showers / thunder
  if (code === 0) return {theme:'sunny', label:'Clear'};
  if (code >= 1 && code <= 3) return {theme:'cloudy', label:'Partly cloudy'};
  if (code >= 45 && code <= 48) return {theme:'foggy', label:'Fog'};
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return {theme:'rainy', label:'Rain'};
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return {theme:'snowy', label:'Snow'};
  if (code >= 95) return {theme:'stormy', label:'Thunderstorm'};
  return {theme:'cloudy', label:'Cloudy'};
}

// --- render function ---
function renderBasic(cityLabel) {
  cityName.textContent = cityLabel;
  updated.textContent = `Last updated: ${new Date().toLocaleString()}`;
}

function renderWeatherAndExtras(weatherJson, airQualityJson) {
  // current weather
  const cw = weatherJson.current_weather;
  if (!cw) {
    temperature.textContent = '--°C';
    desc.textContent = 'No current weather';
    return;
  }

  const temp = Math.round(cw.temperature);
  temperature.textContent = `${temp}°C`;
  feels.textContent = ''; // placeholder if you want feels-like in future

  // description label from mapping
  const map = mapWeatherCodeToTheme(cw.weathercode);
  desc.textContent = `${map.label} • code ${cw.weathercode}`;

  // find hourly index
  const hourly = weatherJson.hourly || {};
  const idx = findHourIndex(hourly, cw.time);

  // humidity
  const humidity = (idx >= 0 && hourly.relativehumidity_2m && hourly.relativehumidity_2m[idx] !== undefined)
    ? `${Math.round(hourly.relativehumidity_2m[idx])}%` : '--%';
  humidityEl.textContent = humidity;

  // precipitation probability
  const precip = (idx >= 0 && hourly.precipitation_probability && hourly.precipitation_probability[idx] !== undefined)
    ? `${Math.round(hourly.precipitation_probability[idx])}%` : '--%';
  precipEl.textContent = precip;

  // wind
  const wind = cw.windspeed !== undefined ? `${Math.round(cw.windspeed)} km/h` : '-- km/h';
  windEl.textContent = wind;

  // air quality (hourly.us_aqi from airQualityJson)
  let aqiText = '--';
  if (airQualityJson && airQualityJson.hourly && airQualityJson.hourly.us_aqi) {
    // choose the nearest time index: airQualityJson.hourly.time should align with weather times
    const times = airQualityJson.hourly.time || [];
    const tIndex = times.indexOf(cw.time);
    const aqiVal = (tIndex >= 0) ? airQualityJson.hourly.us_aqi[tIndex] : (airQualityJson.hourly.us_aqi[0] || null);
    if (aqiVal !== null && aqiVal !== undefined) aqiText = String(Math.round(aqiVal));
  }
  aqiEl.textContent = aqiText;
  styleAqiBadge(aqiText);

  // theme visuals
  setTheme(map.theme, cw);
}

// --- style AQI badge with color ---
function styleAqiBadge(aqiText) {
  aqiEl.className = '';
  if (!isFinite(Number(aqiText))) {
    aqiEl.style.background = 'rgba(255,255,255,0.06)';
    aqiEl.style.color = '';
    return;
  }
  const aqi = Number(aqiText);
  // US AQI categories (approx)
  if (aqi <= 50) { // Good
    aqiEl.style.background = '#34C75933';
    aqiEl.style.color = '#0b6623';
  } else if (aqi <= 100) { // Moderate
    aqiEl.style.background = '#ffd54f66';
    aqiEl.style.color = '#5a3e00';
  } else if (aqi <= 150) { // Unhealthy for sensitive groups
    aqiEl.style.background = '#ffb74d66';
    aqiEl.style.color = '#6b2a00';
  } else if (aqi <= 200) { // Unhealthy
    aqiEl.style.background = '#ff704366';
    aqiEl.style.color = '#5a0000';
  } else { // Very unhealthy / Hazardous
    aqiEl.style.background = '#d32f2f66';
    aqiEl.style.color = '#fff';
  }
}

// --- theme visual control ---
function clearVisuals() {
  // hide raindrops and snow, show/hide sun/clouds via classes
  document.body.classList.remove('sunny','cloudy','rainy','snowy','stormy','foggy');
  raindrops.style.display = 'none';
  snowEl.style.display = 'none';
  sunEl.style.display = 'none';
  cloud1.style.display = 'none';
  cloud2.style.display = 'none';
  // clear raindrop/snow children
  raindrops.innerHTML = '';
  snowEl.innerHTML = '';
}

function setTheme(theme, currentWeather) {
  clearVisuals();
  document.body.classList.add(theme);

  if (theme === 'sunny') {
    sunEl.style.display = 'block';
    cloud1.style.display = 'none';
    cloud2.style.display = 'none';
    // ensure warm tint for sun
  } else if (theme === 'cloudy') {
    sunEl.style.display = 'block';
    cloud1.style.display = 'block';
    cloud2.style.display = 'block';
  } else if (theme === 'rainy') {
    cloud1.style.display = 'block';
    cloud2.style.display = 'block';
    raindrops.style.display = 'block';
    generateRaindrops(18);
  } else if (theme === 'snowy') {
    cloud1.style.display = 'block';
    cloud2.style.display = 'block';
    snowEl.style.display = 'block';
    generateSnow(28);
  } else if (theme === 'stormy') {
    cloud1.style.display = 'block';
    cloud2.style.display = 'block';
    raindrops.style.display = 'block';
    generateRaindrops(10, true);
  } else if (theme === 'foggy') {
    cloud1.style.display = 'block';
    cloud2.style.display = 'block';
  }
}

// --- generate raindrops ---
function generateRaindrops(count = 18, heavy=false) {
  raindrops.innerHTML = '';
  for (let i=0;i<count;i++){
    const d = document.createElement('div');
    d.className = 'raindrop';
    const left = Math.random() * 95;
    const duration = (Math.random() * 0.8 + (heavy ? 0.6 : 0.9)) * 1.2; // seconds multiplier
    const delay = Math.random() * 1.2;
    d.style.left = `${left}%`;
    d.style.animationDuration = `${duration + 0.6}s`;
    d.style.animationDelay = `${delay}s`;
    raindrops.appendChild(d);
  }
}

// --- generate snowflakes ---
function generateSnow(count = 24) {
  snowEl.innerHTML = '';
  for (let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'snowflake';
    const left = Math.random() * 98;
    const size = Math.random() * 6 + 4;
    const duration = Math.random() * 6 + 6;
    const delay = Math.random() * 4;
    s.style.left = `${left}%`;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.animationDuration = `${duration}s`;
    s.style.animationDelay = `${delay}s`;
    snowEl.appendChild(s);
  }
}

// --- main search + orchestration ---
async function searchAndShow(q) {
  cityName.textContent = "Loading…";
  desc.textContent = '';
  try {
    const geo = await geocodeCity(q);
    if (!geo) {
      renderBasic("Unknown location");
      temperature.textContent = '--°C';
      desc.textContent = 'No results for that city';
      return;
    }

    renderBasic(`${geo.name}${geo.country ? ', ' + geo.country : ''}`);

    // fetch weather and air quality concurrently
    const [weatherJson, airJson] = await Promise.allSettled([
      fetchWeatherWithHourly(geo.latitude, geo.longitude),
      fetchAirQuality(geo.latitude, geo.longitude)
    ]);

    let weatherData = null;
    let airData = null;

    if (weatherJson.status === 'fulfilled') weatherData = weatherJson.value;
    if (airJson.status === 'fulfilled') airData = airJson.value;

    if (!weatherData) {
      temperature.textContent = '--°C';
      desc.textContent = 'Weather data unavailable';
      return;
    }

    renderWeatherAndExtras(weatherData, airData);
  } catch (err) {
    console.error(err);
    renderBasic("Error");
    temperature.textContent = '--°C';
    desc.textContent = 'Unable to fetch data';
  }
}

// --- DOM handlers ---
searchBtn.addEventListener('click', () => {
  const q = (cityInput.value || "").trim();
  if (q.length) searchAndShow(q);
});

cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = (cityInput.value || "").trim();
    if (q.length) searchAndShow(q);
  }
});

// load default
document.addEventListener('DOMContentLoaded', () => {
  cityInput.value = DEFAULT_CITY;
  searchAndShow(DEFAULT_CITY);
});
