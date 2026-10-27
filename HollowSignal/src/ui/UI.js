const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class UI {
  constructor(settings) {
    this.settings = settings;
    this.onAction = null;
    this.onSettingsChanged = null;
    this.onSheetClose = null;
    this.onJournalClose = null;
    this.onChoice = null;
    this.onKeypadCancel = null;
    this.onKeypadSubmit = null;

    this.el = {
      hud: $('hud'),
      canvas: $('game-canvas'),
      menu: $('menu-screen'),
      loading: $('loading-screen'),
      loadingStatus: $('loading-status'),
      loadingBar: $('loading-bar'),
      loadingPercent: $('loading-percent'),
      loadingLog: $('loading-log'),
      intro: $('intro-overlay'),
      introKicker: $('intro-kicker'),
      introLines: $('intro-lines'),
      introFootnote: $('intro-footnote'),
      enterButton: $('enter-button'),
      chapterCard: $('chapter-card'),
      chapterCardNumber: $('chapter-card-number'),
      chapterCardTitle: $('chapter-card-title'),
      chapterCardQuote: $('chapter-card-quote'),
      chapterCardMeta: $('chapter-card-quote').parentElement.querySelector('.chapter-meta'),
      screenFade: $('screen-fade'),
      objectivePanel: $('objective-panel'),
      chapterIndex: $('chapter-index'),
      objectiveText: $('objective-text'),
      objectiveSub: $('objective-sub'),
      subtitleBox: $('subtitles'),
      subtitleSpeaker: $('subtitle-speaker'),
      subtitleText: $('subtitle-text'),
      reticle: $('crosshair'),
      interaction: $('interaction'),
      interactionLabel: $('interaction-label'),
      interactionSub: $('interaction-sub'),
      inventoryBar: $('inventory-bar'),
      invFlashlight: $('inv-flashlight'),
      flashlightState: $('flashlight-state'),
      invKeycard: $('inv-keycard'),
      invFuse: $('inv-fuse'),
      invFuseLabel: $('inv-fuse-label'),
      noiseWidget: $('noise-widget'),
      noiseState: $('noise-state'),
      tapeIndicator: $('tape-indicator'),
      tapeLabel: $('tape-label'),
      toastStack: $('toast-stack'),
      hudHint: $('hud-hint'),
      lookHint: $('look-hint'),
      pause: $('pause-screen'),
      pauseChapter: $('pause-chapter'),
      pauseTip: $('pause-tip'),
      settings: $('settings-screen'),
      controls: $('controls-screen'),
      credits: $('credits-screen'),
      noteModal: $('note-modal'),
      noteKicker: $('note-kicker'),
      noteIndex: $('note-index'),
      noteTitle: $('note-title'),
      noteBody: $('note-body'),
      noteFooter: $('note-footer'),
      keypad: $('keypad-modal'),
      keypadTitle: $('keypad-title'),
      keypadDisplay: $('keypad-display'),
      keypadHint: $('keypad-hint'),
      keypadLed: $('keypad-led'),
      keypadBrand: $('keypad-brand'),
      journal: $('journal-modal'),
      journalList: $('journal-list'),
      journalEntryTitle: $('journal-entry-title'),
      journalEntryBody: $('journal-entry-body'),
      journalKicker: $('journal-kicker'),
      journalCode: $('journal-code'),
      journalCount: $('journal-count'),
      journalClose: $('journal-close'),
      choice: $('choice-modal'),
      choiceTitle: $('choice-title'),
      choiceBody: $('choice-body'),
      choiceA: $('choice-a'),
      choiceB: $('choice-b'),
      ending: $('ending-screen'),
      endingKicker: $('ending-kicker'),
      endingTitle: $('ending-title'),
      endingBody: $('ending-body'),
      endingQuote: $('ending-quote'),
      death: $('death-overlay'),
      deathHint: $('death-hint'),
      clickResume: $('click-to-resume'),
      resumeClickButton: $('resume-click-button'),
      continueButton: $('continue-button'),
      continueChapter: $('continue-chapter'),
      hidingShroud: $('hiding-shroud'),
      dangerPulse: $('danger-pulse'),
      whiteout: $('whiteout'),
      damageFlash: $('damage-flash'),
      sensitivity: $('sensitivity'),
      sensitivityValue: $('sensitivity-value'),
      volume: $('volume'),
      volumeValue: $('volume-value'),
      grain: $('grain'),
      grainValue: $('grain-value'),
      fov: $('fov'),
      fovValue: $('fov-value'),
      subtitlesToggle: $('subtitles-toggle'),
      motionToggle: $('motion-toggle'),
      qualityControl: $('quality-control'),
      settingsBack: $('settings-back'),
      fpsHud: $('fps-hud'),
      journalButton: $('journal-button'),
      pauseButton: $('pause-button'),
      signalPath: $('signal-path')
    };

    this.subtitle = {
      active: null,
      hold: 0,
      queue: []
    };
    this.hintTimer = 0;
    this.sheetContext = 'menu';
    this.journalRecords = [];
    this.keypadState = {
      open: false,
      digits: '',
      length: 4,
      locked: false
    };
    this.choiceOpen = false;
    this.introResolver = null;
    this._bind();
    this._applySettingsToControls();
  }

  _bind() {
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        this.onAction?.(button.dataset.action, button);
      });
    });
    this.el.enterButton.addEventListener('click', () => {
      const resolve = this.introResolver;
      this.introResolver = null;
      this.hideIntro();
      resolve?.(true);
    });
    this.el.resumeClickButton.addEventListener('click', () => this.onAction?.('resume-click'));
    this.el.journalButton.addEventListener('click', () => this.onAction?.('journal'));
    this.el.pauseButton.addEventListener('click', () => this.onAction?.('pause'));
    this.el.journalClose.addEventListener('click', () => this.onAction?.('journal-close'));

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => this.closeSheet());
    });
    this.el.settingsBack.addEventListener('click', () => this.closeSheet());

    this.el.qualityControl.querySelectorAll('[data-quality]').forEach((button) => {
      button.addEventListener('click', () => {
        this.settings.set('quality', button.dataset.quality);
        this.syncSettings();
      });
    });
    this.el.sensitivity.addEventListener('input', () => {
      this.settings.set('sensitivity', Number(this.el.sensitivity.value));
      this.syncSettingsLabels();
    });
    this.el.volume.addEventListener('input', () => {
      this.settings.set('volume', Number(this.el.volume.value));
      this.syncSettingsLabels();
    });
    this.el.grain.addEventListener('input', () => {
      this.settings.set('grain', Number(this.el.grain.value));
      this.syncSettingsLabels();
    });
    this.el.fov.addEventListener('input', () => {
      this.settings.set('fov', Number(this.el.fov.value));
      this.syncSettingsLabels();
    });
    this.el.subtitlesToggle.addEventListener('click', () => {
      this.settings.set('subtitles', !this.settings.values.subtitles);
      this.syncSettings();
    });
    this.el.motionToggle.addEventListener('click', () => {
      this.settings.set('reducedMotion', !this.settings.values.reducedMotion);
      this.syncSettings();
    });
    this.settings.subscribe((key, value) => {
      this.onSettingsChanged?.(key, value);
    });

    this.el.keypad.querySelectorAll('[data-key]').forEach((button) => {
      button.addEventListener('click', () => this.keypadPress(button.dataset.key));
    });

    this.el.choiceA.addEventListener('click', () => this._selectChoice('purge'));
    this.el.choiceB.addEventListener('click', () => this._selectChoice('answer'));

    this.el.journalList.addEventListener('click', (e) => {
      const button = e.target.closest('.journal-entry');
      if (!button) return;
      this.showJournalRecord(button.dataset.recordId);
    });

    this._onGlobalKeyDown = (event) => this._handleSpecialKeys(event);
    window.addEventListener('keydown', this._onGlobalKeyDown, { capture: true });
    this._menuSignalTimer = 0;
  }

  _handleSpecialKeys(event) {
    if (this.keypadState.open) {
      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeKeypad();
        this.onKeypadCancel?.();
        return;
      }
      if (/^(Digit|Numpad)\d$/.test(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        this.keypadPress(event.code.slice(-1));
        return;
      }
      if (event.code === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        this.keypadPress('back');
        return;
      }
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        event.preventDefault();
        event.stopPropagation();
        this.keypadPress('enter');
        return;
      }
    }
    if (this.choiceOpen && (event.code === 'Digit1' || event.code === 'Digit2')) {
      event.preventDefault();
      this._selectChoice(event.code === 'Digit1' ? 'purge' : 'answer');
    }
  }

  _applySettingsToControls() {
    const v = this.settings.values;
    this.el.sensitivity.value = v.sensitivity;
    this.el.volume.value = v.volume;
    this.el.grain.value = v.grain;
    this.el.fov.value = v.fov;
    this.syncSettings();
  }

  syncSettings() {
    const v = this.settings.values;
    this.el.qualityControl.querySelectorAll('[data-quality]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.quality === v.quality);
    });
    this.el.subtitlesToggle.classList.toggle('is-on', v.subtitles);
    this.el.subtitlesToggle.setAttribute('aria-checked', String(v.subtitles));
    this.el.subtitlesToggle.lastChild.textContent = v.subtitles ? 'ON' : 'OFF';
    this.el.motionToggle.classList.toggle('is-on', v.reducedMotion);
    this.el.motionToggle.setAttribute('aria-checked', String(v.reducedMotion));
    this.el.motionToggle.lastChild.textContent = v.reducedMotion ? 'ON' : 'OFF';
    this.syncSettingsLabels();
  }

  syncSettingsLabels() {
    const v = this.settings.values;
    this.el.sensitivityValue.textContent = Number(v.sensitivity).toFixed(2).replace(/0$/, '');
    this.el.volumeValue.textContent = `${Math.round(v.volume * 100)}%`;
    const grainLabels = ['Off', 'Soft', 'Normal', 'Heavy'];
    this.el.grainValue.textContent = grainLabels[Math.min(3, Math.round(v.grain * 3))];
    this.el.fovValue.textContent = `${v.fov}°`;
  }

  setMenuContinue(chapterNumber, chapterTitle) {
    if (!chapterNumber) {
      this.el.continueButton.hidden = true;
      return;
    }
    this.el.continueButton.hidden = false;
    this.el.continueChapter.textContent = `CH. ${String(chapterNumber).padStart(2, '0')}`;
    this.el.continueButton.title = chapterTitle;
  }

  showMenu() {
    document.body.classList.add('is-menu');
    document.body.classList.remove('is-paused');
    this.el.menu.classList.remove('is-hidden', 'is-leaving');
    this.hideHud();
    this.hidePause();
    this.hideDeath();
    this.hideClickResume();
    this.hideEnding();
    this.hideNote();
    this.hideJournal();
    this.hideChoice();
    this.hideChapterCard();
    this.hideTape();
    this.hideIntro();
    this.setHiding(false);
    this.setDanger(false);
    this.setWhiteout(false);
    this.setFade(false);
  }

  hideMenu() {
    document.body.classList.remove('is-menu');
    this.el.menu.classList.add('is-leaving');
    const token = (this._menuHideToken || 0) + 1;
    this._menuHideToken = token;
    setTimeout(() => {
      if (this._menuHideToken === token && this.el.menu.classList.contains('is-leaving')) {
        this.el.menu.classList.add('is-hidden');
      }
    }, 1200);
  }

  showLoading(status = 'Mounting archive...') {
    this.el.loadingStatus.textContent = status;
    this.el.loadingBar.style.width = '4%';
    this.el.loadingPercent.textContent = '4%';
    this.el.loadingLog.textContent = '';
    this.el.loading.classList.remove('is-hidden', 'is-leaving');
    this.updateLoading(4, status);
  }

  updateLoading(percent, status, logLine) {
    const p = clamp(percent, 0, 100);
    this.el.loadingBar.style.width = `${p}%`;
    this.el.loadingPercent.textContent = `${Math.floor(p)}%`;
    if (status) this.el.loadingStatus.textContent = status;
    if (logLine) {
      this.el.loadingLog.textContent += (this.el.loadingLog.textContent ? '\n' : '') + logLine;
      const lines = this.el.loadingLog.textContent.split('\n');
      if (lines.length > 4) this.el.loadingLog.textContent = lines.slice(-4).join('\n');
    }
  }

  hideLoading() {
    this.el.loading.classList.add('is-leaving');
    setTimeout(() => this.el.loading.classList.add('is-hidden'), 750);
  }

  showIntro({ kicker, lines, buttonLabel, footnote }) {
    this.el.introKicker.textContent = kicker || '';
    this.el.introFootnote.textContent = footnote || 'Click to capture mouse · Esc to pause';
    this.el.enterButton.querySelector('span').textContent = buttonLabel || 'Enter the station';
    this.el.introLines.replaceChildren();
    lines.forEach((line, index) => {
      const p = document.createElement('p');
      if (typeof line === 'string') {
        p.textContent = line;
      } else {
        p.textContent = line.text;
        if (line.dim) p.classList.add('is-dim');
      }
      p.style.animationDelay = `${0.15 + index * 0.35}s`;
      this.el.introLines.appendChild(p);
    });
    this.el.intro.classList.remove('is-hidden');
    return new Promise((resolve) => {
      this.introResolver = resolve;
    });
  }

  hideIntro() {
    this.el.intro.classList.add('is-hidden');
    this.el.introLines.replaceChildren();
  }

  showHud() {
    this.el.hud.classList.remove('is-hidden');
  }

  hideHud() {
    this.el.hud.classList.add('is-hidden');
  }

  setChapter(number, title, roman) {
    this.el.chapterIndex.textContent = `CHAPTER ${roman || String(number).padStart(2, '0')}`;
    this.el.pauseChapter.textContent = `${number ? `CHAPTER ${roman} · ` : ''}${title.toUpperCase()}`;
  }

  setObjective(text, sub = '') {
    const panel = this.el.objectivePanel;
    const token = (this._objectiveToken || 0) + 1;
    this._objectiveToken = token;
    this.el.objectiveText.classList.add('is-changing');
    setTimeout(() => {
      if (token !== this._objectiveToken) return;
      this.el.objectiveText.textContent = text;
      this.el.objectiveSub.textContent = sub;
      this.el.objectiveText.classList.remove('is-changing');
      panel.classList.remove('is-updated');
      void panel.offsetWidth;
      panel.classList.add('is-updated');
    }, 180);
  }

  showInteraction(label, sub = '') {
    this.el.interactionLabel.textContent = label;
    this.el.interactionSub.textContent = sub;
    this.el.interaction.classList.remove('is-hidden');
    this.el.reticle.classList.add('is-active');
  }

  hideInteraction() {
    this.el.interaction.classList.add('is-hidden');
    this.el.reticle.classList.remove('is-active');
  }

  showToast(text) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = text;
    this.el.toastStack.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  setFlashlightState(on) {
    this.el.flashlightState.textContent = on ? 'ON' : 'OFF';
    this.el.flashlightState.style.color = on ? 'rgba(141,168,155,.8)' : 'rgba(216,209,192,.34)';
  }

  setItem(id, visible, label) {
    const map = { keycard: this.el.invKeycard, fuse: this.el.invFuse };
    const el = map[id];
    if (!el) return;
    el.classList.toggle('is-hidden', !visible);
    if (visible && label) {
      if (id === 'fuse') this.el.invFuseLabel.textContent = label;
    }
  }

  setNoise(value, stateText, listening = false) {
    const segments = clamp(Math.round(value * 6), 0, 6);
    this.el.noiseWidget.dataset.noise = String(segments);
    this.el.noiseWidget.classList.toggle('is-listen', listening);
    if (stateText) this.el.noiseState.textContent = stateText;
  }

  setNoiseVisible(visible) {
    this.el.noiseWidget.classList.toggle('is-hidden', !visible);
  }

  showTape(label) {
    this.el.tapeLabel.textContent = label;
    this.el.tapeIndicator.classList.remove('is-hidden');
  }

  hideTape() {
    this.el.tapeIndicator.classList.add('is-hidden');
  }

  setHiding(hidden) {
    this.el.hidingShroud.classList.toggle('is-hiding', hidden);
  }

  setDanger(danger) {
    this.el.dangerPulse.classList.toggle('is-danger', danger);
  }

  flashDamage() {
    this.el.damageFlash.classList.add('is-hit');
    setTimeout(() => this.el.damageFlash.classList.remove('is-hit'), 70);
  }

  setWhiteout(on) {
    this.el.whiteout.classList.toggle('is-white', on);
  }

  say(speaker, text, duration = null, gap = 0.35) {
    if (!this.settings.values.subtitles) return;
    if (!text) return;
    const length = text.length;
    const span = duration ?? clamp(2.2 + length * 0.037, 2.8, 8.5);
    this.subtitle.queue.push({ speaker: speaker || '', text, duration: span, gap });
    if (this.subtitle.queue.length > 14) this.subtitle.queue.splice(0, this.subtitle.queue.length - 14);
    if (!this.subtitle.active) this._advanceSubtitle();
  }

  clearSubtitles() {
    this.subtitle.queue.length = 0;
    this.subtitle.active = null;
    this.subtitle.hold = 0;
    this.el.subtitleBox.classList.remove('is-visible');
  }

  _advanceSubtitle() {
    const next = this.subtitle.queue.shift();
    if (!next) {
      this.subtitle.active = null;
      this.subtitle.hold = 0;
      this.el.subtitleBox.classList.remove('is-visible');
      return;
    }
    this.subtitle.active = next;
    next.timeLeft = next.duration;
    this.subtitle.hold = 0;
    this.el.subtitleSpeaker.textContent = next.speaker;
    this.el.subtitleText.textContent = next.text;
    this.el.subtitleBox.classList.add('is-visible');
  }

  update(dt) {
    if (this.subtitle.hold > 0) {
      this.subtitle.hold -= dt;
      if (this.subtitle.hold <= 0) this._advanceSubtitle();
    } else if (this.subtitle.active) {
      this.subtitle.active.timeLeft -= dt;
      if (this.subtitle.active.timeLeft <= 0) {
        const gap = this.subtitle.active.gap ?? .35;
        this.subtitle.active = null;
        this.el.subtitleBox.classList.remove('is-visible');
        if (this.subtitle.queue.length) this.subtitle.hold = gap;
      }
    }

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.el.hudHint.classList.remove('is-visible');
    }

    if (!this.el.menu.classList.contains('is-hidden') && document.body.classList.contains('is-menu')) {
      this._menuSignalTimer += dt;
      if (this._menuSignalTimer > 0.08) {
        this._menuSignalTimer = 0;
        this._drawMenuSignal();
      }
    }
  }

  _drawMenuSignal() {
    if (!this.el.signalPath) return;
    const points = 64;
    let d = '';
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * 900;
      const t = performance.now() * 0.0004;
      const env = Math.sin((i / points) * Math.PI) ** 1.8;
      const noise = Math.sin(i * 0.84 + t * 8) * Math.cos(i * 0.21 - t * 5) + Math.sin(i * 0.11 + t * 2) * .4;
      const y = 90 + noise * 32 * env;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
    }
    this.el.signalPath.setAttribute('d', d);
  }

  showHint(text, duration = 6) {
    this.el.hudHint.textContent = text;
    this.el.hudHint.classList.add('is-visible');
    this.hintTimer = duration;
  }

  showLookHint() { this.el.lookHint.classList.remove('is-hidden'); }
  hideLookHint() { this.el.lookHint.classList.add('is-hidden'); }

  showChapterCard({ number, title, quote, meta }) {
    this.el.chapterCardNumber.textContent = number;
    this.el.chapterCardTitle.textContent = title;
    this.el.chapterCardQuote.textContent = quote;
    const metaEl = this.el.chapterCard.querySelector('.chapter-meta');
    if (metaEl) metaEl.textContent = meta;
    this.el.chapterCard.classList.remove('is-hidden');
  }

  hideChapterCard() {
    this.el.chapterCard.classList.add('is-hidden');
  }

  setFade(on, instant = false) {
    this.el.screenFade.classList.toggle('is-visible', on);
    this.el.screenFade.classList.toggle('is-instant', instant);
  }

  showPause({ chapter, tip }) {
    document.body.classList.add('is-paused');
    this.el.pauseChapter.textContent = chapter;
    if (tip) this.el.pauseTip.textContent = tip;
    this.el.pause.classList.remove('is-hidden');
    this.hideHud();
  }

  hidePause() {
    document.body.classList.remove('is-paused');
    this.el.pause.classList.add('is-hidden');
  }

  openSheet(name, context = 'menu') {
    this.sheetContext = context;
    this.syncSettings();
    const map = { settings: this.el.settings, controls: this.el.controls, credits: this.el.credits };
    Object.entries(map).forEach(([key, el]) => el.classList.toggle('is-hidden', key !== name));
  }

  closeSheet() {
    this.el.settings.classList.add('is-hidden');
    this.el.controls.classList.add('is-hidden');
    this.el.credits.classList.add('is-hidden');
    this.onSheetClose?.(this.sheetContext);
  }

  showNote(note) {
    this.el.noteKicker.textContent = note.kicker || 'RECOVERED DOCUMENT';
    this.el.noteIndex.textContent = note.index || '';
    this.el.noteTitle.textContent = note.title || '';
    this.el.noteBody.innerHTML = note.body || '';
    this.el.noteFooter.textContent = note.footer || 'HALCYON RESEARCH STATION';
    this.el.noteModal.classList.remove('is-hidden');
  }

  hideNote() {
    this.el.noteModal.classList.add('is-hidden');
  }

  openKeypad({ title = 'ENTER ACCESS CODE', hint = 'Four digits.', brand = 'SECURITY — HALCYON', length = 4 } = {}) {
    this.keypadState.open = true;
    this.keypadState.digits = '';
    this.keypadState.length = length;
    this.keypadState.locked = false;
    this.el.keypadTitle.textContent = title;
    this.el.keypadHint.textContent = hint;
    this.el.keypadBrand.textContent = brand;
    this.el.keypadLed.classList.remove('is-ok');
    this.el.keypadDisplay.classList.remove('is-error');
    this._renderKeypad();
    this.el.keypad.classList.remove('is-hidden');
  }

  _renderKeypad() {
    const digits = this.keypadState.digits.padEnd(this.keypadState.length, '_').slice(0, this.keypadState.length);
    this.el.keypadDisplay.replaceChildren();
    for (const digit of digits) {
      const span = document.createElement('span');
      span.textContent = digit || '_';
      this.el.keypadDisplay.appendChild(span);
    }
  }

  keypadPress(key) {
    if (!this.keypadState.open || this.keypadState.locked) return;
    if (key === 'clear') {
      this.keypadState.digits = '';
      this.el.keypadHint.textContent = 'Cleared.';
      this._renderKeypad();
      return;
    }
    if (key === 'back') {
      this.keypadState.digits = this.keypadState.digits.slice(0, -1);
      this._renderKeypad();
      return;
    }
    if (key === 'enter') {
      if (this.keypadState.digits.length < this.keypadState.length) {
        this.keypadError('INCOMPLETE CODE');
        return;
      }
      this.keypadState.locked = true;
      this.onKeypadSubmit?.(this.keypadState.digits);
      return;
    }
    if (!/^\d$/.test(key)) return;
    if (this.keypadState.digits.length < this.keypadState.length) {
      this.keypadState.digits += key;
      this.el.keypadHint.textContent = 'Press ENT to submit.';
      this._renderKeypad();
      if (this.keypadState.digits.length === this.keypadState.length) {
        this.el.keypadHint.textContent = 'Code ready. Press ENT.';
      }
    }
  }

  keypadError(message = 'ACCESS DENIED') {
    this.keypadState.locked = false;
    this.el.keypadHint.textContent = message;
    this.el.keypadDisplay.classList.remove('is-error');
    void this.el.keypadDisplay.offsetWidth;
    this.el.keypadDisplay.classList.add('is-error');
    this.el.keypadLed.classList.remove('is-ok');
    setTimeout(() => {
      this.keypadState.digits = '';
      this._renderKeypad();
    }, 600);
  }

  keypadSuccess(message = 'ACCESS GRANTED') {
    this.keypadState.locked = true;
    this.el.keypadHint.textContent = message;
    this.el.keypadLed.classList.add('is-ok');
    setTimeout(() => this.closeKeypad(), 900);
  }

  closeKeypad() {
    this.keypadState.open = false;
    this.keypadState.locked = false;
    this.el.keypad.classList.add('is-hidden');
  }

  openJournal(records) {
    this.journalRecords = records;
    this.el.journalList.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'journal-entry';
      empty.innerHTML = '<small>NO RECORDS</small><span>Nothing recovered yet.</span>';
      this.el.journalList.appendChild(empty);
    } else {
      records.forEach((record, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'journal-entry';
        button.dataset.recordId = record.id;
        const small = document.createElement('small');
        small.textContent = record.type || 'DOCUMENT';
        const span = document.createElement('span');
        span.textContent = record.title;
        button.append(small, span);
        button.addEventListener('click', () => this.showJournalRecord(record.id));
        this.el.journalList.appendChild(button);
        if (i === 0) setTimeout(() => this.showJournalRecord(record.id), 0);
      });
    }
    this.el.journalCount.textContent = `${records.length} RECORD${records.length === 1 ? '' : 'S'}`;
    this.el.journal.classList.remove('is-hidden');
  }

  showJournalRecord(id) {
    const record = this.journalRecords.find((r) => r.id === id);
    if (!record) return;
    this.el.journalList.querySelectorAll('.journal-entry').forEach((b) => b.classList.toggle('is-active', b.dataset.recordId === id));
    this.el.journalKicker.textContent = `${record.type || 'DOCUMENT'} / ${record.index || ''}`;
    this.el.journalEntryTitle.textContent = record.title;
    this.el.journalEntryBody.innerHTML = record.body;
    this.el.journalCode.textContent = record.code || '';
  }

  hideJournal() {
    this.el.journal.classList.add('is-hidden');
  }

  showChoice({ title, body }, callback) {
    this.choiceOpen = true;
    this.onChoice = callback;
    this.el.choiceTitle.textContent = title;
    this.el.choiceBody.textContent = body;
    this.el.choice.classList.remove('is-hidden');
  }

  _selectChoice(id) {
    if (!this.choiceOpen) return;
    this.choiceOpen = false;
    this.el.choice.classList.add('is-hidden');
    const cb = this.onChoice;
    this.onChoice = null;
    cb?.(id);
  }

  hideChoice() {
    this.choiceOpen = false;
    this.el.choice.classList.add('is-hidden');
  }

  showEnding({ kicker, title, paragraphs, quote }) {
    this.el.endingKicker.textContent = kicker;
    this.el.endingTitle.textContent = title;
    this.el.endingBody.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join('');
    this.el.endingQuote.textContent = quote;
    this.el.ending.classList.remove('is-hidden');
    this.hideHud();
    this.hidePause();
    this.hideDeath();
  }

  hideEnding() {
    this.el.ending.classList.add('is-hidden');
  }

  showDeath(message = 'Returning to the last safe moment...') {
    this.el.deathHint.textContent = message;
    this.el.death.classList.remove('is-hidden');
  }

  hideDeath() {
    this.el.death.classList.add('is-hidden');
  }

  showClickResume() {
    this.el.clickResume.classList.remove('is-hidden');
  }

  hideClickResume() {
    this.el.clickResume.classList.add('is-hidden');
  }

  setFps(text, visible = true) {
    this.el.fpsHud.textContent = text;
    this.el.fpsHud.classList.toggle('is-hidden', !visible);
  }
}
