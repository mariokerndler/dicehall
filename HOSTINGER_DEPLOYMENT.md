# Hostinger Deployment

Dicehall must be deployed as a server-side Node.js app because it uses a custom Next.js server with Socket.IO. Do not deploy it as a static `public_html` site.

## Recommended Hostinger Setup

- Hosting type: Node.js Web App hosting
- Framework: Next.js or Other, depending on Hostinger auto-detection
- Node.js version: 22.x, or any supported 20.x+ version
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Output directory, if requested: `.next`
- Entry file, if requested: `dist/server.js`

## Environment Variables

- `PORT`: set by Hostinger automatically.
- `NEXT_PUBLIC_SOCKET_TRANSPORTS`: optional. Leave unset for Hostinger Web App hosting so Socket.IO uses HTTP polling. Set to `polling,websocket` only on hosts that support incoming WebSocket upgrades, such as a VPS with a correctly configured proxy.

## What the Build Produces

`npm run build` does two things:

1. Builds the Next.js app into `.next`.
2. Bundles the custom Express and Socket.IO server into `dist/server.js`.

Hostinger should run the bundled server with `npm run start`. The server reads Hostinger's `PORT` environment variable automatically and binds to `0.0.0.0`.

## Realtime Health Check

After deployment, visit `/api/realtime-health` on the live domain. A working custom server returns JSON like:

```json
{
  "ok": true,
  "service": "dicehall-realtime",
  "socketPath": "/socket.io"
}
```

If that route returns a Next.js 404 page or static HTML, Hostinger is not running `npm run start` against `dist/server.js`.

## Deployment Notes

- Active lobbies are stored in memory. They disappear when Hostinger restarts or redeploys the app.
- For long-lived sessions or multi-instance hosting, move lobby state to a shared store such as Redis, Supabase, or Postgres.
- If the app is deployed from GitHub, redeploy after changing environment variables or build settings.
