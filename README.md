# Maltese Snow War
Open-source fan tribute. Produced by Gary.TC. Gameplay after SnowCraft; fight feel also referenced snowcraftjs by jeffreywilbur.
<img width="598" height="336" alt="banner" src="https://github.com/user-attachments/assets/b7122350-a3a8-4901-a208-d2569200165f" />

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
**Maltese Snow War** is a canvas snowball fight in the browser. Hold a dog to move, release to throw, pack snow between shots. Two-hit bury, ellipse forts, pack-snow cooldown.  It is an unofficial fan tribute to Nicholson NY’s SnowCraft (1998) using moonlab’s puppy illustrations named Maltese.

There is two modes: Play vs AI (Easy / Hard) on one machine, and Play vs Friend connected two devices via a 6-letter room code.  VS AI uses three white Maltese (red hats) stand on the right against several brown Retriever (green hats) on the left.  For VS Friend, the host always plays the Maltese, guest is mirrored and plays the Retriever.

There is no dedicated game-simulation server — the host’s browser is the authority; a small signaling server only helps the two browsers find each other, and various netcode techniques.

Try the demo here:
[maltese-snowwar.grok.me](https://maltese-snowwar.grok.me/)

To understand more, pls refer:
https://github.com/rayony/maltese-snowwar/blob/main/public/Maltese-Snow-War-Architecture.pdf

_This is my first vibe coding project, let me know if you have any thoughts! - Gary.TC_

<img width="500" height="362" alt="landing" src="https://github.com/user-attachments/assets/10dbde96-4dcf-4d43-8d39-02843b9b11a0" />
<img width="500" height="399" alt="gameplay" src="https://github.com/user-attachments/assets/6edac842-4cd3-4fe4-a42a-cac1589d0b79" />

