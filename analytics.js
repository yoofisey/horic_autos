// GA4 + conversion tracking for Dealership Name.
// Paste your GA4 Measurement ID below (format G-XXXXXXXXXX). Until you do,
// tracking is disabled and the site behaves normally (no network calls).
window.GA4_ID = '';

window.RhuleAnalytics = (function () {
  var ID = window.GA4_ID || '';
  var enabled = ID.length > 4 && ID.indexOf('XXXXXXXX') === -1;

  function gtag() { window.dataLayer.push(arguments); }

  var api = {
    enabled: enabled,
    track: function (category, action, label) {
      if (!enabled) return;
      try { gtag('event', action, { event_category: category, event_label: label || undefined }); } catch (e) {}
    }
  };

  if (enabled) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', ID);
  }

  // Auto-track clicks on any element carrying data-track attributes.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el) return;
    api.track('engagement', el.getAttribute('data-track'), el.getAttribute('data-track-label') || '');
  });

  return api;
})();
