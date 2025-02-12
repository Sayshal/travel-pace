class TravelPace {
  static getSceneControlButtons(buttons) {
    let tokenButton = buttons.find((b) => b.name == 'token');
    if (tokenButton) {
      tokenButton.tools.push({
        name: 'travel-pace',
        title: game.i18n.localize('TravelPace.ButtonName'),
        icon: 'fa fa-location-arrow',
        visible: true,
        onClick: () => TravelPace.requestMeasure()
      });
    }
  }
  static requestMeasure() {
    //ui.notifications.warn("oi");
    if (TravelPace.requestor === undefined) TravelPace.requestor = new TravelPaceRequestor();
    TravelPace.requestor.render(true);
  }
}
class TravelPaceRequestor extends FormApplication {
  constructor(...args) {
    super(...args);
    game.users.apps.push(this);
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.title = game.i18n.localize('TravelPace.RequestorName');
    options.id = 'travel-pace';
    options.template = 'modules/travel-pace/templates/template.html';
    options.closeOnSubmit = true;
    options.popOut = true;
    options.width = 400;
    options.height = 'auto';
    options.classes = ['travel-pace'];
    return options;
  }
  activateListeners(html) {
    super.activateListeners(html);
    this.element.find('#jspeed').change(this._onUserChange.bind(this));
    this.element.find('#jmilesonroad').change(this._onUserChange.bind(this));
    this.element.find('#jmilesoffroad').change(this._onUserChange.bind(this));
    this.element.find('#jratio').change(this._onUserChange.bind(this));

    this.element.find('.travelpace-slow-button').click((event) => this.setTravelPace(event, 'Slow'));
    this.element.find('.travelpace-normal-button').click((event) => this.setTravelPace(event, 'Normal'));
    this.element.find('.travelpace-fast-button').click((event) => this.setTravelPace(event, 'Fast'));
  }
  setTravelPace(event, pace) {
    event.preventDefault();
    this.element.find('#pace').val(pace);
    $('#travel-pace-form').submit();
  }
  JourneyTime(speed, onroad, offroad, march, ratio, outDay = false) {
    //console.log(ratio);
    if (game.settings.get('travel-pace', 'MetricSystem') === true) {
      speed = Math.round(speed / 0.3);
      onroad = Math.round(onroad / 1.5);
      offroad = Math.round(offroad / 1.5);
    }
    let realDistance = onroad * 1 + offroad * 2;
    let realSpeed = speed / 10;
    let total = (realDistance / realSpeed) * ratio;
    if (march === 'Slow') {
      total = (realDistance / ((realSpeed / 3) * 2)) * ratio;
    } else if (march === 'Fast') {
      total = (realDistance / ((realSpeed / 3) * 4)) * ratio;
    }
    let formatMeasure = game.i18n.format('TravelPace.Dialog.Journey', { hour: Math.floor(total), min: Math.floor((total * 60) % 60) });
    //The Travel Pace table assumes that characters travel for 8 hours in day
    if (outDay === true) {
      let days = Math.round(total / 8);
      if (days > 1) {
        formatMeasure += game.i18n.format('TravelPace.Dialog.JourneyDays', { days: days });
      } else {
        formatMeasure += game.i18n.format('TravelPace.Dialog.JourneyDay', { days: days });
      }
    }
    return formatMeasure;
  }

  formatMetricSystem() {
    const metricSystem = game.settings.get('travel-pace', 'MetricSystem');
    let unitFeed = metricSystem ? game.i18n.localize('TravelPace.meters') : game.i18n.localize('TravelPace.Units.feets');
    let unitFeedAbbr = metricSystem ? game.i18n.localize('TravelPace.metersAbbr') : game.i18n.localize('TravelPace.Units.feetsAbbr');
    let unitMiles = metricSystem ? game.i18n.localize('TravelPace.kilometers') : game.i18n.localize('TravelPace.Units.miles');
    let unitMilesAbbr = metricSystem ? game.i18n.localize('TravelPace.kilometersAbbr') : game.i18n.localize('TravelPace.Units.milesAbbr');
    let medidas = [unitFeed, unitFeedAbbr, unitMiles, unitMilesAbbr];
    return medidas;
  }
  async getData() {
    let basemed = this.formatMetricSystem();
    let previewSetting = game.settings.get('travel-pace', 'previewSetting');
    let previewSpeedVal = game.settings.get('travel-pace', 'MetricSystem') ? 9 : 30;
    if (previewSetting.jspeed != undefined) previewSpeedVal = previewSetting.jspeed;
    let previewOnroadVal = game.settings.get('travel-pace', 'MetricSystem') ? 5 : 3;
    if (previewSetting.jmilesonroad != undefined) previewOnroadVal = previewSetting.jmilesonroad;
    let previewOffroadVal = game.settings.get('travel-pace', 'MetricSystem') ? 5 : 3;
    if (previewSetting.jmilesoffroad != undefined) previewOffroadVal = previewSetting.jmilesoffroad;
    let r6Select = previewSetting.jratio == '6' ? 'selected' : '';
    let r4Select = previewSetting.jratio == '4' ? 'selected' : '';
    let r2Select = previewSetting.jratio == '2' ? 'selected' : '';
    let rnSelect = previewSetting.jratio == '1' ? 'selected' : '';
    let typeRatio = previewSetting.jratio ? previewSetting.jratio : 1;

    const pwNormal = this.JourneyTime(previewSpeedVal, previewOnroadVal, previewOffroadVal, 'Normal', typeRatio);
    const pwSlow = this.JourneyTime(previewSpeedVal, previewOnroadVal, previewOffroadVal, 'Slow', typeRatio);
    const pwQuick = this.JourneyTime(previewSpeedVal, previewOnroadVal, previewOffroadVal, 'Fast', typeRatio);
    const previewSpeed = game.i18n.format('TravelPace.Dialog.PreviewSpeed', { units_feetAbbr: basemed[0] });
    const previewOnroad = game.i18n.format('TravelPace.Dialog.PreviewOnroad', { units_miles: basemed[2] });
    const previewOffroad = game.i18n.format('TravelPace.Dialog.PreviewOffroad', { units_miles: basemed[2] });
    const previewRatio = game.i18n.localize('TravelPace.Dialog.PreviewRatio');
    return {
      pwNormal,
      pwSlow,
      pwQuick,
      previewSpeed,
      previewOnroad,
      previewOffroad,
      previewSpeedVal,
      previewOnroadVal,
      previewOffroadVal,
      previewRatio,
      rnSelect,
      r2Select,
      r4Select,
      r6Select
    };
  }
  _onUserChange() {
    let typeSpeed = this.element.find('#jspeed').val();
    let typeOnRoad = this.element.find('#jmilesonroad').val();
    let typeOffRoad = this.element.find('#jmilesoffroad').val();
    let typeRatio = this.element.find('#jratio').val();

    $('#march-normal').html(this.JourneyTime(typeSpeed, typeOnRoad, typeOffRoad, 'Normal', typeRatio));
    $('#march-slow').html(this.JourneyTime(typeSpeed, typeOnRoad, typeOffRoad, 'Slow', typeRatio));
    $('#march-fast').html(this.JourneyTime(typeSpeed, typeOnRoad, typeOffRoad, 'Fast', typeRatio));
  }
  async _updateObject(event, formData) {
    //TODO: Fazer as mensagens do chat.
    //ui.notifications.warn('oi2');
    let speaker = ChatMessage.getSpeaker();
    // Translate metric system
    let basemed = this.formatMetricSystem();
    // preview value
    game.settings.set('travel-pace', 'previewSetting', {
      jspeed: formData['jspeed'],
      jmilesonroad: formData['jmilesonroad'],
      jmilesoffroad: formData['jmilesoffroad'],
      jratio: formData['jratio']
    });

    if (!speaker.actor && game.user.character) speaker = ChatMessage.getSpeaker({ actor: game.user.character });
    let templateChat = 'modules/travel-pace/templates/templateChat.html';
    let marchTotal = this.JourneyTime(formData['jspeed'], formData['jmilesonroad'], formData['jmilesoffroad'], formData['pace'], formData['jratio'], true);
    let marchDisclaimer =
      formData['pace'] === 'Slow' ? game.i18n.localize('TravelPace.Dialog.SlowEffects') : formData['pace'] === 'Fast' ? game.i18n.localize('TravelPace.Dialog.FastEffects') : '';
    let dialogNarrative = game.i18n.format('TravelPace.Dialog.Narrative', {
      units_miles: basemed[2],
      units_feetAbbr: basemed[1],
      marchSpeed: formData['jspeed'],
      marchOnRoad: formData['jmilesonroad'],
      marchOffRoad: formData['jmilesoffroad']
    });
    let marchstring = 'TravelPace.PaceTypes.Pace' + formData['pace'];
    let marchType = game.i18n.localize(marchstring);
    let dialogData = {
      marchType: marchType,
      dialogNarrative: dialogNarrative,
      marchTotal: marchTotal,
      marchDisclaimer: marchDisclaimer,
      chatForced: game.settings.get('travel-pace', 'ForcedMarchDialog')
    };
    let flavor = '<h3>' + game.i18n.localize('TravelPace.Dialog.Who') + ' (ratio: 1/' + formData['jratio'] + ')</h3>';
    let content = await renderTemplate(templateChat, dialogData);
    let messageData = {
      content: content,
      flavor: flavor,
      speaker: speaker
    };
    ChatMessage.create(messageData);
    console.log('Travel Pace submit: ', formData);
  }
}
Hooks.on('getSceneControlButtons', TravelPace.getSceneControlButtons);
