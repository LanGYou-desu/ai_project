import * as THREE from 'three';
import { Settings } from '../engine/Settings.js';
import { Input } from '../engine/Input.js';
import { RenderPipeline } from '../engine/RenderPipeline.js';
import { TextureFactory } from '../engine/Textures.js';
import { MaterialLibrary } from '../engine/Materials.js';
import { AudioSystem } from '../engine/AudioSystem.js';
import { Player } from '../engine/Player.js';
import { UI } from '../ui/UI.js';
import { CHAPTERS, RECORDS, ENDINGS, FINAL_CHOICE, getChapter, getRecord } from '../story/content.js';
import { Save } from './Save.js';
import { Chapter1 } from '../world/Chapter1.js';
import { Chapter2 } from '../world/Chapter2.js';
import { Chapter3 } from '../world/Chapter3.js';
import { Chapter4 } from '../world/Chapter4.js';

const CHAPTER_CLASSES = [Chapter1, Chapter2, Chapter3, Chapter4];
const INVISIBLE_HIT_LAYER = 2;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CHAPTER_LABELS = { I: '一', II: '二', III: '三', IV: '四' };
const chapterLabel = (chapter) => `第${CHAPTER_LABELS[chapter.roman] || chapter.number}章`;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = new Settings();
    this.ui = new UI(this.settings);
    this.input = new Input(canvas);
    this.renderPipeline = new RenderPipeline(canvas, this.settings);
    this.textures = new TextureFactory(this.renderPipeline.renderer);
    this.textures.setRenderer(this.renderPipeline.renderer);
    this.audio = new AudioSystem(this.settings);

    this.camera = new THREE.PerspectiveCamera(this.settings.values.fov, window.innerWidth / Math.max(1, window.innerHeight), .04, 110);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.set(0);
    this.player = new Player(this, this.camera);
    this.player.setQuality(this.settings.quality);
    this.player.setFov(this.settings.values.fov);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enable(INVISIBLE_HIT_LAYER);
    this.raycaster.near = .05;
    this.raycaster.far = 3.4;

    this.scene = null;
    this.level = null;
    this.chapterIndex = 0;
    this.chapter = CHAPTERS[0];
    this.materials = null;
    this.assetsReady = false;
    this.state = 'menu';
    this.modeBeforeModal = 'playing';
    this.modal = null;
    this.currentInteraction = null;
    this._lastInteractionKey = '';
    this._lastNoiseKey = '';
    this._keypadResolving = false;
    this._keypadOnSuccess = null;
    this._keypadOnFail = null;
    this._keypadCode = null;
    this._transitioning = false;
    this._dying = false;
    this._ending = null;
    this._records = [];
    this._recordIds = new Set();
    this._items = {};
    this._save = Save.read();
    this._endings = this._save?.endings ? { ...this._save.endings } : {};
    this._lastFrame = performance.now();
    this.elapsed = 0;
    this._fpsTimer = 0;
    this._debugVisible = false;
    this._noiseActive = false;
    this._hidingSpot = null;
    this._hideRestoreCrouch = false;
    this._mutedByMenu = false;
    this._suppressPause = false;
    this._loadToken = 0;

    this._bind();
    this._refreshMenuSave();
    this.ui.showMenu();
    this.audio.ready = false;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame((t) => this._frame(t));
  }

  /* ------------------------------------------------------------------ */
  /* Boot & wiring                                                       */
  /* ------------------------------------------------------------------ */

  _bind() {
    this.ui.onAction = (action) => this.handleAction(action);
    this.ui.onSettingsChanged = (key, value) => this.onSettingsChanged(key, value);
    this.ui.onSheetClose = (context) => this.onSheetClose(context);
    this.ui.onKeypadSubmit = (digits) => this._submitKeypad(digits);
    this.ui.onKeypadCancel = () => this._cancelKeypad();
    this.ui.onChoice = (id) => this._resolveChoice(id);

    this.input.onLockChange = (locked) => this._onLockChange(locked);
    this.input.onLockError = () => {
      if (this.state === 'playing') {
        this.ui.showClickResume();
      }
    };

    this.player.onFootstep = (data) => {
      this.level?.listener?.hearNoise(data.position, data.noise);
      this._updateNoiseUI();
    };

    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
  }

  _resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _refreshMenuSave() {
    const save = Save.read();
    this._save = save;
    if (save) {
      const chapter = getChapter(save.chapter);
      this.ui.setMenuContinue(chapter.number, chapter.title);
    } else {
      this.ui.setMenuContinue(null);
    }
  }

  async _ensureAssets({ showOnUi = false } = {}) {
    if (this.assetsReady) return;
    if (showOnUi) this.ui.showLoading('正在挂载声学档案……');
    let lastPercent = 4;
    await this.textures.preload((fraction, name) => {
      const percent = 8 + fraction * 62;
      lastPercent = percent;
      if (showOnUi) {
        this.ui.updateLoading(percent, '正在铺设场景纹理……', fraction % .18 < .06 ? '纹理/场景' : null);
      }
    });
    if (showOnUi) this.ui.updateLoading(72, '正在烘焙环境探针……', '渲染/环境探针');
    this.materials = new MaterialLibrary(this.textures);
    this.materials.createEnvironment(this.renderPipeline.renderer);
    this.assetsReady = true;
    this.player.setQuality(this.settings.quality);
    if (showOnUi) {
      this.ui.updateLoading(80, '正在索引现场录音……', '音频/环境声');
      await sleep(80);
      this.ui.updateLoading(Math.max(lastPercent, 82), '声学档案已挂载。', null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Menu / session flow                                                 */
  /* ------------------------------------------------------------------ */

  async startNewGame() {
    if (this._transitioning) return;
    if (this.state !== 'menu') return;
    this._transitioning = true;
    this._mutedByMenu = false;
    this.ui.hideMenu();
    this.ui.showLoading('正在挂载声学档案……');
    try {
      await this.audio.unlock();
      this.audio.setPaused(false);
    } catch (err) {
      console.warn('Audio could not be initialised:', err);
    }
    Save.clear();
    this._records = [];
    this._recordIds.clear();
    this._endings = {};
    this._save = null;
    this._transitioning = false;
    await this.loadChapter(0, { first: true });
  }

  async continueGame() {
    if (this._transitioning) return;
    const save = Save.read();
    if (!save) {
      this.ui.showToast('没有可继续的下潜记录。');
      return;
    }
    this._transitioning = true;
    this._save = save;
    this._items = {};
    this._recordIds = new Set(save.records.filter((id) => !!RECORDS[id]));
    this._records = [...this._recordIds].map((id) => getRecord(id)).filter(Boolean);
    this._sortRecords();
    this._endings = save.endings || {};
    this._mutedByMenu = false;
    this.ui.hideMenu();
    this.ui.showLoading('正在恢复上一次上浮……');
    try {
      await this.audio.unlock();
      this.audio.setPaused(false);
    } catch {
      // Silent play is still playable.
    }
    this._transitioning = false;
    await this.loadChapter(save.chapter, { first: true });
  }

  async loadChapter(index, { first = false, skipIntro = false, skipCard = false } = {}) {
    if (this._transitioning) return;
    const chapter = getChapter(index);
    this._transitioning = true;
    const token = ++this._loadToken;
    this.state = 'loading';
    this.input.enabled = false;
    this.input.releaseAll();
    // Pointer lock targets the canvas, so an interstitial shown while it is
    // still held would swallow the click on "Enter". Always hand the pointer back.
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.hideInteraction();
    this.ui.hideHud();
    this.ui.clearSubtitles();
    this.ui.setDanger(false);
    this.ui.setNoiseVisible(false);
    this.ui.setHiding(false);
    this.ui.hideChapterCard();
    this.ui.hideEnding();
    this.ui.setWhiteout(false);
    this._ending = null;

    if (first && !this.assetsReady) {
      try {
        await this._ensureAssets({ showOnUi: true });
      } catch (err) {
        console.error('Asset preparation failed:', err);
        this.ui.updateLoading(4, '声学档案无法挂载。', '错误/资产管线');
        this._transitioning = false;
        this.state = 'menu';
        return;
      }
    } else {
      this.ui.setFade(true, false);
      await sleep(1050);
    }
    if (token !== this._loadToken) return;

    this._disposeLevel();
    this.chapterIndex = index;
    this.chapter = chapter;
    this._resetChapterState();

    const LevelClass = CHAPTER_CLASSES[index];
    if (!LevelClass) throw new Error(`No level class for chapter ${index}`);
    const level = new LevelClass(this, chapter);
    this.level = level;
    this.scene = level.scene;
    this.scene.add(this.camera);
    this.camera.position.set(0, 1.68, 0);

    if (first) this.ui.updateLoading(84, '正在铺设混凝土与电缆……', '场景/构建');
    try {
      await level.build();
      if (first) this.ui.updateLoading(89, '正在烘焙静态照明……', '光照/顶点烘焙');
      await level.finalize((fraction, status) => {
        if (first) this.ui.updateLoading(89 + fraction * 10, status || '正在烘焙静态照明……', fraction > .5 ? '光照/顶点烘焙' : null);
      });
    } catch (err) {
      console.error('Level construction failed:', err);
      this.ui.showToast('档案无法解析这一层。');
      if (first) {
        this.ui.updateLoading(4, '楼层重建失败。', '错误/场景构建');
        await sleep(2400);
        this._transitioning = false;
        this.state = 'menu';
        this.ui.showMenu();
        this._refreshMenuSave();
      } else {
        this.ui.setFade(false);
        this._transitioning = false;
        this.state = 'playing';
      }
      return;
    }

    if (token !== this._loadToken) return;

    const spawn = level.spawn;
    this.player.hidden = false;
    this.player.crouched = false;
    this.player.staminaDrain = 5.8;
    this.player.setPosition(spawn.x, spawn.z, spawn.yaw || 0, spawn.pitch || 0);
    this.player.setFlashlight(level.startWithFlashlight !== false);
    this.player.setVisibleHeld(true);
    this.player.setCrouched(false, true);
    this.player.velocity.set(0, 0);
    this.player.shake = 0;
    this.player.setQuality(this.settings.quality);
    this.player.setFov(this.settings.values.fov);
    this.player.enabled = true;

    this.ui.setChapter(chapter.number, chapter.title, chapter.roman);
    this.ui.setFlashlightState(this.player.flashlightOn);
    this.ui.setItem('keycard', false);
    this.ui.setItem('fuse', false);
    const objective = level.objective || { text: '再往深处走。', sub: '' };
    this.ui.setObjective(objective.text, objective.sub || '');
    level.enter();
    this._noiseActive = false;
    this._lastNoiseKey = '';
    this._updateNoiseUI(true);
    this.audio.setPaused(false);
    this.audio.setTension(0);
    if (level.ambientTrack) {
      this.audio.setAmbient(level.ambientTrack, { volume: .58, fade: 4 });
    }

    if (first) {
      this.ui.updateLoading(100, '档案就绪。', '状态/就绪');
      await sleep(280);
      this.ui.hideLoading();
      await sleep(820);
    }
    this.ui.setFade(false);

    if (!skipCard) {
      this.ui.showChapterCard({
        number: chapterLabel(chapter),
        title: chapter.title,
        quote: chapter.quote,
        meta: chapter.meta
      });
      this._saveProgress(index);
      await sleep(first ? 3600 : 3000);
      this.ui.hideChapterCard();
    }

    if (!skipIntro) {
      this.state = 'intro';
      this.ui.showHud();
      this.ui.hideInteraction();
      await this.ui.showIntro(chapter.intro);
      // Never let a stalled or unavailable audio device block the story.
      await Promise.race([this.audio.unlock().catch(() => {}), sleep(1500)]);
    }

    if (token !== this._loadToken) return;
    this._saveProgress(index);
    this._beginPlaying({ lookHint: first && index === 0 });
    this._transitioning = false;
  }

  _beginPlaying({ lookHint = false } = {}) {
    this.state = 'playing';
    this._suppressPause = false;
    this._dying = false;
    this.input.enabled = true;
    this.input.releaseAll();
    this.ui.hidePause();
    this.ui.hideEnding();
    this.ui.hideDeath();
    this.ui.hideChoice();
    this.ui.hideClickResume();
    this.ui.showHud();
    this.ui.setFade(false);
    this.audio.setPaused(false);
    this.ui.setDanger(false);
    this._updateNoiseUI(true);
    if (lookHint && !this._debugVisible) {
      this.ui.showLookHint();
      setTimeout(() => this.ui.hideLookHint(), 4200);
    }
    setTimeout(() => {
      if (this.state === 'playing') this.input.requestPointerLock();
    }, 30);
  }

  _resetChapterState() {
    this._items = {};
    this._hidingSpot = null;
    this.player.hidden = false;
    this.player.enabled = true;
    this.player.stamina = 1;
    this.player.staminaLocked = false;
    this.player.noiseLevel = 0;
    this._noiseActive = false;
    this.ui.setItem('keycard', false);
    this.ui.setItem('fuse', false);
    this.ui.setHiding(false);
    this.ui.hideTape();
    this.ui.hideNote();
    this.ui.hideJournal();
    this.ui.closeKeypad();
    this.ui.clearSubtitles();
    this._keypadResolving = false;
    this._keypadOnSuccess = null;
    this._keypadOnFail = null;
    this._keypadCode = null;
  }

  _disposeLevel() {
    if (!this.level) return;
    this.camera.removeFromParent();
    this.ui.hideInteraction();
    try {
      this.level.dispose();
    } catch (err) {
      console.warn('Level disposal warning:', err);
    }
    this.level = null;
    this.scene = null;
    this.currentInteraction = null;
  }

  _saveProgress(chapterIndex = this.chapterIndex, completed = false) {
    const chapter = getChapter(chapterIndex);
    Save.write({
      chapter: chapterIndex,
      chapterTitle: chapter.title,
      records: [...this._recordIds],
      endings: this._endings,
      completed
    });
    this._save = Save.read();
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  handleAction(action) {
    switch (action) {
      case 'new-game':
        this.startNewGame();
        break;
      case 'continue':
        this.continueGame();
        break;
      case 'settings':
        if (this.state === 'menu') this.ui.openSheet('settings', 'menu');
        break;
      case 'controls':
        if (this.state === 'menu') this.ui.openSheet('controls', 'menu');
        break;
      case 'credits':
        if (this.state === 'menu') this.ui.openSheet('credits', 'menu');
        break;
      case 'resume':
        this.resumeGame();
        break;
      case 'pause':
        this.pauseGame();
        break;
      case 'journal':
        this.toggleJournal();
        break;
      case 'journal-close':
        this.closeJournal();
        break;
      case 'pause-settings':
        this.ui.openSheet('settings', 'pause');
        break;
      case 'pause-controls':
        this.ui.openSheet('controls', 'pause');
        break;
      case 'restart-chapter':
        this.restartChapter();
        break;
      case 'quit':
        this.quitToTitle();
        break;
      case 'ending-title':
        this.quitToTitle();
        break;
      case 'ending-restart':
        this.ui.hideEnding();
        this.state = 'menu';
        this.startNewGame();
        break;
      case 'resume-click':
        this.ui.hideClickResume();
        this.input.requestPointerLock();
        break;
      default:
        break;
    }
  }

  onSheetClose(context) {
    if (context === 'pause' && this.state === 'paused') {
      this.ui.showPause({
        chapter: `${chapterLabel(this.chapter)} · ${this.chapter.title}`,
        tip: this.chapter.tip
      });
    }
  }

  onSettingsChanged(key, value) {
    if (key === 'quality') {
      this.renderPipeline.setQualityChanged();
      this.player.setQuality(this.settings.quality);
      this.level?.applyQuality?.(this.settings.quality);
      this.textures.anisotropy = Math.min(this.settings.quality.anisotropy, this.renderPipeline.renderer.capabilities.getMaxAnisotropy());
      for (const entry of this.textures.cache.values()) {
        if (entry.map) entry.map.anisotropy = this.textures.anisotropy;
        if (entry.bumpMap) entry.bumpMap.anisotropy = this.textures.anisotropy;
      }
    } else if (key === 'volume') {
      this.audio.applyVolume();
    } else if (key === 'fov') {
      this.player.setFov(value);
    } else if (key === 'subtitles' && !value) {
      this.ui.clearSubtitles();
    } else if (key === 'reducedMotion') {
      this.player.fovBase = this.settings.values.fov;
    }
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideInteraction();
    this.ui.setNoiseVisible(false);
    this.audio.setPaused(true);
    this.ui.showPause({
      chapter: `${chapterLabel(this.chapter)} · ${this.chapter.title}`,
      tip: this.chapter.tip
    });
    this.input.exitPointerLock();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.ui.hidePause();
    this.ui.showHud();
    this.audio.setPaused(false);
    this.ui.setDanger(this.level?.listener ? this.level.listener.getDebugInfo().danger : false);
    setTimeout(() => {
      if (this.state === 'playing') this.input.requestPointerLock();
    }, 30);
  }

  async restartChapter() {
    if (this.state !== 'paused' && this.state !== 'playing' && this.state !== 'modal') return;
    this._transitioning = true;
    this.state = 'transitioning';
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitPointerLock();
    this.ui.hidePause();
    this.ui.hideHud();
    this.ui.hideInteraction();
    this.audio.setPaused(false);
    this.audio.setTension(0);
    this.ui.setFade(true, false);
    await sleep(1100);
    this._transitioning = false;
    await this.loadChapter(this.chapterIndex, { first: false });
  }

  quitToTitle() {
    if (this.state === 'transitioning' || this.state === 'loading') return;
    this._loadToken++;
    this._transitioning = false;
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitPointerLock();
    this._disposeLevel();
    this.state = 'menu';
    this.ui.hideNote();
    this.ui.hideJournal();
    this.ui.closeKeypad();
    this.ui.hidePause();
    this.ui.hideHud();
    this.ui.hideDeath();
    this.ui.hideChoice();
    this.ui.hideEnding();
    this.ui.hideChapterCard();
    this.ui.hideLoading();
    this.ui.clearSubtitles();
    this.ui.setHiding(false);
    this.ui.setDanger(false);
    this.ui.setFade(false);
    this.ui.setWhiteout(false);
    this.ui.showMenu();
    this.audio.setPaused(true);
    this.audio.setTension(0);
    this._mutedByMenu = true;
    this._refreshMenuSave();
    if (this._save) {
      this.ui.showToast('下潜进度已归档。可从章节卡继续。');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Modal flow                                                          */
  /* ------------------------------------------------------------------ */

  _enterModal(kind) {
    this.modeBeforeModal = this.state;
    this.modal = kind;
    this.state = 'modal';
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideInteraction();
    this.ui.setNoiseVisible(false);
    if (document.pointerLockElement) this.input.exitPointerLock();
  }

  _leaveModal({ resume = true } = {}) {
    this.modal = null;
    if (resume) {
      this.state = 'playing';
      this.input.enabled = true;
      this.audio.setPaused(false);
      this._updateNoiseUI(true);
      setTimeout(() => {
        if (this.state === 'playing') this.input.requestPointerLock();
      }, 40);
    }
  }

  openNote(record) {
    if (!record) return;
    this._enterModal('note');
    this.ui.showNote(record);
    this.audio.play('pickup', { volume: .16, rate: .8 });
  }

  closeNote() {
    if (this.modal !== 'note') return;
    this.ui.hideNote();
    this._leaveModal();
  }

  toggleJournal() {
    if (this.state === 'playing') {
      this.openJournal();
    } else if (this.state === 'modal' && this.modal === 'journal') {
      this.closeJournal();
    }
  }

  openJournal() {
    if (this.state !== 'playing') return;
    this._enterModal('journal');
    this.ui.openJournal(this._records);
    this.ui.setNoiseVisible(false);
  }

  closeJournal() {
    if (this.modal !== 'journal') return;
    this.ui.hideJournal();
    this._leaveModal();
  }

  openKeypad({ code = '0317', title, hint, brand, length = 4, onSuccess = null, onFail = null } = {}) {
    if (this.state !== 'playing') return;
    this._enterModal('keypad');
    this._keypadCode = String(code);
    this._keypadOnSuccess = onSuccess;
    this._keypadOnFail = onFail;
    this._keypadResolving = false;
    this.ui.openKeypad({ title, hint, brand, length });
  }

  _submitKeypad(digits) {
    if (this._keypadResolving) return;
    if (digits === this._keypadCode) {
      this._keypadResolving = true;
      this.ui.keypadSuccess('访问通过');
      this.audio.play('keyGrant', { volume: .28 });
      const success = this._keypadOnSuccess;
      this._keypadOnSuccess = null;
      this._keypadOnFail = null;
      setTimeout(() => {
        this.ui.closeKeypad();
        this._leaveModal();
        success?.();
      }, 980);
    } else {
      this.ui.keypadError('访问被拒');
      this.audio.play('keyError', { volume: .22 });
      this._keypadOnFail?.();
    }
  }

  _cancelKeypad() {
    if (this._keypadResolving) return;
    this._keypadOnSuccess = null;
    this._keypadOnFail = null;
    this._keypadCode = null;
    this.modal = null;
    this.state = 'playing';
    this.input.enabled = true;
    setTimeout(() => {
      if (this.state === 'playing') this.input.requestPointerLock();
    }, 30);
  }

  _onLockChange(locked) {
    if (!locked && this.state === 'playing' && !this._suppressPause) {
      this.pauseGame();
    }
    if (locked) this.ui.hideClickResume();
  }

  /* ------------------------------------------------------------------ */
  /* Interaction & hiding                                                */
  /* ------------------------------------------------------------------ */

  _updateInteraction() {
    if (!this.level || this.state !== 'playing') return;
    if (this.player.hidden) {
      this.ui.showInteraction('离开储物柜', 'E — 走出来');
      this.currentInteraction = null;
      this._lastInteractionKey = 'hiding';
      return;
    }
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hitboxes = [];
    for (const item of this.level.interactables) {
      if (!item.enabled || !item.hitbox.visible) continue;
      const dx = item.hitbox.position.x - this.camera.position.x;
      const dy = item.hitbox.position.y - this.camera.position.y;
      const dz = item.hitbox.position.z - this.camera.position.z;
      if (dx * dx + dy * dy + dz * dz > (item.range + 1.2) ** 2) continue;
      hitboxes.push(item.hitbox);
    }
    const hits = hitboxes.length ? this.raycaster.intersectObjects(hitboxes, false) : [];
    if (!hits.length) {
      if (this._lastInteractionKey !== '') {
        this.ui.hideInteraction();
        this._lastInteractionKey = '';
      }
      this.currentInteraction = null;
      return;
    }
    const hit = hits[0];
    if (hit.distance > (hit.object.userData.range || 4)) {
      // The item's own range is checked below using its table entry.
    }
    const item = this.level.interactables.find((entry) => entry.hitbox === hit.object);
    if (!item || !item.enabled || hit.distance > item.range) {
      this.ui.hideInteraction();
      this.currentInteraction = null;
      this._lastInteractionKey = '';
      return;
    }
    this.currentInteraction = item;
    const label = item.getLabel?.() || '交互';
    const sub = item.getSub?.() || '';
    const key = `${item.id}:${label}:${sub}`;
    if (key !== this._lastInteractionKey) {
      this.ui.showInteraction(label, sub);
      this._lastInteractionKey = key;
    }
  }

  performInteract() {
    if (this.state !== 'playing') return false;
    if (this.player.hidden) {
      this.exitHiding();
      return true;
    }
    const item = this.currentInteraction;
    if (!item || !item.enabled) return false;
    try {
      item.onInteract?.(item);
    } catch (err) {
      console.error('Interaction failed:', err);
    }
    return true;
  }

  enterHiding(spot, interactable = null) {
    if (this.state !== 'playing' || this.player.hidden) return;
    if (this.level?.allowHiding === false) {
      this.ui.showHint('现在没时间躲。跑。', 2.4);
      return;
    }
    this._hideRestoreCrouch = this.player.crouched;
    this._hidingSpot = { ...spot, interactable };
    this.player.hidden = true;
    this.player.setPosition(spot.hide.x, spot.hide.z, spot.hide.yaw, -.03, true);
    this.player.setVisibleHeld(false);
    this.player.velocity.set(0, 0);
    this.player.enabled = true;
    this.ui.setHiding(true);
    this.ui.hideInteraction();
    this.audio.playAt('doorClose', new THREE.Vector3(spot.hide.x, 1.2, spot.hide.z), { volume: .2, rate: 1.5 });
    this.ui.showHint('别动。遮罩并不隔音。', 4);
  }

  exitHiding() {
    if (!this.player.hidden || !this._hidingSpot) return;
    const spot = this._hidingSpot;
    this.player.hidden = false;
    this.player.setCrouched(this._hideRestoreCrouch, true);
    const exit = spot.exit || spot.hide;
    this.player.setPosition(exit.x, exit.z, spot.hide.yaw, 0, this._hideRestoreCrouch);
    this.player.setVisibleHeld(true);
    this.player.velocity.set(0, 0);
    this.ui.setHiding(false);
    this.ui.hideInteraction();
    this._hidingSpot = null;
    this.audio.play('switch', { volume: .12, rate: 1.3 });
  }

  /* ------------------------------------------------------------------ */
  /* Objectives, records, items                                          */
  /* ------------------------------------------------------------------ */

  setObjective(text, sub = '') {
    this.ui.setObjective(text, sub);
  }

  collectRecord(recordOrId) {
    const record = typeof recordOrId === 'string' ? getRecord(recordOrId) : recordOrId;
    if (!record) return false;
    if (this._recordIds.has(record.id)) return false;
    this._recordIds.add(record.id);
    this._records.push(record);
    this._sortRecords();
    this.ui.showToast(`案件记录已添加——${record.title}`);
    this.audio.play('pickup', { volume: .2, rate: .92 });
    this._saveProgress();
    return true;
  }

  hasRecord(id) {
    return this._recordIds.has(id);
  }

  _sortRecords() {
    this._records.sort((a, b) => String(a.index || '').localeCompare(String(b.index || '')));
  }

  giveItem(id, label = '') {
    this._items[id] = true;
    this.ui.setItem(id, true, label);
    this.audio.play('pickup', { volume: .22 });
  }

  takeItem(id) {
    delete this._items[id];
    this.ui.setItem(id, false);
  }

  hasItem(id) {
    return !!this._items[id];
  }

  setFuseState(visible, label) {
    if (visible) this._items.fuse = true;
    else delete this._items.fuse;
    this.ui.setItem('fuse', visible, label);
  }

  makeNoise(position, intensity = .8) {
    this.level?.listener?.hearNoise(position, intensity);
    this._updateNoiseUI(true);
  }

  /* ------------------------------------------------------------------ */
  /* Death / endings                                                     */
  /* ------------------------------------------------------------------ */

  killPlayer(cause = 'listener') {
    if (this._dying || this.state === 'ending' || this.state === 'choice' || !this.level) return;
    this._dying = true;
    this.state = 'dying';
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideInteraction();
    this.ui.setNoiseVisible(false);
    this.ui.setDanger(false);
    this.audio.setTension(0);
    this.audio.play('thud', { volume: .32, rate: .8 });
    this.audio.play('staticBurst', { volume: .14, rate: .5 });
    this.player.addShake(1.1);
    this.ui.flashDamage();
    this.ui.showDeath(cause === 'listener' ? '它现在有了你的形状。正在返回上一个安全时刻……' : '正在返回上一个安全时刻……');
    this._suppressPause = true;
    setTimeout(() => {
      if (!this.level) {
        this._dying = false;
        this._suppressPause = false;
        return;
      }
      this.level.respawn();
      this.player.setVisibleHeld(true);
      this.player.hidden = false;
      this.player.enabled = true;
      this.ui.setHiding(false);
      this.ui.hideDeath();
      this.ui.hideInteraction();
      this.ui.setDanger(false);
      this.audio.setPaused(false);
      this.state = 'playing';
      this.input.enabled = true;
      this._dying = false;
      this._suppressPause = false;
      this._updateNoiseUI(true);
      this.ui.showHint('你在上一个安全时刻醒来。没有任何东西忘记你。', 3.4);
      setTimeout(() => {
        if (this.state === 'playing') this.input.requestPointerLock();
      }, 60);
    }, 2400);
  }

  openFinalChoice(choice = FINAL_CHOICE) {
    if (this.state === 'choice' || this.state === 'ending') return;
    this.state = 'choice';
    this._suppressPause = true;
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideInteraction();
    this.ui.setNoiseVisible(false);
    this.audio.setTension(.75);
    this.ui.showChoice(choice, (id) => this._resolveChoice(id));
    this.input.exitPointerLock();
  }

  _resolveChoice(id) {
    if (this._ending) return;
    this._ending = id;
    this.state = 'ending';
    this._suppressPause = true;
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideChoice();
    this.ui.hideTape();
    this.ui.hideInteraction();
    this.audio.setTension(id === 'answer' ? 1 : 0);
    if (id === 'purge') {
      this.audio.play('powerUp', { volume: .3, rate: .55 });
      this.audio.play('thud', { volume: .4, rate: .55 });
      this.player.addShake(.3);
      setTimeout(() => this.ui.setWhiteout(true), 1500);
    } else {
      this.audio.whisper(8, .24);
      this.audio.play('staticBurst', { volume: .3, rate: .4 });
      this.audio.tone({ frequency: 43, duration: 7, volume: .05, type: 'sawtooth' });
      this.player.addShake(.7);
      this.ui.setDanger(true);
    }
    this.level?.onChoice?.(id);
    setTimeout(() => {
      this.ui.setDanger(false);
      this.ui.hideHud();
      this.ui.showEnding(ENDINGS[id]);
      this.audio.setPaused(false);
      Save.clear();
      this._save = null;
      this._endings[id] = true;
      this._refreshMenuSave();
    }, id === 'purge' ? 3200 : 3000);
  }

  /* ------------------------------------------------------------------ */
  /* Update loop                                                         */
  /* ------------------------------------------------------------------ */

  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const rawDt = Math.min(.05, Math.max(0, (now - this._lastFrame) / 1000));
    this._lastFrame = now;
    this.elapsed += rawDt;
    this.renderPipeline.updatePerformance(rawDt);

    if (this.state === 'playing' || this.state === 'dying') {
      this.player.update(rawDt, this.input, this.level);
      this.level.update(rawDt, this.camera);
      this._updateInteraction();
      this._updateNoiseUI();
      if (this.input.wasPressed('KeyE')) this.performInteract();
    } else if (this.state === 'modal') {
      // Keep the world breathing quietly beneath a document or keypad.
      this.player.update(rawDt, this.input, this.level);
      this.level.update(rawDt, this.camera);
    } else if (this.state === 'paused') {
      // Frozen simulation; UI remains responsive.
    } else if (this.state === 'intro') {
      this.level?.update(rawDt * .25, this.camera);
    } else if (this.state === 'choice' || this.state === 'ending' || this.state === 'transitioning' || this.state === 'loading') {
      this.level?.update(rawDt * (this.state === 'choice' ? .5 : 0), this.camera);
    }

    this.ui.update(rawDt);
    this.audio.update(rawDt, this.camera);
    if (this.scene) {
      const listener = this.level?.listener;
      const danger = listener ? (listener.getDebugInfo().danger ? 1 : 0) : 0;
      this.renderPipeline.render(this.scene, this.camera, this.elapsed, {
        danger,
        exposure: this.state === 'ending' && this._ending === 'answer' ? 0.96 : 1.14
      });
    }

    if (this._debugVisible) {
      this._fpsTimer += rawDt;
      if (this._fpsTimer > .4) {
        this._fpsTimer = 0;
        const info = this.renderPipeline.getInfo();
        this.ui.setFps(`${info.fps.toFixed(0)} 帧/秒 · ${info.calls} 次绘制 · ${(info.triangles / 1000).toFixed(0)}K 三角形 · 缩放 ${info.dynamicScale.toFixed(2)}`, true);
      }
    }

    this.input.endFrame();
  }

  _updateNoiseUI(force = false) {
    if (!this.level) return;
    const show = !!this.level.showNoise && this.state === 'playing';
    if (!show) {
      if (this._noiseActive || force) {
        this.ui.setNoiseVisible(false);
        this._noiseActive = false;
        this._lastNoiseKey = '';
      }
      return;
    }
    if (!this._noiseActive) {
      this.ui.setNoiseVisible(true);
      this._noiseActive = true;
    }
    const listener = this.level.listener;
    const chasing = listener?.state === 'chase';
    const noise = this.player.hidden ? 0 : this.player.noiseLevel;
    let label = '静止';
    if (this.player.hidden) label = '屏住呼吸';
    else if (this.player.sprinting) label = '响亮';
    else if (this.player.crouched && this.player.effectiveSpeed > .1) label = '安静';
    else if (this.player.effectiveSpeed > .1) label = '行走';
    else if (chasing) label = '聆听';
    const segments = Math.round(Math.min(1, noise) * 6);
    const key = `${segments}:${label}:${chasing}`;
    if (force || key !== this._lastNoiseKey) {
      this.ui.setNoise(noise, label, chasing);
      this._lastNoiseKey = key;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard & debug                                                    */
  /* ------------------------------------------------------------------ */

  _onKeyDown(event) {
    if (event.code === 'F3') {
      event.preventDefault();
      this._debugVisible = !this._debugVisible;
      this.ui.setFps('', this._debugVisible);
      const dev = document.getElementById('dev-debug');
      if (dev) {
        dev.classList.toggle('is-hidden', !this._debugVisible);
        dev.textContent = '调试 / F3 隐藏';
      }
      return;
    }

    if (this.state === 'modal') {
      if (event.code === 'Escape') {
        if (this.modal === 'note') { event.preventDefault(); this.closeNote(); }
        else if (this.modal === 'journal') { event.preventDefault(); this.closeJournal(); }
        else if (this.modal === 'keypad') { event.preventDefault(); }
      } else if (this.modal === 'note' && event.code === 'KeyE') {
        event.preventDefault();
        this.closeNote();
      } else if (this.modal === 'journal' && event.code === 'KeyJ') {
        event.preventDefault();
        this.closeJournal();
      }
      return;
    }

    if (this.state === 'playing') {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.pauseGame();
      } else if (event.code === 'KeyJ') {
        event.preventDefault();
        this.openJournal();
      }
    } else if (this.state === 'paused') {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.resumeGame();
      }
    }
  }

  /* Debug surface used by tools/smoke-test.mjs and for manual QA. */
  async debugChapter(index, { intro = false } = {}) {
    this._loadToken++;
    this._transitioning = false;
    this.state = 'menu';
    this.ui.hideMenu();
    if (!this.assetsReady) {
      this.ui.showLoading('QA 启动……');
      await this.audio.unlock().catch(() => {});
      await this._ensureAssets({ showOnUi: true });
      this.ui.hideLoading();
      await sleep(800);
    } else {
      this.ui.setFade(true, true);
      await sleep(40);
    }
    this.ui.setFade(false);
    await this.loadChapter(Math.max(0, Math.min(3, index)), {
      first: false,
      skipIntro: !intro,
      skipCard: !intro
    });
    return this.getState();
  }

  debugTeleport(x, z, yaw = 0, pitch = 0) {
    this.player.setPosition(x, z, yaw, pitch);
    this.player.velocity.set(0, 0);
    return { x, z, yaw };
  }

  debugLookAt(x, z, y = 1.2) {
    const dx = x - this.player.position.x;
    const dz = z - this.player.position.z;
    const eyeY = this.player.position.y + this.player.currentEyeHeight;
    this.player.yaw = Math.atan2(-dx, -dz);
    this.player.pitch = Math.atan2(y - eyeY, Math.hypot(dx, dz));
    this.player._updateCamera(0, 0);
    return { yaw: this.player.yaw, pitch: this.player.pitch };
  }

  debugInteract() {
    return this.performInteract();
  }

  debugNearest() {
    if (!this.level) return null;
    let best = null;
    let bestDist = Infinity;
    for (const item of this.level.interactables) {
      if (!item.enabled) continue;
      const dx = item.hitbox.position.x - this.player.position.x;
      const dz = item.hitbox.position.z - this.player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) { bestDist = dist; best = item; }
    }
    return best ? { label: best.getLabel?.(), sub: best.getSub?.(), distance: bestDist } : null;
  }

  debugUseNearest() {
    if (!this.level) return false;
    let best = null;
    let bestDist = Infinity;
    for (const item of this.level.interactables) {
      if (!item.enabled || !item.hitbox.visible) continue;
      const dx = item.hitbox.position.x - this.player.position.x;
      const dz = item.hitbox.position.z - this.player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist && dist < 4) { bestDist = dist; best = item; }
    }
    if (!best) return false;
    best.onInteract?.(best);
    return true;
  }

  debugCompleteChapter() {
    const next = this.chapterIndex + 1;
    if (next < CHAPTERS.length) this.completeChapter(next);
  }

  completeChapter(nextIndex = this.chapterIndex + 1) {
    if (this._transitioning) return;
    if (nextIndex >= CHAPTERS.length) {
      this.openFinalChoice();
      return;
    }
    this._transitionTo(nextIndex);
  }

  async _transitionTo(index) {
    this._transitioning = true;
    this.state = 'transitioning';
    this.input.enabled = false;
    this.input.releaseAll();
    this.ui.hideInteraction();
    this.ui.hideHud();
    this.ui.setDanger(false);
    this.ui.setNoiseVisible(false);
    this.ui.hideTape();
    this.audio.setTension(0);
    this._saveProgress(index);
    this.ui.setFade(true, false);
    await sleep(1300);
    this._transitioning = false;
    await this.loadChapter(index, { first: false });
  }

  debugChoice(id = 'purge') {
    if (this.state !== 'choice') this.openFinalChoice();
    setTimeout(() => this._resolveChoice(id), 80);
  }

  debugCollect(id) {
    return this.collectRecord(id);
  }

  debugKill() {
    this.killPlayer('debug');
  }

  debugHideUI() {
    this.ui.hideHud();
    this.ui.hideLoading();
    this.ui.hideChapterCard();
    this.ui.hideIntro();
    this.ui.setFade(false);
    this.ui.setHiding(false);
    this.ui.setDanger(false);
    this.ui.hideInteraction();
  }

  debugShowUI() {
    this.ui.showHud();
  }

  getState() {
    return {
      state: this.state,
      chapter: this.chapterIndex,
      chapterTitle: this.chapter?.title,
      objective: this.level?.objective?.text || null,
      player: {
        x: +this.player.position.x.toFixed(2),
        z: +this.player.position.z.toFixed(2),
        hidden: this.player.hidden,
        flashlight: this.player.flashlightOn,
        stamina: +this.player.stamina.toFixed(2)
      },
      items: { ...this._items },
      records: [...this._recordIds],
      listener: this.level?.listener?.getDebugInfo?.() || null,
      level: this.level?.getDebugInfo?.() || null,
      audio: this.audio.getDebugInfo()
    };
  }

  debugTeleportToItem(labelIncludes) {
    if (!this.level) return null;
    const item = this.level.interactables.find((entry) => (entry.getLabel?.() || '').toLowerCase().includes(labelIncludes.toLowerCase()));
    if (!item) return null;
    const p = item.hitbox.position;
    this.debugTeleport(p.x, p.z + 1.2, 0, -.15);
    this.debugLookAt(p.x, p.z, p.y);
    return { label: item.getLabel?.(), x: p.x, z: p.z };
  }
}

export { CHAPTER_CLASSES };
