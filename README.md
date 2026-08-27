# Maltese Snow War
Open-source fan tribute. Produced by Gary.TC. Gameplay after SnowCraft; fight feel also referenced snowcraftjs by jeffreywilbur.
<img width="598" height="336" alt="banner" src="https://github.com/user-attachments/assets/b7122350-a3a8-4901-a208-d2569200165f" />

<p align="center">
  <img src="public/og.jpg" alt="Maltese Snow War" width="640">
</p>

Browser snowball fight: three Maltese vs golden retrievers. Hold a dog to move, release to throw, pack snow between shots. Two hits bury; ellipse forts block shots.

**Play:** [maltese-snowwar.grok.me](https://maltese-snowwar.grok.me/)

> Unofficial fan tribute (二次創作) to Nicholson NY’s **SnowCraft** (1998). Dogs after 線條小狗 (moonlab). Not affiliated with the original authors.

## How it plays

| Hold / dodge | Throw |
|:---:|:---:|
| ![Hold to move](public/readme/hold-dodge.gif) | ![Release to throw](public/readme/throw.gif) |
| **Pack snow** | **Brawl** |
| ![Pack](public/readme/pack.gif) | ![Two-hit bury](public/readme/brawl.gif) |
| **Big snowball** | **Victory** |
| ![Big snowball](public/readme/big-snowball.gif) | ![Victory dance](public/readme/victory.gif) |

- **Hold** a dog to move and dodge; **release** to throw (auto-aims the nearest foe)
- Pack snow between shots — you cannot fire while packing
- Two hits bury a dog; forts eat snowballs that pass through them
- **Big snowball** orb can drop mid-fight. Any dog may collect it. That team gets **3 player throws / 10s** (2 HP). A second pickup refills. Clash: big vs normal shrinks the big ball; two bigs shatter
- Solo **star mode**: tap the Level HUD 5× — faster pack/charge, more HP
- Host/solo **test orb**: double-tap the **X vs Y** score HUD

## Modes

| | |
|---|---|
| **vs AI** | You are the Maltese (right, red hats). Retrievers on the left. Easy stays on their half and only throws forward. Hard can cross midfield, shoot backward, and dodge well |
| **vs Friend** | Same URL on two devices. Host is always Maltese; guest is mirrored and plays Retrievers. Share the 6-letter code or QR |
| **Allies** | Unselected Maltese: Manual / Defend (hold forts, peek-throw) / Attack (press in, shoot around forts, punish after the foe throws) |

Languages: English · 繁中 · 简体 · 日本語 · 한국어 (EN + 繁中 load first; others on select). Mute from the landing globe row or **M**.

## Local development

```bash
npm ci
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm test
npm run build
```

## Network

There is no game-sim server. The **host browser is the authority**; a small signaling helper only lets the two browsers find each other.

Host sim + reliable events (throw / hit / over / loot). Unreliable binary pose ~14–20 Hz. Throw delay uses a smoothed RTT clamp. If the guest DataChannel stays down ~3s mid-match, local AI (`src/game/ai.ts`) takes over their team.

Details: [Maltese-Snow-War-Architecture.pdf](public/Maltese-Snow-War-Architecture.pdf)

| Layer | Choice |
|--------|--------|
| UI | TanStack Start + React + Vite |
| Sim | Canvas 2D, fixed timestep (`src/game/sim.ts`) |
| Net | WebRTC P2P listen-server (`VersusLink`) |
| Audio | Web Audio holiday loops (no copyrighted carols) |

## Credits

Open-source fan work. Produced by **Gary.TC**. Gameplay after SnowCraft; fight feel also referenced [snowcraftjs](https://github.com/jeffreywilbur/snowcraftjs) by jeffreywilbur.

_This is my first vibe-coding project — let me know if you have thoughts!_
