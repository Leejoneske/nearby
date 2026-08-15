/* Landing page behaviour. No framework, no build step — open index.html. */

(function () {
  'use strict';

  /* The nav grows a hairline border once the page has scrolled under it. */
  var nav = document.getElementById('nav');
  if (nav) {
    var setStuck = function () {
      nav.dataset.stuck = window.scrollY > 8 ? 'true' : 'false';
    };
    setStuck();
    window.addEventListener('scroll', setStuck, { passive: true });
  }

  /*
   * Accordion. One panel open at a time, and the phone beside it swaps to the
   * screenshot named on the open item — so the picture always matches the step
   * being read.
   */
  var accordion = document.getElementById('accordion');
  var shot = document.getElementById('accordion-shot');
  if (!accordion) return;

  var items = Array.prototype.slice.call(
    accordion.querySelectorAll('.accordion__item'),
  );

  function open(item) {
    items.forEach(function (other) {
      var isTarget = other === item;
      other.dataset.open = isTarget ? 'true' : 'false';
      var trigger = other.querySelector('.accordion__trigger');
      if (trigger) trigger.setAttribute('aria-expanded', String(isTarget));
    });

    var next = item.dataset.shot;
    if (shot && next && shot.getAttribute('src') !== next) {
      shot.setAttribute('src', next);
      var label = item.querySelector('.accordion__trigger');
      shot.setAttribute('alt', label ? label.textContent.trim() : 'Nearby screen');
    }
  }

  items.forEach(function (item) {
    var trigger = item.querySelector('.accordion__trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function () {
      // Clicking the open item leaves it open: this is a stepper, and an empty
      // panel next to a phone screenshot reads as a bug.
      open(item);
    });
  });
})();
