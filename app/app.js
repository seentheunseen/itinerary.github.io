import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { DEFAULT } from "../kaohsiung/data.js";

// ─── ITINERARY ID ────────────────────────────────────────────────────────────
const ITINERARY_ID = new URLSearchParams(location.search).get("id");
if (!ITINERARY_ID) { location.href = "../index.html"; }

// ─── STATE ──────────────────────────────────────────────────────────────────
let db = null;
let dbRef = null;
let meta = {};
let data = { days: [], packing: [], budget: [], food: [], notes: [] };
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
    dbRef = ref(db, "itineraries/" + ITINERARY_ID);
    onValue(dbRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        meta = val.meta || {};
        data = {
          days: toArr(val.days).map(d => ({ ...d, stops: toArr(d.stops) })),
          packing: toArr(val.packing),
          budget: toArr(val.budget),
          food: toArr(val.food),
          notes: toArr(val.notes)
        };
        document.title = (meta.title || "Itinerary") + " · Trip";
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
    set(dbRef, { meta, ...d }).then(() => flashMsg("✓ Synced")).catch(e => flashMsg("⚠ " + e.message, true));
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

function toArr(v) { return v ? Object.values(v) : []; }

const DAY_COLORS = ["#C8956C","#7B9E6B","#5B8FA8","#9B7BA8","#E8A87C","#6BAED6","#A8957B","#D4A5A5"];

function isoToDisplayDate(iso) {
  if (!iso) return "";
  // Already in display format (contains letters) — return as-is
  if (/[a-zA-Z]/.test(iso)) return iso;
  const d = new Date(iso + "T00:00:00");
  const wdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()} (${wdays[d.getDay()]})`;
}

function suggestNextDate() {
  if (!meta.startDate) return "";
  const d = new Date(meta.startDate + "T00:00:00");
  d.setDate(d.getDate() + data.days.length);
  return d.toISOString().slice(0, 10);
}

// ─── DRAG & DROP HELPERS ─────────────────────────────────────────────────────
let _dragKey = null;
let _touchClone = null;
let _touchDragEl = null;
let _touchOffsetX = 0, _touchOffsetY = 0;

function _isDragAfter(el, clientY) {
  const rect = el.getBoundingClientRect();
  return clientY > rect.top + rect.height / 2;
}

function _clearDropIndicators() {
  document.querySelectorAll(".drag-before, .drag-after").forEach(el => el.classList.remove("drag-before", "drag-after"));
}

function _reorderStops(dayId, srcStopId, tgtStopId, insertAfter) {
  const nd = {...data, days: data.days.map(d => {
    if (+d.id !== +dayId) return d;
    const stops = [...d.stops];
    const srcIdx = stops.findIndex(s => s.id === srcStopId);
    if (srcIdx === -1) return d;
    const [moved] = stops.splice(srcIdx, 1);
    const tgtIdx = stops.findIndex(s => s.id === tgtStopId);
    if (tgtIdx === -1) return d;
    stops.splice(insertAfter ? tgtIdx + 1 : tgtIdx, 0, moved);
    return {...d, stops};
  })};
  save(nd);
}

// Block Escape from closing modals (static backdrop)
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.modal) e.stopImmediatePropagation();
});

// Document-level touch handlers for mobile drag (added once)
document.addEventListener("touchmove", e => {
  if (!_touchDragEl || !_touchClone) return;
  e.preventDefault();
  const touch = e.touches[0];
  _touchClone.style.left = (touch.clientX - _touchOffsetX) + "px";
  _touchClone.style.top  = (touch.clientY - _touchOffsetY) + "px";
  _touchClone.style.display = "none";
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  _touchClone.style.display = "";
  _clearDropIndicators();
  const targetRow = el && el.closest("[data-drag-stop]");
  if (targetRow && targetRow !== _touchDragEl) {
    targetRow.classList.add(_isDragAfter(targetRow, touch.clientY) ? "drag-after" : "drag-before");
  }
}, { passive: false });

document.addEventListener("touchend", e => {
  if (!_touchDragEl || !_touchClone) return;
  const touch = e.changedTouches[0];
  _touchClone.style.display = "none";
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  _touchClone.remove();
  _touchClone = null;
  const targetRow = el && el.closest("[data-drag-stop]");
  if (targetRow && targetRow !== _touchDragEl && _dragKey) {
    const after = targetRow.classList.contains("drag-after");
    const [srcDay, srcStop] = _dragKey.split("|");
    const [tgtDay, tgtStop] = targetRow.dataset.dragStop.split("|");
    if (srcDay === tgtDay) _reorderStops(srcDay, srcStop, tgtStop, after);
  }
  _clearDropIndicators();
  _touchDragEl.classList.remove("dragging");
  _touchDragEl = null;
  _dragKey = null;
}, { passive: false });

// Try to get lat/lng from a Google Maps URL, then geocode by name
async function resolveCoords(mapsUrl, name) {
  // 1. Extract coords directly from a full Google Maps URL (e.g. @22.6416,120.3014)
  if (mapsUrl) {
    const m = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
           || mapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
           || mapsUrl.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  if (!name) return null;

  const city = meta.destination ? meta.destination.split(",")[0].trim() : "";

  // 2. Photon (Komoot) — better at finding restaurants/cafes by name
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(name + (city ? " " + city : ""))}&limit=1&lang=en`;
    // Bias results toward destination if we have a center point
    if (meta.centerLat && meta.centerLng) url += `&lat=${meta.centerLat}&lon=${meta.centerLng}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.features && json.features.length > 0) {
      const [lng, lat] = json.features[0].geometry.coordinates;
      return { lat, lng };
    }
  } catch(e) {}

  await new Promise(r => setTimeout(r, 400));

  // 3. Nominatim fallback — try a few query variations
  const queries = [
    city ? `${name}, ${city}` : name,
    city ? `${name} ${city}` : null,
    name,
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const results = await res.json();
      if (results.length > 0) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    } catch(e) {}
    await new Promise(r => setTimeout(r, 400));
  }

  return null;
}

function getDayMapUrl(day) {
  const stops = day.stops.filter(s => s.place && s.place.trim() !== "");
  if (stops.length === 0) return "#";
  const suffix = meta.destination ? " " + meta.destination : "";
  const places = stops.map(s => encodeURIComponent(s.place + suffix));
  if (places.length === 1) return `https://www.google.com/maps/search/?api=1&query=${places[0]}`;
  const origin = places[0];
  const destination = places[places.length - 1];
  const waypoints = places.slice(1, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? '&waypoints=' + waypoints : ''}&travelmode=transit`;
}

function getAllFoodMapUrl(foodList) {
  if (!foodList || foodList.length === 0) return "#";
  const suffix = meta.destination ? " " + meta.destination : "";
  const places = foodList.slice(0, 10).map(f => encodeURIComponent(f.name + suffix));
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

  const hasSavedCenter = meta.centerLat && meta.centerLng;
  const map = L.map('food-map').setView(
    hasSavedCenter ? [meta.centerLat, meta.centerLng] : [20, 0],
    hasSavedCenter ? 13 : 2
  );
  state.mapInstance = map;

  const isLight = document.body.classList.contains("light-mode");
  const tileUrl = isLight
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap' }).addTo(map);

  const markers = [];
  const missingCoords = [];

  function addMarker(lat, lng, f) {
    L.marker([lat, lng]).addTo(map)
      .bindPopup(`<div style="color:#222;min-width:150px"><b>${f.name}</b><br>${f.tag}<br><a href="${f.maps}" target="_blank" style="color:var(--accent);font-weight:bold;text-decoration:none;display:inline-block;margin-top:5px">📍 Open in Google Maps</a></div>`);
    markers.push([lat, lng]);
  }

  foodList.forEach(f => {
    let lat = f.lat, lng = f.lng;
    if (!lat || !lng) {
      const def = DEFAULT.food.find(df => df.name === f.name || df.id === f.id);
      if (def) { lat = def.lat; lng = def.lng; }
    }
    if (lat && lng) {
      addMarker(lat, lng, f);
    } else {
      missingCoords.push(f);
    }
  });

  // Geocode items with missing coords one at a time (rate-limit safe)
  (async () => {
    for (let i = 0; i < missingCoords.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 400));
      const f = missingCoords[i];
      if (!state.mapInstance) break; // user navigated away
      const coords = await resolveCoords(f.maps, f.name);
      if (!coords || !state.mapInstance) continue;
      data.food = data.food.map(x => x.id === f.id ? {...x, lat: coords.lat, lng: coords.lng} : x);
      if (db && dbRef) set(dbRef, { meta, ...data }).catch(() => {});
      addMarker(coords.lat, coords.lng, f);
      state.mapInstance.fitBounds(markers, { padding: [40, 40] });
    }
  })();

  if (markers.length > 0) {
    map.fitBounds(markers, {padding: [40, 40]});
  } else if (!hasSavedCenter && meta.destination) {
    // Geocode the destination so the map centers on the right city
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(meta.destination)}&format=json&limit=1`)
      .then(r => r.json())
      .then(results => {
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          map.setView([lat, lng], 13);
          // Cache so subsequent opens are instant
          meta.centerLat = lat;
          meta.centerLng = lng;
        }
      })
      .catch(() => {});
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
  if (!meta.startDate) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tripStart = new Date(meta.startDate + "T00:00:00");
  const tripEnd = meta.endDate ? new Date(meta.endDate + "T00:00:00") : tripStart;
  if (today > tripEnd) return "";
  if (today >= tripStart) return "Trip is live! ✈️";
  const days = Math.round((tripStart - today) / (1000 * 60 * 60 * 24));
  return `${days} days until departure 🛫`;
}

function formatTripDates(m) {
  if (!m.startDate) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = new Date(m.startDate + "T00:00:00");
  const e = m.endDate ? new Date(m.endDate + "T00:00:00") : null;
  let dateStr;
  if (!e || s.getMonth() === e.getMonth()) {
    dateStr = `${months[s.getMonth()]} ${s.getDate()}${e ? "–" + e.getDate() : ""}, ${s.getFullYear()}`;
  } else {
    dateStr = `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  const count = data.days.length || m.daysCount;
  return dateStr + (count ? ` · ${count} Days` : "");
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
    let filtered = data.food;
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
        <div class="header-eyebrow">Travel Itinerary</div>
        <h1 class="header-title" style="font-size: 2.2rem">Connect to Firebase</h1>
        <p style="color:var(--text-dim);font-size:.9rem;font-weight:300">Sync your trip data in real time</p>
      </div>
      <div class="setup-card">
        <h2>Connect to Firebase</h2>
        <p>Sync edits across devices in real time. Takes 2 minutes:</p>
        <ul class="steps">
          <li><span class="step-num">1</span> <span>Go to <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a></span></li>
          <li><span class="step-num">2</span> <span>Create a project → add a <b>Web app</b></span></li>
          <li><span class="step-num">3</span> <span>Enable <b>Realtime Database</b> (Test Mode)</span></li>
          <li><span class="step-num">4</span> <span>Copy <code>databaseURL</code> and <code>apiKey</code> below</span></li>
        </ul>
        <input id="fb-apikey" placeholder="apiKey (e.g. AIzaSy...)" />
        <input id="fb-dburl" placeholder="databaseURL (e.g. https://xxx.firebaseio.com)" />
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
    <div class="header-eyebrow">${meta.eyebrow || "Travel Itinerary"}</div>
    <h1 class="header-title">${meta.destination || meta.title || "Loading..."}</h1>
    <p class="header-sub">${formatTripDates(meta)} <button id="edit-meta-btn" title="Edit trip details" style="background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--muted);padding:0 4px;vertical-align:middle">✏️</button></p>
    <div class="status-bar">
      ${getCountdown() ? `<span class="badge countdown">✨ ${getCountdown()}</span>` : ""}
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
    ${meta.route || ""}
  </div>`;
}

// ─── ITINERARY ───────────────────────────────────────────────────────────────
function renderItinerary() {
  const visible = state.dayFilter ? data.days.filter(d=>d.id===state.dayFilter) : data.days;
  if (data.days.length === 0) {
    return `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:2.5rem;margin-bottom:16px">🗓</div>
      <p style="font-size:.9rem;margin-bottom:20px">No days added yet.</p>
      <button class="save-btn" id="add-day" style="display:inline-block;width:auto;padding:10px 28px">+ Add First Day</button>
    </div>`;
  }
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
      <button class="icon-btn" data-editday="${day.id}" title="Edit day">✏️</button>
      <button class="icon-btn del" data-delday="${day.id}" title="Delete day">✕</button>
    </div>
    <div class="timeline">
      <div class="timeline-line" style="background:linear-gradient(to bottom,${day.color}44,transparent)"></div>
      ${day.stops.map(s=>`
      <div class="stop-row" draggable="true" data-drag-stop="${day.id}|${s.id}">
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
              <button class="icon-btn drag-handle" title="Drag to reorder">⠿</button>
              <button class="icon-btn" data-editstop="${day.id}|${s.id}">✏️</button>
              ${day.stops.length>1?`<button class="icon-btn del" data-delstop="${day.id}|${s.id}">✕</button>`:''}
            </div>
          </div>
        </div>
      </div>`).join("")}
      <button class="add-stop-btn" style="border:1px dashed ${day.color}44;color:${day.color}" data-addstop="${day.id}">+ Add stop</button>
    </div>
  </div>`).join("")}
  <button id="add-day" style="margin-top:8px;width:100%;padding:12px;background:transparent;border:1px dashed rgba(200,149,108,.3);border-radius:12px;color:var(--accent);font-size:.85rem;font-weight:700;cursor:pointer">+ Add Day</button>`;
}

// ─── PACKING ─────────────────────────────────────────────────────────────────
function renderPacking() {
  const done = data.packing.filter(p=>p.done).length;
  const total = data.packing.length;
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h2 style="font-family:'Playfair Display',serif;font-size:1.15rem">Packing Checklist</h2>
    <span style="font-size:.8rem;color:var(--accent)">${done}/${total} done</span>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${Math.round((done/(total||1))*100)}%"></div></div>
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
  <div class="budget-row budget-grid" style="padding:0 8px 0 0">
    <span style="font-size:.85rem;color:var(--text-dim);padding-left:8px;display:flex;align-items:center;gap:6px"><button class="icon-btn del" data-delbudget="${b.id}" style="padding:0 4px;height:20px;font-size:.7rem;flex-shrink:0" title="Delete row">✕</button><button class="icon-btn" data-editbudgetcat="${b.id}" style="padding:0 4px;height:20px;font-size:.7rem;flex-shrink:0" title="Edit category">✏️</button>${b.category}</span>
    <input class="budget-input" style="background:var(--input-bg);border:1px solid var(--border);color:var(--accent);padding-right:16px;margin:4px 0" value="${b.estimate}" data-budgetfield="${b.id}|estimate" />
    <input class="budget-input" style="background:var(--input-bg);border:1px solid var(--border);color:var(--green);padding-right:16px;margin:4px 0 4px 0;margin-right:12px" value="${b.actual}" placeholder="—" data-budgetfield="${b.id}|actual" />
  </div>`).join("")}
  <button id="add-budget" style="width:100%;margin:6px 0;padding:10px;background:transparent;border:1px dashed rgba(200,149,108,.3);border-radius:10px;color:var(--accent);font-size:.82rem;font-weight:700;cursor:pointer">+ Add Category</button>
  <div class="budget-total budget-grid" style="padding:16px">
    <span style="font-size:.9rem;font-weight:700;color:var(--accent)">TOTAL</span>
    <span style="font-size:.9rem;font-weight:700;color:var(--accent);text-align:right">₱${totalEst.toLocaleString()}</span>
    <span style="font-size:.9rem;font-weight:700;color:var(--green);text-align:right">${totalAct>0?'₱'+totalAct.toLocaleString():'—'}</span>
  </div>
  ${totalAct > 0 ? `
  <div style="margin-top:8px;padding:10px 16px;border-radius:12px;text-align:center;background:${totalAct<=totalEst?'rgba(123,158,107,.1)':'rgba(255,80,80,.08)'};border:1px solid ${totalAct<=totalEst?'rgba(123,158,107,.3)':'rgba(255,80,80,.25)'}">
    <span style="font-size:.8rem;font-weight:700;color:${totalAct<=totalEst?'var(--green)':'#e88'}">
      ${totalAct<=totalEst ? `🎉 You saved ₱${(totalEst-totalAct).toLocaleString()}!` : `⚠️ Over budget by ₱${(totalAct-totalEst).toLocaleString()}`}
    </span>
  </div>` : ''}`;
}

// ─── NOTES ───────────────────────────────────────────────────────────────────
function renderNotes() {
  const filter = state.foodFilter || "all";
  const search = (state.foodSearch || "").toLowerCase();
  let filtered = data.food;

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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-wrap"><label class="field-label">Latitude</label><input class="field-input" id="m-flat" placeholder="auto" value="${fp.lat || ''}"/></div>
        <div class="field-wrap"><label class="field-label">Longitude</label><input class="field-input" id="m-flng" placeholder="auto" value="${fp.lng || ''}"/></div>
      </div>
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
      <div class="field-wrap"><label class="field-label">Google Maps URL (optional)</label><input class="field-input" id="m-fmaps" value=""/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-wrap"><label class="field-label">Latitude</label><input class="field-input" id="m-flat" placeholder="auto"/></div>
        <div class="field-wrap"><label class="field-label">Longitude</label><input class="field-input" id="m-flng" placeholder="auto"/></div>
      </div>
      <button class="save-btn" id="m-save-addfood">Add place</button>`;
  } else if (type === "editNote") {
    const n = payload;
    inner = `
      <div class="field-wrap"><label class="field-label">Icon</label><input class="field-input" id="m-nicon" value="${n.icon}"/></div>
      <div class="field-wrap"><label class="field-label">Title</label><input class="field-input" id="m-ntitle" value="${n.title}"/></div>
      <div class="field-wrap"><label class="field-label">Text</label><textarea class="field-input" id="m-ntext" rows="3">${n.text}</textarea></div>
      <button class="save-btn" id="m-save-note">Save</button>`;
  } else if (type === "addDay") {
    const suggested = suggestNextDate();
    const nextColor = DAY_COLORS[data.days.length % DAY_COLORS.length];
    inner = `
      <div class="field-wrap"><label class="field-label">Date</label><input class="field-input" id="m-daydate" type="date" value="${suggested}" style="color-scheme:dark"/></div>
      <div class="field-wrap"><label class="field-label">Theme / Title</label><input class="field-input" id="m-daytheme" placeholder="e.g. Arrival Day"/></div>
      <div class="field-wrap"><label class="field-label">Emoji</label><input class="field-input" id="m-dayemoji" value="📅"/></div>
      <div class="field-wrap"><label class="field-label">Color</label><input class="field-input" id="m-daycolor" type="color" value="${nextColor}" style="height:44px;padding:4px 6px;cursor:pointer"/></div>
      <button class="save-btn" id="m-save-addday">Add Day</button>`;
  } else if (type === "editDay") {
    const d = payload;
    inner = `
      <div class="field-wrap"><label class="field-label">Date <span style="color:var(--muted);font-size:.75rem">(e.g. Jul 24 (Thu))</span></label><input class="field-input" id="m-daydate" value="${d.date}"/></div>
      <div class="field-wrap"><label class="field-label">Theme / Title</label><input class="field-input" id="m-daytheme" value="${d.theme}"/></div>
      <div class="field-wrap"><label class="field-label">Emoji</label><input class="field-input" id="m-dayemoji" value="${d.emoji}"/></div>
      <div class="field-wrap"><label class="field-label">Color</label><input class="field-input" id="m-daycolor" type="color" value="${d.color}" style="height:44px;padding:4px 6px;cursor:pointer"/></div>
      <button class="save-btn" id="m-save-editday">Save Day</button>`;
  } else if (type === "editMeta") {
    inner = `
      <div class="field-wrap"><label class="field-label">Trip Title</label><input class="field-input" id="m-mtitle" value="${meta.title || ''}"/></div>
      <div class="field-wrap"><label class="field-label">Destination</label><input class="field-input" id="m-mdest" value="${meta.destination || ''}"/></div>
      <div class="field-wrap"><label class="field-label">Start Date</label><input class="field-input" id="m-mstart" type="date" value="${meta.startDate || ''}" style="color-scheme:dark"/></div>
      <div class="field-wrap"><label class="field-label">End Date</label><input class="field-input" id="m-mend" type="date" value="${meta.endDate || ''}" style="color-scheme:dark"/></div>
      <button class="save-btn" id="m-save-editmeta">Save Trip Details</button>`;
  } else if (type === "editBudgetCat") {
    inner = `
      <div class="field-wrap"><label class="field-label">Category Name</label><input class="field-input" id="m-budgetcat" value="${payload.category}"/></div>
      <button class="save-btn" id="m-save-budgetcat">Save</button>`;
  }
  return `
  <div class="overlay" id="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${type==="editStop"?"Edit Stop":type==="addStop"?"Add Stop":type==="editPack"?"Edit Item":type==="addNote"?"Add Note":type==="editFood"?"Edit Place":type==="addFood"?"Add Place":type==="addDay"?"Add Day":type==="editDay"?"Edit Day":type==="editMeta"?"Trip Details":type==="editBudgetCat"?"Edit Category":"Edit Note"}</span>
        <button style="background:none;border:none;color:#444;font-size:1.1rem" id="modal-close">✕</button>
      </div>
      ${inner}
    </div>
  </div>`;
}

// ─── DRAG & DROP INIT ────────────────────────────────────────────────────────
function initDragDrop() {
  document.querySelectorAll("[data-drag-stop]").forEach(row => {
    // HTML5 drag (desktop)
    row.addEventListener("dragstart", e => {
      _dragKey = row.dataset.dragStop;
      setTimeout(() => row.classList.add("dragging"), 0);
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      _clearDropIndicators();
      _dragKey = null;
    });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      if (row.dataset.dragStop === _dragKey) return;
      _clearDropIndicators();
      row.classList.add(_isDragAfter(row, e.clientY) ? "drag-after" : "drag-before");
    });
    row.addEventListener("dragleave", e => {
      if (!row.contains(e.relatedTarget)) row.classList.remove("drag-before", "drag-after");
    });
    row.addEventListener("drop", e => {
      e.preventDefault();
      if (!_dragKey || row.dataset.dragStop === _dragKey) return;
      const after = row.classList.contains("drag-after");
      _clearDropIndicators();
      const [srcDay, srcStop] = _dragKey.split("|");
      const [, tgtStop] = row.dataset.dragStop.split("|");
      _reorderStops(srcDay, srcStop, tgtStop, after);
      _dragKey = null;
    });

    // Touch drag (mobile) — triggered from the drag handle
    const handle = row.querySelector(".drag-handle");
    if (handle) {
      handle.addEventListener("touchstart", e => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = row.getBoundingClientRect();
        _touchOffsetX = touch.clientX - rect.left;
        _touchOffsetY = touch.clientY - rect.top;
        _touchClone = row.cloneNode(true);
        _touchClone.style.cssText = `position:fixed;z-index:9999;width:${rect.width}px;opacity:0.85;pointer-events:none;left:${rect.left}px;top:${rect.top}px;margin:0;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,0.4);`;
        document.body.appendChild(_touchClone);
        _touchDragEl = row;
        row.classList.add("dragging");
        _dragKey = row.dataset.dragStop;
      }, { passive: false });
    }
  });
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

  // drag & drop
  if (state.tab === "itinerary") initDragDrop();

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

  // add day
  const addDayBtn = document.getElementById("add-day");
  if (addDayBtn) addDayBtn.onclick = ()=>{
    state.modal = {type:"addDay", payload:{}};
    render();
  };

  // edit day
  document.querySelectorAll("[data-editday]").forEach(b => b.onclick = ()=>{
    const day = data.days.find(d=>+d.id===+b.dataset.editday);
    if (day) { state.modal = {type:"editDay", payload:{...day}}; render(); }
  });

  // delete day
  document.querySelectorAll("[data-delday]").forEach(b => b.onclick = ()=>{
    const day = data.days.find(d=>+d.id===+b.dataset.delday);
    if (!day) return;
    const msg = day.stops.length > 0
      ? `Delete Day ${day.id} "${day.theme}" and its ${day.stops.length} stop(s)?`
      : `Delete Day ${day.id} "${day.theme}"?`;
    if (!confirm(msg)) return;
    save({...data, days: data.days.filter(d=>+d.id!==+b.dataset.delday)});
  });

  // edit meta (trip details)
  const editMetaBtn = document.getElementById("edit-meta-btn");
  if (editMetaBtn) editMetaBtn.onclick = ()=>{
    state.modal = {type:"editMeta", payload:{}};
    render();
  };

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

  // add budget category
  const addBudgetBtn = document.getElementById("add-budget");
  if (addBudgetBtn) addBudgetBtn.onclick = ()=>{
    save({...data, budget:[...data.budget, {id:"b"+uid(), category:"New Category", estimate:0, actual:""}]});
  };

  // delete budget category
  document.querySelectorAll("[data-delbudget]").forEach(b => b.onclick = ()=>{
    save({...data, budget:data.budget.filter(x=>x.id!==b.dataset.delbudget)});
  });

  // edit budget category name
  document.querySelectorAll("[data-editbudgetcat]").forEach(b => b.onclick = ()=>{
    const item = data.budget.find(x=>x.id===b.dataset.editbudgetcat);
    state.modal = {type:"editBudgetCat", payload:{...item}};
    render();
  });

  // modal save budget category
  const saveBudgetCat = document.getElementById("m-save-budgetcat");
  if (saveBudgetCat) saveBudgetCat.onclick = ()=>{
    const updated = {...state.modal.payload, category:document.getElementById("m-budgetcat").value};
    state.modal=null; save({...data, budget:data.budget.map(x=>x.id!==updated.id?x:updated)});
  };

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
    const fp = data.food.find(x=>x.id===b.dataset.editfood);
    state.modal = {type:"editFood", payload:{...fp}};
    render();
  });

  // delete food place
  document.querySelectorAll("[data-delfood]").forEach(b => b.onclick = (e)=>{
    e.stopPropagation();
    save({...data, food:data.food.filter(f=>f.id!==b.dataset.delfood)});
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
  if (overlay) overlay.onclick = (e)=>{ e.stopPropagation(); };

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

  // modal add day
  const saveAddDay = document.getElementById("m-save-addday");
  if (saveAddDay) saveAddDay.onclick = ()=>{
    const isoDate = document.getElementById("m-daydate").value;
    const nd = {
      id: data.days.length + 1,
      date: isoToDisplayDate(isoDate) || isoDate,
      theme: document.getElementById("m-daytheme").value || "Day",
      emoji: document.getElementById("m-dayemoji").value || "📅",
      color: document.getElementById("m-daycolor").value,
      stops: []
    };
    state.modal=null; save({...data, days:[...data.days, nd]});
  };

  // modal edit day
  const saveEditDay = document.getElementById("m-save-editday");
  if (saveEditDay) saveEditDay.onclick = ()=>{
    const d = state.modal.payload;
    const updated = {...d, date:document.getElementById("m-daydate").value, theme:document.getElementById("m-daytheme").value, emoji:document.getElementById("m-dayemoji").value, color:document.getElementById("m-daycolor").value};
    state.modal=null; save({...data, days:data.days.map(x=>x.id!==updated.id?x:updated)});
  };

  // modal edit meta
  const saveEditMeta = document.getElementById("m-save-editmeta");
  if (saveEditMeta) saveEditMeta.onclick = ()=>{
    meta = {...meta, title:document.getElementById("m-mtitle").value, destination:document.getElementById("m-mdest").value, startDate:document.getElementById("m-mstart").value, endDate:document.getElementById("m-mend").value};
    state.modal=null; save(data);
  };

  // modal save edit food
  const saveEditFood = document.getElementById("m-save-editfood");
  if (saveEditFood) saveEditFood.onclick = async ()=>{
    const manualLat = parseFloat(document.getElementById("m-flat").value);
    const manualLng = parseFloat(document.getElementById("m-flng").value);
    const updated = {
      ...state.modal.payload,
      name: document.getElementById("m-fname").value,
      category: document.getElementById("m-fcat").value,
      tag: document.getElementById("m-ftag").value,
      desc: document.getElementById("m-fdesc").value,
      hours: document.getElementById("m-fhours").value,
      maps: document.getElementById("m-fmaps").value,
      lat: !isNaN(manualLat) && manualLat ? manualLat : (state.modal.payload.lat || null),
      lng: !isNaN(manualLng) && manualLng ? manualLng : (state.modal.payload.lng || null),
    };
    if (!updated.lat || !updated.lng) {
      const coords = await resolveCoords(updated.maps, updated.name);
      if (coords) { updated.lat = coords.lat; updated.lng = coords.lng; }
    }
    state.modal=null; save({...data, food:data.food.map(f=>f.id!==updated.id?f:updated)});
  };

  // modal save add food
  const saveAddFood = document.getElementById("m-save-addfood");
  if (saveAddFood) saveAddFood.onclick = async ()=>{
    const manualLat = parseFloat(document.getElementById("m-flat").value);
    const manualLng = parseFloat(document.getElementById("m-flng").value);
    const nf = {
      id: "f"+uid(),
      name: document.getElementById("m-fname").value,
      category: document.getElementById("m-fcat").value,
      tag: document.getElementById("m-ftag").value,
      desc: document.getElementById("m-fdesc").value,
      hours: document.getElementById("m-fhours").value,
      maps: document.getElementById("m-fmaps").value,
      lat: !isNaN(manualLat) && manualLat ? manualLat : null,
      lng: !isNaN(manualLng) && manualLng ? manualLng : null,
    };
    if (!nf.lat || !nf.lng) {
      const coords = await resolveCoords(nf.maps, nf.name);
      if (coords) { nf.lat = coords.lat; nf.lng = coords.lng; }
    }
    state.modal=null; save({...data, food:[...data.food, nf]});
  };
}

// kick off
render();
