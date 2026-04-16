# Itinerary Feature Request

## Overview
This document tracks the feature status of the itinerary web app — what's built, what's genuinely missing, and what was removed from scope.

## Architecture: Database-Driven (Single Global App)

All itineraries live in **Firebase Realtime Database** under `/itineraries/{id}/`. There is one global app folder (`/app/`) that loads any itinerary via `?id=` URL parameter — no per-trip folders. The landing page reads all itineraries from the database and allows creating new ones.

### Firebase Schema
```
/itineraries/
  {id}/
    meta/  — title, destination, coverEmoji, startDate, endDate, daysCount, route, tags[], status, createdAt
    days/  — array of day objects with nested stops
    packing/ — array of packing items
    budget/  — array of budget entries
    food/    — array of food/cafe places
    notes/   — array of trip notes
```

### URL Routing
| URL | Behavior |
|-----|----------|
| `/` | Landing page — lists all itineraries from DB |
| `/app/?id=kaohsiung-2025` | Opens Kaohsiung trip |
| `/app/?id=itin-abc123` | Opens any dynamically created itinerary |
| `/kaohsiung/` | Legacy per-trip app (preserved, still works) |

---

## ✅ Completed Features

### Landing Page
- Trip card grid — fetches all itineraries from Firebase, displays cover emoji, destination, dates, route, tags, status badge
- Create itinerary modal (title, destination, emoji, start/end dates, tags) — seeds default packing list and budget categories
- Delete itinerary with confirmation
- Firebase setup banner + config modal when no Firebase is connected
- Static Kaohsiung fallback when Firebase is not configured
- Light/dark theme toggle (persisted)

### Universal App (`/app/`)
- Loads any itinerary by `?id=` URL parameter; redirects to landing if missing
- Header shows trip title, destination, date range, countdown timer (hides after trip ends, "Trip is live!" during trip)
- Status badges: Firebase connection, packing progress, total estimated budget, sync flash
- Edit trip meta (title, destination, start/end dates) via modal

### Itinerary Tab
- Day-by-day timeline — colored cards with emoji, theme, date, day-of-week
- Stops per day — time, place, note, custom icon, check-off toggle (done state)
- Add/edit/delete days and stops
- Drag-and-drop stop reordering — HTML5 for desktop, touch-based with ghost clone for mobile
- Day filter buttons to isolate a single day's view
- Per-day Google Maps route link (multi-waypoint, transit mode)

### Packing Tab
- Checkbox-style list with toggle done, edit, delete
- Packing progress bar and count badge in header
- Add item via modal
- Default 18-item list seeded on new itinerary creation

### Budget Tab
- Category rows with inline estimate and actual spend fields (₱)
- Auto-calculated totals — "You saved ₱X" (green) or "Over budget by ₱X" (red)
- Add/edit/delete budget categories
- Default 7 categories seeded on new itinerary creation

### Food & Cafes Tab
- Category filter (All / Restaurants / Cafes / Night Markets)
- Live search by name, description, or cuisine tag
- List view: cards with category emoji, tag, description, hours, Google Maps link
- Map view: interactive Leaflet map with auto-geocoding (Photon + Nominatim fallback), geolocation button, light/dark tile layers, marker popups
- Add/edit/delete food places
- Destination auto-centering (cached in meta)

### Infrastructure
- Real-time Firebase sync across all tabs — flash "✓ Synced" or "⚠ Error"
- Offline/local mode — badge shows "💾 Local" when disconnected
- Light/dark theme, responsive mobile layout
- Leaflet 1.9.4 maps, no paid API keys required

---

## 🔧 Active TODO

Prioritized by impact. P0 items are functional gaps; P1/P2 are quality-of-life improvements.

### P0 — Fix First

**Notes tab UI**
- Data model exists (`notes: [{id, icon, title, text}]`), CRUD modals and save handlers are already written — there is just no render block displaying the notes array.
- Add a fifth "Notes" tab that renders note cards and exposes the existing add/edit/delete modals.
- ~2 hours of work.

**Trip status auto-derived from dates**
- The `meta.status` field is set at creation time and never updated.
- Landing page badge ("Upcoming" / "Past trip") should be derived from `meta.endDate` vs. today at render time — not from the stored field.
- ~30 min fix in `renderTrips()` in `index.html`.

### P1 — High Value

**Packing: "Reset all" button**
- After a trip, all packing items are checked. Reusing the same list for the next trip requires individually unchecking 18+ items.
- Add a "Reset all" button that unchecks every item in one click.
- ~30 min in `app/app.js`.

**Food place: visited/tried toggle**
- Food cards have no visited state. During a trip, users want to mark places as tried and filter by untried.
- Add a `visited` boolean to each food entry — same pattern as packing's `done` field.
- ~2 hours in `app/app.js`.

**Print / PDF export**
- A `window.print()` trigger with `@media print` CSS that linearizes all tab content into a single readable document.
- Useful on travel day for an offline reference without needing the app open.
- Zero dependencies, zero server code. ~3 hours.

### P2 — Nice to Have

**Budget: per-stop cost field**
- Each stop (`{time, place, note, icon, checked}`) has no cost field.
- Add an optional `cost` number on stops to enable day-level spend rollup without a separate budget workflow.
- ~4 hours (data model + render + Firebase sync).

**Packing item categories/grouping**
- Flat packing list works for short trips but gets unwieldy for longer ones.
- Add a `category` field ("Clothing", "Documents", "Electronics", "Toiletries") and group items by category in the render.
- ~3 hours in `app/app.js`.

---

## ❌ Removed from Scope

These were in the original plan but are not worth building for a personal solo travel app:

| Feature | Reason Removed |
|---|---|
| Map + Route Optimization | Per-day Google Maps deep link already shows live travel time in Google Maps. Building it in-app requires a paid Directions API. |
| Calendar Sync / .ics export | Timezone handling + RFC 5545 formatting complexity outweighs value. Flights and hotels are already in the user's real calendar. |
| Itinerary Templates | New-trip creation already seeds a default packing list and 7 budget categories — that is the template. Formal trip-type templates are a SaaS product feature. |
| Checklists & Reminders with due dates | Push notifications require a service worker and server. Out of scope for a static Firebase-only app. The packing tab already covers pre-trip checklists. |

---

## Notes
- `/kaohsiung/` legacy folder is preserved and not modified.
- No build step — everything runs directly in the browser via ES modules and CDN imports.
- Currency display uses Philippine Peso (₱).
