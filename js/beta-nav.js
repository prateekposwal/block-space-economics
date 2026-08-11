/* BSAHI beta-nav — site-wide login-state UI.
 * Renders a "✓ Beta · {name} · until {date} · Sign out" chip in every page
 * header for logged-in beta users, and swaps the hero "Join the free beta →"
 * CTA to "My beta →" (→ /beta-login.html). Visitors see nothing.
 *
 * Read-only UI consumer of the public beta roster — never redirects, never
 * calls BSAHIGate.guard(), never removes the key (except on explicit Sign out).
 * Degrades gracefully: roster outage → chip from key-presence + email prefix.
 *
 * Mirrors js/beta-gate.js verifyKeyStatic() so it works standalone on pages
 * that do NOT load the gate.
 */
(function (global) {
  'use strict';

  var KEY_NAME = 'bsahi_beta_key';
  var ROSTER_URL = '/data/beta-users.json';
  var CHIP_ID = 'bsahi-beta-chip';

  function getKey() {
    try { return global.localStorage.getItem(KEY_NAME); } catch (e) { return null; }
  }

  function removeKey() {
    try { global.localStorage.removeItem(KEY_NAME); } catch (e) {}
  }

  /* decodeKey(key) → { email, spot } | null */
  function decodeKey(key) {
    try {
      var decoded = atob(String(key || '').replace(/-/g, '+').replace(/_/g, '/'));
      var parts = decoded.split('|');
      if (parts.length !== 3 || parts[2] !== 'bsahi-beta') return null;
      return { email: parts[0], spot: parts[1] };
    } catch (e) { return null; }
  }

  /* verify(key) → Promise<{state:'ok',user} | {state:'outage'} | {state:'expired'} | {state:'invalid'}> */
  function verify(key) {
    var parsed = decodeKey(key);
    if (!parsed) return Promise.resolve({ state: 'invalid' });
    return fetch(ROSTER_URL).then(function (r) { return r.json(); }).then(function (roster) {
      var u = (roster.users || []).find(function (x) { return x.email === parsed.email; });
      if (!u) return { state: 'invalid' };
      if (!u.active) return { state: 'invalid' };
      if (u.expiry && new Date(u.expiry) < new Date()) return { state: 'expired', user: u, email: parsed.email };
      return { state: 'ok', user: u, email: parsed.email };
    }).catch(function () {
      // Roster unreachable — degrade to key-presence (fail open, like the gate).
      return { state: 'outage', email: parsed.email };
    });
  }

  function css(name, val) {
    return name + ':' + val + ';';
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    for (var k in attrs) { node.setAttribute(k, attrs[k]); }
    if (text) node.textContent = text;
    return node;
  }

  function mountChip(label, href, opts) {
    if (document.getElementById(CHIP_ID)) return;
    var chip = el('a', { id: CHIP_ID, href: href, style:
      'display:inline-flex;align-items:center;gap:6px;margin-left:12px;padding:6px 14px;' +
      'border-radius:999px;background:#161B22;border:1px solid #30363D;' +
      'font-size:.8rem;text-decoration:none;color:#E6EDF3;white-space:nowrap;flex-shrink:0;' +
      'vertical-align:middle;'
    });
    var dot = el('span', { style: css('color', '#3FB950') + css('font-weight', '800') }, '✓');
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(label));
    if (opts && opts.signOut) chip.appendChild(createSignOut());
    mountIn(chip);
  }

  function createSignOut() {
    var a = el('a', { href: '#', onclick: 'return window.__bsahiSignOut(event)', style:
      'margin-left:8px;color:#8B949E;text-decoration:none;font-size:.8rem;'
    }, 'Sign out');
    return a;
  }

  global.__bsahiSignOut = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    removeKey();
    global.location.replace('/');
    return false;
  };

  /* Place the chip in the page header — prefers .nav, then .header-inner,
   * then #nav-links, then .header. Falls back to body. */
  function mountIn(chip) {
    var targets = [
      document.querySelector('.header-inner .nav'),
      document.querySelector('#nav-links'),
      document.querySelector('.header-inner'),
      document.querySelector('.header'),
      document.body
    ];
    var host = null;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i]) { host = targets[i]; break; }
    }
    if (host === document.body) {
      var s = document.createElement('span');
      s.style.cssText = 'position:fixed;top:14px;right:14px;z-index:99;';
      s.appendChild(chip);
      host.appendChild(s);
    } else {
      host.appendChild(chip);
    }
  }

  /* Logged-in members: swap hero "Join the free beta →" CTAs to "My beta →". */
  function swapCTAs(user) {
    var btns = document.querySelectorAll('a[href="/beta.html"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var isHero = b.className && /\bbtn\b/.test(b.className);
      if (isHero && b.getAttribute('data-swapped') !== '1') {
        b.setAttribute('data-swapped', '1');
        b.textContent = 'My beta →';
        b.setAttribute('href', '/beta-login.html');
        b.title = (user && user.name ? user.name + ' — ' : '') + 'manage your beta';
      }
    }
  }

  /* On beta-login.html, toggle the header's Join/Sign out links by state. */
  function toggleLoginHeader(state) {
    var join = document.getElementById('login-join');
    var so = document.getElementById('login-signout');
    if (!join && !so) return;
    var loggedIn = state === 'ok' || state === 'outage';
    if (join) join.style.display = loggedIn ? 'none' : '';
    if (so) so.style.display = loggedIn ? '' : 'none';
  }

  /* On beta.html, a logged-in member should NOT see the registration form —
   * show their account state instead (they're already in the beta). */
  function accountifyBetaPage(user, email) {
    var formWrap = document.querySelector('#beta-form');
    if (!formWrap) return;
    var msg = document.getElementById('msg');
    var name = (user && user.name) || (email || '').split('@')[0] || 'member';
    var exp = (user && user.expiry) ? String(user.expiry).slice(0, 10) : '';
    formWrap.style.display = 'none';
    if (msg) msg.style.display = 'none';
    var panel = document.createElement('div');
    panel.style.cssText = 'text-align:center;padding:18px 8px;';
    panel.innerHTML =
      '<div style="font-size:2.2rem;margin-bottom:8px">🎉</div>' +
      '<h2 style="color:var(--fg);margin:0 0 6px">You\'re in the BSAHI beta</h2>' +
      '<p style="color:var(--muted);margin:0 0 4px">Welcome, <b style="color:var(--fg)">' + name.replace(/</g, '&lt;') + '</b>.' +
      (exp ? ' Beta runs until <b style="color:var(--accent)">' + exp + '</b>.' : '') + '</p>' +
      '<p style="margin:16px 0 8px;color:var(--muted);font-size:.9rem">Unlock your products:</p>' +
      '<p style="margin:0 0 6px"><a href="/products/send-widget.html" style="color:var(--accent);font-weight:700">Send Widget — live verdict →</a></p>' +
      '<p style="margin:0 0 6px"><a href="/products/sccr-index.html" style="color:var(--accent);font-weight:700">SCCR Index — daily coverage →</a></p>' +
      '<p style="margin:0"><a href="/beta-login.html" style="color:var(--muted);font-size:.85rem">Manage account / Sign out</a></p>';
    formWrap.parentNode.insertBefore(panel, formWrap);
  }

  function init() {
    var key = getKey();
    if (!key) return; // visitor — do nothing

    verify(key).then(function (res) {
      var user = res.user;
      // The login page has its own Join/Sign out header toggle + unlock panel —
      // only toggle it there, don't duplicate the chip.
      var onLoginPage = !!document.getElementById('login-signout');
      toggleLoginHeader(res.state);
      if (onLoginPage) return;
      if (res.state === 'ok') {
        var name = (user && user.name) || '';
        var exp = (user && user.expiry) ? String(user.expiry).slice(0, 10) : '';
        mountChip((name ? name + ' · ' : '') + 'until ' + exp, '/beta-login.html', { signOut: true });
        swapCTAs(user);
        accountifyBetaPage(user, res.email);
      } else if (res.state === 'outage') {
        // Degrade: key-presence + email prefix, no date.
        var pre = (res.email || '').split('@')[0] || 'member';
        mountChip(pre + ' · beta', '/beta-login.html', { signOut: true });
        swapCTAs(user);
        accountifyBetaPage(user, res.email);
      } else if (res.state === 'expired') {
        mountChip('Beta expired · Sign in →', '/beta-login.html?reason=expired');
      }
      // invalid → render nothing (visitor view); key left for the gate to handle.
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
