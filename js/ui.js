// DOM overlay: dukaan (shop), action bar, countdown, stats, toasts.
const $ = (s) => document.querySelector(s);
const fmt = (n) => '₹' + n.toLocaleString('en-IN');

export class UI {
  constructor(catalog, handlers) {
    this.catalog = catalog;
    this.h = handlers;
    this.cards = {};
    this.busy = false;
    this.selected = null;
    this._buildJhalar();
    this._buildShop();
    $('#sound-btn').addEventListener('click', () => {
      const on = $('#sound-btn').getAttribute('aria-pressed') !== 'true';
      $('#sound-btn').setAttribute('aria-pressed', String(on));
      this.h.onSound(on);
    });
    $('#ambient-btn').addEventListener('click', () => {
      const on = $('#ambient-btn').getAttribute('aria-pressed') !== 'true';
      $('#ambient-btn').setAttribute('aria-pressed', String(on));
      this.h.onAmbient(on);
    });
    $('#view-btn').addEventListener('click', () => this.h.onResetView());
    for (const b of document.querySelectorAll('#where [data-spot]')) b.addEventListener('click', () => this.h.onSpot(b.dataset.spot));
    $('#tour-btn').addEventListener('click', () => this.h.onTour());
    $('#enter-btn').addEventListener('click', () => this.h.onEnter());
  }

  _buildJhalar() {
    const wrap = $('#jhalar');
    const n = Math.max(24, Math.round(window.innerWidth / 34));
    const cols = ['#ff3b3b', '#3bff6a', '#3b8bff', '#ffd83b', '#ff3bd8', '#3bfff2', '#ff8a1e'];
    const frag = document.createDocumentFragment();
    const swags = Math.max(3, Math.round(n / 8));
    for (let i = 0; i < n; i++) {
      const b = document.createElement('i');
      const u = (i / n) * swags;
      const f = u - Math.floor(u);
      b.style.left = `${((i + 0.5) / n) * 100}%`;
      b.style.top = `${4 + Math.sin(f * Math.PI) * 16}px`;
      b.style.setProperty('--c', cols[i % cols.length]);
      b.style.animationDelay = `${(i % 7) * 0.18}s`;
      frag.appendChild(b);
    }
    wrap.appendChild(frag);
  }

  _buildShop() {
    const list = $('#shop-list');
    for (const item of this.catalog) {
      const card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.setAttribute('aria-label', `${item.name}, ${fmt(item.price)}, free here`);
      card.innerHTML = `
        <div class="thumb"><img alt="" /></div>
        <div class="info">
          <div class="nm">${item.name}</div>
          <div class="hi">${item.hindi}</div>
          <div class="price"><s>${fmt(item.price)}</s><span class="free">FREE</span></div>
          <div class="unit">${item.unit}</div>
        </div>`;
      card.title = item.desc;
      card.addEventListener('click', () => { if (!this.busy) this.h.onSelect(item); });
      list.appendChild(card);
      this.cards[item.id] = card;
    }
  }

  setThumb(id, url) {
    const img = this.cards[id]?.querySelector('img');
    if (img) img.src = url;
  }

  setLoading(text, done = false) {
    const b = $('#enter-btn');
    b.textContent = text;
    b.disabled = !done;
  }

  hideIntro() {
    $('#intro').classList.add('gone');
    document.body.classList.add('started');
  }

  select(item) {
    this.selected = item;
    for (const [id, c] of Object.entries(this.cards)) c.classList.toggle('active', id === item?.id);
  }

  setSpot(key) {
    for (const b of document.querySelectorAll('#where [data-spot]')) b.setAttribute('aria-pressed', String(b.dataset.spot === key));
  }

  setBusy(b) {
    this.busy = b;
    document.body.classList.toggle('busy', b);
  }

  countdown(text, big = false) {
    const el = $('#countdown');
    el.textContent = text;
    el.className = '';
    void el.offsetWidth;
    el.className = big ? 'show boom' : 'show';
  }

  toast(html, ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 600);
  }

  /* --------------------------------------- money saved / pollution avoided */

  updateStats(all, session, initial = false) {
    const from = this.shown || { saved: 0, smoke: 0 };
    const to = { saved: all.saved, smoke: all.smoke };
    const draw = (k) => {
      $('#m-saved').textContent = fmt(Math.round(from.saved + (to.saved - from.saved) * k));
      $('#m-smoke').textContent = fmtG(Math.round(from.smoke + (to.smoke - from.smoke) * k));
    };
    cancelAnimationFrame(this._raf);
    if (initial) draw(1);
    else {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1000);
        draw(1 - Math.pow(1 - k, 3));
        if (k < 1) this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
      for (const el of document.querySelectorAll('#meter .chip')) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    }
    this.shown = to;
  }

  /** Floating "+₹60" over the spot where the cracker went off. */
  popAt(x, y, html) {
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = html;
    $('#pops').appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

function fmtG(g) { return g >= 1000 ? `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg` : `${g} g`; }
