// AutoRepublic: meniul mobil, programul live, alegerea simptomului, harta la cerere și programarea online.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const TZ = 'Europe/Chisinau';
  const lang = document.documentElement.lang;

  // Programul de lucru: zi (0 = duminică) -> [deschide, închide]. Vine din build.py, dintr-o singură sursă.
  const HOURS = JSON.parse(document.body.dataset.hours || '{}');

  // Ziua și ora curentă în Chișinău, indiferent de fusul orar al telefonului
  const chisinauNow = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), h: +p.hour + p.minute / 60 };
  };
  const isoDay = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD

  // Meniul de pe telefon
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  if (menuBtn && menu) {
    const set = open => {
      menu.hidden = !open;
      menuBtn.setAttribute('aria-expanded', open);
      document.body.classList.toggle('no-scroll', open);
    };
    menuBtn.addEventListener('click', () => set(menu.hidden));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { set(false); menuBtn.focus(); } });
  }

  // „Deschis acum, până la 18:00” / „Închis acum. Deschidem mâine la 09:00”
  const hhmm = h => String(h).padStart(2, '0') + ':00';
  $$('[data-open]').forEach(el => {
    const L = JSON.parse(el.dataset.open), { day, h } = chisinauNow(), today = HOURS[day];
    if (today && h >= today[0] && h < today[1]) {
      el.textContent = L.open.replace('{t}', hhmm(today[1]));
      el.classList.add('is-open');
      return;
    }
    let d = day, label = L.today;
    if (!today || h >= today[1]) {
      do { d = (d + 1) % 7; } while (!HOURS[d]);
      label = d === (day + 1) % 7 ? L.tomorrow : L.days[d];
    }
    el.textContent = L.closed.replace('{d}', label).replace('{t}', hhmm(HOURS[d][0]));
    el.classList.add('is-closed');
  });

  // „Ce simți la mașină?”: un buton deschide panoul lui
  $$('[data-picker]').forEach(box => {
    const btns = $$('[data-sym]', box), panels = $$('[data-panel]', box);
    const show = id => {
      btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.sym === id));
      panels.forEach(p => p.classList.toggle('on', p.dataset.panel === id));
    };
    btns.forEach(b => b.addEventListener('click', () => show(b.dataset.sym)));
    if (btns.length) show(btns[0].dataset.sym);
  });

  // Harta Google se încarcă doar la cerere: pagina rămâne ușoară
  $$('[data-map]').forEach(btn => btn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.map;
    f.title = btn.dataset.title || '';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    btn.closest('.map').replaceChildren(f);
  }));

  // Programarea online, în 3 pași
  const form = $('#booking');
  if (!form) return;
  const M = JSON.parse(form.dataset.msg);
  const steps = $$('.step', form), bars = $$('.prog li', form);
  const date = form.elements.data, times = $$('input[name=ora]', form);
  let cur = 0;

  const err = msg => { const e = $('.err', steps[cur]); e.textContent = msg; e.hidden = !msg; };
  const go = i => {
    cur = i;
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    bars.forEach((b, k) => b.classList.toggle('done', k <= i));
    form.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('legend', steps[i]).focus?.();
  };
  const weekday = v => new Date(v + 'T12:00').getDay();

  // Precompletare din linkuri: /programare/?serviciu=frane
  const pre = new URLSearchParams(location.search).get('serviciu');
  if (pre) $$('input[name=servicii]', form).forEach(c => { if (c.value === pre) c.checked = true; });

  date.min = isoDay(new Date());
  // Orele disponibile depind de zi: sâmbăta până la 13:00, duminica închis
  const syncTimes = () => {
    const open = HOURS[weekday(date.value)];
    times.forEach(t => {
      const h = parseInt(t.value, 10), ok = !!open && h >= open[0] && h < open[1];
      t.disabled = !ok;
      t.closest('.opt').hidden = !ok;
      if (!ok) t.checked = false;
    });
    err(date.value && !open ? M.sunday : '');
  };
  date.addEventListener('change', syncTimes);
  $$('[data-day]', form).forEach(b => b.addEventListener('click', () => {
    date.value = isoDay(new Date(Date.now() + b.dataset.day * 864e5));
    syncTimes();
  }));

  const check = i => {
    if (i === 0) return $$('input[name=servicii]:checked', form).length ? '' : M.service;
    if (i === 1) {
      if (!date.value) return M.date;
      if (!HOURS[weekday(date.value)]) return M.sunday;
      return $('input[name=ora]:checked', form) ? '' : M.time;
    }
    if (form.elements.nume.value.trim().length < 2) return M.name;
    return /^\+?\d{8,15}$/.test(form.elements.telefon.value.replace(/[\s\-().]/g, '')) ? '' : M.phone;
  };
  $$('[data-next]', form).forEach(b => b.addEventListener('click', () => { const m = check(cur); err(m); if (!m) go(cur + 1); }));
  $$('[data-back]', form).forEach(b => b.addEventListener('click', () => { err(''); go(cur - 1); }));

  const done = d => {
    const names = $$('input[name=servicii]:checked', form).map(c => c.nextElementSibling.textContent.trim()).join(', ');
    const when = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d.data + 'T12:00')) + ', ' + d.ora;
    const first = d.nume.trim().split(/\s+/)[0];
    const box = $('#booking-done');
    $('h2', box).textContent = box.dataset.title.replace('{n}', first);
    $('[data-sum]', box).textContent = `${names}. ${when}.`;
    const wa = $('[data-wa]', box);
    wa.href = wa.href.split('?')[0] + '?text=' + encodeURIComponent(M.wa.replace('{n}', d.nume.trim()).replace('{s}', names).replace('{w}', when) + (d.masina ? ` (${d.masina})` : ''));
    form.hidden = true;
    box.hidden = false;
    box.focus();
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const m = check(2); err(m); if (m) return;
    const fd = new FormData(form);
    const data = {
      servicii: fd.getAll('servicii'), data: fd.get('data'), ora: fd.get('ora'),
      nume: fd.get('nume'), telefon: fd.get('telefon'), masina: fd.get('masina'), mesaj: fd.get('mesaj'),
      limba: lang, pagina: location.href,
    };
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      // Fără endpoint (prototip) doar simulăm trimiterea
      if (form.dataset.endpoint) {
        const r = await fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(r.status);
      }
      // Conversia pentru Google Ads / GA4, doar după răspunsul OK (cerința din TRACKING-pentru-programatori.md)
      (window.dataLayer = window.dataLayer || []).push({ event: 'form_submit_success', form_name: 'programare' });
      done(data);
    } catch {
      err(M.fail);
      btn.disabled = false;
    }
  });
})();
