/* Page Manager visitor analytics. No secrets are embedded in this public script. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || navigator.doNotTrack === '1' || /^\/(admin|api)(\/|$)/.test(location.pathname)) return;
  var site = script.getAttribute('data-site-id');
  if (!site || !/^[a-z][a-z0-9_-]{1,39}$/.test(site)) return;
  window.__pmTrackers = window.__pmTrackers || {};
  if (window.__pmTrackers[site]) return;
  window.__pmTrackers[site] = true;
  var endpoint = new URL('/api/public/track?site_id=' + encodeURIComponent(site), script.src).href;
  var prefix = '_pm_' + site + '_', memory = {}, current, thresholds = [25, 50, 75, 90];
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var n = Math.random() * 16 | 0; return (c === 'x' ? n : (n & 3 | 8)).toString(16); }); }
  function get(kind, key) { try { return window[kind].getItem(prefix + key) || memory[key]; } catch (_) { return memory[key]; } }
  function set(kind, key, value) { memory[key] = value; try { window[kind].setItem(prefix + key, value); } catch (_) {} }
  var visitor = get('localStorage', 'visitor') || uuid(); set('localStorage', 'visitor', visitor);
  function clean(value) { try { var u = new URL(value); return /^https?:$/.test(u.protocol) ? u.origin + u.pathname : ''; } catch (_) { return ''; } }
  function session() {
    var now = Date.now(), value;
    try { value = JSON.parse(get('sessionStorage', 'session') || 'null'); } catch (_) {}
    if (!value || now - value.last > 1800000) {
      var query = new URLSearchParams(location.search), utm = {};
      ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) { utm[k] = query.get('utm_' + k) || ''; });
      value = { id: uuid(), landing: clean(location.href), referrer: clean(document.referrer), utm: utm };
    }
    value.last = now; set('sessionStorage', 'session', JSON.stringify(value)); return value;
  }
  function send(kind, extra) {
    if (!current) return;
    var body = Object.assign({ kind: kind, hitId: uuid(), visitorId: visitor, sessionId: current.session.id, pageViewId: current.id, pageUrl: current.url, title: current.title, landingPage: current.session.landing, referrer: current.session.referrer, utm: current.session.utm, automation: navigator.webdriver === true }, extra || {});
    var data = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([data], { type: 'application/json' }))) return; } catch (_) {}
    try { fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true, credentials: 'omit' }).catch(function () {}); } catch (_) {}
  }
  function checkpoint() {
    if (!current) return;
    if (current.visibleSince) { current.elapsed += Date.now() - current.visibleSince; current.visibleSince = document.visibilityState === 'hidden' ? 0 : Date.now(); }
    send('end', { duration: Math.round(current.elapsed / 1000) });
  }
  function start() {
    if (/^\/(admin|api)(\/|$)/.test(location.pathname)) { current = null; return; }
    current = { id: uuid(), session: session(), url: clean(location.href), title: document.title, elapsed: 0, visibleSince: document.visibilityState === 'hidden' ? 0 : Date.now(), scroll: {} };
    send('pageview');
  }
  function ensure() { var s = session(); if (!current || s.id !== current.session.id) { checkpoint(); start(); } }
  function trackEvent(name, category, value) { ensure(); if (name) send('event', { eventName: String(name), eventCategory: String(category || 'click'), eventValue: value == null ? '' : String(value) }); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') checkpoint(); else { ensure(); if (current) current.visibleSince = Date.now(); } });
  window.addEventListener('pagehide', function () { checkpoint(); if (current) current.visibleSince = 0; });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { ensure(); if (current) current.visibleSince = Date.now(); } });
  window.setInterval(function () { if (document.visibilityState !== 'hidden') { ensure(); checkpoint(); } }, 30000);
  document.addEventListener('click', function (e) { var el = e.target && e.target.closest && e.target.closest('[data-track-event]'); if (el) trackEvent(el.getAttribute('data-track-event'), el.getAttribute('data-track-category'), el.getAttribute('data-track-value')); });
  var scrollPending = false;
  window.addEventListener('scroll', function () { if (scrollPending) return; scrollPending = true; window.setTimeout(function () { scrollPending = false; ensure(); if (!current) return; var size = document.documentElement.scrollHeight - innerHeight; if (size <= 0) return; var depth = Math.min(100, Math.round(scrollY / size * 100)); thresholds.forEach(function (t) { if (depth >= t && !current.scroll[t]) { current.scroll[t] = true; trackEvent('스크롤 ' + t + '%', 'scroll', t); } }); }, 200); }, { passive: true });
  function changed() { if (!current || clean(location.href) !== current.url) { checkpoint(); start(); } }
  ['pushState', 'replaceState'].forEach(function (method) { var original = history[method]; history[method] = function () { var result = original.apply(this, arguments); changed(); return result; }; });
  window.addEventListener('popstate', changed);
  window.PageManagerTracker = { trackEvent: trackEvent };
  window.GUTracker = window.PageManagerTracker;
  start();
})();
