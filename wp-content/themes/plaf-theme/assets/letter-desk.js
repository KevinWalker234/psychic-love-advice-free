/* Unsent Letter Desk: автономний скрипт без залежностей.
 * Конфіг (радники) — з <script type="application/json" id="uld-config">.
 * Запит іде на window.PLAF_AI.endpoint (Cloudflare Worker); відповідь — SSE {"t": "..."}.
 * Модель віддає розділи [NOTE] / [LETTER] / [CHECK]; клієнт розбирає їх на лету й виводить лише як textContent.
 */
(function () {
  'use strict';
  var root = document.getElementById('uld-app');
  if (!root) return;
  var config;
  try { config = JSON.parse(document.getElementById('uld-config').textContent); } catch (e) { return; }
  var ENDPOINT = (window.PLAF_AI && window.PLAF_AI.endpoint) || '/api/love-letter/';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORE = 'plaf_letter_drawer';
  var COOL_MS = 24 * 3600 * 1000;

  var TO = [['partner', 'My partner'], ['dating', 'Someone I am dating'], ['ex', 'My ex'], ['crush', 'A crush'], ['drifting', 'Someone I am drifting from']];
  var OCC = [
    ['feelings', 'Say how I feel', 'Put honest feelings into words'],
    ['reconnect', 'Reconnect', 'Reach out after silence'],
    ['apology', 'Apologise', 'Own it without grovelling'],
    ['boundary', 'Set a boundary', 'Say what you need, kindly'],
    ['goodbye', 'Say goodbye', 'Close a chapter with care'],
    ['clarity', 'Ask where we stand', 'Invite a clear conversation']
  ];
  var OCC_ICON = {
    feelings: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    reconnect: '<path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M18 3v4h-4M6 21v-4h4"/>',
    apology: '<path d="M7 11V6a2 2 0 0 1 4 0v5M11 9a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7H7a3 3 0 0 1-3-3v-3a2 2 0 0 1 3-1.7"/>',
    boundary: '<path d="M12 3v18M5 8h4M15 16h4M5 16h4M15 8h4"/>',
    goodbye: '<path d="M4 20c4-1 6-4 8-9s4-7 8-8c-1 4-3 6-8 8s-8 4-8 9z"/>',
    clarity: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'
  };
  var WARM = ['Guarded', 'Reserved', 'Warm', 'Tender', 'Wide open'];
  var DIRECT = ['Very gentle', 'Gentle', 'Balanced', 'Direct', 'Blunt'];
  var LEN = ['A few lines', 'One page', 'A full letter'];
  var TWEAKS = [['shorter', 'Shorter'], ['softer', 'Softer'], ['direct', 'More direct'], ['opening', 'New opening']];

  var qs = new URLSearchParams(location.search);
  var S = { to: 'partner', occ: qs.get('occasion') || 'feelings', advisor: qs.get('voice') || config.advisors[0].slug, warm: 2, direct: 2, len: 1, busy: false, controller: null, last: null, letter: '' };
  if (!OCC.some(function (o) { return o[0] === S.occ; })) S.occ = 'feelings';
  if (!config.advisors.some(function (a) { return a.slug === S.advisor; })) S.advisor = config.advisors[0].slug;

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k]; // лише статичні SVG/розмітка з цього файлу
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function svg(inner, size) { return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>'; }
  var SEAL = '<svg class="uld-seal" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="27" fill="#8B2252"/><circle cx="32" cy="32" r="21" fill="none" stroke="#D4A843" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M32 43s-10-6-10-14a6 6 0 0 1 10-3.5A6 6 0 0 1 42 29c0 8-10 14-10 14z" fill="#D4A843"/></svg>';

  // ---------- форма ----------
  var form = h('form', { class: 'uld-card', id: 'uld-form', novalidate: 'novalidate' });

  function fieldset(num, legend, hint) {
    var fs = h('fieldset', { class: 'uld-fs' });
    fs.appendChild(h('legend', { html: '<span class="uld-num">' + num + '</span>' }));
    fs.firstChild.appendChild(document.createTextNode(legend));
    if (hint) fs.appendChild(h('p', { class: 'uld-hint', text: hint }));
    return fs;
  }
  function radio(name, val, checked, cls, content, extra) {
    var id = 'uld-' + name + '-' + val;
    var inp = h('input', { type: 'radio', name: name, value: val, id: id, class: 'uld-rad' });
    if (checked) inp.checked = true;
    var lab = h('label', { class: cls, for: id });
    content(lab);
    var wrap = h('span', { class: 'uld-opt' }, [inp, lab]);
    inp.addEventListener('change', function () { S[extra] = val; });
    return wrap;
  }

  var fs1 = fieldset(1, 'Who is the letter for?');
  var row1 = h('div', { class: 'uld-chips' });
  TO.forEach(function (t) { row1.appendChild(radio('to', t[0], S.to === t[0], 'uld-chip', function (l) { l.textContent = t[1]; }, 'to')); });
  fs1.appendChild(row1);

  var fs2 = fieldset(2, 'What kind of letter is it?');
  var grid2 = h('div', { class: 'uld-tiles' });
  OCC.forEach(function (o) {
    grid2.appendChild(radio('occ', o[0], S.occ === o[0], 'uld-tile', function (l) {
      l.appendChild(h('span', { class: 'uld-tile-ic', html: svg(OCC_ICON[o[0]]) }));
      l.appendChild(h('strong', { text: o[1] }));
      l.appendChild(h('small', { text: o[2] }));
    }, 'occ'));
  });
  fs2.appendChild(grid2);

  var fs3 = fieldset(3, 'What is going on, in your words?', 'Use first names or initials only. Please leave out surnames, addresses and contact details.');
  var ta = h('textarea', { id: 'uld-story', class: 'uld-ta', rows: '5', maxlength: '600', placeholder: 'For example: We have barely spoken since the argument about moving cities. I miss him but I am afraid of starting the same fight again.' });
  var count = h('div', { class: 'uld-count', text: '0 / 600' });
  ta.addEventListener('input', function () { count.textContent = ta.value.length + ' / 600'; ta.classList.remove('is-bad'); });
  fs3.appendChild(ta); fs3.appendChild(count);

  var fs4 = fieldset(4, 'Set the tone');
  function dial(key, label, names, max, lo, hi) {
    var out = h('output', { class: 'uld-dial-val', text: names[S[key]] });
    var inp = h('input', { type: 'range', min: '0', max: String(max), step: '1', value: String(S[key]), 'aria-label': label, class: 'uld-range' });
    inp.addEventListener('input', function () { S[key] = +inp.value; out.textContent = names[S[key]]; });
    return h('div', { class: 'uld-dial' }, [
      h('div', { class: 'uld-dial-top' }, [h('span', { class: 'uld-dial-name', text: label }), out]),
      inp,
      h('div', { class: 'uld-dial-ends' }, [h('span', { text: lo }), h('span', { text: hi })])
    ]);
  }
  fs4.appendChild(dial('warm', 'Warmth', WARM, 4, 'Guarded', 'Open'));
  fs4.appendChild(dial('direct', 'Directness', DIRECT, 4, 'Gentle', 'Direct'));
  fs4.appendChild(dial('len', 'Length', LEN, 2, 'Short note', 'Full letter'));

  var fs5 = fieldset(5, 'Whose voice should guide you?');
  var advs = h('div', { class: 'uld-advisors' });
  config.advisors.forEach(function (a) {
    advs.appendChild(radio('advisor', a.slug, S.advisor === a.slug, 'uld-adv', function (l) {
      l.appendChild(h('img', { src: a.avatar, alt: '', width: '48', height: '48', loading: 'lazy' }));
      l.appendChild(h('span', {}, [h('strong', { text: a.name }), h('small', { text: a.style })]));
    }, 'advisor'));
  });
  fs5.appendChild(advs);

  var go = h('button', { type: 'submit', class: 'btn btn-primary btn-pill uld-go', 'data-nebula-preserve': '1', text: 'Write my draft' });
  var err = h('p', { class: 'uld-err', role: 'alert' });
  form.appendChild(fs1); form.appendChild(fs2); form.appendChild(fs3); form.appendChild(fs4); form.appendChild(fs5);
  form.appendChild(go); form.appendChild(err);
  form.appendChild(h('p', { class: 'uld-fine', text: 'AI-written drafts for reflection and entertainment. Not a live session, not professional advice, and nothing is sent to anyone for you.' }));

  // ---------- аркуш ----------
  var paper = h('div', { class: 'uld-paper', id: 'uld-paper', 'aria-live': 'polite' });
  function showEmpty() {
    paper.className = 'uld-paper is-empty';
    paper.innerHTML = '';
    paper.appendChild(h('div', { class: 'uld-empty' }, [
      h('div', { html: SEAL }),
      h('p', { class: 'uld-empty-t', text: 'Your draft will appear here' }),
      h('p', { class: 'uld-empty-s', text: 'Fill in the card, choose a voice and the letter is written out line by line. You decide whether it is ever sent.' })
    ]));
  }
  showEmpty();

  var note, letterEl, checkEl, actions, status;
  function buildSheet() {
    paper.className = 'uld-paper is-writing';
    paper.innerHTML = '';
    var adv = advisor();
    note = h('aside', { class: 'uld-note' }, [h('span', { class: 'uld-note-by', text: adv.first + ' says' }), h('p', { class: 'uld-note-p' })]);
    letterEl = h('div', { class: 'uld-letter', 'aria-label': 'Draft letter' });
    checkEl = h('div', { class: 'uld-check' }, [h('h3', { text: 'Before you send' }), h('ul')]);
    actions = h('div', { class: 'uld-actions' });
    status = h('p', { class: 'uld-status', text: 'Writing…' });
    paper.appendChild(note); paper.appendChild(letterEl); paper.appendChild(checkEl); paper.appendChild(status); paper.appendChild(actions);
    checkEl.hidden = true; letterEl.hidden = true;
  }
  function advisor() {
    var a = config.advisors.filter(function (x) { return x.slug === S.advisor; })[0];
    return a;
  }

  function parse(full) {
    var iN = full.indexOf('[NOTE]'), iL = full.indexOf('[LETTER]'), iC = full.indexOf('[CHECK]');
    function seg(start, tag, others) {
      if (start < 0) return '';
      var from = start + tag.length, to = full.length;
      others.forEach(function (o) { if (o > start && o < to) to = o; });
      return full.slice(from, to).trim();
    }
    return { note: seg(iN, '[NOTE]', [iL, iC]), letter: seg(iL, '[LETTER]', [iN, iC]), check: seg(iC, '[CHECK]', [iN, iL]) };
  }
  function render(full, done) {
    var p = parse(full);
    if (!p.note && !p.letter && !p.check) p.note = full.replace(/\[[A-Z]+\]/g, '').trim();
    note.querySelector('.uld-note-p').textContent = p.note;
    letterEl.hidden = !p.letter;
    if (p.letter) {
      letterEl.textContent = '';
      p.letter.split(/\n{2,}/).forEach(function (para) { letterEl.appendChild(h('p', { text: para.replace(/\s*\n\s*/g, ' ').trim() })); });
      S.letter = p.letter;
    }
    var items = p.check.split('\n').map(function (l) { return l.replace(/^[\s\-•*\d.]+/, '').trim(); }).filter(Boolean).slice(0, 4);
    checkEl.hidden = !items.length;
    var ul = checkEl.querySelector('ul'); ul.textContent = '';
    items.forEach(function (t) { ul.appendChild(h('li', { text: t })); });
  }

  function finish(opts) {
    S.busy = false; go.disabled = false; go.textContent = 'Write another draft';
    paper.classList.remove('is-writing');
    status.textContent = opts.cut ? 'The draft was cut short. Try again for a full version.' : '';
    actions.textContent = '';
    if (!S.letter) return;
    paper.classList.add('is-done');
    paper.appendChild(h('div', { class: 'uld-sealwrap', html: SEAL }));
    var copy = h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Copy letter' });
    copy.addEventListener('click', function () { copyText(S.letter, copy); });
    var drawer = h('button', { type: 'button', class: 'btn btn-outline btn-sm', text: 'Keep in drawer for 24 hours' });
    drawer.addEventListener('click', function () { saveDrawer(); drawer.textContent = 'Sealed in your drawer'; drawer.disabled = true; renderDrawer(); });
    actions.appendChild(copy); actions.appendChild(drawer);
    var tw = h('div', { class: 'uld-tweaks' }, [h('span', { class: 'uld-tweaks-l', text: 'Adjust:' })]);
    TWEAKS.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'uld-tweak', text: t[1] });
      b.addEventListener('click', function () { run(t[0]); });
      tw.appendChild(b);
    });
    paper.appendChild(tw);
  }

  function copyText(text, btn) {
    function ok() { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, function () { fallback(); }); } else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* користувач скопіює вручну */ }
      document.body.removeChild(t);
    }
  }

  // ---------- шухляда (localStorage) ----------
  function loadDrawer() { try { return JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { return []; } }
  function storeDrawer(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 6))); } catch (e) { /* приватний режим */ } }
  function saveDrawer() {
    var list = loadDrawer();
    var occ = OCC.filter(function (o) { return o[0] === S.occ; })[0][1];
    list.unshift({ id: Date.now(), ts: Date.now(), occ: occ, to: TO.filter(function (t) { return t[0] === S.to; })[0][1], by: advisor().first, letter: S.letter });
    storeDrawer(list);
  }
  var drawerBox = h('section', { class: 'uld-drawer', hidden: 'hidden' });
  function renderDrawer() {
    var list = loadDrawer();
    drawerBox.hidden = !list.length;
    drawerBox.textContent = '';
    if (!list.length) return;
    drawerBox.appendChild(h('h2', { text: 'Your drawer' }));
    drawerBox.appendChild(h('p', { class: 'uld-hint', text: 'Letters stay in this browser only. A good unsent letter rests overnight before anyone reads it again, including you.' }));
    var wrap = h('div', { class: 'uld-drawer-grid' });
    list.forEach(function (it) {
      var left = it.ts + COOL_MS - Date.now();
      var sealed = left > 0;
      var card = h('article', { class: 'uld-env' + (sealed ? ' is-sealed' : '') });
      card.appendChild(h('div', { class: 'uld-env-h' }, [h('strong', { text: it.occ }), h('span', { text: 'to ' + it.to.toLowerCase() + ' · with ' + it.by })]));
      var body = h('p', { class: 'uld-env-b', text: it.letter });
      var st = h('p', { class: 'uld-env-s', text: sealed ? 'Sealed. Ready to reread in about ' + Math.max(1, Math.ceil(left / 3600000)) + ' h.' : 'Rested for 24 hours. Ready to reread.' });
      var btns = h('div', { class: 'uld-env-a' });
      var open = h('button', { type: 'button', class: 'uld-tweak', text: sealed ? 'Open anyway' : 'Reread' });
      open.addEventListener('click', function () { card.classList.remove('is-sealed'); open.hidden = true; });
      var cp = h('button', { type: 'button', class: 'uld-tweak', text: 'Copy' });
      cp.addEventListener('click', function () { copyText(it.letter, cp); });
      var del = h('button', { type: 'button', class: 'uld-tweak', text: 'Burn it' });
      del.addEventListener('click', function () { storeDrawer(loadDrawer().filter(function (x) { return x.id !== it.id; })); renderDrawer(); });
      btns.appendChild(open); btns.appendChild(cp); btns.appendChild(del);
      card.appendChild(body); card.appendChild(st); card.appendChild(btns);
      wrap.appendChild(card);
    });
    drawerBox.appendChild(wrap);
  }

  // ---------- запит ----------
  function run(tweak) {
    if (S.busy) return;
    var story = ta.value.replace(/\s+/g, ' ').trim();
    if (story.length < 20) { err.textContent = 'Please tell us a little more (at least a couple of sentences) so the draft can fit your situation.'; ta.classList.add('is-bad'); ta.focus(); return; }
    err.textContent = '';
    var payload = { advisor: S.advisor, to: S.to, occasion: S.occ, story: story, warmth: S.warm, directness: S.direct, length: S.len, tweak: tweak || 'none' };
    S.busy = true; S.letter = ''; go.disabled = true; go.textContent = 'Writing…';
    buildSheet();
    if (window.innerWidth < 900) paper.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    var full = '', cut = false, got = false;
    if (S.controller) { try { S.controller.abort(); } catch (e) { /* вже завершено */ } }
    S.controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: S.controller ? S.controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'The desk is unavailable right now. Please try again in a moment.'); });
        }
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split('\n'); buf = lines.pop();
            lines.forEach(function (ln) {
              ln = ln.trim();
              if (ln.indexOf('data:') !== 0) return;
              var d = ln.slice(5).trim();
              if (d === '[DONE]') return;
              try { var j = JSON.parse(d); if (j.t) { full += j.t; got = true; } if (j.cut) cut = true; } catch (e) { /* неповний рядок */ }
            });
            render(full);
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        if (!got) throw new Error('The desk is unavailable right now. Please try again in a moment.');
        render(full, true); finish({ cut: cut });
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        S.busy = false; go.disabled = false; go.textContent = 'Write my draft';
        paper.className = 'uld-paper is-error';
        paper.innerHTML = '';
        paper.appendChild(h('div', { class: 'uld-empty' }, [h('p', { class: 'uld-empty-t', text: 'The ink ran dry' }), h('p', { class: 'uld-empty-s', text: (e && e.message) || 'Something went wrong. Please try again.' })]));
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run('none'); });

  var desk = h('div', { class: 'uld-desk' }, [form, h('div', { class: 'uld-paperwrap' }, [paper])]);
  root.appendChild(desk);
  root.appendChild(drawerBox);
  renderDrawer();
})();
