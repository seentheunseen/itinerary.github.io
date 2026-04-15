# Project Structure

```
itinerary/
│
├── index.html                    # Landing page — lists all available itineraries
│
├── kaohsiung/
│   ├── index.html                # Kaohsiung trip app shell (thin HTML, no inline JS/CSS)
│   ├── app.js                    # All app logic as an ES module (Firebase, render, events)
│   └── data.js                   # Kaohsiung trip data (DEFAULT export — days, packing, budget, food)
│
├── assets/
│   ├── css/
│   │   ├── tokens.css            # CSS custom properties (:root + .light-mode overrides)
│   │   ├── base.css              # Global resets, html/body, inputs, keyframes, scrollbar
│   │   ├── components.css        # All trip-app component classes (shared by trip pages)
│   │   └── landing.css           # Landing page styles (hero, trip card grid, theme toggle)
│   └── js/
│       └── (empty — shared JS goes here when a second trip is added)
│
├── FEATURE_REQUEST.md            # Planned features and ideas
└── PROJECT_STRUCTURE.md          # This file
```

## CSS Import Map

| Page | Imports |
|---|---|
| `index.html` (landing) | `tokens.css`, `base.css`, `landing.css` |
| `kaohsiung/index.html` | `../assets/css/tokens.css`, `../assets/css/base.css`, `../assets/css/components.css` |
| Future `<trip>/index.html` | Same `../assets/css/` pattern |

## Adding a New Trip

1. Create a new folder: e.g., `tokyo/`
2. Copy `kaohsiung/index.html` → `tokyo/index.html`, update `<title>`
3. Create `tokyo/data.js` with the trip's `DEFAULT` export
4. Create `tokyo/app.js` — copy from `kaohsiung/app.js`, change `dbRef` path to `"tokyo-trip"`
5. Add one object to the `TRIPS` array in the root `index.html`

## Tech Stack

- Vanilla HTML + CSS + JS — no build step required
- Firebase Realtime Database (optional, for real-time sync)
- Leaflet 1.9.4 (map view in Food & Cafes tab)
- Google Fonts: Playfair Display + Lato
- All CDN dependencies, no local install needed
