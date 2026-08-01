// Renders a filtered vehicle grid for the local SEO landing pages.
// Usage: <div class="cars-grid seo-listing" data-body="suv" data-fuel="" data-condition=""></div>
(function () {
  function statusBadge(status) {
    var map = {
      in_stock: '<span class="badge badge-new">In Stock</span>',
      coming_soon: '<span class="badge badge-coming">Coming Soon</span>',
      sold: '<span class="badge badge-sold">Sold</span>'
    };
    return map[status] || '';
  }

  var CAR_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/><circle cx="7.5" cy="17" r="1" /><circle cx="16.5" cy="17" r="1" /></svg>';

  function buildCard(car) {
    var costs = RhuleData.estimateRunningCosts(car);
    var img = (car.images && car.images.length)
      ? '<img src="' + car.images[0] + '" alt="' + car.make + ' ' + car.model + '" loading="lazy">'
      : '<div class="car-card-img-placeholder"><div class="car-card-img-icon">' + CAR_SVG + '</div><div class="car-card-img-label">' + car.make + '</div></div>';
    var waMsg = encodeURIComponent('Hi, I am interested in the ' + car.year + ' ' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + ' priced at ' + RhuleData.formatPrice(car.price) + '. Can I get more details?');

    return '<div class="car-card reveal">' +
      '<a class="car-card-image" href="inventory.html?make=' + encodeURIComponent(car.make) + '" data-track="listing_view" data-track-label="' + car.make + ' ' + car.model + '">' + img +
      '<div class="car-card-badges">' + (car.condition === 'new' ? '<span class="badge badge-new">New</span>' : '<span class="badge badge-used">Pre-Owned</span>') + statusBadge(car.status) + '</div></a>' +
      '<div class="car-card-body">' +
      '<div class="car-card-year">' + car.year + '</div>' +
      '<div class="car-card-name">' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + '</div>' +
      '<div class="car-card-specs">' +
      '<span class="spec-pill">' + car.body_type + '</span>' +
      '<span class="spec-pill">' + car.fuel + '</span>' +
      '<span class="spec-pill">' + car.transmission + '</span>' +
      (car.mileage > 0 ? '<span class="spec-pill">' + car.mileage.toLocaleString() + ' km</span>' : '') +
      '</div>' +
      '<div class="car-card-footer">' +
      '<div><div class="car-card-price">' + RhuleData.formatPrice(car.price) + '</div>' +
      '<div class="car-card-cost">~<span>' + RhuleData.formatPrice(costs.total) + '/mo</span> running</div></div>' +
      '<a class="btn btn-primary btn-sm" href="inventory.html?make=' + encodeURIComponent(car.make) + '" data-track="listing_view" data-track-label="' + car.make + ' ' + car.model + '">View</a>' +
      '</div></div></div>';
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var el = document.querySelector('.seo-listing');
    if (!el) return;

    var countEl = document.getElementById('seoCount');
    var showSold = el.getAttribute('data-show-sold') === 'true';

    try {
      var res = await fetch('/api/vehicles');
      var vehicles = res.ok ? await res.json() : [];
      var bodies = (el.getAttribute('data-body') || '').split(',').map(function (b) { return b.trim(); }).filter(Boolean);
      var fuel = (el.getAttribute('data-fuel') || '').trim();
      var cond = (el.getAttribute('data-condition') || '').trim();
      var list = vehicles.filter(function (c) {
        if (!showSold && c.status === 'sold') return false;
        if (bodies.length && bodies.indexOf(c.body_type) === -1) return false;
        if (fuel && c.fuel !== fuel) return false;
        if (cond && c.condition !== cond) return false;
        return true;
      });

      if (countEl) countEl.textContent = list.length;

      if (!list.length) {
        el.innerHTML = '<div class="no-results" style="grid-column:1/-1;"><div class="no-results-icon">!</div><h3>No vehicles right now</h3><p>Our inventory changes often. Check the full inventory or ask Rhule AI for the latest arrivals.</p><div class="no-results-actions"><a class="btn btn-primary btn-sm" href="inventory.html">Browse Full Inventory</a><button class="btn btn-outline btn-sm" onclick="document.querySelector(\'.chat-toggle\').click()">Ask Rhule AI</button></div></div>';
        return;
      }
      el.innerHTML = list.map(buildCard).join('');
    } catch (e) {
      el.innerHTML = '<div class="no-results" style="grid-column:1/-1;"><div class="no-results-icon">!</div><h3>Could not load vehicles</h3><p>Please try again or contact us directly.</p><div class="no-results-actions"><a class="btn btn-primary btn-sm" href="inventory.html">Browse Full Inventory</a><a class="btn btn-outline btn-sm" href="https://wa.me/233538861301">WhatsApp Us</a></div></div>';
    }
  });
})();
