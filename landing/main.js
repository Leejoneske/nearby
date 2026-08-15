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
   * APK download.
   *
   * The button ships pointing at GitHub's stable "latest release" URL, so it
   * works with JavaScript off. When it runs, this asks the GitHub API which
   * release is actually current and rewrites the button with the exact asset,
   * its version and its size — and, more importantly, says so plainly when no
   * APK has been published rather than sending someone to a 404.
   */
  var REPO = 'Leejoneske/nearby';

  function formatBytes(bytes) {
    if (!bytes) return '';
    var mb = bytes / (1024 * 1024);
    return mb >= 10 ? Math.round(mb) + ' MB' : mb.toFixed(1) + ' MB';
  }

  function setUnavailable(meta, button, label) {
    if (meta) {
      meta.textContent =
        'No Android build published yet. Follow the repository to hear when the first one lands.';
    }
    if (button) {
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-disabled');
      button.href = 'https://github.com/' + REPO + '/releases';
    }
    if (label) label.textContent = 'Android build coming soon';
  }

  var apkButton = document.getElementById('apk-download');
  var apkMeta = document.getElementById('apk-meta');
  var apkLabel = document.getElementById('apk-label');

  if (apkButton && window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (res) {
        // 404 is the honest answer when a repo has no releases yet.
        if (!res.ok) throw new Error('no release (' + res.status + ')');
        return res.json();
      })
      .then(function (release) {
        var assets = release.assets || [];
        var apk = null;
        for (var i = 0; i < assets.length; i += 1) {
          if (/\.apk$/i.test(assets[i].name)) {
            apk = assets[i];
            break;
          }
        }
        if (!apk) throw new Error('release has no apk asset');

        apkButton.href = apk.browser_download_url;
        if (apkLabel) apkLabel.textContent = 'Download for Android';

        var parts = [];
        if (release.tag_name) parts.push(release.tag_name);
        var size = formatBytes(apk.size);
        if (size) parts.push(size);
        if (release.published_at) {
          parts.push(
            new Date(release.published_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
          );
        }
        if (apkMeta) apkMeta.textContent = parts.join(' · ');
      })
      .catch(function () {
        setUnavailable(apkMeta, apkButton, apkLabel);
      });
  } else if (apkButton) {
    // No fetch: leave the stable URL alone and say nothing misleading.
    if (apkMeta) apkMeta.textContent = 'Latest Android build';
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
