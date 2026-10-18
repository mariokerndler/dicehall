# Hostinger Deployment

Dicehall must be deployed as a server-side Node.js app because it uses a custom Next.js server with Socket.IO. Do not deploy it as a static `public_html` site.

## Recommended Hostinger Setup

- Hosting type: Node.js Web App hosting
- Framework: Next.js or Other, depending on Hostinger auto-detection
- Node.js version: 22.x or 24.x LTS. Node.js 20 is end-of-life and is no longer supported by this project.
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Output directory, if requested: `.next`
- Entry file, if requested: `server.js`

If Hostinger only shows a build command field, leave it as `npm run build`. Do not put `node server.js` in the build command, because build commands must exit. Hostinger should start the app from the `start` script in `package.json` or from the `server.js` entry file setting.

If the panel does not show an entry file setting either, the app was likely created as a static/front-end app instead of a Node.js app. Recreate the site through Hostinger's Node.js Apps/Web App hosting flow and select `Other` or `Express` if the Next.js preset serves only static output.

## Environment Variables

- `PORT`: set by Hostinger automatically.
- `DICEHALL_ALLOWED_ORIGINS`: set this to the deployed origin, for example `https://your-domain.com`. Use a comma-separated list if you deploy the same app behind multiple domains.
- `DICEHALL_TRUSTED_PROXIES`: comma-separated IP addresses or CIDR ranges of your actual reverse proxies. Defaults to `loopback`, which supports a proxy on the same machine. If Hostinger uses a separate ingress proxy, obtain its address/range from Hostinger and set that exact value. An empty value disables proxy trust for a directly exposed server. Do not set this to all addresses or copy an unrelated network range.
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

- Commit both `package.json` and `package-lock.json`, deploy with `npm ci`, and redeploy after security updates. Hostinger scans the deployed dependency versions; a local update does not update the live application or its scanner results.
- HTTP feedback and Socket.IO use the same trusted-proxy configuration to identify clients. Reconnects share the same address limits; roll and DM-action limits also follow authenticated player identities.
- Default limits: 5 lobby creations and 60 join attempts per address per minute, 30 rolls per player per minute, 20 requests per DM control per player per minute, 600 total events per address per minute, 60 connections per address per minute, and 48 simultaneous connections per address. The join budget allows a full table sharing an address to reconnect together. The server allows at most 6,000 simultaneous Socket.IO connections.
- Only enable forwarded client-address handling for proxies that overwrite or append the real client address correctly. For forwarded Host values, configure the public origin in `DICEHALL_ALLOWED_ORIGINS`; arbitrary `X-Forwarded-Host` values are not trusted.
- Active lobbies are stored in memory. They disappear when Hostinger restarts or redeploys the app.
- For long-lived sessions or multi-instance hosting, move lobby state to a shared store such as Redis, Supabase, or Postgres.
- Rate limits are also held in one process. Use a shared limiter before enabling multiple server instances.
- If the app is deployed from GitHub, redeploy after changing environment variables or build settings.

See [SECURITY.md](./SECURITY.md) for the dependency audit results and the remaining build-tool advisory.
