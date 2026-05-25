# Orilon Weather Control Module

## Install
1. Copy the `orilon-weather-control` folder into `Data/modules/`.
2. Enable **Orilon Weather Control** in Foundry's Module Management.
3. Reload Foundry.

## Usage
- A GM gets a new **Orilon Weather** scene control button.
- Click **Open Orilon Weather Board** to use the full board.
- The module preserves the existing board logic from v47.
- Client-side overlays are now also started on connected player clients by reading the scene weather state.

## Notes
- This is a first-pass module conversion built from the working macro version `v47 Heatwave No Debris`.
- Scene FX / Ambient SFX / token vision / actor effects still come from the board logic.
- The module runtime adds player-side overlays for Ashfall, Heavy Ashfall, Blizzard, and Heatwave.
- Future expansion can add socket-based commands, settings persistence, and tighter board/runtime separation.
