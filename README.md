# Travel Pace

![GitHub release](https://img.shields.io/github/v/release/Sayshal/travel-pace?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](<https://img.shields.io/github/downloads/Sayshal/travel-pace/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f>)
![GitHub Downloads (specific asset, latest release)](<https://img.shields.io/github/downloads/Sayshal/travel-pace/latest/module.zip?sort=date&style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Latest)&color=ff144f>)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Ftravel-pace%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![D&D5E Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fsystem%3FnameType%3Dfoundry%26showVersion%3D1%26style%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Ftravel-pace%2Freleases%2Flatest%2Fdownload%2Fmodule.json)

![Travel Pace Hero](https://wiki.3deathsaves.com/travel-pace/hero.png)

## Supporting the module

[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/3deathsaves)
[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sayshal)
[![Discord](https://dcbadge.limes.pink/api/server/PzzUwU9gdz)](https://discord.gg/PzzUwU9gdz)

## What it does

A calculator dialog for D&D 5E travel pace. Convert a distance into how long the journey takes, or convert a time budget into how far the party can go. Results post to chat with optional rules text for the pace's mechanical effects.

## Features

**Two calculation modes:** Distance → Time and Time → Distance, using the three SRD travel paces (Fast / Normal / Slow) with their standard multipliers.

<img src="https://wiki.3deathsaves.com/travel-pace/calculator-dialog.png" alt="Travel Pace Calculator" width="750">

**Chat card:** Pace effects (Stealth / Perception disadvantage, etc.) included on the chat card by default.

<img src="https://wiki.3deathsaves.com/travel-pace/chat-card.png" alt="Travel Pace chat card" width="750">

**Weather:** With Calendaria active, set a multiplier for each weather preset so the current weather speeds up or slows down travel.

<img src="https://wiki.3deathsaves.com/travel-pace/weather-config.png" alt="Weather multiplier configuration" width="750">

### Also Included

- Mount and vehicle support: drag any actor, vehicle, or party onto the calculator, or pick one from a configurable list of world or compendium actors. Creatures use their movement speed; vehicles use their travel speed from their actor data.
- Imperial or metric units, following the system's unit setting

<img src="https://wiki.3deathsaves.com/travel-pace/calculator-traveller.png" alt="Calculator with a vehicle as the traveller" width="750">

## Installation

Install through Foundry's module manager, or paste the manifest URL:
`https://github.com/Sayshal/travel-pace/releases/latest/download/module.json`

## Usage

1. Open the calculator from the Travel Pace tool in the token scene-control palette.
2. Pick Distance → Time or Time → Distance.
3. Enter your distance (or days + hours).
4. Pick the pace. The label updates to show the resulting speed.
5. Optional: drag a mount, vehicle, or party onto the Traveler panel, or pick one from the Transport dropdown. The pace label adjusts to that actor's speed.
6. Send to Chat.

To configure which actors appear in the Transport dropdown, open Configure Settings → Travel Pace Calculator → Configure Mounts & Vehicles. Pick from world NPCs, world vehicles, world groups, and vehicle actors in any installed compendium.

## Settings

- **Show Pace Effects in Chat**: include the SRD rules text for the selected pace on the chat card.
- **Day Advance Mode**: advance world time by full calendar days for each travel day, or by only the hours spent moving.
- **Weather Affects Travel Speed**: apply the weather multipliers when Calendaria reports the current weather.
- **Configure Mounts & Vehicles**: opens the mount and vehicle picker.
- **Configure Weather Multipliers**: sets the multiplier for each weather preset and severity level.

## Support

If you hit a bug or want a feature, report it at [3deathsaves.com/report](https://3deathsaves.com/report?module=travel-pace).
