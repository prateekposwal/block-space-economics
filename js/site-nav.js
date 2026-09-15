/* BSAHI site-nav — injects the one consistent topbar into every page.
 *
 * - Links /css/site-nav.css once.
 * - Builds the header: ⬡ BSAHI brand + primary nav (Live / Learn /
 *   Capacity / Fork Tracker / Research / Articles / Beta) with the current
 *   page marked .active.
 * - If the page pre-declared <header id="site-nav" class="site-nav"> (the
 *   live dashboard adds a .nav-tabs second row), it fills that header's
 *   .site-nav-inner instead of creating a new one.
 * - Adopts any existing #chip (data-freshness dot) and moves it to the end
 *   of the bar, so the homepage and live keep their freshness signal.
 *
 * Idempotent: refrains if #site-nav is already populated.
 */
(function (global) {
  'use strict';

  var LINKS = [
    { href: '/live', label: 'Live' },
    { href: '/learn', label: 'Learn' },
    { href: '/capacity', label: 'Capacity' },
    { href: '/fork-tracker', label: 'Fork Tracker' },
    { href: '/research', label: 'Research' },
    { href: '/articles.html', label: 'Articles' },
    { href: '/beta.html', label: 'Beta' }
  ];
  var CSS_URL = '/css/site-nav.css';
  var CHIP_HTML = '<b id="chip-dot"></b><span id="chip-label">Live</span>';

  function isActive(href) {
    var p = global.location.pathname;
    if (p === href) return true;
    if (href === '/articles.html' || href === '/beta.html') return p === href;
    return p.indexOf(href + '/') === 0;
  }

  function buildLinks() {
    var out = '';
    for (var i = 0; i < LINKS.length; i++) {
      var ln = LINKS[i];
      out += '<a href="' + ln.href + '"' + (isActive(ln.href) ? ' class="active"' : '') + '>' + ln.label + '</a>';
    }
    return out;
  }

  function adoptChip(inner) {
    var chip = global.document.getElementById('chip');
    if (!chip) {
      chip = global.document.createElement('span');
      chip.id = 'chip';
      chip.title = 'Data freshness';
      chip.innerHTML = CHIP_HTML;
    }
    if (chip.parentNode !== inner) inner.appendChild(chip);
  }

  function main() {
    // stylesheet (once)
    if (!global.document.querySelector('link[href="' + CSS_URL + '"]')) {
      var l = global.document.createElement('link');
      l.rel = 'stylesheet';
      l.href = CSS_URL;
      global.document.head.appendChild(l);
    }

    var nav = global.document.getElementById('site-nav');
    var inner;

    if (nav && nav.querySelector('.site-nav-inner')) {
      // pre-declared header (live dashboard with a tab strip): fill its row
      inner = nav.querySelector('.site-nav-inner');
      nav.classList.add('site-nav');
    } else {
      nav = global.document.createElement('header');
      nav.id = 'site-nav';
      nav.className = 'site-nav';
      inner = global.document.createElement('div');
      inner.className = 'site-nav-inner';
      nav.appendChild(inner);
      global.document.body.insertBefore(nav, global.document.body.firstChild);
    }

    if (!inner.querySelector('.site-nav-links')) {
      inner.insertAdjacentHTML('afterbegin',
        '<a class="brand" href="/"><span class="bi">⬡</span> BSAHI</a>' +
        '<nav class="site-nav-links" aria-label="Primary">' + buildLinks() + '</nav>');
    }

    adoptChip(inner);
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})(window);