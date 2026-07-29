// node scripts/test-orgs.js — self-check for the Christian groups list and the "Starting a New
// Club" card.
//
// Same stubbing trick as test-majors.js: app.js is browser code that starts fetching on load, so
// requiring it in node needs a dead document and fetch. Only the pure string builders are exercised.
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

// A group we only have a name and a blurb for must not print empty contact rows, and must not
// leak the word "undefined" into any of the hrefs we would have built from missing fields.
var bare = app.orgHtml({ name: 'Some Fellowship', blurb: 'Meets weekly.' });
assert.ok(bare.indexOf('<ul') === -1, 'no contacts should mean no contact list');
assert.ok(bare.indexOf('undefined') === -1);
assert.ok(bare.indexOf('Some Fellowship') !== -1);

// Every contact type renders, and the handle-to-URL conversion drops the leading @.
var full = app.orgHtml({
  name: 'Columbia Catholic Ministry',
  blurb: 'A close-knit fellowship.',
  email: 'catholics@columbia.edu',
  site: 'https://columbia-catholic.org/',
  instagram: '@columbiacatholics',
  phone: '+1 212 555 0100',
  where: '405 W 114th St',
  verified: true,
  source: 'https://www.cc-seas.columbia.edu/student-group/columbia-catholic-ministry'
});
assert.ok(full.indexOf('href="mailto:catholics@columbia.edu"') !== -1, 'email must be a mailto link');
assert.ok(full.indexOf('instagram.com/columbiacatholics') !== -1, 'the @ must be stripped from the URL');
assert.ok(full.indexOf('instagram.com/@') === -1);
assert.ok(full.indexOf('href="tel:+12125550100"') !== -1, 'phone spacing must be stripped from tel:');
assert.ok(full.indexOf('405 W 114th St') !== -1, 'a location has no link but still shows');
assert.ok(full.indexOf('unconfirmed') === -1, 'a verified group carries no flag');

// The flag is the whole point of the field: an unchecked email address sends someone's
// introduction nowhere and they never find out.
var unchecked = app.orgHtml({ name: 'X', blurb: 'Y', email: 'z@example.com', verified: false });
assert.ok(unchecked.indexOf('unconfirmed') !== -1, 'verified:false must show the flag');

// Group names and blurbs are hand-authored, but they are still going into innerHTML.
var nasty = app.orgHtml({ name: '<img src=x onerror=alert(1)>', blurb: '<script>bad()</script>' });
assert.ok(nasty.indexOf('<img') === -1 && nasty.indexOf('<script') === -1, 'org fields must be escaped');
assert.ok(nasty.indexOf('&lt;img') !== -1);

// A javascript: URL in any link field must be dropped rather than rendered as clickable.
var evil = app.orgHtml({ name: 'X', blurb: 'Y', site: 'javascript:alert(1)' });
assert.ok(evil.indexOf('javascript:') === -1, 'unsafe scheme must not survive into an href');
assert.ok(app.safeUrl('mailto:a@b.com') === 'mailto:a@b.com', 'mailto is allowed');
assert.ok(app.safeUrl('javascript:alert(1)') === null);

// The card is optional — a campus JSON without the section renders nothing rather than throwing.
assert.strictEqual(app.startingHtml(undefined), '');

var rso = app.startingHtml({
  intro: 'Apply once a year.',
  requirements: ['At least 10 members.', 'A constitution.'],
  links: [{ label: 'SGB', url: 'https://sgb.studentgroups.columbia.edu/' }],
  note: 'Confirm the current window.'
});
assert.ok(rso.indexOf('At least 10 members.') !== -1);
assert.ok(rso.indexOf('<li>A constitution.</li>') !== -1);
assert.ok(rso.indexOf('sgb.studentgroups.columbia.edu') !== -1);

// And the real data files: the sections are optional, but an entry that exists must carry the
// things this page promises the reader — a blurb, and a source to check it against.
['columbia', 'nyu'].forEach(function (id) {
  var uni = JSON.parse(fs.readFileSync('data/universities/' + id + '.json', 'utf8'));

  (uni.christianOrgs || []).forEach(function (o) {
    assert.ok(o.name && o.blurb, id + ': an org is missing its name or blurb');
    assert.ok(o.source, id + ': ' + o.name + ' has no source');
    assert.ok(typeof o.verified === 'boolean', id + ': ' + o.name + ' must say whether it was checked');
    // An unverified entry is fine. An unverified entry nobody can tell is unverified is not.
    if (o.verified === false) {
      assert.ok(app.orgHtml(o).indexOf('unconfirmed') !== -1, id + ': ' + o.name + ' flag missing');
    }
  });

  if (uni.christianOrgs) {
    assert.ok(uni.christianOrgsNote, id + ': a group list needs a note saying how far it was checked');
  }

  if (uni.startingAnRso) {
    assert.ok(uni.startingAnRso.intro, id + ': startingAnRso needs an intro');
    assert.ok(uni.startingAnRso.requirements.length, id + ': startingAnRso needs requirements');
  }
});

console.log('All checks passed.');
