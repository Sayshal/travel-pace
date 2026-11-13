import { MODULE, SETTINGS, TRAVEL } from './constants.mjs';

/**
 * @typedef {object} MountSpeed
 * A speed in one travel medium: a vehicle or group's own travel speed in a `CONFIG.DND5E.travelUnits` key, or a
 * creature's movement as a ratio of the baseline the pace table assumes.
 * @property {number} [perHour] Travel speed per hour, in `unit`
 * @property {string} [unit] A `CONFIG.DND5E.travelUnits` key
 * @property {number} [ratio] Movement as a ratio of the walking baseline
 * @property {string} type The `CONFIG.DND5E.travelTypes` key this speed travels by
 * @property {number} hours Hours travelled per travel day
 * @property {boolean} paced Whether the chosen pace changes this speed, false for vehicles that do not travel on land
 */

/** @type {Object<string, string>} The length unit each travel unit measures distance in. */
const TRAVEL_TO_LENGTH = { mph: 'mi', kph: 'km' };

/**
 * The pace configuration for an id, falling back to normal so an unknown pace travels rather than stalling.
 * @param {string} pace Travel pace id
 * @returns {object} An entry of `CONFIG.DND5E.travelPace`
 */
function paceConfig(pace) {
  return CONFIG.DND5E.travelPace[pace] ?? CONFIG.DND5E.travelPace.normal;
}

/**
 * The pace configuration a speed moves at. A speed the pace does not change always travels at normal.
 * @param {MountSpeed} speed Mount speed
 * @param {string} pace Travel pace id
 * @returns {object} An entry of `CONFIG.DND5E.travelPace`
 */
function speedPaceConfig(speed, pace) {
  return paceConfig(speed.paced === false ? 'normal' : pace);
}

/**
 * Minutes in an hour, read from the world calendar so a custom one is honoured.
 * @returns {number} Minutes per hour
 */
export function minutesPerHour() {
  return game.time.calendar?.days?.minutesPerHour ?? 60;
}

/**
 * Minutes in a travel day. How many hours a party marches is a rule the system states; how long an
 * hour lasts is the world calendar's business.
 * @param {number} [hours] Hours travelled per day, defaulting to the system's group travel day
 * @returns {number} Minutes per travel day
 */
export function minutesPerTravelDay(hours = CONFIG.DND5E.travelTimes.group) {
  return hours * minutesPerHour();
}

/**
 * Combat rounds in a minute, for reading a per-round walking speed as a per-minute one. A round is
 * a fixed span of seconds, so a calendar with longer minutes fits more of them in.
 * @returns {number} Rounds per minute
 */
function roundsPerMinute() {
  const secondsPerMinute = game.time.calendar?.days?.secondsPerMinute ?? 60;
  return secondsPerMinute / (CONFIG.time.roundTime || 6);
}

/**
 * The travel and length units the world measures in, following the system's metric setting.
 * @returns {{travel: string, length: string}} A `CONFIG.DND5E.travelUnits` key and its length unit
 */
export function travelUnits() {
  const travel = dnd5e.utils.defaultUnits('travel') ?? 'mph';
  return { travel, length: TRAVEL_TO_LENGTH[travel] ?? 'mi' };
}

/**
 * The localized abbreviation for a `CONFIG.DND5E.movementUnits` key.
 * @param {string} unit Movement unit key
 * @returns {string} Localized abbreviation
 */
export function unitAbbreviation(unit) {
  return CONFIG.DND5E.movementUnits[unit]?.abbreviation ?? unit;
}

/**
 * Hours an actor travels per travel day: its own travel setting when it has one, else the system's group default.
 * @param {foundry.documents.Actor|null} actor The traveller
 * @returns {number} Hours per travel day
 */
function travelHours(actor) {
  return actor?.system?.attributes?.travel?.time || CONFIG.DND5E.travelTimes.group;
}

/**
 * Whether a prepared travel speed has a real source: a stated speed or pace, or a visible movement type that travels
 * by that medium. dnd5e folds hidden movement types such as jump into land travel, which would give every vehicle a
 * land speed.
 * @param {foundry.documents.Actor} actor A vehicle or group actor
 * @param {string} type A `CONFIG.DND5E.travelTypes` key
 * @returns {boolean} True when the speed comes from something the actor can actually travel with
 */
function hasTravelSource(actor, type) {
  const source = actor._source.system.attributes?.travel ?? {};
  if (source.speeds?.[type] || source.paces?.[type]) return true;
  const movement = actor.system.attributes?.movement?.speeds ?? {};
  return Object.entries(CONFIG.DND5E.movementTypes).some(([key, config]) => !config.hidden && (config.travel ?? 'land') === type && movement[key] > 0);
}

/**
 * Read a mount's speed in every medium it can travel. Vehicles and groups carry a prepared travel block;
 * creatures are measured against the walking baseline.
 * @param {foundry.documents.Actor|null} mount The resolved mount or vehicle actor
 * @returns {Object<string, MountSpeed>} Speeds keyed by `CONFIG.DND5E.travelTypes` key, only for media it can travel
 */
export function getMountSpeeds(mount) {
  const hours = travelHours(mount);
  if (!mount) return { land: { ratio: 1, type: 'land', hours, paced: true } };
  const paced = !mount.system.isVehicle || mount.system.details?.type === 'land';
  const speeds = {};
  const travel = mount.system.attributes?.travel;
  for (const type of Object.keys(CONFIG.DND5E.travelTypes)) {
    if (travel?.speeds?.[type] > 0 && hasTravelSource(mount, type)) speeds[type] = { perHour: travel.speeds[type], unit: travel.units, type, hours, paced };
  }
  if (!foundry.utils.isEmpty(speeds)) return speeds;
  const movement = mount.system.attributes?.movement;
  for (const [key, config] of Object.entries(CONFIG.DND5E.movementTypes)) {
    if (config.hidden) continue;
    const type = config.travel ?? 'land';
    const feet = dnd5e.utils.convertLength(movement?.speeds?.[key] || 0, movement?.units ?? 'ft', { to: 'ft', legacy: false }).value;
    const ratio = feet / TRAVEL.WALK_BASELINE_FEET;
    if (ratio > (speeds[type]?.ratio ?? 0)) speeds[type] = { ratio, type, hours, paced };
  }
  return speeds;
}

/**
 * Read a group's speeds: its primary vehicle's, its own stated travel speeds, or else every medium all
 * of its creatures share, at the slowest member's speed.
 * @param {foundry.documents.Actor} group A group actor
 * @returns {Object<string, MountSpeed>} Speeds keyed by `CONFIG.DND5E.travelTypes` key
 */
function getGroupSpeeds(group) {
  const vehicle = group.system.primaryVehicle;
  if (vehicle) return getMountSpeeds(vehicle);
  const stated = getMountSpeeds(group);
  const members = group.system.creatures ?? [];
  if (!foundry.utils.isEmpty(stated) || !members.length) return stated;
  const hours = travelHours(group);
  const memberSpeeds = members.map(getMountSpeeds);
  const speeds = {};
  for (const type of Object.keys(CONFIG.DND5E.travelTypes)) {
    if (!memberSpeeds.every((memberSpeed) => memberSpeed[type])) continue;
    const slowest = memberSpeeds.map((memberSpeed) => memberSpeed[type]).reduce((slower, speed) => (distancePerMinute('normal', speed) < distancePerMinute('normal', slower) ? speed : slower));
    speeds[type] = { ...slowest, hours };
  }
  return speeds;
}

/**
 * Read every medium whatever the party is travelling as can travel, and its speed in each.
 * @param {foundry.documents.Actor|null} actor A creature, vehicle or group actor
 * @returns {Object<string, MountSpeed>} Speeds keyed by `CONFIG.DND5E.travelTypes` key
 */
export function getTravellerSpeeds(actor) {
  return actor?.type === 'group' ? getGroupSpeeds(actor) : getMountSpeeds(actor);
}

/**
 * The medium a set of speeds travels fastest in.
 * @param {Object<string, MountSpeed>} speeds Speeds from getTravellerSpeeds
 * @returns {string|undefined} A `CONFIG.DND5E.travelTypes` key, or undefined when there are none
 */
export function fastestTravelType(speeds) {
  return Object.values(speeds).reduce((fastest, speed) => (!fastest || distancePerMinute('normal', speed) > distancePerMinute('normal', fastest) ? speed : fastest), null)?.type;
}

/**
 * Read the speed of whatever the party is travelling as, in one medium.
 * @param {foundry.documents.Actor|null} actor A creature, vehicle or group actor
 * @param {string} [travelType] A `CONFIG.DND5E.travelTypes` key, defaulting to the fastest medium
 * @returns {MountSpeed} The speed to travel at, standing still when the actor cannot travel that medium
 */
export function getTravellerSpeed(actor, travelType) {
  const speeds = getTravellerSpeeds(actor);
  const type = travelType || fastestTravelType(speeds) || 'land';
  return speeds[type] ?? { ratio: 0, type, hours: travelHours(actor), paced: true };
}

/**
 * The pace a traveller actually moves at. A group with a slowed member is held to slow pace unless its vehicle ignores pace.
 * @param {foundry.documents.Actor|null} actor A creature, vehicle or group actor
 * @param {string} pace The chosen travel pace id
 * @returns {string} The travel pace id to calculate with
 */
export function effectivePace(actor, pace) {
  if (actor?.type !== 'group') return pace;
  const { slowed, available } = actor.system.getTravelPace().pace;
  if (!slowed || !available) return pace;
  const order = Object.keys(CONFIG.DND5E.travelPace);
  return order.indexOf(pace) > order.indexOf('slow') ? 'slow' : pace;
}

/**
 * Format a mount's speed for display, adjusted by the selected pace.
 * @param {MountSpeed} speed Mount speed, as read by getTravellerSpeed
 * @param {string} pace Travel pace id
 * @returns {string} Localized speed text
 */
export function formatMountSpeed(speed, pace) {
  const { multiplier } = speedPaceConfig(speed, pace);
  const units = travelUnits();
  if (speed.perHour !== undefined) {
    const { value } = dnd5e.utils.convertTravelSpeed(speed.perHour, speed.unit, { to: units.travel });
    return _loc('TRAVELPACE.Speed.Format.PerHour', { speed: (value * multiplier).toFixed(1), unit: unitAbbreviation(units.length) });
  }
  const feetPerMinute = speed.ratio * TRAVEL.WALK_BASELINE_FEET * roundsPerMinute() * multiplier;
  const unit = units.length === 'km' ? 'm' : 'ft';
  const { value } = dnd5e.utils.convertLength(feetPerMinute, 'ft', { to: unit, legacy: false });
  return _loc('TRAVELPACE.Speed.Format.PerMinute', { speed: Math.round(value), unit: unitAbbreviation(unit) });
}

/**
 * The distance a mount covers per minute of travel, in the world's travel unit.
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getTravellerSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {number} Distance per minute, or 0 when the mount cannot travel
 */
export function distancePerMinute(pace, speed, extraMultiplier = 1) {
  const config = speedPaceConfig(speed, pace);
  const { travel } = travelUnits();
  const perMinute =
    speed.perHour !== undefined
      ? (dnd5e.utils.convertTravelSpeed(speed.perHour, speed.unit, { to: travel }).value * config.multiplier) / minutesPerHour()
      : (dnd5e.utils.convertTravelSpeed(config.standard, 'mph', { to: travel }).value * speed.ratio) / minutesPerTravelDay();
  const total = perMinute * extraMultiplier;
  return total > 0 ? total : 0;
}

/**
 * Calculate how long a distance takes to travel.
 * @param {number} distance Distance in the world's travel unit
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getTravellerSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {{minutes: number, hours: number, days: number}|null} Time breakdown, or null when the mount cannot travel
 */
export function calculateTime(distance, pace, speed = getTravellerSpeed(null), extraMultiplier = 1) {
  const perMinute = distancePerMinute(pace, speed, extraMultiplier);
  if (!perMinute) return null;
  return breakdownMinutesToTimeUnits(distance / perMinute, speed.hours);
}

/**
 * Calculate how far a span of travel covers.
 * @param {number} minutes Travel minutes
 * @param {string} pace Travel pace id
 * @param {MountSpeed} speed Mount speed, as read by getTravellerSpeed
 * @param {number} [extraMultiplier] Combined multiplier from weather and registered contributors
 * @returns {number} Distance in the world's travel unit
 */
export function calculateDistance(minutes, pace, speed = getTravellerSpeed(null), extraMultiplier = 1) {
  return distancePerMinute(pace, speed, extraMultiplier) * minutes;
}

/**
 * Total the minutes in a day/hour/minute breakdown.
 * @param {object} [time] Time components
 * @param {number} [time.days] Travel days
 * @param {number} [time.hours] Hours
 * @param {number} [time.minutes] Minutes
 * @param {number} [dayHours] Hours in a travel day
 * @returns {number} Total travel minutes
 */
export function timeToMinutes({ days = 0, hours = 0, minutes = 0 } = {}, dayHours = undefined) {
  return days * minutesPerTravelDay(dayHours) + hours * minutesPerHour() + minutes;
}

/**
 * Break a minute total down into travel days, hours and minutes.
 * @param {number} totalMinutes Raw minute total
 * @param {number} [dayHours] Hours in a travel day
 * @returns {{minutes: number, hours: number, days: number}} Time breakdown
 */
export function breakdownMinutesToTimeUnits(totalMinutes, dayHours = undefined) {
  const rounded = Math.round(totalMinutes);
  const dayMinutes = minutesPerTravelDay(dayHours);
  const remainder = rounded % dayMinutes;
  return { days: Math.floor(rounded / dayMinutes), hours: Math.floor(remainder / minutesPerHour()), minutes: remainder % minutesPerHour() };
}

/**
 * Format a time breakdown for display.
 * @param {{minutes: number, hours: number, days: number}|null} timeData Time data from calculateTime
 * @returns {string} Localized formatted time
 */
export function formatTime(timeData) {
  if (!timeData) return _loc('TRAVELPACE.Time.Immobile');
  const parts = [];
  if (timeData.days > 0) parts.push(dnd5e.utils.formatTime(timeData.days, 'day'));
  if (timeData.hours > 0) parts.push(dnd5e.utils.formatTime(timeData.hours, 'hour'));
  if (timeData.minutes > 0) parts.push(dnd5e.utils.formatTime(timeData.minutes, 'minute'));
  return parts.length ? game.i18n.getListFormatter().format(parts) : _loc('TRAVELPACE.Time.NoTime');
}

/**
 * The localized description of a pace's mechanical effects.
 * @param {string} pace Travel pace id
 * @returns {string} Localized description, empty for a pace the module has no description for
 */
export function getPaceEffects(pace) {
  const key = `TRAVELPACE.Effects.${pace.capitalize()}`;
  return game.i18n.has(key) ? _loc(key) : '';
}

/**
 * The UUIDs of every mount the GM has enabled.
 * @since 6.0.0
 * @returns {string[]} Enabled mount UUIDs
 */
export function getEnabledMountUuids() {
  const stored = game.settings.get(MODULE.ID, SETTINGS.ENABLED_MOUNTS);
  return Array.isArray(stored) ? stored : readLegacyEnabledMounts(stored);
}

/**
 * Read the pre-6.0 enabled-mount map, which keyed world actors by bare id and compendium entries by UUID.
 * @param {object} [stored] The stored `{key: boolean}` map
 * @returns {string[]} Enabled mount UUIDs, with bare world-actor ids promoted to `Actor.<id>`
 * @since 6.0.0
 * @deprecated Remove in 7.0.0
 */
function readLegacyEnabledMounts(stored) {
  return Object.entries(stored ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => (key.includes('.') ? key : `Actor.${key}`));
}

/**
 * Resolve a mount from its stored UUID.
 * @param {string} [uuid] The stored mount UUID
 * @returns {Promise<foundry.documents.Actor|null>} The resolved actor
 */
export async function resolveMount(uuid) {
  if (!uuid) return null;
  return (await fromUuid(uuid)) ?? null;
}
