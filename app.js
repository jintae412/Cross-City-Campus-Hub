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

// Fetched at 14 and shown at 7. One request either way, so the extra week costs nothing and
// expanding is instant — refetching on click would put a spinner behind a disclosure toggle.
var DEFAULT_FORECAST_DAYS = 7;

function loadWeather() {
  var row = document.getElementById('weather-row');
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode'
    + '&hourly=temperature_2m,weathercode'
    + '&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=14';

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
    col.className = 'wx-day-col' + (i >= DEFAULT_FORECAST_DAYS ? ' wx-extended' : '');
    col.setAttribute('aria-pressed', 'false');
    col.setAttribute('data-date', dateStr);
    col.innerHTML = '<div class="wx-day">' + weekday + '</div>'
      + '<div class="wx-icon">' + weatherIconSvg(code) + '</div>'
      + '<div class="wx-temp"><span class="wx-hi">' + hi + '&deg;</span><span class="wx-lo">' + lo + '&deg;</span></div>'
      + '<div class="wx-cond">' + label + '</div>';
    col.addEventListener('click', function () { toggleHourly(dateStr, col); });
    row.appendChild(col);
  });

  if (daily.time.length > DEFAULT_FORECAST_DAYS) {
    row.appendChild(buildForecastToggle(row, daily.time.length));
  }
}

function buildForecastToggle(row, totalDays) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wx-more';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'weather-row');

  function paint() {
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.title = expanded ? 'Show ' + DEFAULT_FORECAST_DAYS + ' days'
      : 'Show ' + totalDays + ' days';
    btn.innerHTML = '<span class="wx-more-chev" aria-hidden="true">' + (expanded ? '‹' : '›')
      + '</span><span class="wx-more-label">' + (expanded ? DEFAULT_FORECAST_DAYS : totalDays)
      + ' days</span>';
  }

  btn.addEventListener('click', function () {
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    row.classList.toggle('wx-show-extended', !expanded);
    // An open hourly panel for a day that just got hidden would be stranded with nothing selected.
    if (expanded && openHourlyDate) {
      var stillVisible = row.querySelector('.wx-day-col[data-date="' + openHourlyDate
        + '"]:not(.wx-extended)');
      if (!stillVisible) { toggleHourly(openHourlyDate, null); }
    }
    paint();
  });

  paint();
  return btn;
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
    var link = safeUrl(ev.url);
    var titleHtml = link
      ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener">' + escapeHtml(ev.title) + '</a>'
      : escapeHtml(ev.title);
    var meta = [ev.date, ev.location].filter(Boolean).map(escapeHtml).join(' &middot; ');
    return '<div class="event-item">'
      + '<div class="event-title">' + titleHtml + '</div>'
      + (meta ? '<div class="event-meta">' + meta + '</div>' : '')
      + '</div>';
  }).join('');
}

loadEvents();

function loadUniversity(id, containerId) {
  var container = document.getElementById(containerId);

  Promise.all([
    fetch('data/universities/' + id + '.json').then(function (res) {
      if (!res.ok) { throw new Error('University data request failed'); }
      return res.json();
    }),
    // The AI holding file. A campus that has none is the normal case, so a missing or broken
    // one degrades to "no drafted entries" rather than failing the whole page.
    fetch('data/universities/' + id + '-content-suggestions.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; })
  ])
    .then(function (both) { renderUniversity(container, both[0], both[1]); })
    .catch(function () {
      // Also catches a render that threw on missing fields, which is the likelier failure once
      // someone hand-adds a university — so the message names the file rather than blaming the network.
      container.innerHTML = '<p class="placeholder">This university\'s data couldn\'t be loaded. '
        + 'It may be temporarily unavailable, or data/universities/' + id + '.json may be '
        + 'missing a required field — see the README.</p>';
    });
}

// Entries a person has already accepted are spliced into the live file by review_content.py but
// left in the queue marked reviewed, so they'd otherwise render twice — once plain, once badged.
// The key check is the same one that script dedupes on, and also covers an entry copied across
// by hand without the flag being flipped.
function pendingSuggestions(suggestions, section, live) {
  var queued = suggestions && suggestions[section] ? suggestions[section] : [];
  return queued.filter(function (entry) {
    if (entry.reviewed === true) { return false; }
    return !live.some(function (item) {
      return section === 'calendar'
        ? item.date === entry.date && item.label === entry.label
        : item === entry.text;
    });
  });
}

// Nothing here has been read by a person yet, so the badge says so on every single entry rather
// than once at the top of the card — a note above a list gets scrolled past and then quoted at
// someone as fact. The source travels in the tooltip so it's checkable without leaving the page.
function aiBadge(entry) {
  var tip = 'Drafted by AI from a public web page and not yet checked by a person.'
    + (entry.source ? ' Source: ' + entry.source : '');
  return ' <span class="ai-unchecked" title="' + escapeHtml(tip) + '">AI &middot; unchecked</span>';
}

// Undated entries sort last: "date unknown" belongs at the bottom of a calendar, not at the top
// where an empty date column reads as a rendering bug.
function byDate(a, b) {
  if (!a.date) { return b.date ? 1 : 0; }
  if (!b.date) { return -1; }
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

function renderUniversity(container, uni, suggestions) {
  var aiCalendar = pendingSuggestions(suggestions, 'calendar', uni.calendar);
  var aiTraditions = pendingSuggestions(suggestions, 'traditions', uni.traditions);
  aiCalendar.forEach(function (ev) { ev.aiUnchecked = true; });

  var majorsHtml = uni.majors.map(function (m) {
    return '<div class="major"><span class="major-name">' + escapeHtml(m.label) + '</span>'
      + '<span class="major-pct">' + escapeHtml(m.pct) + '%</span></div>'
      + '<div class="bar-track"><div class="bar-fill" style="width:' + Math.min(Number(m.pct) * 3, 100) + '%"></div></div>';
  }).join('');

  // Merged and re-sorted rather than appended in a block: a September AI date listed under
  // December's hand-checked one is worse than useless for planning a trip.
  var calendarHtml = uni.calendar.concat(aiCalendar).sort(byDate).map(function (ev) {
    var dateLabel = ev.date
      ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'TBD';
    var flag = ev.aiUnchecked ? aiBadge(ev)
      : ev.verified === false ? ' <span class="unverified">(unconfirmed)</span>' : '';
    return '<div class="cal-item"><span class="cal-item-date">' + escapeHtml(dateLabel) + '</span>'
      + '<span class="cal-item-label">' + escapeHtml(ev.label) + flag + '</span></div>';
  }).join('');

  var calendarNote = aiCalendar.length
    ? '<p class="source-note">' + aiCalendar.length + ' of these were drafted by AI from the '
      + 'university&rsquo;s own pages and <strong>nobody has checked them yet</strong> &mdash; '
      + 'hover one for its source, and confirm before planning around it.</p>'
    : '';

  var traditionsHtml = uni.traditions.map(escapeHtml)
    .concat(aiTraditions.map(function (t) { return escapeHtml(t.text) + aiBadge(t); }))
    .join(', ');

  container.innerHTML = '<div class="row-top">'
    + '<div>'
    + '<p class="cap-label">Campus &amp; Culture</p>'
    + '<p class="blurb">' + escapeHtml(uni.culture) + '</p>'
    + '<p class="demo-line">' + uni.demographics.undergrad.toLocaleString() + ' undergraduates &middot; '
    + uni.demographics.graduate.toLocaleString() + ' graduate students &middot; '
    + escapeHtml(uni.demographics.womenPct) + '% women &middot; '
    + escapeHtml(uni.demographics.internationalPct) + '% international</p>'
    + '<p class="source-note">Source: ' + escapeHtml(uni.demographics.source) + '</p>'
    + '<p class="cap-label" style="margin-top:1.6rem">Top Majors</p>'
    + majorsHtml
    + '<p class="source-note">' + escapeHtml(uni.majorsNote) + '</p>'
    + '<p class="cap-label" style="margin-top:1.6rem">Traditions</p>'
    + '<p class="trad-prose">' + traditionsHtml + '</p>'
    + '</div>'
    + '<div class="card">'
    + '<p class="cap-label">Calendar</p>'
    + calendarHtml
    + calendarNote
    + '</div>'
    + '</div>';
}

// Driven off the markup rather than a hardcoded list, so adding a campus stays a matter of
// copying a section in index.html and dropping in a JSON file — no edit here.
document.querySelectorAll('[data-university-content]').forEach(function (el) {
  loadUniversity(el.getAttribute('data-university-content'), el.id);
});

// id -> { map, markers }. Presence doubles as the "already built" flag.
var universityMaps = {};

// One fetch for the registry, shared by every map that asks for it. Doing it per-map would
// race two clicks against each other; doing it at startup and stashing the array would race
// the click against the fetch.
var universityRegistry = fetch('data/universities/index.json')
  .then(function (res) { return res.json(); });

// Most pin text now comes from OpenStreetMap, which anyone in the world can edit. That makes it
// untrusted input rather than our own data: a venue renamed to `<img src=x onerror=...>` would
// otherwise run as script the moment someone opened its popup. Escaped on the way into innerHTML.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Same reasoning for links: an OSM `website` tag holding a javascript: URL would become a
// clickable script. Anything that isn't a plain web or phone link is dropped rather than rendered.
function safeUrl(url) {
  return /^(https?:|tel:)/i.test(String(url == null ? '' : url)) ? String(url) : null;
}

var MAP_CATEGORY_LABELS = {
  dorm: 'Dorm', library: 'Library', dining: 'Dining Hall', subway: 'Subway',
  parking: 'Parking', gym: 'Gym / Athletic', restroom: 'Restroom', meet: 'Meeting Spot',
  'rain-backup': 'Indoor Rain Backup', quiet: 'Quiet Spot', 'group-food': 'Group Food',
  church: 'Nearby Church', 'sit-no-id': 'Sit Without ID', wifi: 'Good Wi-Fi', power: 'Power Outlets'
};

// Marker color reflects a broad group, not every individual category — with up to four
// categories on a single pin (e.g. Lerner Hall), per-category marker colors would be ambiguous
// anyway. Fine-grained filtering still works off the full category list via the dropdown.
var MAP_CATEGORY_GROUP = {
  dorm: 'lodging', library: 'lodging', quiet: 'lodging', wifi: 'lodging', power: 'lodging',
  restroom: 'lodging', 'rain-backup': 'lodging',
  dining: 'food', 'group-food': 'food',
  subway: 'transit', parking: 'transit',
  meet: 'social', 'sit-no-id': 'social', church: 'social', gym: 'social'
};
// Muted against the greyscale basemap — the old saturated set fought the tiles for attention.
// Kept to four hues that separate by lightness as well as hue, so they stay tellable apart
// in greyscale and for the common red/green colour-vision deficiencies.
// Mirrored by the legend swatches in index.html — update both together.
var MAP_GROUP_COLORS = {
  lodging: '#33587D', food: '#C08A3E', transit: '#8C8878', social: '#9C4038'
};

// The filter controls are generated rather than written per university — the category list
// lives in MAP_CATEGORY_LABELS, and hand-copying 15 <option> tags into every new university's
// section is how the two drift apart.
function mapSectionHtml(id) {
  var options = Object.keys(MAP_CATEGORY_LABELS).map(function (key) {
    return '<option value="' + key + '">' + MAP_CATEGORY_LABELS[key] + '</option>';
  }).join('');

  return '<p class="cap-label">Campus Map</p>'
    + '<div class="map-filters">'
    + '<label for="' + id + '-map-category">Category '
    + '<select id="' + id + '-map-category"><option value="all">All categories</option>'
    + options + '</select></label>'
    // TODO: group-size filter is parked, not deleted — see pinMatchesSize below. It needs
    // capacity data that doesn't exist yet (0 of 855 NYU pins have it), and shipping a control
    // that empties the map is worse than not shipping it.
    + '<label for="' + id + '-map-open-now">'
    + '<input type="checkbox" id="' + id + '-map-open-now"> Open now only</label>'
    + '<label for="' + id + '-map-verified">'
    + '<input type="checkbox" id="' + id + '-map-verified"> Hand-checked spots only</label>'
    + '</div>'
    + '<p class="source-note" id="' + id + '-map-note">Most pins come straight from '
    + 'OpenStreetMap and haven&rsquo;t been checked in person &mdash; call ahead for anything '
    + 'you&rsquo;re planning around.</p>'
    + '<p class="placeholder map-empty" id="' + id + '-map-empty" hidden></p>'
    + '<div id="' + id + '-map" class="leaflet-map"></div>'
    + '<div class="map-legend-simple">'
    + '<span><span class="swatch" style="background:' + MAP_GROUP_COLORS.lodging + '"></span>Lodging &amp; Study</span>'
    + '<span><span class="swatch" style="background:' + MAP_GROUP_COLORS.food + '"></span>Food</span>'
    + '<span><span class="swatch" style="background:' + MAP_GROUP_COLORS.transit + '"></span>Transit &amp; Parking</span>'
    + '<span><span class="swatch" style="background:' + MAP_GROUP_COLORS.social + '"></span>Social &amp; Faith</span>'
    + '</div>';
}

// Called on every nav click; returns immediately for universities already built, and for
// those the registry gives no mapCenter (i.e. no map yet — that's a data state, not an error).
function initUniversityMap(id) {
  if (universityMaps[id]) { return; }
  var host = document.querySelector('[data-map="' + id + '"]');
  if (!host) { return; } // a page with no map section at all (NYC overview)

  universityRegistry
    .then(function (list) {
      var entry = list.filter(function (u) { return u.id === id; })[0];
      if (!entry || !entry.mapCenter) { return; }
      buildUniversityMap(id, entry.mapCenter);
    })
    .catch(function () {
      host.innerHTML = '<p class="cap-label">Campus Map</p><p class="placeholder">The map '
        + 'couldn\'t be loaded. If this keeps happening, check that '
        + 'data/universities/index.json is valid and lists a mapCenter for this campus.</p>';
    });
}

function buildUniversityMap(id, center) {
  if (universityMaps[id]) { return; }

  var host = document.querySelector('[data-map="' + id + '"]');
  host.innerHTML = mapSectionHtml(id);

  var map = L.map(id + '-map').setView(center, 16);
  var state = { map: map, markers: [] };
  universityMaps[id] = state;

  // CARTO Positron rather than OSM's standard tiles. The standard style draws every
  // footpath as a dashed salmon line and labels every shop — on a campus that's almost
  // entirely pedestrian paths, that reads as visual noise under our own markers.
  // Positron is a muted greyscale basemap, so the pins are the only thing competing for attention.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, '
      + '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  fetch('data/universities/' + id + '-map.json')
    .then(function (res) {
      if (!res.ok) { throw new Error('Map data request failed'); }
      return res.json();
    })
    .then(function (pins) {
      pins.forEach(function (pin) {
        var primaryCategory = pin.categories[0];
        var color = MAP_GROUP_COLORS[MAP_CATEGORY_GROUP[primaryCategory]] || '#5B564A';
        var categoryLabels = pin.categories.map(function (c) { return MAP_CATEGORY_LABELS[c] || c; }).join(', ');
        var openRules = parseHours(pin.hours);

        // Small dots: these maps carry hundreds of pins, and at the old radius 9 they merged
        // into blobs wherever the density is high (the Broadway restaurant strip especially).
        var marker = L.circleMarker([pin.lat, pin.lng], {
          radius: 5,
          color: '#FFFFFF',
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.95
        });

        // Built on open rather than bound once, so the open/closed line is right for when
        // you actually clicked the pin, not for when the page happened to load.
        var link = safeUrl(pin.contactUrl);
        marker.bindPopup(function () {
          var openStatus = isOpenNow(openRules, nycNow());
          var statusHtml = openStatus === null ? ''
            : openStatus
              ? '<br><strong style="color:#3F6B3E">Open now</strong>'
              : '<br><strong style="color:#9C4038">Closed now</strong>';
          return '<strong>' + escapeHtml(pin.name) + '</strong><br><em>'
            + escapeHtml(categoryLabels) + '</em>'
            + statusHtml
            + '<br>' + escapeHtml(pin.hours)
            + (pin.capacity ? '<br>Fits up to ' + escapeHtml(pin.capacity) : '')
            // Only the positive claim gets a badge. Every pin is unverified today, so an
            // "unverified" line on all 1,089 would be noise repeating what the note already says.
            + (pin.handVerified === true
              ? '<br><span class="pin-checked">Checked in person</span>' : '')
            + (link ? '<br><a href="' + escapeHtml(link) + '" target="_blank" rel="noopener">More info</a>' : '');
        });

        state.markers.push({
          marker: marker, categories: pin.categories, capacity: pin.capacity,
          openRules: openRules, handVerified: pin.handVerified === true
        });
      });

      describeHoursCoverage(id, state.markers);
      applyMapFilters(id);
    })
    .catch(function () {
      // Tear the map down before replacing the section — Leaflet has already built its panes
      // inside the container by now, and blowing them away underneath a live map instance
      // leaves it half-alive. Dropping the state entry also lets a later nav click retry.
      map.remove();
      delete universityMaps[id];
      host.innerHTML = '<p class="cap-label">Campus Map</p><p class="placeholder">The pins for '
        + 'this campus couldn\'t be loaded. Check that data/universities/' + id
        + '-map.json exists and is valid JSON.</p>';
    });

  ['-map-category', '-map-open-now', '-map-verified'].forEach(function (suffix) {
    document.getElementById(id + suffix)
      .addEventListener('change', function () { applyMapFilters(id); });
  });

  setTimeout(function () { map.invalidateSize(); }, 100);
}

// Counted from the loaded pins rather than written into the copy, because the number moves
// every time hours get backfilled and a hard-coded one goes stale silently.
function describeHoursCoverage(id, markers) {
  var note = document.getElementById(id + '-map-note');
  if (!markers.length) {
    note.textContent = 'No map pins for this campus yet — add them to data/universities/'
      + id + '-map.json.';
    return;
  }
  var readable = markers.filter(function (entry) { return entry.openRules; }).length;
  note.innerHTML +=
    ' &ldquo;Open now&rdquo; uses New York time and covers the ' + readable + ' of '
    + markers.length + ' pins here with posted hours we can read; the rest are hidden while '
    + 'it&rsquo;s on rather than guessed at. Call ahead for anything that matters.';
}

// TODO: bring the group-size filter back once capacity data exists. Kept rather than deleted
// because the logic below encodes a decision that was got wrong once already (see the comment
// on pinMatchesSize); what's missing is data, not code. 15 of 234 Columbia pins and 0 of 855
// NYU pins carry a capacity, and OpenStreetMap doesn't publish it, so filling that gap is
// per-venue manual work.
//
// Categories where "will my group fit?" is a real question. For a dorm, a subway stop or a
// restroom the answer is meaningless, so those pins ignore the size control entirely rather
// than being filtered out by a number that was never going to apply to them.
var SIZEABLE_CATEGORIES = ['group-food', 'dining', 'meet', 'sit-no-id'];

// Unknown capacity FAILS the filter once a size is set. The old rule was
// `!entry.capacity || entry.capacity >= size`, which exempted anything without a capacity —
// so raising the size hid the venues we had checked and kept every venue we hadn't. Most pins
// have no capacity (OpenStreetMap doesn't publish it), so "show it anyway" amounts to claiming
// a fit we can't back up.
function pinMatchesSize(entry, size) {
  if (size <= 1) { return true; }
  var sizeable = entry.categories.some(function (c) {
    return SIZEABLE_CATEGORIES.indexOf(c) !== -1;
  });
  if (!sizeable) { return true; }
  return entry.capacity >= size;
}

function applyMapFilters(id) {
  var state = universityMaps[id];
  var map = state.map;
  var category = document.getElementById(id + '-map-category').value;
  var openOnly = document.getElementById(id + '-map-open-now').checked;
  var verifiedOnly = document.getElementById(id + '-map-verified').checked;
  // One clock reading for the whole pass, so pins can't disagree about what time it is.
  var now = nycNow();
  var shown = 0;

  state.markers.forEach(function (entry) {
    var matchesCategory = category === 'all' || entry.categories.indexOf(category) !== -1;
    // Unknown hours fail when the filter is on: showing a pin we can't confirm is open is a
    // claim the data doesn't support.
    var matchesOpen = !openOnly || isOpenNow(entry.openRules, now) === true;
    // Cuts across every category on purpose — "has someone actually stood here?" is a different
    // question from what kind of place it is.
    var matchesVerified = !verifiedOnly || entry.handVerified;
    var shouldShow = matchesCategory && matchesOpen && matchesVerified;

    if (shouldShow) { shown += 1; }
    if (shouldShow && !map.hasLayer(entry.marker)) {
      entry.marker.addTo(map);
    } else if (!shouldShow && map.hasLayer(entry.marker)) {
      map.removeLayer(entry.marker);
    }
  });

  reportEmptyMap(id, shown, verifiedOnly, state.markers.length);
}

// An empty map reads as broken unless it says why it's empty. That matters most for the
// hand-checked filter, which legitimately hides everything until the verification pass has
// actually produced something.
function reportEmptyMap(id, shown, verifiedOnly, total) {
  var note = document.getElementById(id + '-map-empty');
  if (shown > 0) {
    note.hidden = true;
    return;
  }
  var verifiedCount = universityMaps[id].markers.filter(function (e) {
    return e.handVerified;
  }).length;
  note.textContent = verifiedOnly && verifiedCount === 0
    ? 'Nothing here has been checked in person yet, so this filter hides all ' + total
      + ' pins. Spots appear here as they get confirmed — the list being worked through is '
      + 'docs/recommended-to-verify.csv.'
    : 'No pins match these filters.';
  note.hidden = false;
}

document.querySelectorAll('[data-role="nav"]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var target = btn.getAttribute('data-target');

    document.querySelectorAll('[data-role="nav"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-target') === target));
    });

    document.querySelectorAll('.page-section').forEach(function (section) {
      section.hidden = section.getAttribute('data-section') !== target;
    });

    initUniversityMap(target);
  });
});
