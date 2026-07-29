// node scripts/test-majors.js — self-check for the Top Majors bars and their breakdown drawers.
//
// app.js is written for the browser and starts fetching the moment it loads, so requiring it here
// needs a stub document and fetch. They do nothing: this file only exercises majorHtml, which is
// pure string building.
var assert = require('assert');
var fs = require('fs');

var noop = function () {};
var stubEl = {
  innerHTML: '', hidden: false, title: '', type: '', className: '',
  addEventListener: noop, appendChild: noop, setAttribute: noop, getAttribute: function () { return ''; },
  querySelector: function () { return null; }, classList: { toggle: noop, add: noop }
};
global.document = {
  getElementById: function () { return stubEl; },
  querySelectorAll: function () { return []; },
  createElement: function () { return Object.create(stubEl); }
};
var neverResolves = { then: function () { return neverResolves; }, catch: function () { return neverResolves; } };
global.fetch = function () { return neverResolves; };

var app = require('../app.js');

// A category with no breakdown stays a plain bar — no empty drawer to click on.
var plain = app.majorHtml({ label: 'History', pct: 3.8 });
assert.ok(plain.indexOf('<details') === -1, 'no concentrations should mean no drawer');
assert.ok(plain.indexOf('History') !== -1);

var withConc = app.majorHtml({
  label: 'Social Sciences', pct: 26.9,
  concentrationsSource: 'IPEDS Completions 2022-23',
  concentrations: [
    { label: 'Econometrics and Quantitative Economics', pct: 46.5, degrees: 301 },
    { label: 'Political Science and Government, General', pct: 32.5, degrees: 210 }
  ]
});
assert.ok(withConc.indexOf('<details') !== -1, 'concentrations should produce a drawer');
assert.ok(withConc.indexOf('Econometrics and Quantitative Economics') !== -1);
assert.ok(withConc.indexOf('46.5%') !== -1);
assert.ok(withConc.indexOf('IPEDS Completions 2022-23') !== -1, 'the source must ride along');
// The parent bar is scaled 3x and the children 1x; a 46.5 child must not be drawn at 139%.
assert.ok(withConc.indexOf('width:139') === -1, 'child bars use their own 1:1 scale');

// Same escaping rule as everywhere else — these labels come out of a downloaded federal file.
var nasty = app.majorHtml({
  label: 'Evil', pct: 1,
  concentrations: [{ label: '<img src=x onerror=alert(1)>', pct: 100, degrees: 1 }]
});
assert.ok(nasty.indexOf('<img') === -1, 'concentration labels must be escaped');
assert.ok(nasty.indexOf('&lt;img') !== -1);

// A missing source shouldn't print the word "undefined" at the reader.
var noSource = app.majorHtml({
  label: 'Psychology', pct: 4.7,
  concentrations: [{ label: 'Research and Experimental Psychology, Other', pct: 100, degrees: 124 }]
});
assert.ok(noSource.indexOf('undefined') === -1);

// And the real data files: every breakdown should carry a source and add up to about 100%.
['columbia', 'nyu'].forEach(function (id) {
  var uni = JSON.parse(fs.readFileSync('data/universities/' + id + '.json', 'utf8'));
  uni.majors.forEach(function (m) {
    if (!m.concentrations) { return; }
    assert.ok(m.concentrationsSource, id + ': ' + m.label + ' has concentrations but no source');
    var sum = m.concentrations.reduce(function (t, c) { return t + c.pct; }, 0);
    assert.ok(Math.abs(sum - 100) < 0.5, id + ': ' + m.label + ' shares sum to ' + sum + ', not 100');
  });
});

console.log('All checks passed.');
