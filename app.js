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
