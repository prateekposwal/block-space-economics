/* BSAHI beta gate — shared single source of truth for beta key verification.
 * Used by:
 *   - /beta-login.html  (login form: verifyKeyStatic + sign-out)
 *   - protected pages   (synchronous <head> snippet redirects when no key;
 *                        this file loads with defer and re-verifies via
 *                        BSAHIGate.guard(), revealing body content on success)
 *
 * Mirrors tools/agents/27-beta-manager.js verifyKey() — runs client-side
 * against the public data/beta-users.json (static GitHub Pages, no server).
 */
(function (global) {
  'use strict';

  var KEY_NAME = 'bsahi_beta_key';
  var LOGIN_URL = '/beta-login.html';
  var ROSTER_URL = '/data/beta-users.json';

  function getKey() {
    try { return global.localStorage.getItem(KEY_NAME); } catch (e) { return null; }
  }

  function removeKey() {
    try { global.localStorage.removeItem(KEY_NAME); } catch (e) {}
  }

  function redirectToLogin(nextPath, reason) {
    var url = LOGIN_URL + '?next=' + encodeURIComponent(nextPath || global.location.pathname);
    if (reason) url += '&reason=' + encodeURIComponent(reason);
    global.location.replace(url);
  }

  /* verifyKeyStatic(key) → Promise<{ok:true,user} | {ok:false,error[,rosterError]}>
   * Decode key → email|spot|bsahi-beta, find the user in the public roster,
   * re-derive the deterministic key and compare, then check active + expiry.
   * Roster fetch failure returns {ok:false, rosterError:true} so callers can
   * fail open (gate) or surface the error (login form). */
  function verifyKeyStatic(key) {
    var decoded, parts;
    try {
      decoded = atob(String(key || '').replace(/-/g, '+').replace(/_/g, '/'));
      parts = decoded.split('|');
    } catch (e) {
      return Promise.resolve({ ok: false, error: 'Invalid key format.' });
    }
    if (parts.length !== 3 || parts[2] !== 'bsahi-beta') {
      return Promise.resolve({ ok: false, error: 'Invalid key format.' });
    }
    var email = parts[0];
    var spot = parts[1];
    return fetch(ROSTER_URL).then(function (r) { return r.json(); }).then(function (users) {
      var u = (users.users || []).find(function (x) { return x.email === email; });
      if (!u) {
        return { ok: false, error: 'No beta user found for this key. Check your email or contact beta@bitcoinsahi.com.' };
      }
      // Re-derive and compare the deterministic key (email|spot|bsahi-beta).
      var expect = btoa(email + '|' + (u.spot || spot) + '|bsahi-beta').replace(/=+$/, '');
      if (String(key).replace(/=+$/, '') !== expect) {
        return { ok: false, error: 'Key does not match your registration.' };
      }
      if (!u.active) {
        return { ok: false, error: 'Account not active. Contact beta@bitcoinsahi.com.' };
      }
      if (u.expiry && new Date(u.expiry) < new Date()) {
        return { ok: false, error: 'Beta expired ' + String(u.expiry).slice(0, 10) + '. Contact beta@bitcoinsahi.com.' };
      }
      return { ok: true, user: u };
    }).catch(function () {
      // Roster unreachable — flag so the gate can fail open (keep users in).
      return { ok: false, rosterError: true, error: 'Could not load the beta roster. If you have a beta key, email beta@bitcoinsahi.com for access.' };
    });
  }

  /* guard() — the gate. Runs on protected pages (body starts class="gated").
   *   absent key        → redirect to login with ?next=current page
   *   valid key         → reveal content (remove body.gated)
   *   invalid/expired   → drop the stored key, redirect to login with ?reason=
   *   roster fetch fail → fail open: keep logged-in users in */
  function guard() {
    var key = getKey();
    if (!key) {
      redirectToLogin(global.location.pathname);
      return;
    }
    verifyKeyStatic(key).then(function (res) {
      if (res.ok || res.rosterError) {
        if (document.body) document.body.classList.remove('gated');
      } else {
        removeKey();
        var reason = /expired/i.test(res.error || '') ? 'expired' : 'invalid';
        redirectToLogin(global.location.pathname, reason);
      }
    });
  }

  var BSAHIGate = {
    guard: guard,
    verifyKeyStatic: verifyKeyStatic,
    getKey: getKey,
    removeKey: removeKey,
    redirectToLogin: redirectToLogin,
    KEY_NAME: KEY_NAME,
    LOGIN_URL: LOGIN_URL
  };

  // Protected pages load this with defer → body exists → auto-run the gate.
  // The login page loads this synchronously in <head> (body not yet parsed)
  // and drives verifyKeyStatic/removeKey itself, so it never auto-guards.
  if (document.body && document.body.classList.contains('gated')) {
    guard();
  }

  global.BSAHIGate = BSAHIGate;
  global.verifyKeyStatic = verifyKeyStatic; // back-compat for the login form
})(typeof window !== 'undefined' ? window : this);
