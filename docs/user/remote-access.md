# Remote Access

Use this when you want to control your Workbench from another device — a phone, tablet, or a second computer — while the Workbench itself keeps running on your Mac.

## The Workbench Way: Settings → Connections

Everything you need is inside the desktop app:

1. Open **Settings** → **Connections**.
2. Under **This environment**, toggle **Network access** on. The app restarts its backend so other devices on your network can reach it.
3. The panel shows the default reachable endpoint, with a `+N` control when more endpoints are available (loopback, LAN, private-network, or HTTPS endpoints).
4. Use **Create Link** to generate a pairing link, shown with a QR code.
5. On your phone, scan the QR code (or open the pairing link on the other device).

The default endpoint controls the QR code and primary copy action for pairing links. You can change it from the expanded endpoint list; the preference is stored by endpoint type, so choosing the LAN endpoint survives normal IP address changes when you move between networks.

If the copied link points at `http://192.168.x.y:3773`, open it from a device on the same network. Loopback-only endpoints are not useful from another device.

## Recommended: Use a Tailnet

A trusted private mesh network such as [Tailscale](https://tailscale.com) gives you a stable address, transport security at the network layer, and far less exposure than opening the server to the public internet.

When the desktop app detects Tailscale, it adds Tailnet endpoints to the endpoint list automatically:

- the machine's `100.x.y.z` Tailnet IP
- a MagicDNS name
- an HTTPS MagicDNS endpoint when Tailscale Serve is configured

The Tailscale HTTPS endpoint uses the clean MagicDNS URL, such as `https://machine.tailnet.ts.net/`, and is off until you opt in: turn on **Enable Tailscale HTTPS** on the **Tailscale HTTPS** row in **Settings** → **Connections**. The app restarts the backend and asks Tailscale Serve to proxy HTTPS traffic to it. Turn the same switch off to stop it.

Tailscale is an add-on, not a requirement — LAN HTTP endpoints and custom HTTPS endpoints use the same saved environment and pairing flow.

## How Pairing Works

The remote device does not need a long-lived secret up front:

1. The Workbench issues a one-time owner pairing token (embedded in the pairing link/QR code).
2. The remote device exchanges that token with the server.
3. The server creates an authenticated session for that device.

After pairing, access is session-based; you only reuse a token to pair a new device.

Ringside data travels through this same connection — a paired phone sees the same thread-scoped Ringer runs as the desktop, without connecting to anything else.

## Security Notes

- Treat pairing URLs and pairing tokens like passwords.
- Anyone with a valid pairing credential can create a session until that credential expires or is revoked.
- Prefer Tailnet or LAN endpoints over anything reachable from the public internet.
- Pairing links can leak through browser history, screenshots, logs, or copy/paste — share them deliberately.

---

## Upstream-Only CLI Flows (Not the Workbench)

> **Warning:** everything below runs `npx t3 ...`, which downloads the **upstream T3 Code product from npm** — a different app. It will not run your Workbench, its catalog, or its Ringer runtime. These flows are documented here only for maintainers working across both products; subscribers should stay with the desktop-app flow above.

The upstream CLI offers equivalent remote features against an upstream server:

- `npx t3 pair` mints a fresh pairing token and QR code for a running upstream server; `npx t3 pair --tailscale` pairs over Tailscale Serve HTTPS.
- `npx t3 serve --host "$(tailscale ip -4)"` runs a headless upstream server and prints a connection string, pairing token, pairing URL, and QR code; `--tailscale-serve` publishes it over Tailscale HTTPS.
- The upstream desktop app can launch an upstream server on another machine over SSH (**Settings** → **Connections** → **Add environment** → SSH launch); the remote host needs a Node version satisfying upstream's `engines` range.
- `npx t3 auth` issues, inspects, and revokes pairing credentials and sessions.
- The hosted web app at `https://app.t3.codes` can pair with HTTPS-reachable upstream backends.

For those flows, use upstream's documentation. For this fork's server internals, see [docs/internals/remote.md](../internals/remote.md).
