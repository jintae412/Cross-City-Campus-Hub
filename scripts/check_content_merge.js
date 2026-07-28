// Checks that AI-drafted entries render, render badged, and don't render twice.
// Run:  node scripts/check_content_merge.js
//
// app.js is a plain browser script, not a module, so it's evaluated here against stub globals.
// fetch never settles on purpose: nothing but renderUniversity is under test, and a resolving
// stub would drag the weather, events and map code paths in with it.
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var stubEl = { innerHTML: '', textContent: '', hidden: false, setAttribute: function () {},
  getAttribute: function () { return null; }, addEventListener: function () {},
  appendChild: function () {}, querySelector: function () { return null; },
  classList: { toggle: function () {} } };

var sandbox = {
  fetch: function () { return new Promise(function () {}); },
  document: {
    getElementById: function () { return stubEl; },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    createElement: function () { return stubEl; }
  },
  Promise: Promise, Date: Date, Math: Math, Number: Number, String: String, Object: Object,
  setTimeout: setTimeout, console: console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../app.js', 'utf8'), sandbox);

var uni = {
  culture: 'c', majors: [{ label: 'M', pct: 1 }], majorsNote: 'n',
  demographics: { undergrad: 1, graduate: 2, womenPct: 3, internationalPct: 4, source: 's' },
  traditions: ['Orgo Night'],
  calendar: [{ date: '2026-12-01', label: 'Live Date', verified: true }]
};
var suggestions = {
  traditions: [
    { text: 'Bacchanal', source: 'https://example.edu/t', reviewed: false },
    { text: 'Orgo Night', source: 'https://example.edu/t', reviewed: false }  // already live
  ],
  calendar: [
    { date: '2026-09-02', label: 'AI Date', verified: true, source: 'https://example.edu/c', reviewed: false },
    { date: '2026-12-01', label: 'Live Date', verified: true, source: 'https://example.edu/c', reviewed: true },
    { date: null, label: 'Undated', verified: false, source: 'https://example.edu/c', reviewed: false }
  ]
};

var box = { innerHTML: '' };
sandbox.renderUniversity(box, uni, suggestions);
var html = box.innerHTML;

var badges = html.split('ai-unchecked').length - 1;
assert.strictEqual(badges, 3, 'expected 3 badges (2 calendar + 1 tradition), got ' + badges);
assert.strictEqual(html.split('Live Date').length - 1, 1, 'reviewed entry rendered twice');
assert.strictEqual(html.split('Orgo Night').length - 1, 1, 'duplicate tradition rendered twice');
assert.ok(html.indexOf('AI Date') < html.indexOf('Live Date'), 'calendar not sorted by date');
assert.ok(html.indexOf('Undated') > html.indexOf('Live Date'), 'undated entry not sorted last');
assert.ok(html.indexOf('Source: https://example.edu/c') !== -1, 'source missing from tooltip');

// A campus with no holding file at all must still render.
var plain = { innerHTML: '' };
sandbox.renderUniversity(plain, uni, null);
assert.strictEqual(plain.innerHTML.indexOf('ai-unchecked'), -1);
assert.ok(plain.innerHTML.indexOf('Live Date') !== -1);

// Holding-file text is not ours — it must not reach innerHTML as markup.
var xss = { innerHTML: '' };
sandbox.renderUniversity(xss, uni, {
  calendar: [{ date: '2026-09-02', label: '<img src=x onerror=alert(1)>', verified: true,
    source: '" onmouseover=alert(1) x="', reviewed: false }]
});
assert.strictEqual(xss.innerHTML.indexOf('<img'), -1, 'label injected raw HTML');
// The word itself survives escaped and inert; what must not appear is a raw quote closing the
// title attribute ahead of it.
assert.strictEqual(xss.innerHTML.indexOf('" onmouseover'), -1, 'source broke out of the title attr');

console.log('OK');
