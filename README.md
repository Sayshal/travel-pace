# Travel Pace

![GitHub release](https://img.shields.io/github/v/release/Sayshal/travel-pace?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](<https://img.shields.io/github/downloads/Sayshal/travel-pace/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f>)
![GitHub Downloads (specific asset, latest release)](<https://img.shields.io/github/downloads/Sayshal/travel-pace/latest/module.zip?sort=date&style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Latest)&color=ff144f>)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Ftravel-pace%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![D&D5E Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fsystem%3FnameType%3Dfoundry%26showVersion%3D1%26style%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Ftravel-pace%2Freleases%2Flatest%2Fdownload%2Fmodule.json)

## Supporting the module

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/3deathsaves)
[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sayshal)
[![Discord](https://dcbadge.limes.pink/api/server/PzzUwU9gdz)](https://discord.gg/PzzUwU9gdz)

## What it does

A calculator dialog for D&D 5E travel pace. Convert a distance into how long the journey takes, or convert a time budget into how far the party can go. Results post to chat with optional rules text for the pace's mechanical effects.

## Features

- Two calculation modes: Distance → Time and Time → Distance
- The three SRD travel paces (Fast / Normal / Slow) with their standard multipliers
- Mount and vehicle support: pick from a configurable list of world or compendium actors. Walking actors use their movement speed; vehicles use their speed in mi/hour or km/hour from their actor data.
- Imperial or metric units, set per-world
- Pace effects (Stealth / Perception disadvantage, etc.) included on the chat card by default

## Installation

Install through Foundry's module manager, or paste the manifest URL:
`https://github.com/Sayshal/travel-pace/releases/latest/download/module.json`

## Usage

1. Open the calculator from the Travel Pace tool in the token scene-control palette.
2. Pick Distance → Time or Time → Distance.
3. Enter your distance (or days + hours).
4. Pick the pace. The label updates to show the resulting speed.
5. Optional: pick a configured mount or vehicle. The pace label adjusts to that actor's movement.
6. Send to Chat.

To configure which actors appear in the mount dropdown, open Module Settings → Travel Pace → Configure Mounts & Vehicles. Pick from world NPCs, world vehicles, and vehicle actors in any installed compendium.

## Settings

- **Use Metric System**: switch all distance displays to kilometers / meters.
- **Show Pace Effects in Chat**: include the SRD rules text for the selected pace on the chat card.
- **Configure Mounts & Vehicles**: opens the mount picker.

## Support

If you hit a bug or want a feature, file it on the [issue tracker](https://github.com/Sayshal/travel-pace/issues).
