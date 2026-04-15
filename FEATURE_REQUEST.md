# Itinerary Feature Request

## Overview
This document defines the newly requested itinerary features for implementation.

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

## Feature 1: Landing Page — Itinerary List + Create

- Landing page fetches all itineraries from Firebase and displays them as cards.
- When no Firebase is configured, shows a static fallback (Kaohsiung card) and a "Set up Firebase" banner.
- "New Itinerary" card (with + icon) appears when Firebase is connected.
- Clicking "New Itinerary" opens a create modal with: Title, Destination, Cover Emoji, Start Date, End Date, Tags.
- On create, navigates directly to `/app/?id=<new-id>`.

### Acceptance Criteria
- User sees all their itineraries on the landing page (from DB).
- User can create a new itinerary and is taken to it immediately.
- No Firebase config = static fallback with setup prompt, no broken UI.

---

## Feature 2: Universal Itinerary App (`/app/`)

- One `/app/index.html` + `/app/app.js` serves ALL itineraries.
- Reads `?id=` from the URL to load the correct Firebase path (`itineraries/{id}`).
- Header shows the trip title, destination, and date range from `meta`.
- Missing `?id=` redirects back to landing page.

### Acceptance Criteria
- Opening `/app/?id=kaohsiung-2025` shows Kaohsiung data.
- Opening `/app/?id=itin-xyz` shows a new empty itinerary.
- All tabs (Itinerary, Packing, Budget, Food) work and sync to Firebase.
- Edits persist after page refresh.

---

## Feature 3: Drag-and-Drop Stop Reordering
- In the `Itinerary` tab, users can drag and drop stop cards to reorder their trip stops.
- The new order should save immediately.
- Visual feedback should show where the card will be dropped.

### Acceptance Criteria
- User can click/touch and drag a stop card.
- User can drop the card at a different position in the list.
- The updated order persists after refresh or revisiting the itinerary.

---

## Feature 4: Manage Itinerary Days and Dates
- Users can add new days to an itinerary.
- Users can edit existing day entries.
- Users can update itinerary dates (start date, end date, or per-day date).

### Acceptance Criteria
- User can add a day from the itinerary editor UI.
- User can edit day details without creating duplicates.
- User can change dates, and the itinerary reflects the updated schedule correctly.

---

## Notes
- Keep interactions simple and intuitive for first-time users.
- Ensure mobile usability for drag-and-drop and date editing if mobile support is required.
- The `/kaohsiung/` legacy folder is preserved and not modified.

---

## MVP Prioritization
### MVP (Build First)
1. **Database-Driven Landing + Create Flow** - Implemented
   - All itineraries from Firebase shown on landing page.
   - Create new itinerary via modal.
2. **Universal App (`/app/`)** - Implemented
   - Single app folder loads any itinerary by ID.
3. **Map + Route Optimization (Basic)**
   - Show itinerary stops on a map.
   - Reflect travel time/distance when stop order changes.
4. **Templates**
   - Provide starter itinerary templates (e.g., weekend, family, business).
5. **Calendar Sync (One-Way Export)**
   - Let users export itinerary events to calendar (`.ics` or Google Calendar).
6. **Checklists & Reminders**
   - Add pre-trip task lists and due-date reminders.
7. **Budget Tracking (Simple)**
   - Track estimated trip cost and day-level spending.

### Why This Is MVP
- Fastest path to core user value (planning speed and trip organization).
- Single app folder = zero duplication when adding new trips.
- Lower integration complexity than advanced collaboration/AI features.
