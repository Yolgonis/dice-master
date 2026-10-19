const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const moduleSource = fs.readFileSync(path.join(__dirname, "..", "dice-master.js"), "utf8");

function createHarness({ random = [0.8, 0.05], withLibWrapper = false } = {}) {
  const hookEvents = new Map();
  const onceEvents = new Map();
  const Hooks = {
    events: Object.create(null),
    on(name, fn) {
      const entries = hookEvents.get(name) ?? [];
      entries.push(fn);
      hookEvents.set(name, entries);
      this.events[name] = entries;
      return fn;
    },
    once(name, fn) {
      const entries = onceEvents.get(name) ?? [];
      entries.push(fn);
      onceEvents.set(name, entries);
      return fn;
    },
    call(name, ...args) {
      for (const fn of hookEvents.get(name) ?? []) if (fn(...args) === false) return false;
      const once = onceEvents.get(name) ?? [];
      onceEvents.delete(name);
      for (const fn of once) if (fn(...args) === false) return false;
      return true;
    },
    callAll(name, ...args) {
      for (const fn of hookEvents.get(name) ?? []) fn(...args);
      const once = onceEvents.get(name) ?? [];
      onceEvents.delete(name);
      for (const fn of once) fn(...args);
    }
  };

  class MockDie {
    constructor({ faces = 20, number = 1, modifiers = [], originals = [10], options = {} } = {}) {
      this.faces = faces;
      this.number = number;
      this.modifiers = [...modifiers];
      this.options = options;
      this.results = [];
      this._originals = [...originals];
    }
    async roll() {
      const result = { result: this._originals.shift(), active: true };
      this.results.push(result);
      return result;
    }
    async _evaluateModifiers() {
      const disadvantage = this.modifiers.some((modifier) => /^dis/i.test(modifier));
      const advantage = this.modifiers.some((modifier) => /^adv/i.test(modifier));
      if (!disadvantage && !advantage) return this;
      const target = Math[disadvantage ? "min" : "max"](...this.results.map((result) => result.result));
      let kept = false;
      for (const result of this.results) {
        if (!kept && result.result === target) {
          kept = true;
          continue;
        }
        result.active = false;
        result.discarded = true;
      }
      return this;
    }
  }

  class MockRoll {
    constructor(terms = []) {
      this.terms = terms;
      this.options = {};
    }
    get dice() {
      return this.terms.filter((term) => term instanceof MockDie);
    }
    async evaluate() {
      for (const die of this.dice) {
        for (let index = 0; index < die.number; index += 1) await die.roll();
        await die._evaluateModifiers();
      }
      this._evaluated = true;
      return this;
    }
  }

  class MockBasicRoll extends MockRoll {
    static async buildEvaluate(rolls, config = {}, message = {}) {
      if (config.evaluate === false) return;
      for (const roll of rolls) await roll.evaluate();
    }
  }

  const gm = { id: "GM", name: "Gamemaster", isGM: true, active: true, character: null };
  const actor = {
    id: "ACTOR",
    ownership: { PLAYER: 3, default: 0 },
    testUserPermission(user, level) {
      return Number(this.ownership[user.id] ?? this.ownership.default ?? 0) >= Number(level);
    }
  };
  const player = { id: "PLAYER", name: "Ahmetennes", isGM: false, active: true, character: actor };
  const secondActor = {
    id: "ACTOR_TWO",
    ownership: { PLAYER_TWO: 3, default: 0 },
    testUserPermission(user, level) {
      return Number(this.ownership[user.id] ?? this.ownership.default ?? 0) >= Number(level);
    }
  };
  const secondPlayer = { id: "PLAYER_TWO", name: "Second Player", isGM: false, active: true, character: secondActor };
  const users = {
    contents: [gm, player, secondPlayer],
    get(id) { return this.contents.find((user) => user.id === id); },
    forEach(fn) { this.contents.forEach(fn); },
    [Symbol.iterator]() { return this.contents[Symbol.iterator](); }
  };
  const settings = new Map([
    ["influenceStatePlayers", "off"],
    ["influenceStateGm", "better"],
    ["influenceStatePlayerOverrides", { PLAYER: "worse", PLAYER_TWO: "better" }],
    ["influenceStrategy", "bias"],
    ["thresholdPercent", 25],
    ["explicitMode", false],
    ["debugMode", true],
    ["positiveDirection", "higher"],
    ["positiveDirectionOverrides", {}],
    ["nudgeValues", {}],
    ["biasBetterLimits", {}],
    ["biasWorseLimits", {}],
    ["affectedDice", { d20: true }]
  ]);
  const randomValues = [...random];
  const mockMath = Object.create(Math);
  mockMath.random = () => randomValues.shift() ?? 0.5;
  const createdMessages = [];
  const socketHandlers = new Map();
  const socketAnyHandlers = [];
  const emittedSocketMessages = [];

  const context = vm.createContext({
    console,
    Date,
    Element: class Element {},
    Math: mockMath,
    setTimeout,
    clearTimeout,
    Hooks,
    Roll: MockRoll,
    ChatMessage: { create: async (data) => createdMessages.push(data) },
    CONFIG: { Dice: { BasicRoll: MockBasicRoll } },
    CONST: { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } },
    game: {
      user: gm,
      userId: gm.id,
      users,
      actors: { get: (id) => id === actor.id ? actor : id === secondActor.id ? secondActor : null },
      modules: { get: () => ({ active: false }) },
      socket: {
        on(channel, handler) { socketHandlers.set(channel, handler); },
        prependAny(handler) { socketAnyHandlers.push(handler); },
        emit(channel, payload) { emittedSocketMessages.push({ channel, payload }); }
      },
      settings: {
        register(_module, key, definition) { if (!settings.has(key)) settings.set(key, definition.default); },
        registerMenu() {},
        get(_module, key) { return settings.get(key); },
        async set(_module, key, value) { settings.set(key, value); }
      },
      i18n: {
        localize(key) { return key; },
        format(_key, data) { return `bias (${data.controller}: ${data.state}; ${data.trace}) -> ${data.second}, ${data.direction}`; }
      }
    },
    foundry: {
      appv1: { api: { FormApplication: class FormApplication { static get defaultOptions() { return {}; } } } },
      applications: { api: {}, settings: { SettingsConfig: class SettingsConfig {} } },
      dice: { terms: { Die: MockDie } },
      utils: {
        mergeObject(target, source) { return Object.assign(target, source); }
      }
    }
  });
  context.globalThis = context;
  const libWrapperRegistrations = [];
  if ( withLibWrapper ) {
    context.libWrapper = {
      register(moduleId, target, fn, type) {
        libWrapperRegistrations.push({ moduleId, target, type });
        const parts = target.split(".");
        const method = parts.pop();
        const owner = parts.reduce((object, key) => object[key], context);
        const original = owner[method];
        owner[method] = function(...args) {
          return fn.call(this, (...wrappedArgs) => original.apply(this, wrappedArgs), ...args);
        };
      }
    };
  }
  vm.runInContext(moduleSource, context, { filename: "dice-master.js" });
  Hooks.callAll("init");

  return {
    Hooks,
    libWrapperRegistrations,
    MockBasicRoll,
    MockDie,
    MockRoll,
    actor,
    secondActor,
    player,
    secondPlayer,
    gm,
    context,
    createdMessages,
    emittedSocketMessages,
    receiveSocket(channel, payload, senderId) {
      return socketHandlers.get(channel)?.(payload, senderId);
    },
    receiveAnySocket(channel, payload, senderId) {
      for ( const handler of socketAnyHandlers ) handler(channel, payload, senderId);
    }
  };
}

test("a player cannot replace the synchronized Better/Worse state over the raw socket", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStatePlayers", "off");
  await harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", {});
  harness.context.game.user = harness.player;
  harness.context.initInfluenceStateSync();

  harness.receiveSocket("module.dice-master", {
    type: "influence-state",
    snapshot: { players: "better", gm: "worse", playerOverrides: {} }
  }, harness.secondPlayer.id);

  assert.equal(harness.context.getInfluenceState(harness.player.id), "off");
});

test("a snapshot without an authenticated sender is rejected even if its payload claims to be GM", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStatePlayers", "off");
  await harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", {});
  harness.context.game.user = harness.player;
  harness.context.initInfluenceStateSync();

  harness.receiveSocket("module.dice-master", {
    type: "influence-state",
    userId: harness.gm.id,
    snapshot: { players: "better", gm: "worse", playerOverrides: {} }
  });

  assert.equal(harness.context.getInfluenceState(harness.player.id), "off");
});

test("an active GM can publish a valid synchronized Better/Worse state", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStatePlayers", "off");
  await harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", {});
  harness.context.game.user = harness.player;
  harness.context.initInfluenceStateSync();

  harness.receiveSocket("module.dice-master", {
    type: "influence-state",
    targetUserId: harness.player.id,
    snapshot: { players: "better", gm: "worse", playerOverrides: {} }
  }, harness.gm.id);

  assert.equal(harness.context.getInfluenceState(harness.player.id), "better");
});

test("debug chat markup escapes user-controlled controller and trace text", () => {
  const harness = createHarness();
  const html = harness.context.renderDebugMessage([{
    dieType: "d20",
    originalResult: 4,
    finalResult: 18,
    strategy: "bias",
    direction: "better",
    state: "better",
    controller: '<img src=x onerror="alert(1)">',
    controllerTrace: "<script>alert(1)</script>",
    biasSecondRoll: 18,
    biasLimit: 0
  }]);

  assert.doesNotMatch(html, /<img|<script/i);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
});

test("installing the roll patches twice does not influence one die twice", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "nudge");
  await harness.context.game.settings.set("dice-master", "nudgeValues", { d20: 4 });
  harness.context.game.user = harness.gm;

  harness.context.patchRollEvaluate();
  const die = new harness.MockDie({ faces: 20, originals: [10] });
  await new harness.MockRoll([die]).evaluate();

  assert.equal(die.results[0].result, 14);
  assert.equal(die._diceMasterDebug.length, 1);
});

test("with libWrapper active every roll patch is registered once as a WRAPPER and still influences dice", async () => {
  const harness = createHarness({ withLibWrapper: true });
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "nudge");
  await harness.context.game.settings.set("dice-master", "nudgeValues", { d20: 4 });
  harness.context.game.user = harness.gm;

  harness.context.patchRollEvaluate();
  harness.context.patchDnd5eBuildEvaluate();

  const targets = harness.libWrapperRegistrations.map(entry => entry.target).sort();
  assert.deepEqual(targets, [
    "CONFIG.Dice.BasicRoll.buildEvaluate",
    "Roll.prototype.evaluate",
    "foundry.dice.terms.Die.prototype._evaluateModifiers",
    "foundry.dice.terms.Die.prototype.roll"
  ]);
  assert.ok(harness.libWrapperRegistrations.every(entry => entry.moduleId === "dice-master" && entry.type === "WRAPPER"));

  const die = new harness.MockDie({ faces: 20, originals: [10] });
  await new harness.MockRoll([die]).evaluate();
  assert.equal(die.results[0].result, 14);
});

test("all four influence strategies preserve die boundaries and semantic direction", () => {
  const harness = createHarness({ random: [0.8, 0.8] });
  const better = { state: "better", direction: "better", faces: 20, nudgeValue: 4, thresholdPercent: 25, biasBetterLimit: 0, biasWorseLimit: 0 };
  const worse = { ...better, state: "worse", direction: "worse" };

  const full = [{ result: 9, active: true }];
  harness.context.applyStrategy("full", full, better);
  assert.equal(full[0].result, 20);

  const bias = [{ result: 9, active: true }];
  harness.context.applyStrategy("bias", bias, better);
  assert.equal(bias[0].result, 17);

  const nudge = [{ result: 19, active: true }];
  harness.context.applyStrategy("nudge", nudge, better);
  assert.equal(nudge[0].result, 20);

  const threshold = [{ result: 20, active: true }];
  const debug = harness.context.applyStrategy("threshold", threshold, worse);
  assert.equal(threshold[0].result, 17);
  assert.equal(debug.thresholdTriggered, true);
});

test("pending advantage and disadvantage groups keep the correct result set", () => {
  const harness = createHarness();
  const advantage = new harness.MockDie({
    modifiers: ["adv"],
    options: { pending: { advantage: { adv: true, count: 1, size: 1 } } }
  });
  advantage.results = [{ result: 4, active: true }, { result: 16, active: true }];

  assert.equal(harness.context.applyPendingAdvantageSelection(advantage), "adv");
  assert.equal(advantage.results[0].active, false);
  assert.equal(advantage.results[1].active, true);

  const disadvantage = new harness.MockDie({
    modifiers: [],
    options: { pending: { advantage: { adv: false, count: 1, size: 1 } } }
  });
  disadvantage.results = [{ result: 5, active: true }, { result: 18, active: true }];

  assert.equal(harness.context.repairPendingAdvantageSelection(disadvantage), "dis");
  assert.equal(disadvantage.results[0].active, true);
  assert.equal(disadvantage.results[1].active, false);
});

test("the dice settings menu normalizes submitted values and stores per-die overrides", async () => {
  const harness = createHarness();
  const menu = new harness.context.DiceMasterSettingsMenu();
  const initial = menu.getData();
  assert.equal(initial.dice.length, 7);
  assert.equal(initial.globalDirection, "higher");

  await menu._updateObject(null, {
    "nudge-d20": "999",
    "bias-better-d20": "12.9",
    "bias-worse-d20": "-4",
    "affected-d20": true,
    "direction-d20": "lower"
  });

  assert.equal(harness.context.game.settings.get("dice-master", "nudgeValues").d20, 999);
  assert.equal(harness.context.game.settings.get("dice-master", "biasBetterLimits").d20, 12);
  assert.equal(harness.context.game.settings.get("dice-master", "biasWorseLimits").d20, 0);
  assert.equal(harness.context.game.settings.get("dice-master", "positiveDirectionOverrides").d20, "lower");
});

test("an authorized remote controller is captured and Dice So Nice receives the influence color", () => {
  const harness = createHarness();
  harness.context.game.user = harness.gm;
  harness.context.applyRemoteRollController({
    userId: harness.player.id,
    actorId: harness.actor.id,
    source: "attack",
    intentId: "authorized-controller"
  }, "test");
  assert.equal(harness.context.getPendingRollControllerUserId(), harness.player.id);

  harness.context.game.modules.get = id => ({ active: id === "dice-so-nice" });
  harness.context.initDiceSoNice();
  const roll = { options: { diceMasterInfluenced: true, diceMasterDirection: "better" } };
  harness.Hooks.callAll("diceSoNiceRollStart", "message", { roll });
  assert.equal(roll.options.appearance.diceColor, "#27ae60");
});

test("Dice Master writes only canonical runtime flags", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "full");
  harness.context.game.user = harness.gm;
  const die = new harness.MockDie({ faces: 20, originals: [8] });
  const roll = new harness.MockRoll([die]);

  await roll.evaluate();

  assert.equal(die._diceMasterInfluenced, true);
  assert.equal(die._diceMasterDirection, "better");
  assert.equal(die._diceMasterDebug.length, 1);
  assert.equal(JSON.stringify(roll.options.diceMasterDebug), JSON.stringify(die._diceMasterDebug));
  for ( const target of [die, roll.options] ) {
    assert.deepEqual(Object.keys(target).filter(key => /fumbleSwitch/i.test(key)), []);
  }
});

test("Dice So Nice uses canonical Dice Master flags and ignores legacy Fumble Switch flags", () => {
  const harness = createHarness();
  harness.context.game.modules.get = id => ({ active: id === "dice-so-nice" });
  harness.context.initDiceSoNice();
  const roll = { options: { diceMasterInfluenced: true, diceMasterDirection: "worse" } };

  harness.Hooks.callAll("diceSoNiceRollStart", "message", { roll });

  assert.equal(roll.options.appearance.diceColor, "#c0392b");

  const legacyRoll = { options: { fumbleSwitchCheated: true, fumbleSwitchDirection: "worse" } };
  harness.Hooks.callAll("diceSoNiceRollStart", "message", { roll: legacyRoll });
  assert.equal(legacyRoll.options.appearance, undefined);
});

test("the settings application uses the Dice Master class name without the legacy alias", () => {
  const harness = createHarness();
  assert.equal(typeof harness.context.DiceMasterSettingsMenu, "function");
  assert.equal(typeof harness.context.FumbleSwitchSettingsMenu, "undefined");
});

test("settings metadata, controller resolution, and widget state helpers expose stable values", () => {
  const harness = createHarness();
  const options = harness.context.DiceMasterSettingsMenu.defaultOptions;
  assert.equal(options.id, "dice-master-settings-menu");
  assert.equal(harness.context.getUsersArray().length, 3);
  assert.equal(harness.context.resolveActorControllerUserId(harness.actor), harness.player.id);

  harness.context.localState.influenceStatePlayers = "better";
  harness.context.localState.influenceStateGm = "off";
  harness.context.playerOverrides = { [harness.secondPlayer.id]: "worse" };
  assert.equal(harness.context.hasActiveOverride(), true);
  assert.equal(harness.context.getWidgetStateClass(), "dice-master--better");
  assert.equal(harness.context.getStateTitle("better"), "DICE_MASTER.widget.better");
  assert.equal(harness.context.getEffectivePlayerState(harness.player.id), "better");
  assert.equal(harness.context.getEffectivePlayerState(harness.secondPlayer.id), "worse");
  assert.equal(harness.context.formatSigned(3), "+3");
  assert.deepEqual(Array.from(harness.context.getActiveGmIds()), [harness.gm.id]);
});

test("D&D hooks and Socketlib relay preserve the initiating player identity", async () => {
  const harness = createHarness();
  const registered = new Map();
  const executed = [];
  harness.context.socketlib = {
    registerModule() {
      return {
        register(name, handler) { registered.set(name, handler); },
        executeAsGM(name, ...args) { executed.push({ name, args }); return Promise.resolve(true); }
      };
    }
  };
  harness.context.initSocketlibIntegration();
  assert.deepEqual([...registered.keys()].sort(), ["rollController", "rollIntent"]);

  harness.context.game.user = harness.player;
  harness.Hooks.callAll("dnd5e.preRoll", { subject: { actor: harness.actor } }, null, {});
  assert.equal(harness.context.getPendingRollControllerUserId(), harness.player.id);

  harness.context.relayRollIntent("attack");
  await Promise.resolve();
  assert.equal(executed.some(entry => entry.name === "rollController"), true);
  assert.equal(executed.some(entry => entry.name === "rollIntent"), true);
  assert.equal(harness.emittedSocketMessages.some(entry => entry.payload.type === "roll-intent"), true);
});

test("GM socket capture and local input relays identify the player who initiated a roll", () => {
  const harness = createHarness();
  const listeners = new Map();
  harness.context.document = {
    addEventListener(name, handler) {
      const entries = listeners.get(name) ?? [];
      entries.push(handler);
      listeners.set(name, entries);
    }
  };

  harness.context.game.user = harness.gm;
  harness.context.initSocketActivityCapture();
  harness.receiveAnySocket("module.midi-qol", { handlerName: "rollAttack" }, harness.player.id);
  assert.equal(harness.context.getPendingRollControllerUserId(), harness.player.id);

  harness.context.initRollIntentRelay();
  listeners.get("pointerdown")[0]({ type: "pointerdown", button: 0 });
  assert.equal(harness.context.getPendingRollControllerUserId(), null);

  harness.context.game.user = harness.player;
  harness.context.initRollIntentRelay();
  const target = new harness.context.Element();
  target.dataset = { action: "rollAttack" };
  target.matches = () => false;
  target.hasAttribute = () => false;
  target.closest = selector => selector.startsWith("[data-action]") ? target : null;
  listeners.get("pointerdown")[1]({ type: "pointerdown", button: 0, target });
  assert.equal(harness.emittedSocketMessages.some(entry => entry.payload.action === "rollAttack"), true);
});

test("widget state refresh, visibility toggle, override save, and player removal stay consistent", async () => {
  const harness = createHarness();
  const badge = { textContent: "", title: "" };
  let removed = false;
  const row = {
    dataset: {},
    querySelector() { return badge; },
    remove() { removed = true; }
  };
  harness.context.widget = { isConnected: true, hidden: false, className: "" };
  harness.context.playersContainer = { appendChild() {} };
  harness.context.localState.influenceStatePlayers = "better";
  harness.context.localState.influenceStateGm = "off";
  harness.context.playerOverrides = { [harness.player.id]: "worse" };
  harness.context.playerRows.set(harness.player.id, row);

  harness.context.updateWidgetClass();
  assert.equal(harness.context.widget.className, "dice-master dice-master--better");
  harness.context.updatePlayerRowEffective(harness.player.id);
  assert.equal(row.dataset.effectiveState, "worse");
  assert.equal(badge.textContent, "▼");

  harness.context.toggleWidget();
  assert.equal(harness.context.widget.hidden, true);
  await harness.context.savePlayerOverrides();
  assert.equal(harness.context.game.settings.get("dice-master", "influenceStatePlayerOverrides").PLAYER, "worse");

  harness.context.removePlayerFromWidget(harness.player.id);
  assert.equal(removed, true);
  assert.equal(harness.context.playerRows.has(harness.player.id), false);
});

test("local GM and player rolls always use their own independent states", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "full");

  const gmDie = new harness.MockDie({ faces: 20, originals: [8] });
  await new harness.MockRoll([gmDie]).evaluate();
  assert.equal(gmDie.results[0].result, 20);

  harness.context.game.user = harness.player;
  const firstPlayerDie = new harness.MockDie({ faces: 20, originals: [8] });
  const firstPlayerRoll = new harness.MockRoll([firstPlayerDie]);
  await firstPlayerRoll.evaluate();
  assert.equal(firstPlayerDie.results[0].result, 1);
  assert.equal(firstPlayerRoll.options.diceMasterDebug[0].controller, "Ahmetennes");
  harness.context.game.user = harness.secondPlayer;
  const secondPlayerDie = new harness.MockDie({ faces: 20, originals: [8] });
  const secondPlayerRoll = new harness.MockRoll([secondPlayerDie]);
  await secondPlayerRoll.evaluate();
  assert.equal(secondPlayerDie.results[0].result, 20);
  assert.equal(secondPlayerRoll.options.diceMasterDebug[0].controller, "Second Player");
});

test("a player activity keeps its controller across attack and damage without affecting GM rolls", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "full");
  const workflow = { id: "WF_PLAYER", itemCardId: "CARD_PLAYER", actor: harness.actor };

  harness.Hooks.callAll("createChatMessage", {
    id: "CARD_PLAYER",
    author: harness.player,
    rolls: [],
    flags: { dnd5e: { activity: { id: "ATTACK" } }, "midi-qol": { messageType: "attack" } },
    content: '<div class="midi-chat-card"></div>'
  });
  harness.Hooks.callAll("midi-qol.preAttackRoll", workflow);

  const attackDie = new harness.MockDie({ faces: 20, originals: [12] });
  const attackRoll = new harness.MockBasicRoll([attackDie]);
  await harness.MockBasicRoll.buildEvaluate([attackRoll], { workflow, subject: { actor: harness.actor } }, {});
  assert.equal(attackDie.results[0].result, 1);
  assert.equal(attackRoll.options.diceMasterDebug[0].controller, "Ahmetennes");

  harness.context.applyRemoteRollIntent({ userId: "PLAYER_TWO", action: "other-player", intentId: "intent-two" }, "test");
  harness.Hooks.callAll("midi-qol.preDamageRoll", workflow);
  const damageDie = new harness.MockDie({ faces: 6, originals: [4] });
  const damageRoll = new harness.MockBasicRoll([damageDie]);
  await harness.MockBasicRoll.buildEvaluate([damageRoll], { workflow, subject: { actor: harness.actor } }, {});
  assert.equal(damageDie.results[0].result, 1);
  assert.equal(damageRoll.options.diceMasterDebug[0].controller, "Ahmetennes");

  const gmDie = new harness.MockDie({ faces: 20, originals: [4] });
  const gmRoll = new harness.MockRoll([gmDie]);
  await gmRoll.evaluate();
  assert.equal(gmDie.results[0].result, 20);
  assert.equal(gmRoll.options.diceMasterDebug[0].controller, "Gamemaster");
});

test("simultaneous workflows from two players cannot override one another", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "full");
  const firstWorkflow = { id: "WF_ONE", actor: harness.actor };
  const secondWorkflow = { id: "WF_TWO", actor: harness.secondActor };

  harness.context.applyRemoteRollIntent({ userId: "PLAYER", action: "attack", intentId: "first" }, "test");
  harness.Hooks.callAll("midi-qol.preAttackRoll", firstWorkflow);
  harness.context.applyRemoteRollIntent({ userId: "PLAYER_TWO", action: "attack", intentId: "second" }, "test");
  harness.Hooks.callAll("midi-qol.preAttackRoll", secondWorkflow);

  const firstDie = new harness.MockDie({ faces: 20, originals: [10] });
  const secondDie = new harness.MockDie({ faces: 20, originals: [10] });
  const firstRoll = new harness.MockBasicRoll([firstDie]);
  const secondRoll = new harness.MockBasicRoll([secondDie]);
  await Promise.all([
    harness.MockBasicRoll.buildEvaluate([firstRoll], { workflow: firstWorkflow }, {}),
    harness.MockBasicRoll.buildEvaluate([secondRoll], { workflow: secondWorkflow }, {})
  ]);

  assert.equal(firstDie.results[0].result, 1);
  assert.equal(firstRoll.options.diceMasterDebug[0].controller, "Ahmetennes");
  assert.equal(secondDie.results[0].result, 20);
  assert.equal(secondRoll.options.diceMasterDebug[0].controller, "Second Player");
});

test("explicit message author wins over actor ownership and duplicate intents are ignored", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "full");

  harness.context.applyRemoteRollIntent({ userId: "PLAYER", action: "roll", intentId: "duplicate" }, "raw");
  harness.context.applyRemoteRollIntent({ userId: "PLAYER_TWO", action: "roll", intentId: "duplicate" }, "socketlib");
  const workflow = { id: "WF_DEDUPE", actor: harness.actor };
  harness.Hooks.callAll("midi-qol.preAttackRoll", workflow);
  const playerDie = new harness.MockDie({ faces: 20, originals: [10] });
  await harness.MockBasicRoll.buildEvaluate([new harness.MockBasicRoll([playerDie])], { workflow }, {});
  assert.equal(playerDie.results[0].result, 1);

  const gmDie = new harness.MockDie({ faces: 20, originals: [10] });
  const gmRoll = new harness.MockBasicRoll([gmDie]);
  await harness.MockBasicRoll.buildEvaluate([gmRoll], { subject: { actor: harness.actor } }, { author: harness.gm });
  assert.equal(gmDie.results[0].result, 20);
  assert.equal(gmRoll.options.diceMasterDebug[0].controller, "Gamemaster");
});

test("legacy cheat* world settings move to influence* keys and are removed", async () => {
  const harness = createHarness();
  const stored = new Map([
    ["dice-master.cheatStrategy", "nudge"],
    ["dice-master.cheatStatePlayers", "worse"],
    ["dice-master.cheatStatePlayerOverrides", { PLAYER: "better" }],
    ["dice-master.influenceStateGm", "off"],
    ["dice-master.cheatStateGm", "better"]
  ]);
  harness.context.game.settings.storage = new Map([["world", {
    getSetting(key) {
      if (!stored.has(key)) return undefined;
      return { value: stored.get(key), async delete() { stored.delete(key); } };
    }
  }]]);
  harness.context.game.user = harness.gm;
  await harness.context.game.settings.set("dice-master", "influenceStateGm", "off");

  await harness.context.migrateLegacySettingKeys();

  assert.equal(harness.context.game.settings.get("dice-master", "influenceStrategy"), "nudge");
  assert.equal(harness.context.game.settings.get("dice-master", "influenceStatePlayers"), "worse");
  assert.deepEqual({ ...harness.context.game.settings.get("dice-master", "influenceStatePlayerOverrides") }, { PLAYER: "better" });
  assert.equal(harness.context.game.settings.get("dice-master", "influenceStateGm"), "off", "an existing new key wins over the legacy value");
  assert.deepEqual([...stored.keys()].filter(key => key.includes(".cheat")), []);
});

test("legacy cheat* settings are left alone for players", async () => {
  const harness = createHarness();
  let deleted = false;
  harness.context.game.settings.storage = new Map([["world", {
    getSetting(key) { return key === "dice-master.cheatStrategy" ? { value: "full", async delete() { deleted = true; } } : undefined; }
  }]]);
  harness.context.game.user = harness.player;

  await harness.context.migrateLegacySettingKeys();

  assert.equal(harness.context.game.settings.get("dice-master", "influenceStrategy"), "bias");
  assert.equal(deleted, false);
});

test("legacy player Off overrides migrate to Inherit without changing behavior", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStatePlayers", "better");
  await harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", { PLAYER: "off", PLAYER_TWO: "worse" });
  await harness.context.game.settings.set("dice-master", "stateSchemaVersion", 0);

  await harness.context.migratePlayerOverrideState();
  const migrated = harness.context.game.settings.get("dice-master", "influenceStatePlayerOverrides");
  assert.equal(migrated.PLAYER, "inherit");
  assert.equal(migrated.PLAYER_TWO, "worse");
  assert.equal(harness.context.game.settings.get("dice-master", "stateSchemaVersion"), 2);
  assert.equal(harness.context.getInfluenceState("PLAYER"), "better");
  assert.equal(harness.context.getInfluenceState("PLAYER_TWO"), "worse");
});

test("Inherit, explicit Off, and presets resolve to distinct effective states", async () => {
  const harness = createHarness();
  await harness.context.game.settings.set("dice-master", "influenceStatePlayers", "better");
  await harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", { PLAYER: "inherit", PLAYER_TWO: "off" });
  harness.context.applyInfluenceStateSnapshot(harness.context.readInfluenceStateSnapshot());

  assert.equal(harness.context.getInfluenceState("PLAYER"), "better");
  assert.equal(harness.context.getInfluenceState("PLAYER_TWO"), "off");

  await harness.context.applyPreset("hardMode");
  assert.equal(harness.context.game.settings.get("dice-master", "influenceStatePlayers"), "worse");
  assert.equal(harness.context.game.settings.get("dice-master", "influenceStateGm"), "better");
  assert.deepEqual(Object.keys(harness.context.game.settings.get("dice-master", "influenceStatePlayerOverrides")), []);
});

test("Bias Better and Worse limits enforce the configured d20 floor and ceiling", async () => {
  const harness = createHarness({ random: [0.8, 0.3, 0.3, 0.3] });
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "bias");
  await harness.context.game.settings.set("dice-master", "biasBetterLimits", { d20: 10 });
  await harness.context.game.settings.set("dice-master", "biasWorseLimits", { d20: 10 });

  harness.context.game.user = harness.player;
  const worseAboveLimit = new harness.MockDie({ faces: 20, originals: [13] });
  const worseBelowLimit = new harness.MockDie({ faces: 20, originals: [13] });
  const firstWorseRoll = new harness.MockRoll([worseAboveLimit]);
  const secondWorseRoll = new harness.MockRoll([worseBelowLimit]);
  await firstWorseRoll.evaluate();
  await secondWorseRoll.evaluate();
  assert.equal(worseAboveLimit.results[0].result, 10);
  assert.equal(worseBelowLimit.results[0].result, 7);
  assert.equal(firstWorseRoll.options.diceMasterDebug[0].biasLimit, 10);

  harness.context.game.user = harness.secondPlayer;
  const betterBelowLimit = new harness.MockDie({ faces: 20, originals: [4] });
  const betterAboveLimit = new harness.MockDie({ faces: 20, originals: [13] });
  await new harness.MockRoll([betterBelowLimit]).evaluate();
  await new harness.MockRoll([betterAboveLimit]).evaluate();
  assert.equal(betterBelowLimit.results[0].result, 10);
  assert.equal(betterAboveLimit.results[0].result, 13);
});

test("Bias limits follow semantic Better and Worse when lower rolls are favorable", async () => {
  const harness = createHarness({ random: [0.8, 0.3] });
  await harness.context.game.settings.set("dice-master", "influenceStrategy", "bias");
  await harness.context.game.settings.set("dice-master", "positiveDirection", "lower");
  await harness.context.game.settings.set("dice-master", "biasBetterLimits", { d20: 10 });
  await harness.context.game.settings.set("dice-master", "biasWorseLimits", { d20: 10 });

  harness.context.game.user = harness.secondPlayer;
  const betterDie = new harness.MockDie({ faces: 20, originals: [13] });
  await new harness.MockRoll([betterDie]).evaluate();
  assert.equal(betterDie.results[0].result, 10);

  harness.context.game.user = harness.player;
  const worseDie = new harness.MockDie({ faces: 20, originals: [4] });
  await new harness.MockRoll([worseDie]).evaluate();
  assert.equal(worseDie.results[0].result, 10);
});

async function badLuckHarness(random = [0.8]) {
  const harness = createHarness({ random });
  const settings = harness.context.game.settings;
  await settings.set("dice-master", "influenceStatePlayers", "off");
  await settings.set("dice-master", "influenceStatePlayerOverrides", {});
  await settings.set("dice-master", "badLuckEnabled", true);
  await settings.set("dice-master", "badLuckThreshold", 5);
  await settings.set("dice-master", "badLuckStreak", 3);
  await settings.set("dice-master", "affectedDice", { d20: true });
  harness.context.applyInfluenceStateSnapshot(harness.context.readInfluenceStateSnapshot());
  harness.context.game.user = harness.player;
  harness.context.patchRollEvaluate();
  const roll = async (natural, modifiers = []) => {
    const die = new harness.MockDie({ faces: 20, number: natural.length ?? 1, originals: [].concat(natural), modifiers });
    await new harness.MockRoll([die]).evaluate();
    return die;
  };
  return { harness, roll, entry: () => harness.context.badLuckStreaks.get(harness.player.id) };
}

test("three bad d20s in a row make the next d20 roll twice and keep the higher result, once", async () => {
  const { roll, entry } = await badLuckHarness([0.8]);
  for ( const natural of [2, 5, 1] ) assert.equal((await roll(natural)).results[0].result, natural);
  assert.equal(entry().pending, true);

  const protectedDie = await roll(4);
  assert.equal(protectedDie.results[0].result, 17);
  assert.equal(protectedDie._diceMasterBadLuck, true);
  assert.deepEqual({ ...entry() }, { streak: 0, pending: false });

  assert.equal((await roll(3)).results[0].result, 3, "protection is consumed after one roll");
});

test("a d20 above the threshold resets the bad luck streak", async () => {
  const { roll, entry } = await badLuckHarness();
  await roll(2);
  await roll(3);
  await roll(12);
  assert.deepEqual({ ...entry() }, { streak: 0, pending: false });
});

test("bad luck counts the kept d20 of an advantage roll", async () => {
  const { roll, entry } = await badLuckHarness();
  await roll([2, 15], ["adv"]);
  assert.equal(entry()?.streak ?? 0, 0);
  await roll([2, 4], ["adv"]);
  assert.equal(entry().streak, 1);
});

test("bad luck protection ignores the GM, players with Better/Worse, and the disabled setting", async () => {
  const gmCase = await badLuckHarness();
  gmCase.harness.context.game.user = gmCase.harness.gm;
  for ( const natural of [1, 1, 1, 1] ) await gmCase.roll(natural);
  assert.equal(gmCase.harness.context.badLuckStreaks.has(gmCase.harness.gm.id), false);

  const worseCase = await badLuckHarness();
  await worseCase.harness.context.game.settings.set("dice-master", "influenceStatePlayerOverrides", { PLAYER: "worse" });
  worseCase.harness.context.applyInfluenceStateSnapshot(worseCase.harness.context.readInfluenceStateSnapshot());
  for ( const natural of [1, 1, 1] ) await worseCase.roll(natural);
  assert.equal(worseCase.entry(), undefined);

  const disabledCase = await badLuckHarness();
  await disabledCase.harness.context.game.settings.set("dice-master", "badLuckEnabled", false);
  for ( const natural of [1, 1, 1] ) await disabledCase.roll(natural);
  assert.equal((await disabledCase.roll(4)).results[0].result, 4);
  assert.equal(disabledCase.entry(), undefined);
});
