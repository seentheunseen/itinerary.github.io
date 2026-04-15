import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { DEFAULT } from "./data.js";

// ─── STATE ──────────────────────────────────────────────────────────────────
let db = null;
let dbRef = null;
let data = JSON.parse(JSON.stringify(DEFAULT));
let state = {
  tab: "itinerary",
  dayFilter: null,
  modal: null,        // { type, payload }
  foodFilter: "all",
  foodSearch: "",
  mapView: false,
  mapInstance: null,
  flash: "",
  theme: localStorage.getItem("theme") || "dark",
  connected: false,
  configured: !!localStorage.getItem("fb_config"),
  fbConfig: JSON.parse(localStorage.getItem("fb_config") || "null"),
};

// ─── FIREBASE ───────────────────────────────────────────────────────────────
function initFirebase(config) {
  try {
    const app = initializeApp(config);
    db = getDatabase(app);
    dbRef = ref(db, "kaohsiung-trip");
    onValue(dbRef, snap => {
      if (snap.exists()) {
        data = snap.val();
      } else {
        save(data);
      }
      state.connected = true;
      render();
    }, err => {
      flashMsg("⚠ " + err.message, true);
    });
  } catch(e) {
    flashMsg("⚠ Firebase error: " + e.message, true);
  }
}

function save(d) {
  data = d;
  if (db && dbRef) {
    set(dbRef, d).then(() => flashMsg("✓ Synced")).catch(e => flashMsg("⚠ " + e.message, true));
  } else {
    flashMsg("No database connected", true);
  }
  render();
}

if (state.fbConfig) { initFirebase(state.fbConfig); }

// ─── UTILS ──────────────────────────────────────────────────────────────────
let flashTimer;
function flashMsg(msg, err=false) {
  state.flash = msg; state.flashErr = !!err;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(()=>{ state.flash=""; render(); }, 2500);
  render();
}

function uid() { return Math.random().toString(36).slice(2); }

function getDayMapUrl(day) {
  const stops = day.stops.filter(s => s.place && s.place.trim() !== "");
  if (stops.length === 0) return "#";
  const places = stops.map(s => encodeURIComponent(s.place + " Kaohsiung"));
  if (places.length === 1) return `https://www.google.com/maps/search/?api=1&query=${places[0]}`;
  const origin = places[0];
  const destination = places[places.length - 1];
  const waypoints = places.slice(1, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? '&waypoints=' + waypoints : ''}&travelmode=transit`;
}

function getAllFoodMapUrl(foodList) {
  if (!foodList || foodList.length === 0) return "#";
  const places = foodList.slice(0, 10).map(f => encodeURIComponent(f.name + " Kaohsiung"));
  if (places.length === 1) return `https://www.google.com/maps/search/?api=1&query=${places[0]}`;
  const origin = places[0];
  const destination = places[places.length - 1];
  const waypoints = places.slice(1, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? '&waypoints=' + waypoints : ''}&travelmode=walking`;
}

function initFoodMap(foodList) {
  if (state.mapInstance) {
    state.mapInstance.remove();
    state.mapInstance = null;
  }

  const mapEl = document.getElementById("food-map");
  if (!mapEl) return;

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  const map = L.map('food-map').setView([22.6273, 120.3014], 13);
  state.mapInstance = map;

  const isLight = document.body.classList.contains("light-mode");
  const tileUrl = isLight
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap' }).addTo(map);

  const markers = [];
  foodList.forEach(f => {
    let lat = f.lat, lng = f.lng;
    if (!lat || !lng) {
      const def = DEFAULT.food.find(df => df.name === f.name || df.id === f.id);
      if (def) { lat = def.lat; lng = def.lng; }
    }
    if (lat && lng) {
      L.marker([lat, lng]).addTo(map)
        .bindPopup(`<div style="color:#222;min-width:150px"><b>${f.name}</b><br>${f.tag}<br><a href="${f.maps}" target="_blank" style="color:var(--accent);font-weight:bold;text-decoration:none;display:inline-block;margin-top:5px">📍 Open in Google Maps</a></div>`);
      markers.push([lat, lng]);
    }
  });

  if (markers.length > 0) {
    map.fitBounds(markers, {padding: [40, 40]});
  }

  // "My Location" button
  const locateBtn = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function() {
      const btn = L.DomUtil.create('button', '');
      btn.title = 'Show my location';
      btn.style.cssText = 'width:34px;height:34px;background:var(--card,#1e2235);border:2px solid var(--accent,#7c6af7);border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
      btn.innerHTML = '📍';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', function() {
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser.');
          return;
        }
        btn.innerHTML = '⏳';
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            const { latitude: lat, longitude: lng, accuracy } = pos.coords;
            if (map._userLocationMarker) {
              map.removeLayer(map._userLocationMarker);
              map.removeLayer(map._userLocationCircle);
            }
            const userIcon = L.divIcon({
              className: '',
              html: '<div style="width:14px;height:14px;background:#4a90e2;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(74,144,226,0.35);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            map._userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
              .addTo(map)
              .bindPopup('<b>You are here</b>');
            map._userLocationCircle = L.circle([lat, lng], { radius: accuracy, color: '#4a90e2', fillColor: '#4a90e2', fillOpacity: 0.1, weight: 1 })
              .addTo(map);
            map.setView([lat, lng], 15);
            btn.innerHTML = '📍';
            btn.disabled = false;
          },
          function(err) {
            alert('Unable to retrieve your location: ' + err.message);
            btn.innerHTML = '📍';
            btn.disabled = false;
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      return btn;
    }
  });
  map.addControl(new locateBtn());
}

function getCountdown() {
  const tripStart = new Date("2025-07-24T00:00:00");
  const tripEnd = new Date("2025-07-28T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today > tripEnd) return "";
  if (today >= tripStart) return "Trip is live! ✈️";
  const days = Math.round((tripStart - today) / (1000 * 60 * 60 * 24));
  return `${days} days until departure 🛫`;
}

// ─── RENDER ─────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById("app");
  document.body.className = state.theme === "light" ? "light-mode" : "";
  if (!state.configured) { app.innerHTML = setupScreen(); bindSetup(); return; }
  app.innerHTML = mainApp();
  bindAll();

  if (state.tab === "notes" && state.mapView) {
    const filter = state.foodFilter || "all";
    const search = (state.foodSearch || "").toLowerCase();
    let filtered = data.food || DEFAULT.food;
    if (filter !== "all") filtered = filtered.filter(p => p.category === filter);
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search) || p.tag.toLowerCase().includes(search));
    initFoodMap(filtered);
  }

  window.onscroll = () => {
    const btn = document.getElementById("scroll-top");
    if (btn) btn.style.display = window.scrollY > 300 ? "flex" : "none";
  };
}

// ─── SETUP SCREEN ───────────────────────────────────────────────────────────
function setupScreen() {
  return `
  <div class="setup-wrapper">
    <div class="setup">
      <button class="theme-toggle" id="setup-theme-toggle" style="top: -10px; right: 0px">
        ${state.theme === "light" ? "🌙" : "☀️"}
      </button>
      <div style="text-align:center;margin-bottom:32px">
        <div class="header-eyebrow">First Trip Together 💕</div>
        <h1 class="header-title" style="font-size: 2.2rem">Kaohsiung Trip</h1>
        <p style="color:var(--text-dim);font-size:.9rem;font-weight:300">July 24–28, 2025</p>
      </div>
      <div class="setup-card">
        <h2>Connect to Firebase</h2>
        <p>Sync edits between you and your GF in real time. Takes 2 minutes:</p>
        <ul class="steps">
          <li><span class="step-num">1</span> <span>Go to <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a></span></li>
          <li><span class="step-num">2</span> <span>Create a project → add a <b>Web app</b></span></li>
          <li><span class="step-num">3</span> <span>Enable <b>Realtime Database</b> (Test Mode)</span></li>
          <li><span class="step-num">4</span> <span>Copy <code>databaseURL</code> and <code>apiKey</code> below</span></li>
        </ul>
        <input id="fb-apikey" value="AIzaSyADGFHy9mzr1-9SajpWDL4lXBefZ9ZTFP4" placeholder="apiKey (e.g. AIzaSy...)" />
        <input id="fb-dburl" value="https://kaohsiung-itinerary-default-rtdb.asia-southeast1.firebasedatabase.app/" placeholder="databaseURL (e.g. https://xxx.firebaseio.com)" />
        <button class="setup-btn" id="fb-connect">Connect & Start →</button>
        <div class="setup-or">— or —</div>
        <button class="setup-link" id="demo-mode">Use demo mode (offline only)</button>
      </div>
    </div>
  </div>`;
}

function bindSetup() {
  const setupThemeBtn = document.getElementById("setup-theme-toggle");
  if (setupThemeBtn) setupThemeBtn.onclick = () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", state.theme);
    render();
  };

  document.getElementById("fb-connect").onclick = () => {
    const apiKey = document.getElementById("fb-apikey").value.trim();
    const databaseURL = document.getElementById("fb-dburl").value.trim();
    if (!apiKey || !databaseURL) { alert("Please fill in both fields."); return; }
    const config = { apiKey, databaseURL, authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };
    localStorage.setItem("fb_config", JSON.stringify(config));
    state.fbConfig = config;
    state.configured = true;
    initFirebase(config);
    render();
  };
  document.getElementById("demo-mode").onclick = () => {
    state.configured = true;
    state.connected = false;
    render();
  };
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
function mainApp() {
  const packDone = data.packing.filter(p=>p.done).length;
  const totalEst = data.budget.reduce((s,b)=>s+(+b.estimate||0),0);
  return `
  <div class="header">
    <a href="../index.html" class="back-link">← All trips</a>
    <button class="theme-toggle" id="theme-toggle" title="Toggle Theme">
      ${state.theme === "light" ? "🌙" : "☀️"}
    </button>
    <div class="header-eyebrow">First Trip Together 💕</div>
    <h1 class="header-title">Kaohsiung, Taiwan</h1>
    <p class="header-sub">July 24–28, 2025 · 5 Days</p>
    <div class="status-bar">
      ${getCountdown() ? `<span class="badge countdown">✨ ${getCountdown()}</span>` : ''}
      ${state.flash ? `<span class="badge ${state.flashErr?'red':'green'}">${state.flash}</span>` : ''}
      ${state.connected ? '<span class="badge green">🟢 Live</span>' : '<span class="badge">💾 Local</span>'}
      <span class="badge">🎒 ${packDone}/${data.packing.length}</span>
      <span class="badge accent">₱${totalEst.toLocaleString()}</span>
    </div>
  </div>

  <div class="tabs">
    ${[["itinerary","🗓 Itinerary"],["packing","🎒 Packing"],["budget","💰 Budget"],["notes","🍜 Food & Cafes"]]
      .map(([k,l])=>`<button class="tab-btn${state.tab===k?' active':''}" data-tab="${k}">${l}</button>`).join("")}
  </div>

  <div class="content">
    ${state.tab==="itinerary" ? renderItinerary() : ""}
    ${state.tab==="packing"   ? renderPacking()   : ""}
    ${state.tab==="budget"    ? renderBudget()     : ""}
    ${state.tab==="notes"     ? renderNotes()      : ""}
  </div>

  ${state.modal ? renderModal() : ""}

  <div id="scroll-top" onclick="window.scrollTo({top:0, behavior:'smooth'})">↑</div>

  <div style="text-align:center;color:#333;font-size:.75rem;padding:20px 0 40px;letter-spacing:0.1em">
    MNL ✈ KHH 🚢 CIJIN 🥟 NIGHT MARKETS 🏯 BUDDHA MUSEUM
  </div>`;
}

// ─── ITINERARY ───────────────────────────────────────────────────────────────
function renderItinerary() {
  const visible = state.dayFilter ? data.days.filter(d=>d.id===state.dayFilter) : data.days;
  return `
  <div class="day-filter">
    <button class="day-btn all${!state.dayFilter?' active':''}" data-dayfilter="0">All</button>
    ${data.days.map(d=>`<button class="day-btn" style="${state.dayFilter===d.id?`border-color:${d.color};background:${d.color}22;color:${d.color}`:''}" data-dayfilter="${d.id}">${d.emoji} ${d.date.split(" ")[1]}</button>`).join("")}
  </div>
  ${visible.map(day=>`
  <div class="day-block">
    <div class="day-header">
      <div class="day-icon" style="background:${day.color}18;border:1px solid ${day.color}44">${day.emoji}</div>
      <div style="flex:1">
        <div class="day-label" style="color:${day.color}">Day ${day.id} · ${day.date}</div>
        <div class="day-title">${day.theme}</div>
      </div>
      <a href="${getDayMapUrl(day)}" target="_blank" class="icon-btn" style="width:auto;padding:0 12px;gap:6px;text-decoration:none;border-color:${day.color}44;color:${day.color};font-weight:700" title="View Day Route">
        <span>🗺 Map</span>
      </a>
    </div>
    <div class="timeline">
      <div class="timeline-line" style="background:linear-gradient(to bottom,${day.color}44,transparent)"></div>
      ${day.stops.map(s=>`
      <div class="stop-row">
        <div class="stop-dot" style="background:${s.checked?day.color+'44':day.color+'14'};border-color:${day.color}44" data-togglecheck="${day.id}|${s.id}">
          ${s.checked?"✓":s.icon}
        </div>
        <div class="stop-card${s.checked?' done':''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
            <div style="flex:1">
              <span style="font-size:.63rem;color:${day.color};font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-right:7px">${s.time}</span>
              <span style="font-size:.88rem;font-weight:700;text-decoration:${s.checked?'line-through':'none'}">${s.place}</span>
              <p style="margin:3px 0 0;font-size:.77rem;color:var(--text-dim);line-height:1.5">${s.note}</p>
            </div>
            <div class="stop-actions">
              <button class="icon-btn" data-editstop="${day.id}|${s.id}">✏️</button>
              ${day.stops.length>1?`<button class="icon-btn del" data-delstop="${day.id}|${s.id}">✕</button>`:''}
            </div>
          </div>
        </div>
      </div>`).join("")}
      <button class="add-stop-btn" style="border:1px dashed ${day.color}44;color:${day.color}" data-addstop="${day.id}">+ Add stop</button>
    </div>
  </div>`).join("")}`;
}

// ─── PACKING ─────────────────────────────────────────────────────────────────
function renderPacking() {
  const done = data.packing.filter(p=>p.done).length;
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h2 style="font-family:'Playfair Display',serif;font-size:1.15rem">Packing Checklist</h2>
    <span style="font-size:.8rem;color:var(--accent)">${done}/${data.packing.length} done</span>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${(done/data.packing.length)*100}%"></div></div>
  ${data.packing.map(p=>`
  <div class="pack-item${p.done?' done':''}" data-togglepack="${p.id}">
    <div class="checkbox${p.done?' checked':''}">${p.done?"✓":""}</div>
    <span style="flex:1;font-size:.86rem;color:${p.done?'var(--muted)':'var(--text)'};text-decoration:${p.done?'line-through':'none'}">${p.item}</span>
    <div class="stop-actions" style="flex-shrink:0">
      <button class="icon-btn" data-editpack="${p.id}" title="Edit">✏️</button>
      <button class="icon-btn del" data-delpack="${p.id}" title="Delete">✕</button>
    </div>
  </div>`).join("")}
  <button style="margin-top:10px;width:100%;padding:9px;background:transparent;border:1px dashed rgba(200,149,108,.3);border-radius:9px;color:var(--accent);font-size:.8rem" id="add-pack">+ Add item</button>`;
}

// ─── BUDGET ──────────────────────────────────────────────────────────────────
function renderBudget() {
  const totalEst = data.budget.reduce((s,b)=>s+(+b.estimate||0),0);
  const totalAct = data.budget.reduce((s,b)=>s+(+b.actual||0),0);
  return `
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
    <h2 style="font-family:'Playfair Display',serif;font-size:1.15rem">Budget Planner</h2>
  </div>
  <p style="color:var(--text-dim);font-size:.77rem;margin-bottom:18px">Tap any number to edit.</p>
  <div class="budget-grid" style="margin-bottom:8px;padding:0 16px">
    <span style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em">Category</span>
    <span style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;text-align:right">Estimate</span>
    <span style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;text-align:right">Actual</span>
  </div>
  ${data.budget.map(b=>`
  <div class="budget-row budget-grid" style="padding:0">
    <span style="font-size:.85rem;color:var(--text-dim);padding-left:16px">${b.category}</span>
    <input class="budget-input" style="background:var(--input-bg);border:1px solid var(--border);color:var(--accent);padding-right:16px;margin:4px 0" value="${b.estimate}" data-budgetfield="${b.id}|estimate" />
    <input class="budget-input" style="background:var(--input-bg);border:1px solid var(--border);color:var(--green);padding-right:16px;margin:4px 0" value="${b.actual}" placeholder="—" data-budgetfield="${b.id}|actual" />
  </div>`).join("")}
  <div class="budget-total budget-grid" style="padding:16px">
    <span style="font-size:.9rem;font-weight:700;color:var(--accent)">TOTAL</span>
    <span style="font-size:.9rem;font-weight:700;color:var(--accent);text-align:right">₱${totalEst.toLocaleString()}</span>
    <span style="font-size:.9rem;font-weight:700;color:var(--green);text-align:right">${totalAct>0?'₱'+totalAct.toLocaleString():'—'}</span>
  </div>`;
}

// ─── NOTES ───────────────────────────────────────────────────────────────────
function renderNotes() {
  const filter = state.foodFilter || "all";
  const search = (state.foodSearch || "").toLowerCase();
  let filtered = data.food || DEFAULT.food;

  if (filter !== "all") filtered = filtered.filter(p => p.category === filter);
  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.desc.toLowerCase().includes(search) ||
    p.tag.toLowerCase().includes(search)
  );

  const catIcon = {restaurant:"🍽", cafe:"☕", nightmarket:"🏮"};
  const catLabel = {restaurant:"Restaurants", cafe:"Cafes", nightmarket:"Night Markets"};

  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:10px;flex-wrap:wrap">
    <h2 style="font-family:'Playfair Display',serif;font-size:1.3rem;flex:1">Food & Cafes</h2>
    <div style="display:flex;gap:8px">
      <button id="toggle-map-view" style="padding:6px 16px;background:rgba(91,143,168,.15);border:1px solid rgba(91,143,168,.4);border-radius:10px;color:var(--blue);font-size:.85rem;font-weight:700;display:flex;align-items:center;gap:6px">
        <span>${state.mapView ? "📋 Show List" : "📍 Show Map"}</span>
      </button>
      <button style="padding:6px 16px;background:rgba(200,149,108,.15);border:1px solid rgba(200,149,108,.4);border-radius:10px;color:var(--accent);font-size:.85rem;font-weight:700" id="add-food">+ Add place</button>
    </div>
  </div>

  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input type="text" class="search-input" id="food-search" placeholder="Search places, cuisines, or keywords..." value="${state.foodSearch || ''}">
  </div>

  <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">
    ${["all","restaurant","cafe","nightmarket"].map(k=>`
    <button class="day-btn${filter===k?' active':''}" style="${filter===k?'border-color:var(--accent);background:rgba(200,149,108,.15);color:var(--accent)':''}" data-foodfilter="${k}">
      ${k==="all"?"🗺 All":catIcon[k]+" "+catLabel[k]}
    </button>`).join("")}
  </div>

  ${state.mapView ? `
    <div id="food-map" style="height:450px; border-radius:20px; border:1px solid var(--border); margin-bottom:12px; z-index:10; position:relative; overflow:hidden"></div>` : ""}

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin-bottom:24px; display:${state.mapView ? 'none' : 'grid'}">
    ${filtered.length ? filtered.map(p=>`
    <div class="note-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:1.4rem">${catIcon[p.category]}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:.65rem;padding:3px 10px;border-radius:12px;background:rgba(200,149,108,.15);color:var(--accent);border:1px solid rgba(200,149,108,.25);font-weight:700">${p.tag}</span>
          <button class="icon-btn" data-editfood="${p.id}">✏️</button>
          <button class="icon-btn del" data-delfood="${p.id}">✕</button>
        </div>
      </div>
      <div style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:6px">${p.name}</div>
      <div style="font-size:.8rem;color:var(--text-dim);line-height:1.6;margin-bottom:12px;flex:1">${p.desc}</div>
      <div style="font-size:.7rem;color:var(--muted);display:flex;align-items:flex-start;gap:6px;margin-bottom:12px">
        <span style="margin-top:1px">🕒</span><span>${p.hours}</span>
      </div>
      <a href="${p.maps}" target="_blank" style="margin-top:auto;font-size:.75rem;color:var(--accent);display:flex;align-items:center;gap:5px;text-decoration:none;font-weight:700" onclick="event.stopPropagation()">
        <span>📍 View on Maps</span>
      </a>
    </div>`).join("") : `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No places found matching your search.</div>`}
  </div>`;
}

// ─── MODALS ──────────────────────────────────────────────────────────────────
function renderModal() {
  const { type, payload } = state.modal;
  let inner = "";
  if (type === "editStop") {
    const s = payload.stop;
    inner = `
      <div class="field-wrap"><label class="field-label">Time</label><input class="field-input" id="m-time" value="${s.time}"/></div>
      <div class="field-wrap"><label class="field-label">Place</label><input class="field-input" id="m-place" value="${s.place}"/></div>
      <div class="field-wrap"><label class="field-label">Notes</label><textarea class="field-input" id="m-note" rows="3">${s.note}</textarea></div>
      <div class="field-wrap"><label class="field-label">Icon</label><input class="field-input" id="m-icon" value="${s.icon}"/></div>
      <button class="save-btn" id="m-save-stop">Save changes</button>`;
  } else if (type === "addStop") {
    inner = `
      <div class="field-wrap"><label class="field-label">Time</label><input class="field-input" id="m-time" value=""/></div>
      <div class="field-wrap"><label class="field-label">Place</label><input class="field-input" id="m-place" value=""/></div>
      <div class="field-wrap"><label class="field-label">Notes</label><textarea class="field-input" id="m-note" rows="3"></textarea></div>
      <div class="field-wrap"><label class="field-label">Icon</label><input class="field-input" id="m-icon" value="📍"/></div>
      <button class="save-btn" id="m-save-addstop">Add to itinerary</button>`;
  } else if (type === "editPack") {
    const p = payload;
    inner = `
      <div class="field-wrap"><label class="field-label">Item</label><input class="field-input" id="m-pitem" value="${p.item}"/></div>
      <button class="save-btn" id="m-save-pack">Save</button>`;
  } else if (type === "addNote") {
    inner = `
      <div class="field-wrap"><label class="field-label">Icon</label><input class="field-input" id="m-nicon" value="📝"/></div>
      <div class="field-wrap"><label class="field-label">Title</label><input class="field-input" id="m-ntitle" value=""/></div>
      <div class="field-wrap"><label class="field-label">Text</label><textarea class="field-input" id="m-ntext" rows="3"></textarea></div>
      <button class="save-btn" id="m-save-addnote">Add note</button>`;
  } else if (type === "editFood") {
    const fp = payload;
    inner = `
      <div class="field-wrap"><label class="field-label">Name</label><input class="field-input" id="m-fname" value="${fp.name}"/></div>
      <div class="field-wrap"><label class="field-label">Category</label>
        <select class="field-input" id="m-fcat" style="background:rgba(255,255,255,.06);color:var(--text)">
          <option value="restaurant" ${fp.category==="restaurant"?"selected":""}>🍽 Restaurant</option>
          <option value="cafe" ${fp.category==="cafe"?"selected":""}>☕ Cafe</option>
          <option value="nightmarket" ${fp.category==="nightmarket"?"selected":""}>🏮 Night Market</option>
        </select>
      </div>
      <div class="field-wrap"><label class="field-label">Tag (e.g. Italian · $$)</label><input class="field-input" id="m-ftag" value="${fp.tag}"/></div>
      <div class="field-wrap"><label class="field-label">Description</label><textarea class="field-input" id="m-fdesc" rows="3">${fp.desc}</textarea></div>
      <div class="field-wrap"><label class="field-label">Hours</label><input class="field-input" id="m-fhours" value="${fp.hours}"/></div>
      <div class="field-wrap"><label class="field-label">Google Maps URL</label><input class="field-input" id="m-fmaps" value="${fp.maps}"/></div>
      <button class="save-btn" id="m-save-editfood">Save changes</button>`;
  } else if (type === "addFood") {
    inner = `
      <div class="field-wrap"><label class="field-label">Name</label><input class="field-input" id="m-fname" value=""/></div>
      <div class="field-wrap"><label class="field-label">Category</label>
        <select class="field-input" id="m-fcat" style="background:rgba(255,255,255,.06);color:var(--text)">
          <option value="restaurant">🍽 Restaurant</option>
          <option value="cafe">☕ Cafe</option>
          <option value="nightmarket">🏮 Night Market</option>
        </select>
      </div>
      <div class="field-wrap"><label class="field-label">Tag (e.g. Italian · $$)</label><input class="field-input" id="m-ftag" value=""/></div>
      <div class="field-wrap"><label class="field-label">Description</label><textarea class="field-input" id="m-fdesc" rows="3"></textarea></div>
      <div class="field-wrap"><label class="field-label">Hours</label><input class="field-input" id="m-fhours" value=""/></div>
      <div class="field-wrap"><label class="field-label">Google Maps URL (optional)</label><input class="field-input" id="m-fmaps" value="https://maps.google.com/?q=Kaohsiung+Taiwan"/></div>
      <button class="save-btn" id="m-save-addfood">Add place</button>`;
  } else if (type === "editNote") {
    const n = payload;
    inner = `
      <div class="field-wrap"><label class="field-label">Icon</label><input class="field-input" id="m-nicon" value="${n.icon}"/></div>
      <div class="field-wrap"><label class="field-label">Title</label><input class="field-input" id="m-ntitle" value="${n.title}"/></div>
      <div class="field-wrap"><label class="field-label">Text</label><textarea class="field-input" id="m-ntext" rows="3">${n.text}</textarea></div>
      <button class="save-btn" id="m-save-note">Save</button>`;
  }
  return `
  <div class="overlay" id="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${type==="editStop"?"Edit Stop":type==="addStop"?"Add Stop":type==="editPack"?"Edit Item":type==="addNote"?"Add Note":type==="editFood"?"Edit Place":type==="addFood"?"Add Place":"Edit Note"}</span>
        <button style="background:none;border:none;color:#444;font-size:1.1rem" id="modal-close">✕</button>
      </div>
      ${inner}
    </div>
  </div>`;
}

// ─── BIND EVENTS ─────────────────────────────────────────────────────────────
function bindAll() {
  // theme toggle
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) themeBtn.onclick = () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", state.theme);
    render();
  };

  // tabs
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = ()=>{ state.tab=b.dataset.tab; render(); });

  // day filter
  document.querySelectorAll("[data-dayfilter]").forEach(b => b.onclick = ()=>{
    const id = +b.dataset.dayfilter;
    state.dayFilter = id===0 ? null : (state.dayFilter===id?null:id);
    render();
  });

  // check stop
  document.querySelectorAll("[data-togglecheck]").forEach(el => el.onclick = ()=>{
    const [did,sid] = el.dataset.togglecheck.split("|");
    const nd = {...data, days: data.days.map(d=>+d.id!==+did?d:{...d,stops:d.stops.map(s=>s.id!==sid?s:{...s,checked:!s.checked})})};
    save(nd);
  });

  // edit stop
  document.querySelectorAll("[data-editstop]").forEach(b => b.onclick = ()=>{
    const [did,sid] = b.dataset.editstop.split("|");
    const day = data.days.find(d=>+d.id===+did);
    const stop = day.stops.find(s=>s.id===sid);
    state.modal = {type:"editStop", payload:{dayId:+did, stop:{...stop}}};
    render();
  });

  // delete stop
  document.querySelectorAll("[data-delstop]").forEach(b => b.onclick = ()=>{
    const [did,sid] = b.dataset.delstop.split("|");
    const nd = {...data, days:data.days.map(d=>+d.id!==+did?d:{...d,stops:d.stops.filter(s=>s.id!==sid)})};
    save(nd);
  });

  // add stop
  document.querySelectorAll("[data-addstop]").forEach(b => b.onclick = ()=>{
    state.modal = {type:"addStop", payload:{dayId:+b.dataset.addstop}};
    render();
  });

  // edit pack item
  document.querySelectorAll("[data-editpack]").forEach(b => b.onclick = (e)=>{
    e.stopPropagation();
    const id = b.dataset.editpack;
    const p = data.packing.find(x=>x.id===id);
    state.modal = {type:"editPack", payload:{...p}};
    render();
  });

  // delete pack item
  document.querySelectorAll("[data-delpack]").forEach(b => b.onclick = (e)=>{
    e.stopPropagation();
    save({...data, packing:data.packing.filter(p=>p.id!==b.dataset.delpack)});
  });

  // pack toggle
  document.querySelectorAll("[data-togglepack]").forEach(el => el.onclick = ()=>{
    const id = el.dataset.togglepack;
    save({...data, packing:data.packing.map(p=>p.id!==id?p:{...p,done:!p.done})});
  });

  // add pack
  const addPackBtn = document.getElementById("add-pack");
  if (addPackBtn) addPackBtn.onclick = ()=>{
    save({...data, packing:[...data.packing,{id:"p"+uid(),item:"New item",done:false}]});
  };

  // budget fields
  document.querySelectorAll("[data-budgetfield]").forEach(input => {
    input.onchange = ()=>{
      const [id,field] = input.dataset.budgetfield.split("|");
      save({...data, budget:data.budget.map(b=>b.id!==id?b:{...b,[field]:input.value})});
    };
  });

  // add note
  const addNoteBtn = document.getElementById("add-note");
  if (addNoteBtn) addNoteBtn.onclick = ()=>{
    state.modal = {type:"addNote", payload:{}};
    render();
  };

  // delete note
  document.querySelectorAll("[data-delnote]").forEach(b => b.onclick = ()=>{
    save({...data, notes:data.notes.filter(n=>n.id!==b.dataset.delnote)});
  });

  // food filter
  document.querySelectorAll("[data-foodfilter]").forEach(b => b.onclick = ()=>{
    state.foodFilter = b.dataset.foodfilter;
    render();
  });

  // toggle map view
  const mapToggle = document.getElementById("toggle-map-view");
  if (mapToggle) mapToggle.onclick = () => {
    state.mapView = !state.mapView;
    render();
  };

  // food search
  const searchInput = document.getElementById("food-search");
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.foodSearch = e.target.value;
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(render, 300);
    };
    if (state.foodSearch) {
      searchInput.focus();
      const len = searchInput.value.length;
      searchInput.setSelectionRange(len, len);
    }
  }

  // add food place
  const addFoodBtn = document.getElementById("add-food");
  if (addFoodBtn) addFoodBtn.onclick = ()=>{ state.modal={type:"addFood",payload:{}}; render(); };

  // edit food place
  document.querySelectorAll("[data-editfood]").forEach(b => b.onclick = (e)=>{
    e.stopPropagation();
    const fp = (data.food||DEFAULT.food).find(x=>x.id===b.dataset.editfood);
    state.modal = {type:"editFood", payload:{...fp}};
    render();
  });

  // delete food place
  document.querySelectorAll("[data-delfood]").forEach(b => b.onclick = (e)=>{
    e.stopPropagation();
    save({...data, food:(data.food||DEFAULT.food).filter(f=>f.id!==b.dataset.delfood)});
  });

  // edit note
  document.querySelectorAll("[data-editnote]").forEach(b => b.onclick = ()=>{
    const n = data.notes.find(x=>x.id===b.dataset.editnote);
    state.modal = {type:"editNote", payload:{...n}};
    render();
  });

  // modal close
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.onclick = ()=>{ state.modal=null; render(); };
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.onclick = (e)=>{ if(e.target===overlay){state.modal=null;render();} };

  // modal save stop
  const saveStop = document.getElementById("m-save-stop");
  if (saveStop) saveStop.onclick = ()=>{
    const {dayId,stop} = state.modal.payload;
    const updated = {...stop, time:document.getElementById("m-time").value, place:document.getElementById("m-place").value, note:document.getElementById("m-note").value, icon:document.getElementById("m-icon").value};
    const nd = {...data, days:data.days.map(d=>+d.id!==+dayId?d:{...d,stops:d.stops.map(s=>s.id!==updated.id?s:updated)})};
    state.modal=null; save(nd);
  };

  // modal add stop
  const saveAddStop = document.getElementById("m-save-addstop");
  if (saveAddStop) saveAddStop.onclick = ()=>{
    const {dayId} = state.modal.payload;
    const ns = {id:uid(),time:document.getElementById("m-time").value,place:document.getElementById("m-place").value,note:document.getElementById("m-note").value,icon:document.getElementById("m-icon").value,checked:false};
    const nd = {...data, days:data.days.map(d=>+d.id!==+dayId?d:{...d,stops:[...d.stops,ns]})};
    state.modal=null; save(nd);
  };

  // modal save pack item
  const savePack = document.getElementById("m-save-pack");
  if (savePack) savePack.onclick = ()=>{
    const updated = {...state.modal.payload, item:document.getElementById("m-pitem").value};
    save({...data, packing:data.packing.map(p=>p.id!==updated.id?p:updated)});
    state.modal=null; render();
  };

  // modal save note
  const saveNote = document.getElementById("m-save-note");
  if (saveNote) saveNote.onclick = ()=>{
    const updated = {...state.modal.payload, icon:document.getElementById("m-nicon").value, title:document.getElementById("m-ntitle").value, text:document.getElementById("m-ntext").value};
    const nd = {...data, notes:data.notes.map(n=>n.id!==updated.id?n:updated)};
    state.modal=null; save(nd);
  };

  // modal add note
  const saveAddNote = document.getElementById("m-save-addnote");
  if (saveAddNote) saveAddNote.onclick = ()=>{
    const nn = {id:"n"+uid(), icon:document.getElementById("m-nicon").value, title:document.getElementById("m-ntitle").value, text:document.getElementById("m-ntext").value};
    state.modal=null; save({...data, notes:[...data.notes, nn]});
  };

  // modal save edit food
  const saveEditFood = document.getElementById("m-save-editfood");
  if (saveEditFood) saveEditFood.onclick = ()=>{
    const updated = {...state.modal.payload, name:document.getElementById("m-fname").value, category:document.getElementById("m-fcat").value, tag:document.getElementById("m-ftag").value, desc:document.getElementById("m-fdesc").value, hours:document.getElementById("m-fhours").value, maps:document.getElementById("m-fmaps").value};
    state.modal=null; save({...data, food:(data.food||DEFAULT.food).map(f=>f.id!==updated.id?f:updated)});
  };

  // modal save add food
  const saveAddFood = document.getElementById("m-save-addfood");
  if (saveAddFood) saveAddFood.onclick = ()=>{
    const nf = {id:"f"+uid(), name:document.getElementById("m-fname").value, category:document.getElementById("m-fcat").value, tag:document.getElementById("m-ftag").value, desc:document.getElementById("m-fdesc").value, hours:document.getElementById("m-fhours").value, maps:document.getElementById("m-fmaps").value};
    state.modal=null; save({...data, food:[...(data.food||DEFAULT.food), nf]});
  };
}

// kick off
render();
