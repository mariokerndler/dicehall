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
- Entry file, if requested: `server.js`

If Hostinger only shows a build command field, leave it as `npm run build`. Do not put `node server.js` in the build command, because build commands must exit. Hostinger should start the app from the `start` script in `package.json` or from the `server.js` entry file setting.

If the panel does not show an entry file setting either, the app was likely created as a static/front-end app instead of a Node.js app. Recreate the site through Hostinger's Node.js Apps/Web App hosting flow and select `Other` or `Express` if the Next.js preset serves only static output.

## Environment Variables

- `PORT`: set by Hostinger automatically.
- `NEXT_PUBLIC_SOCKET_TRANSPORTS`: optional. Leave unset for Hostinger Web App hosting so Socket.IO uses HTTP polling. Set to `polling,websocket` only on hosts that support incoming WebSocket upgrades, such as a VPS with a correctly configured proxy.

## What the Build Produces

`npm run build` does two things:

1. Builds the Next.js app into `.next`.
2. Bundles the custom Express and Socket.IO server into `dist/server.js`.

Hostinger should run the root `server.js` launcher through `npm run start`. The launcher loads the bundled custom server from `dist/server.js`. The server reads Hostinger's `PORT` environment variable automatically and binds to `0.0.0.0`.

## Realtime Health Check

After deployment, visit `/api/realtime-health` on the live domain. A working custom server returns JSON like:

```json
{
  "ok": true,
  "service": "dicehall-realtime",
  "socketPath": "/socket.io"
}
```

If that route returns a Next.js 404 page or static HTML, Hostinger is not running `npm run start` against `server.js`.

## Deployment Notes

- Active lobbies are stored in memory. They disappear when Hostinger restarts or redeploys the app.
- For long-lived sessions or multi-instance hosting, move lobby state to a shared store such as Redis, Supabase, or Postgres.
- If the app is deployed from GitHub, redeploy after changing environment variables or build settings.
