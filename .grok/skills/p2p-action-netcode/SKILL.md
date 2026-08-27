---
name: p2p-action-netcode
description: >
  Host-authoritative listen-server netcode for 1v1 / tiny-cast WebRTC action
  games (snowball fights, brawlers, sports). Use when building versus mode,
  guest/host seats, pose streams, hit confirm, interpolation, or debugging
  “dogs freeze until dragged”, false hits, rematch never starting, or LAN lag.
  Complements multiplayer-p2p (mesh/signaling). Do not use GGPO or a dedicated
  sim server unless ranked matchmaking. Triggers: pvp, versus, listen-server,
  host-authoritative, interpolation, rollback, datachannel, guest prediction,
  snowball, rematch, RTT, TURN.
metadata:
  short-description: "Listen-server P2P: host owns score, guest owns feel"
user-invocable: false
---

# P2P action netcode (listen-server)

Proven on **Maltese Snow War** (1v1 WebRTC, ~6 actors, projectile snowballs).
Transport lives in the **`multiplayer-p2p`** skill (`P2PRoom`, `/api/rtc`, TURN).
This skill is the **gameplay layer** on top.

**Rule of thumb:** host owns score, guest owns feel, never treat a dropped UDP
as truth, never predict HP.

Load **`references/failed-attempts.md`** before re-inventing a pipe that already
failed.

---

## 1. Authority

| Seat | Sim | Paint |
|---|---|---|
| **Host** | Real `stepSim` + collisions + winner | Instant move. Throw = ghost now, collide after `clamp(RTT/2, 30–80ms)` |
| **Guest** | Local move / throw / ally AI for **own team only** | Interp remote actors 55–70ms in the past. Optional spark. HP/SFX from host `hit` |

- Guest **never** decides bury or winner. Infer over three ways: tiny `over`, pose `phase`, snap.
- One host per room (room creator). Guest canvas may be **mirrored** so they play from the right.
- Delay the **host throw**, not host **move** — the stick must follow the finger.

Vs AI on one machine: same sim, **no net**. Do not reuse PvP charge/range if the two seats would disagree.

---

## 2. Wire split

Two SCTP channels + HTTP belt (`versus-link` pattern):

| Msg | Channel | When |
|---|---|---|
| `pose` / `allypose` / `snap` | **Unreliable + reliable copy** | 14–20 Hz / guest yard / 1.2s keyframe |
| `input` move | Dual-send | Guest drag |
| `input` down/up, `throw`, `allythrow`, `hit` | Reliable + HTTP copy | Events |
| `over` / `start` / `rematch` / `packed` / `bye` | Reliable + unreliable + HTTP; **ignore seq-drop** | Outcomes; `over` resent ~0.35s |

**Why copy poses onto reliable:** LAN / iOS unordered SCTP often **drops with no error**. Actors freeze until that unit is dragged (drag used a reliable `input`). Dual-send; unreliable still wins on freshness via seq.

**Two sequence spaces:** `lastIn` (events) vs `lastPose` (pose/allypose/move/hb). One space lets a pose seq eat rematch/over.

Payloads stay tiny JSON: `id, x, y, vx, vy, facing, state, hp` + live balls. Full snap is **recovery only** and must **not clobber** local/ghost balls.

Guest **always** streams own-team poses (`allypose`), even in Manual — clamp-to-screen is local and otherwise never reaches the host.

---

## 3. Clocks and motion

- Ping every ~2s → `rttMs` + `clockOffset` (smooth 0.8/0.2).
- **Live** RTT, not lobby ping: ICE can flip STUN→TURN mid-match.
- Guest paints remotes with **interpolation** (two pose samples, 55–70ms in the past). **Not** `x += vx * rtt` dead reckoning (skates through cover).
- Host paints guest units at **live sim x,y** — do not interp a unit you already applied from `input`/`allypose`.
- Grabbed local unit: never overwrite from pose.
- Throw packets carry `t0`. Host maps through `clockOffset`: queue if early, **projectile catch-up** (one ball vs pose history) if ≤~200ms late. Not hitscan rewind.

---

## 4. Hits (cosmetic vs score)

HP / bury / bark / winner = **host `hit` only**.

Guest juice from **smoothed RTT** (upgrade instantly, downgrade after 2s):

| RTT | Guest paint | Score / SFX |
|---|---|---|
| < 55ms | Wait | Host `hit` |
| 55–120ms | Spark only | Host `hit` |
| > 120ms | Spark + light hurt pose (rollbackable) | Host `hit` |

Test against **latest pose + half-RTT**, never the interpolated `viewX` (that ghost is already late → false hits).

Guest should **fly all balls** and prune unmatched local host-throws after a short hold — do not wait 220ms to reconcile.

---

## 5. Guest-local simulation

Guest typically **does not** run host `stepSim`. Then you **must** still tick on the guest:

- `packT`, `cooldown`, `stun`, `freeze`, throw/hurt `stateT`
- Intro → fight when host pose says `phase: fight`

If `cooldown` never ticks, ally bots throw once and **stand still** (windup blocked forever).

Ally AI steps locally; send `allythrow` + `allypose`. Host is still collision authority.

Presentation (fidget, walk cycle, aim line, particles, 3-2-1, SFX) is **local**. Do not network it.

---

## 6. Fairness knobs (PvP vs local)

If charge/range is a **local timer**, two seats will disagree under RTT.

Pattern that worked: Versus = auto-aim **direction**, **fixed range + speed**, pack as the cadence. Tap = hold. Keep charge only for vs-AI.

Host delay on throws (`clamp(RTT/2, 30–80ms)` + ghost ball) equalizes first contact without delaying drag.

---

## 7. Session / UX that looks like netcode

- Packed handshake: do not `start` until **both** have sprites.
- Rematch in-room (no new code). Ignore late rematch if already `fight`/`intro`.
- Disconnect: pause → bot / wait / end. Detect via heartbeat, not only `bye`.
- HUD: `direct` vs `relay`, RTT, fps — so lag is not blamed on art.
- TURN from **server env**, never git. ICE restart if stuck; HTTP/SSE fallback for join/events, not the live pose stream.
- `select-none` + drop stale pointer capture — “Select All” looks like a net hang.

---

## 8. Do not

See **`references/failed-attempts.md`**. Short list:

- Full-yard snapshot 12–20Hz as the live stream
- HTTP 40ms poll as the primary pipe
- Unreliable-only poses
- One seq space for poses and events
- Guest always-on HP/SFX prediction
- GGPO / lockstep (sim has `Math.random` + wall clocks)
- Dedicated sim server for a 6-actor friend room (LAN gets slower)
- Protobuf for a few hundred bytes of JSON
- TURN credentials in the repo

---

## 9. Finish checklist (versus)

- [ ] Idle units stay aligned **without dragging**
- [ ] Guest ally bots still walk/throw after the first shot
- [ ] False hits rare; bark/HP wait for host
- [ ] Host win/lose reaches guest; rematch does not need a new code
- [ ] Disconnect offers bot / wait / end
- [ ] HUD shows direct/relay + RTT
- [ ] TURN not in git; `.env.example` empty
