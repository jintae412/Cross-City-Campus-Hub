// node scripts/test-hours.js — self-check for the opening-hours parser.
// Strings below are copied verbatim out of data/universities/columbia-map.json.
var assert = require('assert');
var h = require('../hours.js');

function at(day, hhmm) { // day: 0=Sun. A known Sunday, so getDay() lines up.
  return new Date(2026, 6, 26 + day, parseInt(hhmm.split(':')[0], 10), parseInt(hhmm.split(':')[1], 10));
}
function open(hours, day, hhmm) { return h.isOpenNow(h.parseHours(hours), at(day, hhmm)); }

// Plain weekday ranges
assert.strictEqual(open('Mo-Fr 12:00-21:00; Sa-Su 11:00-21:00', 1, '13:00'), true);
assert.strictEqual(open('Mo-Fr 12:00-21:00; Sa-Su 11:00-21:00', 1, '11:30'), false);
assert.strictEqual(open('Mo-Fr 12:00-21:00; Sa-Su 11:00-21:00', 0, '11:30'), true);

// Past midnight — Friday's 02:00 close keeps it open early Saturday, but not early Friday.
assert.strictEqual(open('Mo-Th 12:00-24:00; Fr 12:00-02:00; Sa 10:30-02:00', 6, '01:00'), true);
assert.strictEqual(open('Mo-Th 12:00-24:00; Fr 12:00-02:00; Sa 10:30-02:00', 5, '01:00'), false);

// Comma as a rule separator, and a split-shift day
assert.strictEqual(open('Mo,Tu 11:00-22:00, We-Su 11:00-24:00', 3, '23:00'), true);
assert.strictEqual(open('Mo,Tu 11:00-22:00, We-Su 11:00-24:00', 2, '23:00'), false);
assert.strictEqual(open('Mo-Su 12:00-14:00, 17:00-22:00', 1, '15:00'), false);
assert.strictEqual(open('Mo-Su 12:00-14:00, 17:00-22:00', 1, '18:00'), true);

// Week-wrapping day range, PH ignored rather than fatal
assert.strictEqual(open('Su-We 10:00-24:00, Th-Sa 10:00-02:00', 0, '23:00'), true);
assert.strictEqual(open('Mo-Su,PH 11:00-21:00', 4, '12:00'), true);

// 24/7, spelled both ways
assert.strictEqual(open('Subway service runs 24/7', 2, '03:00'), true);
assert.strictEqual(open('Commercial garage, open 24 hours', 2, '03:00'), true);

// Unknown stays unknown — never guessed from partial matches
assert.strictEqual(h.parseHours('Hours not listed — check before you go'), null);
assert.strictEqual(h.parseHours('Hours vary by semester — check library.columbia.edu'), null);
assert.strictEqual(h.parseHours('Mon–Fri 7:30am–8pm, Sat 9am–8pm'), null);
assert.strictEqual(h.parseHours('08:00-22:00 open "Cafe" || 16:00-04:00 open "Bar"'), null);
assert.strictEqual(h.isOpenNow(null, at(1, '12:00')), null);

console.log('hours.js: all assertions passed');
