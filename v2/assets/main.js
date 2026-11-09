// AutoRepublic v2 „Bordul mașinii”: martorii de bord, programul live, vremea din Chișinău,
// „Sună-mă înapoi”, programarea cu turometru, meniul și evenimentele pentru GA4 / Google Ads.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const TZ = 'Europe/Chisinau';
  const lang = document.documentElement.lang;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const push = o => (window.dataLayer = window.dataLayer || []).push(o);
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* fereastră privată: mergem mai departe */ } },
  };

  // Programul de lucru: zi (0 = duminică) -> [deschide, închide]. Vine din build.py.
  const HOURS = JSON.parse(document.body.dataset.hours || '{}');
  const chisinauNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), h: +p.hour + p.minute / 60 };
  };
  const isoDay = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
  const hhmm = h => String(h).padStart(2, '0') + ':00';

  // Deschis acum sau când deschidem (azi, mâine, luni…)
  const openState = () => {
    const { day, h } = chisinauNow(), today = HOURS[day];
    if (today && h >= today[0] && h < today[1]) return { open: true, close: today[1] };
    let d = day, when = 'today';
    if (!today || h >= today[1]) {
      do { d = (d + 1) % 7; } while (!HOURS[d]);
      when = d === (day + 1) % 7 ? 'tomorrow' : 'day';
    }
    return { open: false, d, when, at: HOURS[d][0] };
  };
  const whenLabel = (L, st) => (st.when === 'day' ? L.days[st.d] : L[st.when]);

  $$('[data-open]').forEach(el => {
    const L = JSON.parse(el.dataset.open), st = openState();
    el.textContent = st.open ? L.open.replace('{t}', hhmm(st.close)) : L.closed.replace('{d}', whenLabel(L, st)).replace('{t}', hhmm(st.at));
    el.classList.add(st.open ? 'is-open' : 'is-closed');
  });

  // Contact: cadranul live. Acul arată cât din ziua de lucru a trecut; textul spune când închidem sau când deschidem
  const lamps = $('[data-lamps]');
  if (lamps && !reduced && 'IntersectionObserver' in window) {
    const nums = [...lamps.querySelectorAll('b')].map(b => [b, b.textContent.match(/^(\d+)(\+?)$/)]).filter(x => x[1] && +x[1][1] > 0);
    nums.forEach(([b, m]) => { b.textContent = '0' + m[2]; });
    lamps.classList.add('lamps');
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect(); lamps.classList.add('is-on');
      const t0 = performance.now();
      const tick = now => { const k = Math.min(1, (now - t0) / 1100), ease = 1 - Math.pow(1 - k, 3);
        nums.forEach(([b, m]) => { b.textContent = Math.round(+m[1] * ease) + m[2]; });
        if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(lamps);
  }

  const live = $('[data-live]');
  if (live) {
    const T = JSON.parse(live.dataset.live), st = openState(), now = chisinauNow();
    const v = $('.dial-v', live), l = $('.dial-l', live);
    if (st.open) {
      const o = HOURS[now.day], left = Math.max(0, Math.round((st.close - now.h) * 60));
      live.style.setProperty('--to', Math.round(-90 + 180 * (now.h - o[0]) / (o[1] - o[0])) + 'deg');
      v.textContent = T.dial_open;
      l.textContent = T.dial_left.replace('{h}', Math.floor(left / 60)).replace('{m}', left % 60);
    } else {
      live.style.setProperty('--to', '-90deg');
      v.textContent = T.dial_closed;
      l.textContent = T.dial_opens.replace('{d}', whenLabel(T.open, st)).replace('{t}', hhmm(st.at));
    }
    live.classList.add(st.open ? 'is-open' : 'is-closed');
  }

  // De unde a venit vizitatorul (Google Ads, TikTok…): pleacă împreună cu cererea
  const SRC = 'ar_src';
  try {
    const q = new URLSearchParams(location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid'];
    const found = Object.fromEntries(keys.filter(k => q.get(k)).map(k => [k, q.get(k).slice(0, 120)]));
    if (Object.keys(found).length || !ss.get(SRC)) ss.set(SRC, JSON.stringify({ ...found, landing: location.pathname, referrer: document.referrer.slice(0, 200) }));
  } catch { /* fără sursă */ }
  const source = () => { try { return JSON.parse(ss.get(SRC) || '{}'); } catch { return {}; } };

  // Trimiterea unei cereri. Fără endpoint (prototip) doar simulăm trimiterea.
  const sendLead = async (form, name, data) => {
    if (data.website) return;                       // capcana pentru roboți a fost completată: nu trimitem nimic
    delete data.website;
    const payload = { form: name, ...data, limba: lang, pagina: location.href, sursa: source() };
    // Fără endpoint (prototip) nu pleacă nimic și nu numărăm nicio conversie
    if (!form.dataset.endpoint) return;
    const r = await fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(r.status);
    // Conversia pentru Google Ads / GA4, doar după răspunsul OK (TRACKING-pentru-programatori.md)
    push({ event: 'form_submit_success', form_name: name });
  };

  // Atingerea se vede și pe iPhone: Safari aplică :active doar dacă pagina ascultă touchstart
  document.addEventListener('touchstart', () => {}, { passive: true });

  // „Scrie” din bara de jos: alegerea între WhatsApp, Viber și Messenger (popover nativ);
  // în browserele fără popover, butonul deschide direct WhatsApp
  const scrie = $('[data-scrie]');
  if (scrie && !HTMLElement.prototype.hasOwnProperty('popover')) scrie.addEventListener('click', () => { location.href = scrie.dataset.scrie; });

  // Meniul de pe telefon: se deschide sub antet, oricât de jos l-ar împinge banda pentru rusă
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  if (menuBtn && menu) {
    const set = open => {
      if (open) menu.style.top = Math.max(0, $('.top').getBoundingClientRect().bottom) + 'px';
      menu.hidden = !open;
      menuBtn.setAttribute('aria-expanded', open);
      document.body.classList.toggle('no-scroll', open);
    };
    menuBtn.addEventListener('click', () => set(menu.hidden));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { set(false); menuBtn.focus(); } });
  }

  // Bara de jos se ascunde cât timp tastatura e deschisă într-un câmp
  const typing = el => el.matches?.('input:not([type=checkbox]):not([type=radio]), textarea');
  document.addEventListener('focusin', e => { if (typing(e.target)) document.body.classList.add('typing'); });
  document.addEventListener('focusout', e => { if (typing(e.target)) document.body.classList.remove('typing'); });

  // Telefon setat în rusă, pagină în română: propunem versiunea rusă, fără redirect
  const hint = $('.lang-hint');
  if (hint) {
    let off = false;
    try { off = localStorage.getItem('ar_hint') === '1'; } catch { /* fără memorie */ }
    if (!off && /^ru\b/i.test((navigator.languages || [navigator.language])[0] || '')) hint.hidden = false;
    $('[data-hint-x]', hint).addEventListener('click', () => {
      hint.hidden = true;
      try { localStorage.setItem('ar_hint', '1'); } catch { /* fără memorie */ }
    });
  }

  // Martorii de bord: la prima vizită din sesiune se aprind și se sting, ca la contact
  const lights = $('[data-lights]'), sheet = $('#martor');
  if (lights) {
    if (!reduced && !ss.get('ar_ign')) lights.classList.add('ignite');
    ss.set('ar_ign', '1');
  }
  if (lights && sheet) {
    const sheetCb = $('.sheet-cb', sheet);
    const open = id => {
      $$('.m-card', sheet).forEach(a => { a.hidden = a.dataset.m !== id; });
      if (sheetCb) sheetCb.hidden = openState().open;   // închis: „te sunăm mâine la 09:00”
      sheet.setAttribute('aria-labelledby', 'mt-' + id);
      sheet.showModal();
      push({ event: 'martor_select', martor: id });
    };
    $$('[data-m]', lights).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      lights.classList.remove('ignite');
      open(a.dataset.m);
    }));
    $('[data-close]', sheet).addEventListener('click', () => sheet.close());
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });   // atingere pe fundal
  }

  // „Ce auzi sau simți la mașină?”: un buton deschide panoul lui
  $$('[data-picker]').forEach(box => {
    const btns = $$('[data-sym]', box), panels = $$('[data-panel]', box);
    const show = (id, byUser) => {
      btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.sym === id));
      panels.forEach(p => p.classList.toggle('on', p.dataset.panel === id));
      if (!byUser) return;
      const p = panels.find(x => x.dataset.panel === id);
      if (p.getBoundingClientRect().bottom > innerHeight) p.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      push({ event: 'symptom_select', symptom: btns.find(b => b.dataset.sym === id).textContent.trim() });
    };
    btns.forEach(b => b.addEventListener('click', () => show(b.dataset.sym, true)));   // nimic ales dinainte: alege omul
  });

  // Prețuri: taburi pe categorii; fără JavaScript toate grupurile rămân vizibile, unul sub altul
  const ptabs = $('[data-ptabs]');
  if (ptabs) {
    const tabs = $$('.ptab', ptabs), panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const pick = (i, byUser) => {
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.hidden = k !== i; });
      if (!byUser) return;
      history.replaceState(null, '', '#' + panels[i].id);
      tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      push({ event: 'price_tab', tab: panels[i].id });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', ev => { ev.preventDefault(); pick(i, true); });
      t.addEventListener('keydown', ev => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
        if (!d) return;
        ev.preventDefault();
        const j = (i + d + tabs.length) % tabs.length;
        pick(j, true); tabs[j].focus();
      });
    });
    const fromHash = () => { const h = panels.findIndex(p => '#' + p.id === location.hash); if (h >= 0 || !location.hash) pick(Math.max(h, 0), false); };
    fromHash();
    addEventListener('hashchange', fromHash);   // un link spre /preturi/#roti de pe aceeași pagină
  }

  // Harta Google se încarcă doar la cerere: pagina rămâne ușoară
  $$('[data-map]').forEach(btn => btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.map;
    f.title = btn.dataset.title || '';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    btn.closest('.map').replaceChildren(f);
  }));

  // Vremea de acum din Chișinău și sfatul potrivit; dacă nu răspunde, rămâne blocul sezonier
  const wx = $('[data-wx]');
  if (wx) {
    const W = JSON.parse(wx.dataset.wx);
    const show = ({ t, kind }) => {
      const [tip, href] = W.tips[kind];
      const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls, textContent: text });
      const deg = (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + ' °C';
      const btn = el('a', 'btn btn-red btn-sm', W.btn);
      btn.href = href;
      wx.replaceChildren(el('span', 'wx-t', W.now.replace('{t}', deg)), el('span', 'wx-tip', tip), btn);
      wx.hidden = false;
    };
    let cached = null;
    try { cached = JSON.parse(ss.get('ar_wx') || 'null'); } catch { /* fără cache */ }
    if (cached && Date.now() - cached.ts < 30 * 60e3) show(cached);
    else {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${W.lat}&longitude=${W.lon}&current=temperature_2m,precipitation,weather_code&timezone=Europe%2FChisinau`)
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(d => {
          const t = Math.round(d.current.temperature_2m), code = d.current.weather_code;
          const rain = d.current.precipitation > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
          const v = { t, kind: t < 7 ? 'cold' : rain ? 'rain' : t > 28 ? 'hot' : 'mild', ts: Date.now() };
          ss.set('ar_wx', JSON.stringify(v));
          show(v);
        })
        .catch(() => { /* rămâne doar blocul sezonier */ });
    }
  }

  // „Sună-mă înapoi”: un singur câmp, textul urmează programul
  $$('[data-cb]').forEach(form => {
    const T = JSON.parse(form.dataset.cb), st = openState();
    const closed = k => T[k].replace('{d}', whenLabel(T.open, st)).replace('{t}', hhmm(st.at));
    if (!st.open) $('[data-cb-text]', form).innerHTML = closed('cb_closed');   // textele vin din build.py, gata de HTML
    const err = $('.cb-err', form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const tel = form.elements.telefon;
      if (!/^\+?\d{8,15}$/.test(tel.value.replace(/[\s\-().]/g, ''))) {
        err.textContent = T.cb_err; err.hidden = false; tel.focus(); return;
      }
      err.hidden = true;
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        await sendLead(form, 'callback', { telefon: tel.value.trim(), serviciu: form.dataset.service, website: form.elements.website.value });
        const ok = Object.assign(document.createElement('p'), { className: 'cb-done', innerHTML: st.open ? T.cb_ok_open : closed('cb_ok_closed') });
        ok.setAttribute('role', 'status');
        form.replaceChildren(ok);
      } catch {
        err.textContent = T.cb_fail; err.hidden = false; btn.disabled = false;
      }
    });
  });

  // Programarea online: 3 pași, turometrul arată pasul
  const form = $('#booking');
  if (!form) return;
  const M = JSON.parse(form.dataset.msg);
  const steps = $$('.step', form), gauge = $('.gauge'), stepTxt = $('[data-steptxt]');
  const date = form.elements.data, times = $$('input[name=ora]', form), days = $('[data-days]', form);
  const ANGLE = [-60, 0, 60, 88];          // acul: pasul 1, 2, 3 și „gata”
  let cur = 0;

  const err = msg => { const e = $('.err', steps[cur]); e.textContent = msg; e.hidden = !msg; };
  const setGauge = i => {
    gauge.style.setProperty('--a', ANGLE[i] + 'deg');
    gauge.classList.toggle('is-done', i === 3);
    if (i < 3) stepTxt.textContent = M.step.replace('{n}', i + 1);
    else stepTxt.hidden = true;
  };
  const chosen = () => $$('input[name=servicii]:checked', form).map(c => c.nextElementSibling.textContent.trim()).join(', ');
  // „Frâne · marți, 10 noiembrie, ora 09:00”: ce a ales omul, repetat la pasul 3 și după trimitere
  const summary = () => {
    const ora = $('input[name=ora]:checked', form)?.value;
    const day = date.value ? new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date.value + 'T12:00')) : '';
    return [chosen(), day && ora ? `${day}, ${M.at} ${ora}` : day].filter(Boolean).join(' · ');
  };
  const go = (i, byUser = true) => {
    cur = i;
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    if (i === 1) $('[data-chosen] span', form).textContent = chosen();
    if (i === 2) $('[data-recap] span', form).textContent = summary();
    setGauge(i);
    if (!byUser) return;
    push({ event: 'booking_step', step: i + 1 });
    form.closest('.book-main').scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    $('legend', steps[i]).focus({ preventScroll: true });
  };

  // Orele libere ale unei zile: în program și, azi, doar cele care n-au trecut
  const weekday = iso => new Date(iso + 'T12:00').getDay();
  const free = iso => {
    const o = HOURS[weekday(iso)];
    if (!o) return [];
    const after = iso === isoDay(new Date()) ? chisinauNow().h : -1;
    return times.map(t => parseInt(t.value, 10)).filter(h => h >= o[0] && h < o[1] && h > after);
  };
  // Grila de ore stă pe loc: orele din program rămân vizibile, cele trecute doar se dezactivează,
  // ca să nu se mute butoanele sub deget când schimbi ziua
  const syncTimes = () => {
    const ok = date.value ? free(date.value) : [];
    const o = date.value ? HOURS[weekday(date.value)] : null;
    times.forEach(t => {
      const h = parseInt(t.value, 10), on = ok.includes(h);
      t.disabled = !on;
      t.closest('.opt').hidden = !o || h < o[0] || h >= o[1];
      if (!on) t.checked = false;
    });
    err(date.value && !ok.length ? (HOURS[weekday(date.value)] ? M.full : M.sunday) : '');
  };

  // Următoarele 6 zile cu ore libere, ca butoane („Azi”, „Mâine”, „joi, 5 nov.”)
  const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
  for (let i = 0, added = 0; added < 6 && i < 14; i++) {
    const d = new Date(Date.now() + i * 864e5), iso = isoDay(d);
    if (!free(iso).length) continue;
    const label = i === 0 ? M.today : i === 1 ? M.tomorrow : fmt.format(d);
    days.insertAdjacentHTML('beforeend', `<label class="opt"><input type="radio" name="zi" value="${iso}"><span>${label}</span></label>`);
    added++;
  }
  days.addEventListener('change', e => {
    date.value = e.target.value;
    date.hidden = true;
    syncTimes();
  });
  const firstDay = $('input[name=zi]', days);
  if (firstDay) { firstDay.checked = true; date.value = firstDay.value; }
  syncTimes();
  date.min = isoDay(new Date());
  date.addEventListener('change', () => { $$('input[name=zi]', days).forEach(r => { r.checked = r.value === date.value; }); syncTimes(); });
  $('[data-other]', form).addEventListener('click', () => {
    date.hidden = false;
    date.focus();
    try { date.showPicker(); } catch { /* browserul nu are showPicker */ }
  });

  const check = i => {
    if (i === 0) return $$('input[name=servicii]:checked', form).length ? '' : M.service;
    if (i === 1) {
      if (!date.value) return M.date;
      if (!free(date.value).length) return HOURS[weekday(date.value)] ? M.full : M.sunday;
      return $('input[name=ora]:checked', form) ? '' : M.time;
    }
    if (form.elements.nume.value.trim().length < 2) return M.name;
    return /^\+?\d{8,15}$/.test(form.elements.telefon.value.replace(/[\s\-().]/g, '')) ? '' : M.phone;
  };
  $$('[data-next]', form).forEach(b => b.addEventListener('click', () => { const m = check(cur); err(m); if (!m) go(cur + 1); }));
  $$('[data-back]', form).forEach(b => b.addEventListener('click', () => { err(''); go(cur - 1); }));

  // Venit cu serviciul ales (/programare/?serviciu=frane): sărim direct la ziua și ora
  const pre = new URLSearchParams(location.search).get('serviciu');
  const preBox = pre && $$('input[name=servicii]', form).find(c => c.value === pre);
  if (preBox) {
    preBox.checked = true;
    const more = preBox.closest('details');
    if (more) more.open = true;
    go(1, false);
  } else setGauge(0);

  const done = d => {
    const names = chosen();
    const when = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d.data + 'T12:00')) + ', ' + d.ora;
    const box = $('#booking-done');
    $('h2', box).textContent = box.dataset.title.replace('{n}', d.nume.trim().split(/\s+/)[0]);
    $('[data-sum]', box).textContent = summary();
    $$('.side .cb').forEach(f => { f.hidden = true; });   // după trimitere nu mai cerem încă o dată telefonul
    const wa = $('[data-wa]', box);
    wa.href = wa.href.split('?')[0] + '?text=' + encodeURIComponent(M.wa.replace('{n}', d.nume.trim()).replace('{s}', names).replace('{w}', when) + (d.masina ? ` (${d.masina})` : ''));
    // Google Calendar: o oră, după ora Chișinăului; un link, nu un fișier de descărcat
    const ymd = d.data.replace(/-/g, ''), h = parseInt(d.ora, 10), p2 = n => String(n).padStart(2, '0');
    const cal = new URLSearchParams({
      action: 'TEMPLATE', text: M.cal_title.replace('{s}', names), dates: `${ymd}T${p2(h)}0000/${ymd}T${p2(h + 1)}0000`,
      ctz: TZ, location: M.address, details: M.cal_details,
    });
    $('[data-cal]', box).href = 'https://calendar.google.com/calendar/render?' + cal;
    form.hidden = true;
    box.hidden = false;
    setGauge(3);
    box.focus();
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = check(2); err(m); if (m) return;
    const fd = new FormData(form);
    const data = {
      servicii: fd.getAll('servicii'), data: fd.get('data'), ora: fd.get('ora'), nume: fd.get('nume'),
      telefon: fd.get('telefon'), masina: fd.get('masina'), mesaj: fd.get('mesaj'), website: fd.get('website'),
    };
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      await sendLead(form, 'programare', data);
      done(data);
    } catch {
      err(M.fail);
      btn.disabled = false;
    }
  });
})();
