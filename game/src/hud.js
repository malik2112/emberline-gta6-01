// EMBERLINE HUD — DOM overlay: health, cash, stars, minimap, feed, menu.
export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.feed = [];
    this._build();
  }

  _el(tag, id, parent, text = '') {
    const e = document.createElement(tag);
    if (id) e.id = id;
    e.textContent = text;
    (parent ?? this.root).appendChild(e);
    return e;
  }

  _build() {
    const top = this._el('div', 'hud-top');
    this.starsEl = this._el('div', 'stars', top, '☆☆☆☆☆');
    this.cashEl = this._el('div', 'cash', top, '$120');
    const bl = this._el('div', 'hud-bl');
    this.healthWrap = this._el('div', 'health-wrap', bl);
    this.healthBar = this._el('div', 'health-bar', this.healthWrap);
    this.healthText = this._el('div', 'health-text', bl, '100');
    this.ammoEl = this._el('div', 'ammo', bl, '12 / 48');
    const br = this._el('div', 'hud-br');
    this.map = document.createElement('canvas');
    this.map.id = 'minimap';
    this.map.width = 168;
    this.map.height = 168;
    br.appendChild(this.map);
    this.mapCtx = this.map.getContext('2d');
    const ml = this._el('div', 'hud-ml');
    this.missionEl = this._el('div', 'mission', ml);
    this.objectiveEl = this._el('div', 'objective', ml);
    this.feedEl = this._el('div', 'feed', ml);
    this.bannerEl = this._el('div', 'banner');
    this.bannerEl.style.display = 'none';
    this.cross = this._el('div', 'crosshair', null, '+');
    this.menu = document.getElementById('menu');
    this.menuTitle = document.getElementById('menu-title');
    this.menuSub = document.getElementById('menu-sub');
    this.menuBtn = document.getElementById('menu-btn');
  }

  setHealth(h) {
    this.healthBar.style.width = `${Math.max(0, h)}%`;
    this.healthBar.style.background = h > 50 ? '#3aa655' : h > 25 ? '#d8a22e' : '#d83a2e';
    this.healthText.textContent = `${Math.round(h)} HP`;
  }

  setCash(n) { this.cashEl.textContent = `$${n.toLocaleString('en-US')}`; }

  setAmmo(a, r) { this.ammoEl.textContent = `${a} / ${r}`; }

  setStars(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.style.color = n === 0 ? '#cfc4b8' : n < 3 ? '#ffb020' : '#ff3b30';
  }

  setMission(title, brief) {
    this.missionEl.textContent = title;
    this.missionEl.title = brief;
  }

  setObjective(text) { this.objectiveEl.textContent = `◆ ${text}`; }

  message(text) {
    this.feed.unshift(text);
    this.feed = this.feed.slice(0, 4);
    this.feedEl.innerHTML = this.feed.map((f) => `<div>${f}</div>`).join('');
    window.clearTimeout(this._feedT);
    this._feedT = window.setTimeout(() => { this.feedEl.innerHTML = ''; this.feed = []; }, 9000);
  }

  banner(text, ms = 2600) {
    this.bannerEl.textContent = text;
    this.bannerEl.style.display = 'block';
    window.clearTimeout(this._banT);
    this._banT = window.setTimeout(() => { this.bannerEl.style.display = 'none'; }, ms);
  }

  showMenu(title, sub, btn) {
    this.menu.style.display = 'flex';
    this.menuTitle.textContent = title;
    this.menuSub.textContent = sub;
    this.menuBtn.textContent = btn;
  }

  hideMenu() { this.menu.style.display = 'none'; }

  // Top-down minimap: roads, water, pier, player, marker, cops.
  drawMinimap(px, pz, heading, marker, cops, vehicles) {
    const c = this.mapCtx;
    const S = 168;
    const half = 200;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    c.fillStyle = '#241d2e';
    c.fillRect(0, 0, S, S);
    c.fillStyle = '#274b63';
    c.fillRect(S * 0.82, 0, S * 0.18, S);           // water east
    c.strokeStyle = '#3a3340';
    c.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      const [ax] = toMap(i * 46, 0);
      c.beginPath(); c.moveTo(ax, 0); c.lineTo(ax, S); c.stroke();
      const [, ay] = toMap(0, i * 46);
      c.beginPath(); c.moveTo(0, ay); c.lineTo(S, ay); c.stroke();
    }
    c.fillStyle = '#6b4a2f';
    const [pxx, pzz] = toMap(190, 40);
    c.fillRect(pxx, pzz - 3, S * 0.16, 6);           // pier
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      c.fillStyle = '#ffb020';
      c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffb020';
      c.beginPath(); c.arc(mx, my, 9, 0, Math.PI * 2); c.stroke();
    }
    for (const v of vehicles) {
      const [vx, vy] = toMap(v.x, v.z);
      c.fillStyle = '#9aa0b0';
      c.fillRect(vx - 2, vy - 2, 4, 4);
    }
    for (const cop of cops) {
      const [cx, cy] = toMap(cop.group.position.x, cop.group.position.z);
      c.fillStyle = '#3b82f6';
      c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();
    }
    const [ux, uy] = toMap(px, pz);
    c.save();
    c.translate(ux, uy);
    c.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * 0 + heading);
    c.fillStyle = '#ff5a2e';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }
}
