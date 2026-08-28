# Maltese Snow War
A browser-based snowball fight: three Maltese vs golden retrievers. Fan tribute to the Flash game “SnowCraft”. Hold a dog to move, release to throw, pack snow between shots. Two hits bury; ellipse forts block shots.

**Play Now:** [maltese-snowwar.grok.me](https://maltese-snowwar.grok.me/)

> Unofficial fan tribute (二次創作) to Nicholson NY’s **SnowCraft** (1998). This repo’s dogs are original Christmas chibi pups (小白 / 小金毛). Not affiliated with the original authors.

<p align="center">
  <img src="public/og.jpg" alt="Maltese Snow War — Line Puppy banner" width="640">
</p>

Action clips below use the Christmas pups (小白 / 小金毛). Tap the title dog heads on [grok.me](https://maltese-snowwar.grok.me/) to switch.

## How it plays

<table>
<tr>
<td width="56%"><img src="public/readme/hold-dodge.gif" alt="Hold / dodge"></td>
<td>

**Hold / dodge**  
Press and drag a Maltese (the finger) to move. Sidestep incoming snowballs before you throw.

</td>
</tr>
<tr>
<td><img src="public/readme/throw.gif" alt="Throw and pack"></td>
<td>

**Throw & pack**  
Tap for a **short** toss. Keep holding to charge a **long** throw. After each shot the dog packs snow before it can throw again.

</td>
</tr>
<tr>
<td><img src="public/readme/auto-aim.gif" alt="Auto-aim nearest foe"></td>
<td>

**Auto-aim**  
While you hold, the dashed line points at the **nearest hittable** opponent (not someone in or behind a snow pile). If nobody is in a clear shot, there is no line and release does not throw.

</td>
</tr>
<tr>
<td><img src="public/readme/brawl.gif" alt="Hit and bury"></td>
<td>

**Hit / bury**  
One snowball **hits** (stun). A second hit **buries** that dog. Forts eat balls that pass through them.

</td>
</tr>
<tr>
<td><img src="public/readme/big-snowball.gif" alt="Big snowball"></td>
<td>

**Big snowball**  
When the gold-rim orb appears, walk onto it or tap it. Your team gets **3 player throws / 10 s** (2 HP) — the bar and dots show time and shots left. Thrown big balls match the orb (white snow, gold rim), fly at **0.8×** speed, and vs AI need **1.2×** hold for max range. A small ball **shrinks** a big one (then HP−1); two bigs shatter. PvP: blinking red *Opponent has the big snowball!* A second pickup refills 3 / 10 s. AI throws stay normal.

</td>
</tr>
<tr>
<td><img src="public/readme/victory.gif" alt="Victory"></td>
<td>

**Victory**  
Clear the retrievers to win. Fight again, or back to the title.

</td>
</tr>
</table>
> Cheats (test only)
> - Solo **star mode**: tap the Level HUD 5× — faster pack/charge, more HP
> - Host/solo **instant orb**: double-tap the **X vs Y** score HUD

## Modes

| | |
|---|---|
| **vs AI** | You are the Maltese (right, red hats). Retrievers on the left. Easy stays on their half and only throws forward. Hard can cross midfield, shoot backward, and dodge well |
| **vs Friend** | Same URL on two devices. Host is always Maltese; guest is mirrored and plays Retrievers. Share the 6-letter code or QR |
| **Allies** | Unselected Maltese: Manual / Defend (hold forts, peek-throw) / Attack (press in, shoot around forts, punish after the foe throws) |

Languages: English · 繁中 · 简体 · 日本語 · 한국어 (EN + 繁中 load first; others on select). Mute from the landing globe row or **M**.

Landing boot: spinner + English title assets, then Play vs AI / Friend. Action sprites load **after** the mode is chosen (progress bar) — nothing streams in mid-match.

## Character skins

Two casts:

| Pack | Path | Who uses it |
|---|---|---|
| **Line Puppy** (default on grok.me) | `public/sprites/` | Title dogs, in-game, until you switch |
| **Christmas pups** 小白 / 小金毛 | `public/skins/xmas/sprites/` | Tap the title heads to switch |

Snowballs / forts / impacts stay shared in `public/sprites/fx/` (except `buried-*.png`, which follows the skin).

### In the running game

On the title card, tap the **two round dog heads** (top-right, under mute / language). That toggles Line Puppy ⇄ Christmas. The choice is stored as `localStorage.msw-skin-v2`.

[grok.me](https://maltese-snowwar.grok.me/) always **starts on Line Puppy**.

### Swap or add dogs yourself

PNG, ~128×128, **transparent background**, character facing **left** (the game mirrors). Keep `idle-1.png` as the title portrait.

```
red/     idle throw hurt walk pack wave dance   × 1–4.png   ← right team
green/   idle throw hurt walk pack wave dance   × 1–4.png   ← left team
fx/      buried-red.png  buried-green.png
```

- Replace the default cast in `public/sprites/`
- Or drop a second cast in `public/skins/xmas/sprites/` so the title heads can toggle it

Bump `SKIN_VER` in `src/game/assets.ts` if the browser caches old PNGs.

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

Host sim + reliable events (`throw` / `hit` / `over` / `loot` / `got` / `claim`). Unreliable binary pose ~14–20 Hz. Throw delay uses a smoothed RTT clamp. If the guest DataChannel stays down ~3s mid-match, local AI (`src/game/ai.ts`) takes over their team.

Details: [Maltese-Snow-War-Architecture.pdf](public/Maltese-Snow-War-Architecture.pdf)

| Layer | Choice |
|--------|--------|
| UI | TanStack Start + React + Vite |
| Sim | Canvas 2D, fixed timestep (`src/game/sim.ts`) |
| Net | WebRTC P2P listen-server (`VersusLink`) |
| Audio | Web Audio holiday loops (no copyrighted carols) |

## Credits

Fan work by **Gary.TC**. Gameplay after SnowCraft; fight feel also referenced [snowcraftjs](https://github.com/jeffreywilbur/snowcraftjs) by jeffreywilbur.

_This is my first vibe-coding project — let me know if you have thoughts!_

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — see [LICENSE](LICENSE).

You may copy, learn from, and adapt this repo **for non-commercial use**, with attribution, and keep the same license on remixes. Selling the game, putting it behind ads/paywalls, or using it as a company product is not allowed.

This does **not** license SnowCraft, its name, or other IP from Nicholson NY. Line Puppy art is not published in this GitHub tree.
