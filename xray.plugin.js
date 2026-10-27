/**
 * @name XRay
 * @description Panneau façon « X-Ray » : en pause dans le lecteur, le casting de l'épisode ou du film (photos, personnages, invités) et ses infos (réalisation, scénario, note, durée) s'affichent sur le côté. Compatible avec tous les catalogues (Cinemeta, TMDB, AIOStreams, Kitsu…). Données TMDB (clé gratuite à renseigner dans les options). Touche X pour afficher / masquer.
 * @version 1.3.3
 * @author Tipapoute
 * @updateUrl https://raw.githubusercontent.com/Tipapoute/xray-dbxi/main/xray.plugin.js
 * @source https://github.com/Tipapoute/xray-dbxi
 * @license MIT
 */

(function () {
  'use strict';

  const API = typeof StremioEnhancedAPI !== 'undefined' ? StremioEnhancedAPI : null;
  const log = (...a) => console.log('[XRay]', ...a);
  const IMG = 'https://image.tmdb.org/t/p/';

  // ── Settings ───────────────────────────────────────────────────────────────

  const SCHEMA = [
    { key: 'tmdbKey', type: 'input', label: 'Clé API TMDB', description: 'Gratuite : themoviedb.org → Paramètres → API → Create (type Developer). Sans clé, le panneau reste vide.', defaultValue: '', group: 'X-Ray' },
    { key: 'onPause', type: 'toggle', label: 'Afficher automatiquement en pause', description: 'Le panneau apparaît quand tu mets en pause et disparaît à la reprise. La touche X l\'affiche à tout moment.', defaultValue: true, group: 'X-Ray' },
    { key: 'lang', type: 'select', label: 'Langue des infos', description: 'Langue des résumés et noms de personnages (TMDB).', defaultValue: 'fr-FR', options: [{ label: 'Français', value: 'fr-FR' }, { label: 'English', value: 'en-US' }], group: 'X-Ray' },
  ];
  const settings = { tmdbKey: '', onPause: true, lang: 'fr-FR' };

  async function loadSettings() {
    if (!API) return;
    try { await API.registerSettings(SCHEMA); } catch (_) {}
    try {
      for (const o of SCHEMA) {
        const v = await API.getSetting(o.key);
        if (v !== null && v !== undefined && v !== '') settings[o.key] = o.type === 'toggle' ? (v === true || v === 'true') : String(v).trim();
      }
    } catch (_) {}
    try { API.onSettingsSaved((s) => { for (const o of SCHEMA) if (s && o.key in s) settings[o.key] = o.type === 'toggle' ? (s[o.key] === true || s[o.key] === 'true') : String(s[o.key]).trim(); cache.clear(); loadedKey = ''; }); } catch (_) {}
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  const CSS = `
.xray-bg{position:absolute;inset:0;z-index:auto;pointer-events:none;opacity:0;transition:opacity .3s ease;
  background:linear-gradient(90deg,rgba(8,6,7,.94) 0%,rgba(8,6,7,.86) 22%,rgba(8,6,7,.6) 42%,rgba(8,6,7,.3) 62%,rgba(8,6,7,.1) 82%,rgba(8,6,7,0) 100%)}
.xray-bg.on{opacity:1}
.xray{position:absolute;top:0;left:0;bottom:0;width:min(27rem,44vw);z-index:auto;display:flex;flex-direction:column;
  padding:6.2rem 0 7.5rem;color:var(--dx-text,#f4f4f5);font-family:inherit;
  opacity:0;transform:translateX(-24px);pointer-events:none;transition:opacity .22s ease,transform .25s cubic-bezier(.2,.9,.3,1)}
.xray.on{opacity:1;transform:none}
.xray.on .xray-in{pointer-events:auto}
.xray-in{overflow-y:auto;overflow-x:hidden;padding:0 1.6rem 0 2rem;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.12) transparent}
.xray-in::-webkit-scrollbar{width:5px}.xray-in::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:4px}
.xray-k{font-size:.72rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--dx-accent,#ff6a2a);margin:0 0 .35rem}
.xray-t{font-size:1.45rem;font-weight:800;line-height:1.15;letter-spacing:-.01em;margin:0 0 .25rem}
.xray-e{font-size:.95rem;color:var(--dx-text-2,#c4c4cc);margin:0 0 .6rem}
.xray-m{display:flex;flex-wrap:wrap;gap:.35rem .7rem;font-size:.8rem;color:var(--dx-text-3,#8a8a96);margin:0 0 .9rem;font-variant-numeric:tabular-nums}
.xray-m b{color:#ffc53d;font-weight:700}
.xray-d{font-size:.86rem;line-height:1.5;color:var(--dx-text-2,#c4c4cc);margin:0 0 1rem}
.xray-crew{font-size:.82rem;color:var(--dx-text-2,#c4c4cc);margin:0 0 1.1rem;line-height:1.5}
.xray-crew span{color:var(--dx-text-3,#8a8a96)}
.xray-h{font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--dx-text-3,#8a8a96);margin:1.1rem 0 .55rem}
.xray-c{display:flex;align-items:center;gap:.75rem;padding:.4rem .5rem;margin:0 -.5rem;border-radius:9px;cursor:pointer;transition:background-color .15s}
.xray-c:hover,.xray-c:focus-visible{background:rgba(255,255,255,.07);outline:none}
.xray-c img,.xray-c i{width:2.9rem;height:2.9rem;border-radius:50%;object-fit:cover;flex:none;background:var(--dx-surface-2,#212128);display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;color:var(--dx-text-3,#8a8a96)}
.xray-c b{display:block;font-size:.9rem;font-weight:700;line-height:1.2}
.xray-c small{display:block;font-size:.78rem;color:var(--dx-text-3,#8a8a96);margin-top:.1rem}
.xray-note{font-size:.76rem;line-height:1.45;color:#ffc53d;opacity:.85;margin:0 0 .8rem;padding:.45rem .6rem;border-left:2px solid #ffc53d;background:rgba(255,197,61,.07);border-radius:0 6px 6px 0}
.xray-empty{font-size:.86rem;color:var(--dx-text-3,#8a8a96);line-height:1.5}
.xray-hint{font-size:.72rem;color:var(--dx-text-3,#8a8a96);letter-spacing:.06em;margin:1.4rem 0 0;opacity:.7}
`;

  function injectCSS() {
    if (document.getElementById('xray-style')) return;
    const s = document.createElement('style'); s.id = 'xray-style'; s.textContent = CSS; document.head.append(s);
  }

  // ── Route → what is playing ────────────────────────────────────────────────

  function current() {
    if (!/^#\/player\//.test(location.hash)) return null;
    const parts = location.hash.slice(2).split('/').slice(1).map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } });
    // Stremio: player/{stream}/{streamTransportUrl}/{metaTransportUrl}/{type}/{id}/{videoId}
    const n = parts.length;
    if (n < 3) return null;
    const videoId = parts[n - 1].replace(/[?#].*$/, ''), id = parts[n - 2].replace(/[?#].*$/, ''), type = parts[n - 3];
    const metaUrl = (n >= 6 ? parts[2] : parts.find((p) => /^https?:\/\/.+manifest\.json/.test(p))) || '';
    const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let season = null, episode = null;
    // "id:S:E" (Cinemeta, TMDB, most catalogs)
    let m = new RegExp('^' + rx(id) + ':(\\d+):(\\d+)$').exec(videoId);
    if (m) { season = +m[1]; episode = +m[2]; }
    // "id:E" (Kitsu and other absolute-numbered catalogs): episode only, the season comes from elsewhere
    else if ((m = new RegExp('^' + rx(id) + ':(\\d+)$').exec(videoId))) episode = +m[1];
    // Stremio's own player title reads "Title - Episode name (4x37)": the most reliable source
    const t = document.querySelector('[class*="player-container"] [class*="player-title"]');
    const titleText = (t && t.textContent.trim()) || '';
    const tm = /\((\d+)\s*[x×]\s*(\d+)\)\s*$/i.exec(titleText);
    if (tm) { season = +tm[1]; episode = +tm[2]; }
    const name = titleText.replace(/\s*\(\d+\s*[x×]\s*\d+\)\s*$/i, '').split(' - ')[0].trim();
    return { type, id, videoId, metaUrl, season, episode, name, key: `${id}|${videoId}` };
  }

  // ── TMDB ───────────────────────────────────────────────────────────────────

  const cache = new Map();

  async function tmdb(path, params = {}) {
    const u = new URL('https://api.themoviedb.org/3' + path);
    u.searchParams.set('api_key', settings.tmdbKey);
    u.searchParams.set('language', settings.lang);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return r.json();
  }

  // The catalog addon that is playing the title knows its name, year, ids and episode list
  async function catalogMeta(cur) {
    if (!cur.metaUrl || !cur.type || !cur.id) return null;
    try {
      const base = cur.metaUrl.replace(/\/manifest\.json.*$/, '');
      const r = await fetch(`${base}/meta/${encodeURIComponent(cur.type)}/${encodeURIComponent(cur.id)}.json`);
      if (!r.ok) return null;
      return (await r.json()).meta || null;
    } catch (_) { return null; }
  }

  // Search TMDB by name, simplifying the title step by step ("One Piece Kaï" → "One Piece")
  async function searchTitle(name, year, isTv) {
    const variants = [];
    const push = (s) => { s = s.trim(); if (s && !variants.includes(s)) variants.push(s); };
    push(name);
    push(name.replace(/\s*[([].*?[)\]]\s*/g, ' '));            // drop (…) / […]
    push(name.split(/\s*[:\-–|]\s*/)[0]);                        // drop subtitle after : - |
    push(name.replace(/\b(ka[iï]|kai|vostfr|vf|french|multi|uncut|remaster(?:ed)?|edition|pace)\b/gi, ' ').replace(/\s+/g, ' '));
    const words = name.split(/\s+/);
    if (words.length > 2) push(words.slice(0, 2).join(' '));
    for (const q of variants) {
      for (const y of year ? [year, null] : [null]) {
        try {
          const s = await tmdb(isTv ? '/search/tv' : '/search/movie', { query: q, ...(y ? (isTv ? { first_air_date_year: y } : { year: y }) : {}) });
          if (s.results?.[0]) return { tmdbId: s.results[0].id, isTv, approx: true };
        } catch (_) {}
      }
    }
    return null;
  }

  // → { tmdbId, isTv, season, episode } from whatever ids the catalog gave us
  async function resolve(cur) {
    let season = cur.season, episode = cur.episode;
    const isTvType = /series|tv|anime/i.test(cur.type);
    const tryFind = async (imdb) => {
      const f = await tmdb(`/find/${imdb}`, { external_source: 'imdb_id' });
      if (f.tv_results?.[0]) return { tmdbId: f.tv_results[0].id, isTv: true };
      if (f.tv_episode_results?.[0]) {
        const e = f.tv_episode_results[0];
        if (season == null) { season = e.season_number; episode = e.episode_number; }
        return { tmdbId: e.show_id, isTv: true };
      }
      if (f.movie_results?.[0]) return { tmdbId: f.movie_results[0].id, isTv: false };
      return null;
    };
    let hit = null;
    // 1) ids we can read directly
    const direct = /^tmdb:(\d+)/.exec(cur.id);
    if (direct) hit = { tmdbId: +direct[1], isTv: isTvType };
    if (!hit && /^tt\d+/.test(cur.id)) hit = await tryFind(cur.id.split(':')[0]);
    if (!hit && /^tt\d+$/.test(cur.videoId) && cur.videoId !== cur.id) hit = await tryFind(cur.videoId);
    // 2) ask the catalog addon (name, year, imdb id, episode numbers)
    if (!hit || (season == null && isTvType)) {
      const meta = await catalogMeta(cur);
      if (meta) {
        if (!hit && meta.imdb_id) hit = await tryFind(meta.imdb_id);
        if (!hit && meta.name) hit = await searchTitle(meta.name, String(meta.year || meta.releaseInfo || '').match(/\d{4}/)?.[0], isTvType);
        if (season == null && Array.isArray(meta.videos)) {
          const v = meta.videos.find((x) => x.id === cur.videoId);
          if (v && v.season != null) { season = v.season; episode = v.episode ?? v.number; }
        }
      }
    }
    // 3) last resort: the title the player shows
    if (!hit && cur.name) hit = await searchTitle(cur.name, null, isTvType);
    if (!hit) return null;
    return { ...hit, season, episode };
  }

  async function lookup(cur) {
    const key = `${cur.key}:${settings.lang}`;
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const r = await resolve(cur);
      if (!r) return null;
      if (r.isTv) {
        const [show, ep] = await Promise.all([
          tmdb(`/tv/${r.tmdbId}`, {}),
          r.season != null && !r.approx ? tmdb(`/tv/${r.tmdbId}/season/${r.season}/episode/${r.episode}`, { append_to_response: 'credits' }).catch(() => null) : Promise.resolve(null),
        ]);
        const aggregate = ep ? null : await tmdb(`/tv/${r.tmdbId}/aggregate_credits`).catch(() => null);
        return {
          kind: 'episode', title: show.name, year: (show.first_air_date || '').slice(0, 4),
          episode: ep ? `S${r.season} · E${r.episode} — ${ep.name}` : (r.season != null ? `S${r.season} · E${r.episode}` : ''),
          approx: !!r.approx, noEpisode: !ep && r.season != null && !r.approx,
          overview: ep?.overview || show.overview || '', rating: ep?.vote_average || show.vote_average, runtime: ep?.runtime || show.episode_run_time?.[0],
          date: ep?.air_date, genres: (show.genres || []).map((g) => g.name),
          crew: ep?.crew || [], cast: ep?.credits?.cast || (aggregate?.cast || []).map((c) => ({ ...c, character: c.roles?.[0]?.character })), guests: ep?.guest_stars || [],
        };
      }
      const m = await tmdb(`/movie/${r.tmdbId}`, { append_to_response: 'credits' });
      return {
        kind: 'movie', approx: !!r.approx, title: m.title, year: (m.release_date || '').slice(0, 4), episode: '', overview: m.overview || '',
        rating: m.vote_average, runtime: m.runtime, date: m.release_date, genres: (m.genres || []).map((g) => g.name),
        crew: m.credits?.crew || [], cast: m.credits?.cast || [], guests: [],
      };
    })();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  }

  // ── Panel ──────────────────────────────────────────────────────────────────

  let panel = null, shown = false, loadedKey = '';

  function esc(t) { const d = document.createElement('span'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }

  function person(c) {
    const photo = c.profile_path ? `<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="">` : `<i>${esc((c.name || '?').slice(0, 1))}</i>`;
    return `<div class="xray-c" tabindex="0" data-name="${esc(c.name)}">${photo}<div><b>${esc(c.name)}</b><small>${esc(c.character || c.job || '')}</small></div></div>`;
  }

  function render(data) {
    const el = ensurePanel();
    const box = el.querySelector('.xray-in');
    if (!settings.tmdbKey) {
      box.innerHTML = `<p class="xray-k">X-Ray</p><p class="xray-empty">Renseigne une clé TMDB (gratuite) dans les options du plugin XRay : Réglages → dx.bi → Plugins → engrenage de XRay.</p>`;
      return;
    }
    if (!data) {
      const c = current();
      box.innerHTML = `<p class="xray-k">X-Ray</p><p class="xray-empty">Aucune information trouvée sur TMDB pour ce titre.<br><br><span style="opacity:.6">id : ${esc(c?.id)} · vidéo : ${esc(c?.videoId)}</span></p>`;
      return;
    }
    const crewOf = (jobs) => [...new Map(data.crew.filter((c) => jobs.includes(c.job)).map((c) => [c.name, c])).values()].map((c) => esc(c.name)).join(', ');
    const dir = crewOf(['Director']), wri = crewOf(['Writer', 'Screenplay', 'Story', 'Teleplay']);
    const meta = [];
    if (data.rating) meta.push(`<b>★ ${(+data.rating).toFixed(1)}</b>`);
    if (data.runtime) meta.push(`${data.runtime} min`);
    if (data.date) meta.push(new Date(data.date).toLocaleDateString(settings.lang, { day: 'numeric', month: 'short', year: 'numeric' }));
    if (data.genres?.length) meta.push(esc(data.genres.slice(0, 3).join(' · ')));
    const mainCast = data.cast.slice(0, 12), guests = data.guests.slice(0, 10);
    box.innerHTML = `
      <p class="xray-k">${data.kind === 'episode' ? 'Épisode' : 'Film'}</p>
      <h2 class="xray-t">${esc(data.title)}${data.year ? ` <span style="font-weight:500;color:var(--dx-text-3,#8a8a96)">(${esc(data.year)})</span>` : ''}</h2>
      ${data.episode ? `<p class="xray-e">${esc(data.episode)}</p>` : ''}
      ${data.approx ? `<p class="xray-note">Titre reconnu par son nom, pas par son identifiant : seules les informations générales ${data.kind === 'episode' ? 'de la série' : 'du film'} sont affichées.</p>` : ''}
      ${data.noEpisode ? `<p class="xray-note">Épisode non référencé sur TMDB sous ce numéro : distribution de la série.</p>` : ''}
      <p class="xray-m">${meta.join('<span>·</span>')}</p>
      ${data.overview ? `<p class="xray-d">${esc(data.overview)}</p>` : ''}
      ${dir || wri ? `<p class="xray-crew">${dir ? `<span>Réalisation</span> ${dir}` : ''}${dir && wri ? '<br>' : ''}${wri ? `<span>Scénario</span> ${wri}` : ''}</p>` : ''}
      ${mainCast.length ? `<p class="xray-h">Distribution</p>${mainCast.map(person).join('')}` : ''}
      ${guests.length ? `<p class="xray-h">Invités de l'épisode</p>${guests.map(person).join('')}` : ''}
      ${!mainCast.length && !guests.length ? `<p class="xray-empty">Pas de distribution renseignée.</p>` : ''}
      <p class="xray-hint">Touche X : afficher / masquer</p>`;
  }

  function ensurePanel() {
    if (panel && panel.isConnected) return panel;
    injectCSS();
    panel = document.createElement('aside');
    panel.className = 'xray';
    panel.innerHTML = `<div class="xray-in"></div>`;
    panel.addEventListener('click', (e) => {
      const c = e.target.closest('.xray-c');
      if (!c) return;
      const name = c.getAttribute('data-name');
      if (name) location.hash = '#/search?search=' + encodeURIComponent(name);
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('xray-c')) e.target.click(); });
    const host = document.querySelector('[class*="player-container"]') || document.body;
    let bg = host.querySelector(':scope > .xray-bg');
    if (!bg) { bg = document.createElement('div'); bg.className = 'xray-bg'; }
    // The player's first layer is the video (it carries no specific class name); our two elements go
    // right after it, so every later layer (nav bar, control bar, menus, subtitles) paints above them
    const videoLayer = [...host.children].find((c) => c.querySelector('video')) || host.firstElementChild;
    if (videoLayer) { videoLayer.after(bg); bg.after(panel); }
    else { host.prepend(bg); bg.after(panel); }
    return panel;
  }

  async function show() {
    const cur = current();
    if (!cur) return;
    const el = ensurePanel();
    el.classList.add('on');
    el.previousElementSibling?.classList.add('on');
    shown = true;
    const key = `${cur.key}:${settings.lang}`;
    if (loadedKey === key) return;
    loadedKey = key;
    if (!settings.tmdbKey) { render(null); return; }
    el.querySelector('.xray-in').innerHTML = `<p class="xray-k">X-Ray</p><p class="xray-empty">Chargement…</p>`;
    try { render(await lookup(cur)); }
    catch (err) { log(err); el.querySelector('.xray-in').innerHTML = `<p class="xray-k">X-Ray</p><p class="xray-empty">TMDB ne répond pas (${esc(err.message)}). Vérifie la clé dans les options.</p>`; loadedKey = ''; }
  }

  function hide() { if (panel) { panel.classList.remove('on'); panel.previousElementSibling?.classList.remove('on'); } shown = false; }

  // ── Hooks: video pause/play, keyboard, route changes ───────────────────────

  let video = null;
  const onPause = () => { if (settings.onPause && current() && !video.seeking && !video.ended) show(); };
  const onPlay = () => { if (settings.onPause) hide(); };

  function bindVideo() {
    const v = document.querySelector('[class*="player-container"] video');
    if (v === video) return;
    if (video) { video.removeEventListener('pause', onPause); video.removeEventListener('play', onPlay); }
    video = v;
    if (video) { video.addEventListener('pause', onPause); video.addEventListener('play', onPlay); }
  }

  document.addEventListener('keydown', (e) => {
    if (!current()) return;
    if (e.key !== 'x' && e.key !== 'X') return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
    e.preventDefault(); e.stopPropagation();
    shown ? hide() : show();
  }, true);

  let lastHash = '';
  setInterval(() => {
    if (location.hash !== lastHash) { lastHash = location.hash; loadedKey = ''; hide(); if (panel) { panel.previousElementSibling?.classList.contains('xray-bg') && panel.previousElementSibling.remove(); panel.remove(); panel = null; } }
    if (current()) bindVideo();
  }, 400);

  injectCSS();
  loadSettings();
})();
