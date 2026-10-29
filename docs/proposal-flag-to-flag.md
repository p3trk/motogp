# Proposal: flag-to-flag bike swap

**Status:** proposal only, not scheduled · **Written:** 2026-10-29 · **Owner:** Petr

This is not part of the GDD. Nothing here changes the game. It records how a
real MotoGP pit stop could work in Silverstone GP once the game has weather.
When it is scheduled, the agreed parts move into `docs/GDD.md` as usual (§14).

---

## 1. Why it is not built now

- The game has no weather (GDD §15). In real MotoGP a bike swap is only allowed in a wet race, so without rain there is no reason to swap.
- Since 1.22.0 (branch `feature/remove-pit-refuel`, not merged yet) the pit box has no service: no refuelling, no repair. This proposal assumes that change. The pit lane and its 60 km/h limiter stay.

## 2. Real MotoGP (research summary)

- **No normal pit stops.** No refuelling, no tyre changes in a dry race. Tyres and fuel must last the whole race.
- **Flag-to-flag.** If Race Direction declares the race wet before the start, or shows **white flags** during the race for rain, riders may come in and swap to their **second bike**. The race is not stopped.
- **Unlimited swaps.** Once declared, the race stays flag-to-flag to the end, even if the rain stops. Any tyre combination is allowed: slick to wet, wet to slick, or the same type.
- **The rider decides** when to come in. The team can only signal with the pit board or a dashboard message.
- **Procedure:** 60 km/h in the pit lane; the rider stops on an official floor marker in front of the box; the second bike waits on a matching marker, engine running, tyre warmers just removed. Up to 5 crew per rider in a race. Only the rider puts the bike in gear. One crew member watches traffic and releases the rider.
- **Penalty:** speeding in the pit lane in a race is a double Long Lap.
- **Mandatory swap (once):** Phillip Island 2013. A tyre safety problem made every rider swap on lap 9 or 10. A rider who came in too late was disqualified.
- **Future:** for 2027 there is talk of one bike per rider. That would bring either stopped races or real tyre-change stops with a minimum pit time, as in WorldSBK.

Sources: motogp.com, "What Happens During a MotoGP Pit Stop?" and "How Do MotoGP Riders Switch Bikes During a Race?"; Crash.net on the 2027 rule talks.

## 3. What the game needs first

| # | Prerequisite | Notes |
|---|---|---|
| 1 | **Weather** | Rain that starts, gets heavier and stops during a session. A track wetness value from dry to soaked, perhaps different per sector. This is a separate proposal. |
| 2 | **Tyre types** | Slick and wet, each with a grip curve against track wetness. Slicks are faster when dry and dangerous when wet; wets are the reverse and overheat on a drying track. Today the game has one tyre model (GDD §5). |
| 3 | **Second bike** | Each rider owns two bikes with their own tyres, fuel and damage. |

Without 1 and 2 a swap changes nothing, so they come first.

## 4. Proposed design

**Declaring the race**
- Wet before the start: the race is flag-to-flag from lights out. A "WET RACE" message appears on the grid.
- Rain during a dry race: white flags at the marshal posts and a "WHITE FLAG · BIKE SWAP ALLOWED" centre message. From then on it is flag-to-flag to the end.
- In a dry race the box does nothing (as in 1.22.0).

**The swap**
1. The player rides into the pit lane. The limiter is automatic, so the speeding penalty is never needed.
2. Stopping on the box marker (the blinking ring, GDD §11) starts the swap. No key press is needed.
3. The bike stands still for a fixed **swap time**, then the second bike is ready. Press W to leave, as the old pit service worked.
4. The bikes trade places. The first bike stays in the box and its crew prepare it again in about 1 lap, with the tyre the team expects next. Coming in before it is ready gives that bike with its old tyres (open question 8).
5. Unlimited swaps, as in the real rules.

**The second bike**
- Tyres: **prepared before the race starts** (decided by Petr). The second bike gets the opposite tyre to the start bike: wets if the race starts dry, slicks if it starts wet. The player can change this in the pre-race menu (see open question 2). There is no tyre change on the grid or in the box at the moment of a swap.
- Fuel: its own tank, filled to the menu's Starting fuel.
- Damage: its own. Swapping to an undamaged bike is a real side effect and stays in.
- Tyre temperature: warm, because it was in tyre warmers.

**AI riders**
- Each AI swaps when the time lost on the wrong tyre over the remaining laps is more than the time lost in the pit lane, plus a small random margin per rider, so they do not all come in on the same lap.

**HUD**
- Tyre type icon next to the speed (S or W).
- Pit board message "BOX" when the team thinks it is time to swap (an assist, can be turned off).
- Timing tower: a small marker next to riders who have swapped, and the count of their swaps.

**Recordings, ghosts and replay**
- Recordings already include pit stops (GDD §11c). A swap is recorded the same way, plus the tyre type, so a ghost shows the right bike after its swap.

## 5. Open questions (recommended answer in bold)

1. Swap time standing still in the box? **About 3 s**, the rider getting off and on. Plus the time lost in the pit lane, which the game already has. Tune it after measuring a full pit lane pass at Silverstone in the game.
2. When are the second bike's tyres prepared? **Decided: before the race starts.** Default is the opposite of the start tyre; the player can pick slick or wet for each bike in the pre-race menu. (Replaces the earlier idea of the team picking tyres automatically during the race.)
3. Allow a swap in a dry race? **No**, as in the real rules. The box does nothing until the race is declared wet.
4. Mandatory swap race (as Phillip Island 2013)? **Later, as an optional race rule**: one swap between two given laps, disqualification if missed. This is the only form that would work without weather, but on its own it adds little, since both bikes would be the same.
5. Should the second bike repair damage? **Yes**, it is a different bike. This makes a swap after a crash attractive, which is also true in real racing.
6. Qualifying in the wet? **Swaps allowed at any time**, as in real practice and qualifying.
7. Judge pit lane speeding? **No**, the limiter is automatic (GDD §7).
8. After a swap, is the bike left in the box prepared again? **Decided: yes, after a preparation time of about 1 lap**, with the tyre the team expects next (in real racing mechanics can work on it while the race goes on). Coming in before it is ready gives the bike with its old tyres. Alternative: no re-preparation, so each bike keeps its pre-race tyres all race.

## 6. Rough phases

1. **Weather and track wetness** (own proposal): rain, wetness, grip loss, visuals.
2. **Tyre types**: slick and wet grip curves; tyre choice on the grid.
3. **Flag-to-flag swap**: this proposal; white flags, second bike, AI strategy, HUD.
4. **Optional:** mandatory swap race rule.

When phase 3 ships, GDD §15 changes: "No tyre compound choice or flag-to-flag bike swap" is removed.
