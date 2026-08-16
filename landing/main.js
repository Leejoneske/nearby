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
   * The button ships pointing at the stable "latest release" URL, so it works
   * with JavaScript off. When it runs, this resolves the current release and
   * rewrites the button with the exact file and its size — and, more
   * importantly, says plainly that it is not ready when there is nothing to
   * download, rather than sending someone to a 404.
   */
  var REPO = 'Leejoneske/nearby';

  function formatBytes(bytes) {
    if (!bytes) return '';
    var mb = bytes / (1024 * 1024);
    return mb >= 10 ? Math.round(mb) + ' MB' : mb.toFixed(1) + ' MB';
  }

  // Nothing here names a tool, a repository or a file format: the visitor is
  // told whether they can install the app, and nothing about how it is made.
  // See DEVELOPER.md, "What visitors are allowed to read".
  function setUnavailable(meta, button, label) {
    if (meta) meta.textContent = 'Not quite ready. Check back shortly.';
    if (button) {
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-disabled');
      button.removeAttribute('href');
    }
    if (label) label.textContent = 'Coming soon for Android';
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
        var fallback = null;

        // Prefer the smaller per-architecture file; the larger one that runs
        // anywhere is the backup if that is all a release carries.
        for (var i = 0; i < assets.length; i += 1) {
          var asset = assets[i];
          if (!/\.apk$/i.test(asset.name)) continue;
          if (/universal/i.test(asset.name)) {
            fallback = asset;
          } else if (!apk) {
            apk = asset;
          }
        }
        if (!apk) apk = fallback;
        if (!apk) throw new Error('release has no installable file');

        apkButton.href = apk.browser_download_url;
        if (apkLabel) apkLabel.textContent = 'Download for Android';

        // Size and date only. The version string is a build label, not
        // something a visitor has any use for.
        var parts = [];
        var size = formatBytes(apk.size);
        if (size) parts.push(size);
        if (release.published_at) {
          parts.push(
            'Updated ' +
              new Date(release.published_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
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
    if (apkMeta) apkMeta.textContent = '\u00a0';
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
