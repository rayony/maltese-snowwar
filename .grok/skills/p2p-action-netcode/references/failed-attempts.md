# Failed / unused netcode (do not rebuild)

Source: Maltese Snow War, 2026. Live stack is in `p2p-action-netcode/SKILL.md`.

| Attempt | What happened | Kept instead |
|---|---|---|
| Full-yard snapshot 12–20 Hz as the live stream | Fat, 70–220 ms feel, balls popped on late snap | Thin pose + event throws/hits. Snap every 1.2 s, does not clobber local balls |
| HTTP poll ~40 ms as primary pipe | Extra RTT + jitter; JSON poll of the yard | WebRTC first. HTTP/SSE for join, ICE, rare event copies |
| Unreliable-only poses (unordered SCTP) | LAN/iOS drop with no error. Units freeze until dragged (drag used reliable `input`) | Dual-send pose / allypose / snap on reliable. Unreliable for freshness |
| One sequence space for poses and events | High pose seq made rematch / over / start look stale | `lastIn` vs `lastPose`. Outcome packets ignore seq-drop |
| Guest always-on hit prediction (HP/SFX) | “Hit” spark + bark on a miss (lagged target) | Host `hit` is the only HP/SFX. Cosmetic spark is RTT-tiered |
| Predict hits on interpolated `viewX` | Paint pose is already 55–70 ms late → more false positives | Test latest pose + half-RTT, never the interpolated sprite |
| Wait ~220 ms before reconciling balls | Ghost balls hung; real balls late; clashes random | Guest flies every ball. Prune unmatched local host-throws after a short hold |
| `vx·lead` dead reckoning | Opponent skated through cover; fought host delay | Guest interpolates in the past. Host draws guest live |
| Host interpolating guest dogs from poseHist | Host already applied `input`. Extra 70 ms made host see its own apply late | Only guest interpolates remotes |
| `allypose` only while Defend/Attack | Manual guest still clamp-to-screen locally; host never heard x,y until drag | Guest always streams living own-team poses (skip grabbed; that uses `input`) |
| Guest skipping cooldown / pack ticks | Guest does not run `stepSim`. After first ally throw, `cooldown` stuck, windup never finished | `stepPresentation` ticks cooldown, packT, stun, freeze |
| Fat `WireState` `over` packet | Easy to drop; two winners | Tiny `{ winner }` reliable + HTTP, resent 0.35 s, plus `pose.phase` |
| Charge-based PvP throws | Tap-near / hold-far disagreed across seats | Versus: auto-aim direction, fixed range/speed, pack as cadence |
| GGPO / full rollback | Needs a deterministic sim. `Math.random` + wall clocks + many projectiles | Listen-server. Cosmetic spark rollback only |
| Dedicated sim server | Fairer WAN, anti-cheat, 24/7 ops. LAN gets slower | Host browser + signaling + TURN. Revisit for ranked matchmaking |
| Binary protobuf | JSON pose already a few hundred bytes at 20 Hz | JSON envelopes |
| TURN credentials in git | Secret leak | Server env only; public `.env.example` empty |

**Rule:** host owns score, guest owns feel, dropped UDP is not truth, never predict HP.
