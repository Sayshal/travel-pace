import { CONST } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Configuration menu for mounts and vehicles
 * @class
 * @extends {HandlebarsApplicationMixin(ApplicationV2)}
 */
export class MountConfigMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    form: {
      template: 'modules/travel-pace/templates/mount-config.hbs',
      id: 'travelpace-mountconfig-body',
      classes: ['travel-pace-mount-config']
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
      id: 'travelpace-mountconfig-footer',
      classes: ['travel-pace-footer']
    }
  };

  /**
   * Prepare context data for rendering the mount configuration template
   * @param {object} _options - Application render options
   * @returns {Promise<object>} Context data for template rendering
   * @protected
   */
  async _prepareContext(_options) {
    try {
      const enabledMounts = game.settings.get(CONST.moduleId, CONST.settings.enabledMounts);
      const actors = await MountConfigMenu.#getPotentialMounts();
      this.actors = actors;
      const settingSchema = new foundry.data.fields.SchemaField({
        mounts: new foundry.data.fields.SetField(new foundry.data.fields.StringField({ required: false }))
      });
      const selectedMounts = Object.keys(enabledMounts).filter((id) => enabledMounts[id]);
      const document = { schema: settingSchema, mounts: selectedMounts };
      const app = this;
      const mountsWidget = (field, groupConfig, inputConfig) => {
        return MountConfigMenu.#createMountsWidget(field, groupConfig, inputConfig, app);
      };
      return {
        document,
        fields: settingSchema.fields,
        mountsWidget,
        buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TravelPace.Buttons.Save' }],
        actors: actors
      };
    } catch (error) {
      console.error('TravelPace | Error preparing mount config context:', error);
      return {
        document: { schema: {}, mounts: [] },
        fields: {},
        mountsWidget: () => document.createElement('div'),
        buttons: [{ type: 'submit', icon: 'fas fa-save', label: 'TravelPace.Buttons.Save' }],
        actors: []
      };
    }
  }

  /**
   * Shows a notification and closes the application
   * @param {PointerEvent} event - Form submission event
   * @param {HTMLElement} form - The form element
   * @param {FormDataExtended} formData - Processed form data
   * @protected
   */
  async _processSubmit(event, form, formData) {
    try {
      const selectedMounts = {};
      const mountIds = formData.object.mounts || [];
      this.actors.forEach((actor) => {
        selectedMounts[actor.id] = mountIds.includes(actor.id);
      });
      await game.settings.set(CONST.moduleId, CONST.settings.enabledMounts, selectedMounts);
      ui.notifications.info(game.i18n.localize('TravelPace.Settings.MountConfig.Saved'));
      this.close();
    } catch (error) {
      console.error('TravelPace | Error saving mount config:', error);
      ui.notifications.error(game.i18n.localize('TravelPace.Errors.SaveFailed'));
    }
  }

  /**
   * Get potential mounts and vehicles from the world and compendiums
   * @returns {Promise<Array>} Array of potential mount actors
   * @private
   * @static
   */
  static async #getPotentialMounts() {
    const actors = [];
    try {
      for (const actor of game.actors) {
        if (actor.type === 'npc' || actor.type === 'vehicle') {
          actors.push({
            id: actor.id,
            name: actor.name,
            type: actor.type,
            img: actor.img,
            isWorld: true
          });
        }
      }
      for (const pack of game.packs) {
        if (pack.metadata.type === 'Actor') {
          try {
            const content = await pack.getDocuments();
            for (const actor of content) {
              if (actor.type === 'vehicle') {
                actors.push({
                  id: actor.uuid,
                  name: actor.name,
                  type: actor.type,
                  img: actor.img,
                  isWorld: false,
                  pack: pack.title
                });
              }
            }
          } catch (err) {
            console.warn(`TravelPace | Could not load compendium ${pack.title}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('TravelPace | Error getting potential mounts:', error);
    }
    return actors;
  }

  /**
   * Create the mounts selection widget
   * @param {object} field - The field configuration
   * @param {object} groupConfig - Group configuration
   * @param {object} inputConfig - Input configuration
   * @param {MountConfigMenu} app - The application instance
   * @returns {HTMLElement} The widget element
   * @private
   * @static
   */
  static #createMountsWidget(field, groupConfig, inputConfig, app) {
    const div = document.createElement('div');
    div.classList.add('mounts-widget');
    if (!app.actors || app.actors.length === 0) {
      div.innerHTML = `<p>${game.i18n.localize('TravelPace.Settings.MountConfig.NoActors')}</p>`;
      return div;
    }
    const worldNPCs = app.actors.filter((a) => a.isWorld && a.type === 'npc');
    const worldVehicles = app.actors.filter((a) => a.isWorld && a.type === 'vehicle');
    const compendiumVehicles = app.actors.filter((a) => !a.isWorld);
    if (worldNPCs.length > 0) {
      const section = document.createElement('div');
      section.classList.add('mount-section');
      section.innerHTML = `<h4>${game.i18n.localize('TravelPace.Settings.MountConfig.WorldNPCs')}</h4>`;
      worldNPCs.forEach((actor) => {
        const label = document.createElement('label');
        label.classList.add('checkbox');
        label.innerHTML = `
          <input type="checkbox" name="mounts" value="${actor.id}">
          <img src="${actor.img}" alt="${actor.name}" width="24" height="24">
          ${actor.name}
        `;
        section.appendChild(label);
      });
      div.appendChild(section);
    }
    if (worldVehicles.length > 0) {
      const section = document.createElement('div');
      section.classList.add('mount-section');
      section.innerHTML = `<h4>${game.i18n.localize('TravelPace.Settings.MountConfig.WorldVehicles')}</h4>`;
      worldVehicles.forEach((actor) => {
        const label = document.createElement('label');
        label.classList.add('checkbox');
        label.innerHTML = `
          <input type="checkbox" name="mounts" value="${actor.id}">
          <img src="${actor.img}" alt="${actor.name}" width="24" height="24">
          ${actor.name}
        `;
        section.appendChild(label);
      });
      div.appendChild(section);
    }
    if (compendiumVehicles.length > 0) {
      const section = document.createElement('div');
      section.classList.add('mount-section');
      section.innerHTML = `<h4>${game.i18n.localize('TravelPace.Settings.MountConfig.CompendiumVehicles')}</h4>`;
      compendiumVehicles.forEach((actor) => {
        const label = document.createElement('label');
        label.classList.add('checkbox');
        label.innerHTML = `
          <input type="checkbox" name="mounts" value="${actor.id}">
          <img src="${actor.img}" alt="${actor.name}" width="24" height="24">
          ${actor.name} (${actor.pack})
        `;
        section.appendChild(label);
      });
      div.appendChild(section);
    }
    return div;
  }
}

/**
 * Register module settings
 */
Hooks.once('init', () => {
  try {
    game.settings.register(CONST.moduleId, CONST.settings.useMetric, {
      name: game.i18n.localize('TravelPace.Settings.UseMetric.Name'),
      hint: game.i18n.localize('TravelPace.Settings.UseMetric.Hint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(CONST.moduleId, CONST.settings.showEffects, {
      name: game.i18n.localize('TravelPace.Settings.ShowEffects.Name'),
      hint: game.i18n.localize('TravelPace.Settings.ShowEffects.Hint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });

    game.settings.register(CONST.moduleId, CONST.settings.enabledMounts, {
      name: game.i18n.localize('TravelPace.Settings.EnabledMounts.Name'),
      hint: game.i18n.localize('TravelPace.Settings.EnabledMounts.Hint'),
      scope: 'world',
      config: false,
      type: Object,
      default: {}
    });

    game.settings.registerMenu(CONST.moduleId, 'mountConfigMenu', {
      name: game.i18n.localize('TravelPace.Settings.MountConfig.Name'),
      label: game.i18n.localize('TravelPace.Settings.MountConfig.Label'),
      hint: game.i18n.localize('TravelPace.Settings.MountConfig.Hint'),
      icon: 'fas fa-horse',
      type: MountConfigMenu,
      restricted: true
    });
  } catch (error) {
    console.error('TravelPace | Error registering settings:', error);
  }
});
