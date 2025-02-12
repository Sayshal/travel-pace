const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class TravelPace {
  static getSceneControlButtons(buttons) {
    let tokenButton = buttons.find((b) => b.name == 'token');
    if (tokenButton) {
      tokenButton.tools.push({
        name: 'travel-pace',
        title: game.i18n.localize('TravelPace.ButtonName'),
        icon: 'fa-regular fa-route',
        visible: true,
        onClick: () => TravelPace.requestMeasure()
      });
    }
  }

  static requestMeasure() {
    if (TravelPace.requestor === undefined) {
      TravelPace.requestor = new TravelPaceRequestor();
      TravelPace.requestor.render(true);
    }
  }
}

class TravelPaceRequestor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'travel-pace-app',
    template: 'modules/travel-pace/templates/template.html',
    width: 500,
    height: 'auto',
    classes: ['travel-pace'],
    closeOnSubmit: true,
    tag: 'form',
    resizable: true,
    form: {
      handler: TravelPaceRequestor.formHandler,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      setPaceSlow: (event) => TravelPaceRequestor._setPace(event, 'slow'),
      setPaceNormal: (event) => TravelPaceRequestor._setPace(event, 'normal'),
      setPaceFast: (event) => TravelPaceRequestor._setPace(event, 'fast'),
      updatePreview: (event) => TravelPaceRequestor._updatePreview(event)
    }
  };

  static PARTS = {
    main: {
      template: 'modules/travel-pace/templates/template.html',
      scrollable: ['.pw-march']
    }
  };

  constructor(options = {}) {
    super(options);
    game.users.apps.push(this);
  }

  get title() {
    return game.i18n.localize('TravelPace.title');
  }

  async _prepareContext() {
    const context = {};

    const basemed = this.constructor.formatMetricSystem();
    const previewSetting = game.settings.get('travel-pace', 'preview');
    const typeRatio = previewSetting.jratio ?? 1;

    const defaultValues = {
      speed: game.settings.get('travel-pace', 'useMetric') ? 9 : 30,
      onRoad: game.settings.get('travel-pace', 'useMetric') ? 5 : 3,
      offRoad: game.settings.get('travel-pace', 'useMetric') ? 5 : 3
    };

    context.pwNormal = this.constructor.calculateJourneyTime(defaultValues.speed, defaultValues.onRoad, defaultValues.offRoad, 'Normal', typeRatio);
    context.pwSlow = this.constructor.calculateJourneyTime(defaultValues.speed, defaultValues.onRoad, defaultValues.offRoad, 'Slow', typeRatio);
    context.pwQuick = this.constructor.calculateJourneyTime(defaultValues.speed, defaultValues.onRoad, defaultValues.offRoad, 'Fast', typeRatio);
    context.previewSpeed = game.i18n.format('TravelPace.preview.speed', { units: basemed[0] });
    context.previewOnroad = game.i18n.format('TravelPace.preview.onroad', { units: basemed[2] });
    context.previewOffroad = game.i18n.format('TravelPace.preview.offroad', { units: basemed[2] });
    context.previewSpeedVal = defaultValues.speed;
    context.previewOnroadVal = defaultValues.onRoad;
    context.previewOffroadVal = defaultValues.offRoad;
    context.previewRatio = game.i18n.localize('TravelPace.preview.ratio');
    context.r6Select = typeRatio === '6';
    context.r4Select = typeRatio === '4';
    context.r2Select = typeRatio === '2';
    context.rnSelect = typeRatio === '1';

    return context;
  }

  static formatMetricSystem() {
    const metricSystem = game.settings.get('travel-pace', 'useMetric');
    return [
      metricSystem ? game.i18n.localize('TravelPace.units.meters') : game.i18n.localize('TravelPace.units.feet'),
      metricSystem ? game.i18n.localize('TravelPace.units.metersAbbr') : game.i18n.localize('TravelPace.units.feetAbbr'),
      metricSystem ? game.i18n.localize('TravelPace.units.kilometers') : game.i18n.localize('TravelPace.units.miles'),
      metricSystem ? game.i18n.localize('TravelPace.units.kilometersAbbr') : game.i18n.localize('TravelPace.units.milesAbbr')
    ];
  }

  static calculateJourneyTime(speed, onroad, offroad, march, ratio, outDay = false) {
    console.log('Initial values:', { speed, onroad, offroad, march, ratio });

    if (game.settings.get('travel-pace', 'useMetric')) {
      speed = Math.round(speed / 0.3);
      onroad = Math.round(onroad / 1.5);
      offroad = Math.round(offroad / 1.5);
      console.log('After metric conversion:', { speed, onroad, offroad });
    }

    const realDistance = onroad + offroad * 2;
    const realSpeed = speed / 10;
    let total = (realDistance / realSpeed) * ratio;

    console.log('Basic calculations:', {
      realDistance,
      realSpeed,
      initialTotal: total
    });

    if (march === 'Slow') {
      total = (realDistance / ((realSpeed / 3) * 2)) * ratio;
    } else if (march === 'Fast') {
      total = (realDistance / ((realSpeed / 3) * 4)) * ratio;
    }

    console.log('After pace adjustment:', {
      march,
      total
    });

    const hours = Math.floor(total);
    const minutes = Math.floor((total * 60) % 60);
    const days = outDay ? Math.round(total / 8) : null;

    console.log('Final calculations:', {
      hours,
      minutes,
      days
    });

    let formatMeasure = game.i18n.format('TravelPace.journey.time', {
      hours: hours,
      minutes: minutes
    });

    if (outDay) {
      formatMeasure += game.i18n.format(days > 1 ? 'TravelPace.journey.days' : 'TravelPace.journey.day', { days });
    }

    return formatMeasure;
  }

  static _setPace(event, pace) {
    event.preventDefault();
    const form = event.currentTarget.closest('form');
    const formData = new FormDataExtended(form);

    // Get values directly from form elements
    const data = {
      speed: Number(form.querySelector('#speed').value),
      onRoadDistance: Number(form.querySelector('#onRoadDistance').value),
      offRoadDistance: Number(form.querySelector('#offRoadDistance').value),
      ratio: Number(form.querySelector('#ratio').value),
      selectedPace: pace
    };

    console.log('Form data collected:', data);

    this.formHandler(event, form, data);
  }

  static async formHandler(event, form, formData) {
    event.preventDefault();

    const data = {
      speed: Number(formData.speed),
      onRoadDistance: Number(formData.onRoadDistance),
      offRoadDistance: Number(formData.offRoadDistance),
      ratio: Number(formData.ratio),
      selectedPace: formData.selectedPace
    };

    console.log('Processed form data:', data);

    await game.settings.set('travel-pace', 'preview', {
      speed: data.speed,
      onRoadDistance: data.onRoadDistance,
      offRoadDistance: data.offRoadDistance,
      ratio: data.ratio
    });

    await this._createChatMessage(data);
  }

  static _updatePreview(event) {
    const form = event.currentTarget.closest('form');
    const speed = form.querySelector('#speed').value;
    const onRoad = form.querySelector('#onRoadDistance').value;
    const offRoad = form.querySelector('#offRoadDistance').value;
    const ratio = form.querySelector('#ratio').value;

    const times = {
      normal: this.calculateJourneyTime(speed, onRoad, offRoad, 'Normal', ratio),
      slow: this.calculateJourneyTime(speed, onRoad, offRoad, 'Slow', ratio),
      fast: this.calculateJourneyTime(speed, onRoad, offRoad, 'Fast', ratio)
    };

    form.querySelector('[data-pace="normal"]').textContent = times.normal;
    form.querySelector('[data-pace="slow"]').textContent = times.slow;
    form.querySelector('[data-pace="fast"]').textContent = times.fast;
  }

  static async _createChatMessage(data) {
    console.log('Chat Message Data:', data);
    const speaker = ChatMessage.getSpeaker();
    const basemed = this.formatMetricSystem();

    // Log all values being passed to calculateJourneyTime
    console.log('Values being passed to calculateJourneyTime:', {
      speed: data.speed,
      onRoadDistance: data.onRoadDistance,
      offRoadDistance: data.offRoadDistance,
      selectedPace: data.selectedPace,
      ratio: data.ratio
    });

    const marchTotal = this.calculateJourneyTime(data.speed, data.onRoadDistance, data.offRoadDistance, data.selectedPace, data.ratio, true);

    const chatData = {
      marchType: game.i18n.localize(`TravelPace.pace.${data.selectedPace}`),
      dialogNarrative: game.i18n.format('TravelPace.chat.narrative', {
        units: {
          distance: basemed[2],
          speed: basemed[1]
        },
        values: {
          speed: data.speed,
          onRoad: data.onRoadDistance,
          offRoad: data.offRoadDistance
        }
      }),
      marchTotal,
      marchEffect: data.selectedPace !== 'normal' ? game.i18n.localize(`TravelPace.effects.${data.selectedPace}`) : '',
      showForcedMarch: game.settings.get('travel-pace', 'forcedMarch')
    };

    const content = await renderTemplate('modules/travel-pace/templates/templateChat.html', chatData);

    const messageData = {
      content,
      speaker,
      flavor: game.i18n.format('TravelPace.chat.header', {
        ratio: data.ratio
      })
    };

    return ChatMessage.create(messageData);
  }
}

Hooks.on('getSceneControlButtons', TravelPace.getSceneControlButtons);
