# CLAUDE.md

See [AGENTS.md](AGENTS.md) for detailed project guidance, architecture, and conventions.

## Quick Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
npm run format     # Format code
npm run transform  # Transform raw data (blurs coordinates)
```

## Key Points

- Stack: Vite 7 + TypeScript (strict) + Leaflet + Tailwind CSS v4
- Entry: `src/main.ts`
- Privacy: Never commit raw coordinates; always use blurred data
- Validate changes with `npm run build` and manual testing
