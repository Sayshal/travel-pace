import { MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import { getEnabledMountUuids } from '../utils.mjs';
import { FOOTER_PART, TravelPaceMenu } from './menu.mjs';

/** Configuration menu for choosing which mounts and vehicles the calculator offers. */
export class MountConfigMenu extends TravelPaceMenu {
  static PARTS = { form: { template: TEMPLATES.MOUNT_CONFIG }, footer: FOOTER_PART };
  static DEFAULT_OPTIONS = {
    id: 'travel-pace-mount-config',
    window: { icon: 'fa-solid fa-horse', title: 'TRAVELPACE.Settings.MountConfig.Title' },
    form: { handler: MountConfigMenu.#onSubmit, closeOnSubmit: true }
  };

  /** @inheritdoc */
  async _prepareContext(_options) {
    this.actors = await MountConfigMenu.#getPotentialMounts();
    this.enabled = new Set(getEnabledMountUuids());
    const settingSchema = new foundry.data.fields.SchemaField({ mounts: new foundry.data.fields.SetField(new foundry.data.fields.StringField({ required: false })) });
    return {
      document: { schema: settingSchema, mounts: [...this.enabled] },
      fields: settingSchema.fields,
      mountsWidget: () => this.#createMountsWidget(),
      buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'ATLAS.Common.Save' }],
      actors: this.actors
    };
  }

  /**
   * Persist the enabled mounts as a list of UUIDs.
   * @this {MountConfigMenu}
   * @param {SubmitEvent} _event Form submit event
   * @param {HTMLFormElement} _form Submitted form element
   * @param {foundry.applications.ux.FormDataExtended} formData Parsed form data
   * @returns {Promise<void>}
   */
  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object.mounts || [];
    const checked = Array.isArray(submitted) ? submitted : [submitted];
    const listed = new Set(this.actors.map((actor) => actor.uuid));
    const untouched = getEnabledMountUuids().filter((uuid) => !listed.has(uuid));
    await game.settings.set(MODULE.ID, SETTINGS.ENABLED_MOUNTS, [...new Set([...untouched, ...checked])]);
    ui.notifications.info('TRAVELPACE.Settings.MountConfig.Saved');
  }

  /**
   * Collect candidate mounts and vehicles from world actors and Actor compendiums, keyed by UUID.
   * @returns {Promise<Array<object>>} Candidate actor descriptors ({uuid, name, type, img, isWorld, pack?})
   */
  static async #getPotentialMounts() {
    const actors = [];
    for (const actor of game.actors) if (actor.type === 'npc' || actor.type === 'vehicle') actors.push({ uuid: actor.uuid, name: actor.name, type: actor.type, img: actor.img, isWorld: true });
    for (const pack of game.packs) {
      if (pack.metadata.type !== 'Actor') continue;
      const index = await pack.getIndex({ fields: ['type', 'img'] });
      for (const entry of index) {
        if (entry.type !== 'vehicle') continue;
        actors.push({ uuid: entry.uuid, name: entry.name, type: entry.type, img: entry.img, isWorld: false, pack: pack.title });
      }
    }
    return actors;
  }

  /**
   * Render the mount selector widget for the form-field helper.
   * @returns {HTMLDivElement} The widget container element
   */
  #createMountsWidget() {
    const div = document.createElement('div');
    div.classList.add('mounts-widget');
    const sections = [
      { titleKey: 'TRAVELPACE.Settings.MountConfig.WorldNPCs', items: this.actors.filter((a) => a.isWorld && a.type === 'npc') },
      { titleKey: 'TRAVELPACE.Settings.MountConfig.WorldVehicles', items: this.actors.filter((a) => a.isWorld && a.type === 'vehicle') },
      { titleKey: 'TRAVELPACE.Settings.MountConfig.CompendiumVehicles', items: this.actors.filter((a) => !a.isWorld), suffix: (a) => ` (${a.pack})` }
    ];
    for (const section of sections) if (section.items.length) div.append(MountConfigMenu.#buildSection(section, this.enabled));
    return div;
  }

  /**
   * Build a labeled section of mount checkboxes.
   * @param {object} section Section descriptor
   * @param {string} section.titleKey Localization key for the section heading
   * @param {Array<object>} section.items Actor descriptors to render
   * @param {function(object): string} [section.suffix] Builder returning a name suffix per actor
   * @param {Set<string>} enabled UUIDs currently enabled
   * @returns {HTMLDivElement} The section container element
   */
  static #buildSection({ titleKey, items, suffix }, enabled) {
    const section = document.createElement('div');
    section.classList.add('mount-section');
    const heading = document.createElement('h4');
    heading.textContent = _loc(titleKey);
    section.append(heading);
    for (const actor of items) {
      const label = document.createElement('label');
      label.classList.add('checkbox');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'mounts';
      checkbox.value = actor.uuid;
      checkbox.checked = enabled.has(actor.uuid);
      const img = document.createElement('img');
      img.src = actor.img;
      img.alt = actor.name;
      img.width = 24;
      img.height = 24;
      label.append(checkbox, img, document.createTextNode(` ${actor.name}${suffix ? suffix(actor) : ''}`));
      section.append(label);
    }
    return section;
  }
}
