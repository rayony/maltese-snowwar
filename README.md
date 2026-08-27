# Maltese Snow War

Fan tribute to classic **SnowCraft** (Nicholson NY, 1998): three Maltese vs golden retrievers in a snowball brawl. Browser P2P multiplayer (WebRTC listen-server), solo vs AI, and a star-mode cheat.

> Unofficial fan work (二次創作). Dogs inspired by 線條小狗 (moonlab). Not affiliated with the original authors.

## Live play

- Deploy from this repo (Vercel / your host) after `npm run build`
- Open the same URL on two devices → **Play vs Friend** → share the 6-letter room code or QR

## Tech highlights

| Layer | Choice |
|--------|--------|
| UI | TanStack Start + React + Vite |
| Sim | Canvas 2D, fixed-timestep (`src/game/sim.ts`) |
| Net | Host-authoritative WebRTC P2P (`VersusLink`, binary pose + reliable events) |
| Audio | Web Audio holiday loops (no copyrighted carols) |
| i18n | EN · 繁中 · 简体 · 日 · 韓 |

Architecture notes: [`public/Maltese-Snow-War-Architecture.pdf`](public/Maltese-Snow-War-Architecture.pdf)

## Local development

```bash
npm ci
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm test             # includes src/game/sim.test.ts and src/game/wire.test.ts
npm run build
```

## Controls

- **Hold** a dog to move / dodge
- **Release** to throw (auto-aims nearest foe in PvP)
- Pack snow between shots
- **Star mode**: tap Level HUD 5× (solo) — faster pack/charge, stronger HP
- **Big snowball**: glowing orb drops mid-fight; any dog (player or AI) can collect it. That team gets **3 player throws / 10s** (2 HP). Picking another orb refills to 3 / 10s. Double-tap the **X vs Y** score HUD (host/solo) to spawn one for testing
- **M** or landing mute button — mute

## Network model (short)

Host runs the authoritative sim. Guests send inputs; host broadcasts **binary pose** (~14–20 Hz, dual-send on unreliable + reliable DataChannels) and reliable events (throw / hit / over). Throw delay uses a smoothed RTT clamp. If the guest DataChannel stays down for ~3s mid-match, the host hands their team to local AI (`ai.ts`) instead of ending the round. See the architecture PDF § netcode.

## License / credit

Open-source fan tribute. Produced by Gary.TC. Gameplay after SnowCraft; fight feel also referenced snowcraftjs by jeffreywilbur.
