// Opening-hours parsing for map pins.
//
// Handles the subset of OpenStreetMap's opening_hours syntax the pin data actually carries:
// "Mo-Fr 12:00-21:00; Sa,Su 11:00-23:00", several ranges in one rule ("Mo-Su 12:00-14:00,
// 17:00-22:00"), ends past midnight ("Fr 12:00-02:00"), and 24/7. Everything else — the
// hand-written prose hours ("Hours vary by semester — check library.columbia.edu") and the
// 95 pins with no hours at all — parses to null, which the UI shows as unknown rather than
// guessing. A full opening_hours implementation (holidays, seasons, sunset-relative times,
// "off" rules) is a library-sized problem the data doesn't need.

var DAY_INDEX = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
var ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

var DAY_TOKEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)';
var DAY_RANGE = DAY_TOKEN + '(?:\\s*-\\s*' + DAY_TOKEN + ')?';
var TIME_RANGE = '\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}';
var RULE_RE = new RegExp(
  '((?:' + DAY_RANGE + '\\s*,\\s*)*' + DAY_RANGE + ')?\\s*'
    + '(' + TIME_RANGE + '(?:\\s*,\\s*' + TIME_RANGE + ')*)',
  'g'
);

function parseDays(spec) {
  var days = [];
  spec.split(',').forEach(function (token) {
    var ends = token.trim().split('-');
    var from = DAY_INDEX[ends[0].trim()];
    if (from === undefined) { return; } // PH — public holidays aren't modelled
    var to = ends.length > 1 ? DAY_INDEX[ends[1].trim()] : from;
    for (var d = from; ; d = (d + 1) % 7) {
      if (days.indexOf(d) === -1) { days.push(d); }
      if (d === to) { break; }
    }
  });
  return days;
}

function toMinutes(hhmm) {
  var parts = hhmm.trim().split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Returns [{ days, start, end }] in minutes-from-midnight, or null if the string isn't
// machine-readable. Anything left over after matching rules (prose, "open Cafe || open Bar")
// makes the whole string unparsable — a partial read of "9am–4pm, Dinner 4–10:30pm" would
// claim hours we didn't actually understand.
function parseHours(text) {
  if (!text) { return null; }
  if (/\b24\/7\b/.test(text) || /open 24 hours/i.test(text)) {
    return [{ days: ALL_DAYS, start: 0, end: 1440 }];
  }

  var rules = [];
  var leftover = text;
  var match;
  RULE_RE.lastIndex = 0;
  while ((match = RULE_RE.exec(text)) !== null) {
    leftover = leftover.replace(match[0], '');
    var days = match[1] ? parseDays(match[1]) : ALL_DAYS;
    match[2].split(',').forEach(function (range) {
      var ends = range.split('-');
      rules.push({ days: days, start: toMinutes(ends[0]), end: toMinutes(ends[1]) });
    });
  }

  if (!rules.length) { return null; }
  if (!/^[\s;,.]*$/.test(leftover)) { return null; }
  return rules;
}

// true / false / null (unknown). `now` must already be in the venue's local time.
function isOpenNow(rules, now) {
  if (!rules) { return null; }
  var day = now.getDay();
  var yesterday = (day + 6) % 7;
  var mins = now.getHours() * 60 + now.getMinutes();

  return rules.some(function (rule) {
    if (rule.end > rule.start) {
      return rule.days.indexOf(day) !== -1 && mins >= rule.start && mins < rule.end;
    }
    // Ends at or before it starts = runs past midnight, so yesterday's rule can still be open.
    return (rule.days.indexOf(day) !== -1 && mins >= rule.start)
      || (rule.days.indexOf(yesterday) !== -1 && mins < rule.end);
  });
}

function nycNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

if (typeof module !== 'undefined') {
  module.exports = { parseHours: parseHours, isOpenNow: isOpenNow };
}
