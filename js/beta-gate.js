/* BSAHI beta gate — shared single source of truth for beta key verification.
 * Used by:
 *   - /beta-login.html  (login form: verifyKeyStatic + sign-out)
 *   - protected pages   (synchronous <head> snippet redirects when no key;
 *                        this file loads with defer and re-verifies via
 *                        BSAHIGate.guard(), revealing body content on success)
 *
 * Keys are RANDOM (not derived from an email). The public roster
 * (data/beta-users.json) stores only a SHA-256 hash of each key, so no PII and
 * no raw key is ever served. Verification hashes the presented key and looks
 * for a matching, active, unexpired entry.
 * Static GitHub Pages has no server, so this is access obfuscation, not
 * cryptographic auth — the roster no longer contains anything worth stealing.
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

  /* Normalise a presented key: trim, drop internal whitespace, strip base64
   * '=' padding (keys are issued unpadded). */
  function normalizeKey(key) {
    return String(key == null ? '' : key).replace(/\s+/g, '').replace(/=+$/, '');
  }

  /* SHA-256 hex of a UTF-8 string. Requires a secure context (HTTPS). */
  function sha256Hex(str) {
    if (!(global.crypto && global.crypto.subtle && global.TextEncoder)) {
      return Promise.reject(new Error('crypto.subtle unavailable'));
    }
    return global.crypto.subtle.digest('SHA-256', new global.TextEncoder().encode(str))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
  }

  /* verifyKeyStatic(key) → Promise<{ok:true,user} | {ok:false,error[,rosterError]}>
   * Hash the presented key, find a matching entry in the public roster, then
   * check active + expiry. Roster fetch failure returns
   * {ok:false, rosterError:true} so the gate can fail open (keep users in). */
  function verifyKeyStatic(key) {
    var k = normalizeKey(key);
    if (!k) return Promise.resolve({ ok: false, error: 'Enter your key.' });
    return sha256Hex(k).then(function (hash) {
      return fetch(ROSTER_URL).then(function (r) { return r.json(); }).then(function (roster) {
        var users = (roster && roster.users) || [];
        var u = users.find(function (x) { return x.key_sha256 === hash; });
        if (!u) {
          return { ok: false, error: 'That beta key was not recognised. Check your email or contact beta@bitcoinsahi.com.' };
        }
        if (!u.active) {
          return { ok: false, error: 'Account not active. Contact beta@bitcoinsahi.com.' };
        }
        if (u.expiry && new Date(u.expiry) < new Date()) {
          return { ok: false, error: 'Beta expired ' + String(u.expiry).slice(0, 10) + '. Contact beta@bitcoinsahi.com.' };
        }
        // Never return PII — the roster holds none.
        return { ok: true, user: { id: u.id, label: u.label, product: u.product, plan: u.plan, spot: u.spot, expiry: u.expiry } };
      });
    }).catch(function (err) {
      if (err && /crypto\.subtle/.test(err.message || '')) {
        return { ok: false, error: 'This browser cannot verify beta keys. Try a modern browser over HTTPS.' };
      }
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
