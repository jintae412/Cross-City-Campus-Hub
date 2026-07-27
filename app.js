var WEATHER_CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorms', 96: 'Thunderstorms, hail', 99: 'Thunderstorms, heavy hail'
};

function loadWeather() {
  var row = document.getElementById('weather-row');
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode'
    + '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=7';

  fetch(url)
    .then(function (res) {
      if (!res.ok) { throw new Error('Weather request failed'); }
      return res.json();
    })
    .then(function (data) { renderWeather(row, data.daily); })
    .catch(function () {
      row.innerHTML = '<p class="placeholder">Weather is temporarily unavailable — try refreshing in a bit.</p>';
    });
}

function renderWeather(row, daily) {
  row.innerHTML = '';
  daily.time.forEach(function (dateStr, i) {
    var date = new Date(dateStr + 'T00:00:00');
    var weekday = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
    var hi = Math.round(daily.temperature_2m_max[i]);
    var lo = Math.round(daily.temperature_2m_min[i]);
    var label = WEATHER_CODES[daily.weathercode[i]] || 'Unknown';

    var col = document.createElement('div');
    col.className = 'wx-day-col';
    col.innerHTML = '<div class="wx-day">' + weekday + '</div>'
      + '<div class="wx-temp">' + hi + '&deg;<span class="wx-lo"> ' + lo + '&deg;</span></div>'
      + '<div class="wx-cond">' + label + '</div>';
    row.appendChild(col);
  });
}

loadWeather();

document.querySelectorAll('[data-role="nav"]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var target = btn.getAttribute('data-target');

    document.querySelectorAll('[data-role="nav"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-target') === target));
    });

    document.querySelectorAll('.page-section').forEach(function (section) {
      section.hidden = section.getAttribute('data-section') !== target;
    });
  });
});
