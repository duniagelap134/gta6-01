# SOLMAR

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/duniagelap134/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/duniagelap134/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR** — a sun-soaked open-world crime story that plays offline in a desktop browser from its own files. A [make.fun](https://make.fun/bounty/gta6-01) bounty entry (`gta6-01`): build the most complete open-world crime game you can, in the spirit of GTA 6.

Rico Vale, getaway driver, is pulled into a turf war between the Costa Crew and the Vulture Kings over the coastal city of Solmar. Eight linked missions — a pickup gone loud, a stolen Vela GT, a bridge run with the whole PD on your tail, a dockside ledger, a sunset tow, a tapped radio relay, a midnight courier van and the final King Tide — across a living city of traffic, pedestrians, palms, a beach, a marina and the Solmar Tower. The camera rides behind the car in a hand-rolled 3D chase view, golden hour to night, with a helicopter overhead when the heat rises.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no dependencies. Node.js 22.18+ for the server and the hand-in program.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk or drive |
| Mouse | Aim (on foot) |
| Click | Shoot |
| Space | Punch / handbrake |
| E | Get in a car, steal one, get out |
| R | Reload |
| Z | Crew: Swap Plates (Dana — heat down a star) |
| X | Crew: Quick Fix (Milo — repair the car to 100%) |
| C | Crew: Eyes Out (Nia — mark the nearest police unit) |
| Shift | Sprint |
| P | Pause |
| M | Mute |
| F5 | Quick-save |

## Systems

- **3D chase view** (`render3d.js`) — hand-rolled perspective renderer: chase camera behind the car, golden-hour sky and sun, low-poly buildings with lit windows, palms, traffic, peds, a police helicopter with a spotlight cone, night headlights. No library.
- **Open world** (`city.js`) — a seeded city: road grid, buildings, parks, beach, marina, stadium, casino and the Solmar Tower.
- **On foot and driving** (`player.js`, `vehicles.js`) — walk, sprint, steal parked or moving cars, handbrake turns; cars wear down (condition) and lose top speed when battered.
- **Traffic and pedestrians** (`traffic.js`) — cars cruise the grid and slow for the car ahead; pedestrians stroll the sidewalks and flee gunfire and fast cars.
- **Wanted level and police** (`police.js`) — 0–5 stars from heat (theft, shooting, hitting pedestrians); patrol cars chase and ram, foot officers arrest, HAWK-1 circles overhead from 2 stars, getting busted costs cash.
- **Eight linked missions and a story** (`missions.js`) — objectives with a pulsing ★ marker and a light beam, a dialogue box with the fixer and crew, and a minimap marker; finishing all eight ends the story.
- **Combat** (`combat.js`) — pistol with reload, fists, rival gunmen and brutes, health / ammo / armour pickups.
- **Dense HUD** (`hud.js`) — mission card with stage bar, police dispatch panel with live unit distances and status tags (RAMMING / FLANKING / PURSUIT / SPOTLIGHT / ROADBLOCK), weapon slots, crew cards with cooldowns, rank + RP, money, wanted stars, circular minimap, health / armour with numbers, huge speed + car condition, radio ticker, dialogue box.
- **Start screen, pause, save** (`save.js`) — title screen with story and controls, continue from a save, F5 quick-save, autosave every 30 s.
- **Sound** (`audio.js`) — synthesised WebAudio only: engine hum, two-tone sirens, gunshots, pickups and a bassline loop. No audio files.

## Layout

```
game/index.html        entry point, canvas + module script
game/src/main.js       boot, game state, loop, crew abilities, render order
game/src/render3d.js   3D chase camera, projection, sky, ground, buildings, cars, heli
game/src/city.js       map generation, collision, colour helpers
game/src/config.js     world size, roads, palette, districts, radio, crew, ranks, tuning
game/src/rng.js        seeded random numbers
game/src/input.js      keyboard + mouse
game/src/audio.js      synthesised sound and music
game/src/player.js     on-foot movement, health, 3D mouse aiming
game/src/vehicles.js   car types, driving, entering / stealing, condition
game/src/traffic.js    traffic cars + pedestrians
game/src/police.js     wanted level, police AI, dispatch feed, helicopter, busted
game/src/combat.js     shooting, melee, enemies, pickups
game/src/missions.js   the eight linked missions + story + dialogue
game/src/hud.js        dense HUD, circular minimap, menus
game/src/save.js       localStorage save / load
game/src/shots.js      screenshot staging (?shot=chase|foot|drive|night)
main.ts                hand-in program (copies game/ + screenshots/, writes dossier.json)
serve.ts               tiny static server for local play
```

## Screenshots

Four real Playwright renders of the game itself (`screenshots/`, staged by `game/src/shots.js`):

1. `1-chase.jpg` — the cover: a golden-hour 3-star police chase, HAWK-1 spotlight, the Bridge Job escape leg.
2. `2-foot.jpg` — on foot in Mission 2, pistol out, rivals closing in on the marked Vela GT.
3. `3-drive.jpg` — daytime drive through downtown traffic in the Vela GT, the Pickup's escape leg.
4. `4-night.jpg` — night escape in Mission 8 (King Tide), sirens, headlights and the helicopter.

## Originality

SOLMAR, Rico Vale, the Costa Crew, the Vulture Kings, Vera Solano, Dana Rook, Milo Ferran, Nia Sol, the Vela GT and every street, line and sound are invented for this entry. Nothing from Rockstar Games or any other commercial game — no names, characters, map, art or music.
