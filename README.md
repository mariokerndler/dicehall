# Dicehall

Dicehall is a modern real-time D&D dice roller for Discord campaigns. A DM creates a lobby, shares the short lobby code, and players join with a username to roll together in a synchronized log.

## Features

- Create and join readable six-character lobbies.
- Session-based player identity with duplicate username handling.
- Shared real-time player list and roll log via Socket.IO.
- Dice controls for d4, d6, d8, d10, d12, d20, and d100.
- Quantity, modifier, player dice color, animated roll reveal, and final totals.
- DM-only controls for clearing the roll log and removing players.
- In-memory lobby state for a simple MVP.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test multiplayer locally, open two browser windows or two browser profiles. Create a lobby in one window, copy the code, and join from the other.

## Scripts

```bash
npm run dev     # Start the custom Next.js + Socket.IO server
npm run test    # Run Vitest dice logic tests
npm run lint    # Run Next.js linting
npm run build   # Build the Next.js app
npm run start   # Start the production custom server after build
```

## Deployment

For Hostinger Node.js Web App hosting, use the settings in [HOSTINGER_DEPLOYMENT.md](./HOSTINGER_DEPLOYMENT.md). Dicehall must run as a server-side Node.js app because the custom server powers Socket.IO.

## Notes

Lobby state is stored in memory and disappears when the server restarts. Authentication is intentionally out of scope for the MVP; browser session storage keeps the local player identity during a session.
