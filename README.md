# SOLMAR

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/duniagelap134/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/duniagelap134/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR** — a sun-soaked open-world crime story that plays offline in a desktop browser from its own files. A [make.fun](https://make.fun/bounty/gta6-01) bounty entry (`gta6-01`): build the most complete open-world crime game you can, in the spirit of GTA 6.

Rico Vale, getaway driver, is pulled into a turf war between the Costa Crew and the Vulture Kings over the coastal city of Solmar. Three linked missions — a pickup gone loud, a stolen Vela GT, and a final bridge run with the whole PD on your tail — across a living city of traffic, pedestrians, beaches, a marina and a downtown tower.

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
| Shift | Sprint |
| P | Pause |
| M | Mute |
| F5 | Quick-save |

## Systems

- **Open world** — a seeded city (`city.js`): road grid, 2.5D buildings, parks, beach, marina, stadium, casino and the Solmar Tower.
- **On foot and driving** (`player.js`, `vehicles.js`) — walk, sprint, steal parked or moving cars, handbrake turns.
- **Traffic and pedestrians** (`traffic.js`) — cars cruise the grid and slow for the car ahead; pedestrians stroll the sidewalks and flee gunfire and fast cars.
- **Wanted level and police** (`police.js`) — 0–5 stars from heat (theft, shooting, hitting pedestrians); patrol cars chase and ram, foot officers arrest, getting busted costs cash.
- **Three linked missions and a story** (`missions.js`) — objectives with a pulsing ★ marker, an on-screen banner and a minimap marker; finishing all three ends the story.
- **Combat** (`combat.js`) — pistol with reload, fists, rival gunmen and brutes, health / ammo / armour pickups.
- **HUD and minimap** (`hud.js`) — cash, health, wanted stars, mission banner, speed, message feed, crosshair, live minimap with player, police, traffic and objective.
- **Start screen, pause, save** (`save.js`) — title screen with story and controls, continue from a save, F5 quick-save, autosave every 30 s.
- **Sound** (`audio.js`) — synthesised WebAudio only: engine hum, two-tone sirens, gunshots, pickups and a bassline loop. No audio files.

## Layout

```
game/index.html        entry point, canvas + module script
game/src/main.js       boot, game state, loop, camera, render order
game/src/city.js       map generation, collision, 2.5D drawing
game/src/config.js     world size, roads, palette, tuning
game/src/rng.js        seeded random numbers
game/src/input.js      keyboard + mouse
game/src/audio.js      synthesised sound and music
game/src/player.js     on-foot movement, health, aiming
game/src/vehicles.js   car types, driving, entering / stealing
game/src/traffic.js    traffic cars + pedestrians
game/src/police.js     wanted level, police AI, busted
game/src/combat.js     shooting, melee, enemies, pickups
game/src/missions.js   the three linked missions + story
game/src/hud.js        HUD, minimap, menus
game/src/save.js       localStorage save / load
game/src/shots.js      screenshot staging (?shot=chase|foot|drive|night)
main.ts                hand-in program (copies game/ + screenshots/, writes dossier.json)
serve.ts               tiny static server for local play
```

## Screenshots

Four real Playwright renders of the game itself (`screenshots/`, staged by `game/src/shots.js`):

1. `1-chase.jpg` — the cover: a 3-star police chase with wanted stars, minimap and mission objective on the HUD at once.
2. `2-foot.jpg` — on foot in Mission 2, pistol out, rivals closing in on the marked Vela GT.
3. `3-drive.jpg` — daytime drive through downtown traffic.
4. `4-night.jpg` — night escape in Mission 3, sirens and headlights.

## Originality

SOLMAR, Rico Vale, the Costa Crew, the Vulture Kings, the Vela GT and every street, line and sound are invented for this entry. Nothing from Rockstar Games or any other commercial game — no names, characters, map, art or music.
