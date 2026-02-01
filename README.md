# Wahlkampf Karlsruhe 2026 - Campaign Visualization

An interactive web application that visualizes election campaign activities (house visits and poster placement) on a map of Karlsruhe with timeline controls.

## Features

- **Interactive Map**: OpenStreetMap with Leaflet showing all campaign activities across Karlsruhe
- **Two-Layer Visualization**:
  - Cumulative layer (semi-transparent) showing all past activities
  - Recent activity layer (bright, pulsing) highlighting the last 5 days
- **Timeline Controls**: Scrub through January-March 2026 with play/pause and speed controls
- **Statistics Dashboard**: Live-updating counts for locations, doors knocked, flyers distributed, and posters placed
- **Fullscreen Ad Mode**: Auto-playing visualization for recording campaign videos
- **Privacy Protection**: All coordinates are blurred by 30-100 meters for privacy
- **Responsive Design**: Works on desktop, tablet, and mobile

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Keyboard Shortcuts

- **Space**: Play/Pause timeline
- **F**: Toggle fullscreen/ad mode
- **R**: Reset to start

## Eigene Kampagnendaten hinzufügen

Lege beliebig viele JSON-Dateien unter `src/data/activity-files/` ab. Alle Dateien werden beim Build gebündelt und gemeinsam geladen.

Rohdaten (privat) kannst du in `raw-exports/` ablegen (wird git-ignored). Mit `npm run transform` werden alle dortigen JSONs automatisch nach `src/data/activity-files/<name>-transformed.json` konvertiert.

### Format pro Datei

```json
[
  {
    "date": "2026-01-15",
    "type": "HOUSE",
    "lat": 49.0069,
    "lng": 8.4037,
    "count": 12
  },
  {
    "date": "2026-01-15",
    "type": "POSTER",
    "lat": 49.0089,
    "lng": 8.4127,
    "count": 5
  }
]
```

### Aktivitätstypen

| Type     | Beschreibung   |
| -------- | -------------- |
| `HOUSE`  | Haustürbesuche |
| `POSTER` | Plakate kleben |

## Privacy

All coordinates are automatically blurred by 30-100 meters using a deterministic offset (same location always gets the same blur). This protects exact addresses while maintaining the visual accuracy of the coverage map.

## Configuration

Edit the constants at the top of `src/main.ts`:

```typescript
const KARLSRUHE_CENTER: L.LatLngTuple = [49.0069, 8.4037] // Map center
const INITIAL_ZOOM = 12 // Initial zoom level
const START_DATE = new Date('2026-01-01') // Timeline start
const END_DATE = new Date('2026-03-31') // Timeline end
const RECENT_DAYS = 5 // Days to highlight
const AD_MODE_DURATION = 25000 // Fullscreen duration (ms)
```

## Project Structure

```
campaign-viz/
├── src/
│   ├── main.ts              # Main application logic
│   ├── style.css            # Tailwind + custom styles
│   ├── data/
│   │   └── activities.ts    # Campaign data
│   └── utils/
│       └── privacyBlur.ts   # Coordinate blurring
├── public/                   # Static assets
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
└── package.json             # Dependencies
```

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Leaflet](https://leafletjs.com/) - Interactive maps
- [OpenStreetMap](https://www.openstreetmap.org/) - Map tiles
- [date-fns](https://date-fns.org/) - Date handling
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## License

MIT
