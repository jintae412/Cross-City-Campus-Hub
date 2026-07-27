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

var WEATHER_ICON_GROUP = {
  0: 'sun', 1: 'sun', 2: 'partly', 3: 'cloud', 45: 'cloud', 48: 'cloud',
  51: 'rain', 53: 'rain', 55: 'rain', 56: 'rain', 57: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
  80: 'rain', 81: 'rain', 82: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow', 85: 'snow', 86: 'snow',
  95: 'storm', 96: 'storm', 99: 'storm'
};

var WEATHER_ICON_PATHS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  partly: '<circle cx="8.5" cy="8" r="2.6"/><path d="M8.5 4v1.2M4.6 6l.9.8M12.4 6l-.9.8"/><path d="M9 18a4 4 0 0 1-.6-7.96 5 5 0 0 1 9.4-1.55A4.5 4.5 0 0 1 17.5 18H9z"/>',
  cloud: '<path d="M6.5 17a4 4 0 0 1-.5-7.96A5 5 0 0 1 15.9 7.5 4.5 4.5 0 0 1 17.5 17h-11z"/>',
  rain: '<path d="M6.5 14a4 4 0 0 1-.5-7.96A5 5 0 0 1 15.9 4.5 4.5 4.5 0 0 1 17.5 14h-11z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  snow: '<path d="M6.5 13a4 4 0 0 1-.5-7.96A5 5 0 0 1 15.9 3.5 4.5 4.5 0 0 1 17.5 13h-11z"/><path d="M8 17v0M8 20v0M12 17v0M12 20v0M16 17v0M16 20v0" stroke-linecap="round"/>',
  storm: '<path d="M6.5 12a4 4 0 0 1-.5-7.96A5 5 0 0 1 15.9 2.5 4.5 4.5 0 0 1 17.5 12h-11z"/><path d="M13 12l-3 5h3l-2 5"/>'
};

function weatherIconSvg(code) {
  var group = WEATHER_ICON_GROUP[code] || 'cloud';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
    + 'stroke-linecap="round" stroke-linejoin="round">' + WEATHER_ICON_PATHS[group] + '</svg>';
}

var weatherData = null;
var openHourlyDate = null;

function loadWeather() {
  var row = document.getElementById('weather-row');
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode'
    + '&hourly=temperature_2m,weathercode'
    + '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=7';

  fetch(url)
    .then(function (res) {
      if (!res.ok) { throw new Error('Weather request failed'); }
      return res.json();
    })
    .then(function (data) {
      weatherData = data;
      renderWeatherDays(row, data.daily);
    })
    .catch(function () {
      row.innerHTML = '<p class="placeholder">Weather is temporarily unavailable — try refreshing in a bit.</p>';
    });
}

function renderWeatherDays(row, daily) {
  row.innerHTML = '';
  daily.time.forEach(function (dateStr, i) {
    var date = new Date(dateStr + 'T00:00:00');
    var weekday = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
    var hi = Math.round(daily.temperature_2m_max[i]);
    var lo = Math.round(daily.temperature_2m_min[i]);
    var code = daily.weathercode[i];
    var label = WEATHER_CODES[code] || 'Unknown';

    var col = document.createElement('button');
    col.type = 'button';
    col.className = 'wx-day-col';
    col.setAttribute('aria-pressed', 'false');
    col.setAttribute('data-date', dateStr);
    col.innerHTML = '<div class="wx-day">' + weekday + '</div>'
      + '<div class="wx-icon">' + weatherIconSvg(code) + '</div>'
      + '<div class="wx-temp"><span class="wx-hi">' + hi + '&deg;</span><span class="wx-lo">' + lo + '&deg;</span></div>'
      + '<div class="wx-cond">' + label + '</div>';
    col.addEventListener('click', function () { toggleHourly(dateStr, col); });
    row.appendChild(col);
  });
}

function toggleHourly(dateStr, col) {
  var panel = document.getElementById('hourly-panel');
  var allDayBtns = document.querySelectorAll('.wx-day-col');

  if (openHourlyDate === dateStr) {
    openHourlyDate = null;
    panel.hidden = true;
    panel.innerHTML = '';
    allDayBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    return;
  }

  openHourlyDate = dateStr;
  allDayBtns.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-date') === dateStr));
  });
  renderHourly(panel, dateStr);
}

function renderHourly(panel, dateStr) {
  var hourly = weatherData.hourly;
  var dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });

  var cells = '';
  hourly.time.forEach(function (timeStr, i) {
    if (timeStr.indexOf(dateStr) !== 0) { return; }
    var hourDate = new Date(timeStr);
    var hourLabel = hourDate.toLocaleTimeString('en-US', { hour: 'numeric' });
    var temp = Math.round(hourly.temperature_2m[i]);
    var icon = weatherIconSvg(hourly.weathercode[i]);
    cells += '<div class="wx-hour">'
      + '<div class="wx-hour-time">' + hourLabel + '</div>'
      + '<div class="wx-icon">' + icon + '</div>'
      + '<div class="wx-hour-temp">' + temp + '&deg;</div>'
      + '</div>';
  });

  panel.innerHTML = '<p class="wx-hourly-title">Hourly &mdash; ' + dateLabel + '</p>'
    + '<div class="wx-hourly-row">' + cells + '</div>';
  panel.hidden = false;
}

loadWeather();

function loadEvents() {
  var list = document.getElementById('events-list');

  fetch('data/nyc-events.json')
    .then(function (res) {
      if (!res.ok) { throw new Error('Events request failed'); }
      return res.json();
    })
    .then(function (events) { renderEvents(list, events); })
    .catch(function () {
      list.innerHTML = '<p class="placeholder">Events are temporarily unavailable.</p>';
    });
}

function renderEvents(list, events) {
  if (!events.length) {
    list.innerHTML = '<p class="placeholder">No events added yet &mdash; edit data/nyc-events.json to add one.</p>';
    return;
  }

  list.innerHTML = events.map(function (ev) {
    var titleHtml = ev.url
      ? '<a href="' + ev.url + '" target="_blank" rel="noopener">' + ev.title + '</a>'
      : ev.title;
    var meta = [ev.date, ev.location].filter(Boolean).join(' &middot; ');
    return '<div class="event-item">'
      + '<div class="event-title">' + titleHtml + '</div>'
      + (meta ? '<div class="event-meta">' + meta + '</div>' : '')
      + '</div>';
  }).join('');
}

loadEvents();

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
