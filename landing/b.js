/**
 * A shared listing.
 *
 * Somebody tapped Share in the app and sent this link to a person who may
 * never have heard of Nearby. So it shows the business first and the app
 * second: a page that opened with "install our app" and nothing else would be
 * a link nobody sends twice.
 *
 * One PostgREST read with the publishable key. Row level security decides
 * what an anonymous reader gets, which is live listings and nothing else — a
 * listing still waiting for review, or one that was taken down, simply is not
 * found, which is the honest answer either way.
 */
(function () {
  var config = window.NEARBY_CONFIG || {};
  var root = document.getElementById('listing');

  var slug = decodeURIComponent(window.location.pathname.replace(/^\/b\/?/, '')).trim();

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function say(message) {
    root.innerHTML = '<p class="listing-status">' + escapeHtml(message) + '</p>';
  }

  if (!slug) {
    say('That link is missing the listing.');
    return;
  }
  if (!config.supabaseUrl || !config.supabaseKey) {
    say('We could not load this listing just now.');
    return;
  }

  var columns = [
    'slug', 'name', 'category', 'tagline', 'description', 'address',
    'neighbourhood', 'phone', 'website', 'photos', 'rating', 'review_count',
    'price_from', 'price_to', 'verified',
  ].join(',');

  var url =
    config.supabaseUrl.replace(/\/$/, '') +
    '/rest/v1/businesses?select=' + columns +
    '&slug=eq.' + encodeURIComponent(slug) + '&limit=1';

  fetch(url, {
    headers: {
      apikey: config.supabaseKey,
      Authorization: 'Bearer ' + config.supabaseKey,
      Accept: 'application/json',
    },
  })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (rows) {
      var business = rows && rows[0];
      if (!business) {
        say('We could not find that listing. It may have been taken down.');
        return;
      }
      render(business);
    })
    .catch(function (error) {
      console.warn('[listing] could not load', error);
      say('We could not load this listing just now. Try again in a moment.');
    });

  var CATEGORY_LABELS = {
    restaurant: 'Restaurant', cafe: 'Cafe', beauty: 'Beauty', shopping: 'Shopping',
    auto: 'Auto', health: 'Health', fitness: 'Fitness', hotel: 'Hotel',
    services: 'Services', nightlife: 'Nightlife',
  };

  function fact(label, value, href) {
    if (!value) return '';
    var body = href
      ? '<a href="' + escapeHtml(href) + '" rel="nofollow noopener">' + escapeHtml(value) + '</a>'
      : escapeHtml(value);
    return '<div class="listing-fact"><dt>' + escapeHtml(label) + '</dt><dd>' + body + '</dd></div>';
  }

  function render(b) {
    document.title = b.name + ' · Nearby';

    var photos = Array.isArray(b.photos) ? b.photos : [];
    var where = [b.address, b.neighbourhood].filter(Boolean).join(', ');
    var rating = Number(b.rating);
    var spend = b.price_to > 0 ? 'KSh ' + b.price_from + ' to ' + b.price_to : '';

    var badges = '';
    if (CATEGORY_LABELS[b.category]) {
      badges += '<span class="listing-badge">' + escapeHtml(CATEGORY_LABELS[b.category]) + '</span>';
    }
    if (b.review_count > 0 && isFinite(rating)) {
      badges +=
        '<span class="listing-badge listing-badge--quiet">' +
        rating.toFixed(1) + ' from ' + b.review_count +
        (b.review_count === 1 ? ' review' : ' reviews') +
        '</span>';
    }
    if (b.verified) {
      badges += '<span class="listing-badge listing-badge--quiet">Verified</span>';
    }

    root.innerHTML =
      (photos[0]
        ? '<img class="listing-hero" src="' + escapeHtml(photos[0]) + '" alt="" />'
        : '') +
      '<h1 class="listing-name">' + escapeHtml(b.name) + '</h1>' +
      (b.tagline ? '<p class="listing-tagline">' + escapeHtml(b.tagline) + '</p>' : '') +
      (badges ? '<div class="listing-badges">' + badges + '</div>' : '') +
      (b.description ? '<p class="listing-about">' + escapeHtml(b.description) + '</p>' : '') +
      '<dl class="listing-facts">' +
        fact('Where', where) +
        fact('Phone', b.phone, b.phone ? 'tel:' + b.phone : null) +
        fact('Website', b.website, b.website) +
        fact('Typical spend', spend) +
      '</dl>' +
      (photos.length > 1
        ? '<div class="listing-photos">' +
            photos.slice(1).map(function (src) {
              return '<img src="' + escapeHtml(src) + '" alt="" loading="lazy" />';
            }).join('') +
          '</div>'
        : '') +
      '<div class="listing-cta">' +
        '<h2>Opening hours, directions and reviews</h2>' +
        '<p>All of it is in the app, along with everything else around you.</p>' +
        '<a class="btn btn--accent" href="/#download">Get Nearby free</a>' +
      '</div>';
  }
})();
