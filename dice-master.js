//#region src/constants.ts
var MODULE_ID = "dice-master";
var MODULE_VERSION = "0.9.0";
var SOCKET_NAME = `module.${MODULE_ID}`;
var socketlibModule = null;
var DIE_TYPES = [
	"d4",
	"d6",
	"d8",
	"d10",
	"d12",
	"d20",
	"d100"
];
var DEFAULT_NUDGE_VALUES = {
	d4: 1,
	d6: 2,
	d8: 2,
	d10: 3,
	d12: 3,
	d20: 4,
	d100: 15
};
var DEFAULT_BIAS_LIMITS = {
	d4: 0,
	d6: 0,
	d8: 0,
	d10: 0,
	d12: 0,
	d20: 0,
	d100: 0
};
var DEFAULT_AFFECTED_DICE = {
	d4: true,
	d6: true,
	d8: true,
	d10: true,
	d12: true,
	d20: true,
	d100: true
};
//#endregion
//#region src/ui/settings-menu.ts
var s$3 = () => game.settings;
var DiceMasterSettingsMenu = class extends foundry.appv1.api.FormApplication {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "dice-master-settings-menu",
			title: game.i18n.localize("DICE_MASTER.settingsMenu.title"),
			template: `modules/${MODULE_ID}/templates/settings-menu.hbs`,
			width: 700,
			closeOnSubmit: true
		});
	}
	getData() {
		const nudgeValues = s$3().get(MODULE_ID, "nudgeValues");
		const affectedDice = s$3().get(MODULE_ID, "affectedDice");
		const positiveDirection = s$3().get(MODULE_ID, "positiveDirection");
		const overrides = s$3().get(MODULE_ID, "positiveDirectionOverrides");
		const biasBetterLimits = s$3().get(MODULE_ID, "biasBetterLimits");
		const biasWorseLimits = s$3().get(MODULE_ID, "biasWorseLimits");
		return {
			dice: DIE_TYPES.map((die) => ({
				die,
				nudgeValue: nudgeValues[die] ?? DEFAULT_NUDGE_VALUES[die],
				biasBetterLimit: biasBetterLimits[die] ?? DEFAULT_BIAS_LIMITS[die],
				biasWorseLimit: biasWorseLimits[die] ?? DEFAULT_BIAS_LIMITS[die],
				faces: Number(die.slice(1)),
				affected: affectedDice[die] ?? DEFAULT_AFFECTED_DICE[die],
				direction: overrides[die] ?? positiveDirection,
				isOverridden: die in overrides
			})),
			globalDirection: positiveDirection
		};
	}
	async _updateObject(_event, formData) {
		const nudgeValues = {};
		const biasBetterLimits = {};
		const biasWorseLimits = {};
		const affectedDice = {};
		const overrides = {};
		const globalDirection = s$3().get(MODULE_ID, "positiveDirection");
		DIE_TYPES.forEach((die) => {
			const faces = Number(die.slice(1));
			const raw = Number(formData[`nudge-${die}`]);
			nudgeValues[die] = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_NUDGE_VALUES[die];
			const rawBetterLimit = Number(formData[`bias-better-${die}`]);
			const rawWorseLimit = Number(formData[`bias-worse-${die}`]);
			biasBetterLimits[die] = Number.isFinite(rawBetterLimit) ? Math.max(0, Math.min(faces, Math.trunc(rawBetterLimit))) : 0;
			biasWorseLimits[die] = Number.isFinite(rawWorseLimit) ? Math.max(0, Math.min(faces, Math.trunc(rawWorseLimit))) : 0;
			affectedDice[die] = Boolean(formData[`affected-${die}`]);
			const dir = formData[`direction-${die}`];
			if (dir && dir !== globalDirection) overrides[die] = dir;
		});
		await s$3().set(MODULE_ID, "nudgeValues", nudgeValues);
		await s$3().set(MODULE_ID, "biasBetterLimits", biasBetterLimits);
		await s$3().set(MODULE_ID, "biasWorseLimits", biasWorseLimits);
		await s$3().set(MODULE_ID, "affectedDice", affectedDice);
		await s$3().set(MODULE_ID, "positiveDirectionOverrides", overrides);
	}
};
//#endregion
//#region src/settings.ts
var s$2 = () => game.settings;
function registerSettings() {
	s$2().register(MODULE_ID, "influenceStrategy", {
		name: "DICE_MASTER.settings.influenceStrategy.name",
		hint: "DICE_MASTER.settings.influenceStrategy.hint",
		scope: "world",
		config: true,
		type: String,
		default: "bias",
		choices: {
			full: "DICE_MASTER.settings.influenceStrategy.full",
			bias: "DICE_MASTER.settings.influenceStrategy.bias",
			nudge: "DICE_MASTER.settings.influenceStrategy.nudge",
			threshold: "DICE_MASTER.settings.influenceStrategy.threshold"
		}
	});
	s$2().register(MODULE_ID, "positiveDirection", {
		name: "DICE_MASTER.settings.positiveDirection.name",
		hint: "DICE_MASTER.settings.positiveDirection.hint",
		scope: "world",
		config: true,
		type: String,
		default: "higher",
		choices: {
			higher: "DICE_MASTER.settings.positiveDirection.higher",
			lower: "DICE_MASTER.settings.positiveDirection.lower"
		}
	});
	s$2().register(MODULE_ID, "thresholdPercent", {
		name: "DICE_MASTER.settings.thresholdPercent.name",
		hint: "DICE_MASTER.settings.thresholdPercent.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 25,
		range: {
			min: 1,
			max: 50,
			step: 1
		}
	});
	s$2().register(MODULE_ID, "explicitMode", {
		name: "DICE_MASTER.settings.explicitMode.name",
		hint: "DICE_MASTER.settings.explicitMode.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "debugMode", {
		name: "DICE_MASTER.settings.debugMode.name",
		hint: "DICE_MASTER.settings.debugMode.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "badLuckEnabled", {
		name: "DICE_MASTER.settings.badLuckEnabled.name",
		hint: "DICE_MASTER.settings.badLuckEnabled.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "badLuckThreshold", {
		name: "DICE_MASTER.settings.badLuckThreshold.name",
		hint: "DICE_MASTER.settings.badLuckThreshold.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			max: 10,
			step: 1
		}
	});
	s$2().register(MODULE_ID, "badLuckStreak", {
		name: "DICE_MASTER.settings.badLuckStreak.name",
		hint: "DICE_MASTER.settings.badLuckStreak.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 3,
		range: {
			min: 2,
			max: 6,
			step: 1
		}
	});
	s$2().registerMenu(MODULE_ID, "diceSettingsMenu", {
		name: "DICE_MASTER.settings.diceSettingsMenu.name",
		label: "DICE_MASTER.settings.diceSettingsMenu.label",
		hint: "DICE_MASTER.settings.diceSettingsMenu.hint",
		icon: "fas fa-dice",
		type: DiceMasterSettingsMenu,
		restricted: true
	});
	s$2().register(MODULE_ID, "positiveDirectionOverrides", {
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});
	s$2().register(MODULE_ID, "nudgeValues", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_NUDGE_VALUES
	});
	s$2().register(MODULE_ID, "biasBetterLimits", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_BIAS_LIMITS
	});
	s$2().register(MODULE_ID, "biasWorseLimits", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_BIAS_LIMITS
	});
	s$2().register(MODULE_ID, "affectedDice", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_AFFECTED_DICE
	});
	s$2().register(MODULE_ID, "influenceStatePlayers", {
		scope: "world",
		config: false,
		type: String,
		default: "off"
	});
	s$2().register(MODULE_ID, "influenceStateGm", {
		scope: "world",
		config: false,
		type: String,
		default: "off"
	});
	s$2().register(MODULE_ID, "influenceStatePlayerOverrides", {
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});
	s$2().register(MODULE_ID, "stateSchemaVersion", {
		scope: "world",
		config: false,
		type: Number,
		default: 0
	});
	s$2().register(MODULE_ID, "widgetPosition", {
		scope: "client",
		config: false,
		type: Object,
		default: {
			top: 100,
			left: 100
		}
	});
}
//#endregion
//#region src/influence/state.ts
var s$1 = () => game.settings;
var syncedInfluenceState = null;
var dieControllerUserIds = /* @__PURE__ */ new WeakMap();
var rollControllerUserIds = /* @__PURE__ */ new WeakMap();
var dieControllerTraces = /* @__PURE__ */ new WeakMap();
var rollControllerTraces = /* @__PURE__ */ new WeakMap();
var workflowControllerUserIds = /* @__PURE__ */ new WeakMap();
var workflowControllerContexts = /* @__PURE__ */ new Map();
var pendingRollController = null;
var lastRollControllerTrace = "none";
var recentRemoteIntentIds = /* @__PURE__ */ new Map();
var ROLL_CONTEXT_TTL = 45e3;
function readInfluenceStateSnapshot() {
	return {
		players: s$1().get(MODULE_ID, "influenceStatePlayers"),
		gm: s$1().get(MODULE_ID, "influenceStateGm"),
		playerOverrides: { ...s$1().get(MODULE_ID, "influenceStatePlayerOverrides") }
	};
}
function isInfluenceState(value) {
	return value === "off" || value === "better" || value === "worse";
}
function isPlayerOverrideState(value) {
	return value === "inherit" || isInfluenceState(value);
}
function normalizeInfluenceStateSnapshot(snapshot) {
	if (!snapshot || !isInfluenceState(snapshot.players) || !isInfluenceState(snapshot.gm)) return null;
	const playerOverrides = {};
	if (snapshot.playerOverrides && typeof snapshot.playerOverrides === "object") {
		for (const [userId, state] of Object.entries(snapshot.playerOverrides)) {
			if (isPlayerOverrideState(state)) playerOverrides[userId] = state;
		}
	}
	return {
		players: snapshot.players,
		gm: snapshot.gm,
		playerOverrides
	};
}
function applyInfluenceStateSnapshot(snapshot) {
	const normalized = normalizeInfluenceStateSnapshot(snapshot);
	if (normalized) syncedInfluenceState = normalized;
}
function sendInfluenceStateSnapshot(targetUserId = null) {
	const snapshot = readInfluenceStateSnapshot();
	applyInfluenceStateSnapshot(snapshot);
	game.socket?.emit(SOCKET_NAME, {
		type: "influence-state",
		targetUserId,
		snapshot
	});
}
function broadcastInfluenceStateSnapshot() {
	sendInfluenceStateSnapshot();
}
function isAuthorizedInfluenceStateSender(senderId) {
	if (typeof senderId !== "string") return false;
	const sender = game.users?.get?.(senderId);
	return Boolean(sender?.isGM && sender.active);
}
function initInfluenceStateSync() {
	applyInfluenceStateSnapshot(readInfluenceStateSnapshot());
	game.socket?.on(SOCKET_NAME, (payload, senderId) => {
		if (payload?.type === "roll-intent") {
			applyRemoteRollIntent({ ...payload, userId: senderId ?? payload.userId }, "raw-socket");
			return;
		}
		if (payload?.type === "roll-controller") {
			applyRemoteRollController({ ...payload, userId: senderId ?? payload.userId }, "raw-socket");
			return;
		}
		if (payload?.type === "request-influence-state") {
			if (game.user?.isGM && typeof payload.userId === "string") sendInfluenceStateSnapshot(payload.userId);
			return;
		}
		if (payload?.type !== "influence-state") return;
		if (!isAuthorizedInfluenceStateSender(senderId)) return;
		if (payload.targetUserId && payload.targetUserId !== game.user?.id) return;
		applyInfluenceStateSnapshot(payload.snapshot);
	});
	Hooks.on("updateSetting", (setting) => {
		const key = String(setting?.key ?? "");
		if (!key.startsWith(`${MODULE_ID}.influenceState`)) return;
		applyInfluenceStateSnapshot(readInfluenceStateSnapshot());
		if (key === `${MODULE_ID}.influenceStatePlayers`) localState.influenceStatePlayers = s$1().get(MODULE_ID, "influenceStatePlayers");
		if (key === `${MODULE_ID}.influenceStateGm`) localState.influenceStateGm = s$1().get(MODULE_ID, "influenceStateGm");
		if (key === `${MODULE_ID}.influenceStatePlayerOverrides`) playerOverrides = { ...s$1().get(MODULE_ID, "influenceStatePlayerOverrides") };
		refreshWidgetControls();
	});
	if (game.user?.isGM) broadcastInfluenceStateSnapshot();
	else if (game.user?.id) game.socket?.emit(SOCKET_NAME, {
		type: "request-influence-state",
		userId: game.user.id
	});
}
function getInfluenceState(controllerUserId = null) {
	const snapshot = syncedInfluenceState ?? readInfluenceStateSnapshot();
	const userId = controllerUserId ?? game.user?.id ?? null;
	const controller = userId ? game.users?.get?.(userId) : null;
	if (controller?.isGM) return snapshot.gm;
	if (userId) {
		const override = snapshot.playerOverrides[userId];
		if (override && override !== "inherit") return override;
		return snapshot.players;
	}
	return game.user?.isGM ? snapshot.gm : snapshot.players;
}
var LEGACY_SETTING_KEYS = {
	cheatStrategy: "influenceStrategy",
	cheatStatePlayers: "influenceStatePlayers",
	cheatStateGm: "influenceStateGm",
	cheatStatePlayerOverrides: "influenceStatePlayerOverrides"
};
async function migrateLegacySettingKeys() {
	const activeGm = game.users?.activeGM;
	if (activeGm ? !activeGm.isSelf : !(game.user?.isGM ?? false)) return;
	const storage = game.settings?.storage?.get?.("world");
	if (typeof storage?.getSetting !== "function") return;
	for (const [legacyKey, key] of Object.entries(LEGACY_SETTING_KEYS)) {
		const legacy = storage.getSetting(`${MODULE_ID}.${legacyKey}`);
		if (!legacy) continue;
		if (!storage.getSetting(`${MODULE_ID}.${key}`)) await s$1().set(MODULE_ID, key, legacy.value);
		await legacy.delete();
	}
}
async function migratePlayerOverrideState() {
	if (!(game.user?.isGM ?? false)) return;
	const schemaVersion = Number(s$1().get(MODULE_ID, "stateSchemaVersion") ?? 0);
	if (schemaVersion >= 2) return;
	const saved = s$1().get(MODULE_ID, "influenceStatePlayerOverrides") ?? {};
	const migrated = {};
	for (const [userId, state] of Object.entries(saved)) {
		migrated[userId] = state === "off" ? "inherit" : isPlayerOverrideState(state) ? state : "inherit";
	}
	await s$1().set(MODULE_ID, "influenceStatePlayerOverrides", migrated);
	await s$1().set(MODULE_ID, "stateSchemaVersion", 2);
	applyInfluenceStateSnapshot(readInfluenceStateSnapshot());
}
function getInfluenceConfig(controllerUserId = null) {
	return {
		state: getInfluenceState(controllerUserId),
		strategy: s$1().get(MODULE_ID, "influenceStrategy"),
		thresholdPercent: s$1().get(MODULE_ID, "thresholdPercent"),
		explicitMode: s$1().get(MODULE_ID, "explicitMode"),
		debugMode: s$1().get(MODULE_ID, "debugMode")
	};
}
function getUsersArray() {
	if (Array.isArray(game.users?.contents)) return game.users.contents;
	return game.users ? Array.from(game.users) : [];
}
function resolveActorFromRollContext(config, message) {
	const subject = config?.subject;
	const workflow = config?.workflow ?? config?.midiOptions?.workflow;
	const actor = subject?.actor ?? subject?.parent?.actor ?? subject?.item?.actor ?? config?.actor ?? workflow?.actor ?? workflow?.activity?.actor ?? workflow?.item?.actor;
	if (actor) return actor;
	const actorId = message?.data?.speaker?.actor ?? config?.midiOptions?.messageData?.speaker?.actor;
	return actorId ? game.actors?.get(actorId) : null;
}
function resolveActorControllerUserId(actor) {
	if (!actor) return null;
	const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
	const owners = getUsersArray().filter((user) => {
		if (user.isGM || !user.id) return false;
		if (typeof actor.testUserPermission === "function") return actor.testUserPermission(user, ownerLevel);
		return Number(actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0) >= ownerLevel;
	});
	if (owners.length === 0) return null;
	const executingPlayer = !(game.user?.isGM ?? false) ? owners.find((user) => user.id === game.user?.id) : null;
	if (executingPlayer) return executingPlayer.id;
	const assignedActive = owners.find((user) => user.active && user.character?.id === actor.id);
	if (assignedActive) return assignedActive.id;
	const assigned = owners.find((user) => user.character?.id === actor.id);
	if (assigned) return assigned.id;
	return (owners.find((user) => user.active) ?? owners[0]).id;
}
function getLocalControllerUserId() {
	return typeof game.user?.id === "string" ? game.user.id : null;
}
function getContextControllerUserId(config, message) {
	const candidates = [
		message?.user,
		message?.author,
		message?.data?.user,
		message?.data?.author,
		config?.user,
		config?.userId,
		config?.messageData?.user,
		config?.midiOptions?.messageData?.user,
		config?.workflow?.user,
		config?.midiOptions?.workflow?.user
	];
	for (const candidate of candidates) {
		const userId = typeof candidate === "string" ? candidate : candidate?.id;
		if (typeof userId === "string" && game.users?.get?.(userId)) return userId;
	}
	return null;
}
function getWorkflowFromContext(config) {
	return config?.workflow ?? config?.midiOptions?.workflow ?? null;
}
function getWorkflowContextKeys(workflow = null, message = null) {
	const keys = [];
	const add = (prefix, value) => {
		if (typeof value !== "string" || !value || keys.includes(`${prefix}:${value}`)) return;
		keys.push(`${prefix}:${value}`);
	};
	add("workflow", workflow?.uuid);
	add("workflow", workflow?.id);
	add("message", workflow?.itemCardId);
	add("message", workflow?.activityCardId);
	add("message", message?.id);
	add("message", message?._id);
	return keys;
}
function pruneWorkflowControllerContexts() {
	const now = Date.now();
	for (const [key, context] of workflowControllerContexts) {
		if (!context || context.expiresAt < now) workflowControllerContexts.delete(key);
	}
}
function rememberWorkflowController(workflow, message, userId, source) {
	if (typeof userId !== "string" || !game.users?.get?.(userId)) return;
	const context = {
		userId,
		source,
		expiresAt: Date.now() + ROLL_CONTEXT_TTL
	};
	if (workflow && typeof workflow === "object") workflowControllerUserIds.set(workflow, context);
	pruneWorkflowControllerContexts();
	for (const key of getWorkflowContextKeys(workflow, message)) workflowControllerContexts.set(key, context);
}
function getWorkflowControllerContext(workflow = null, message = null) {
	pruneWorkflowControllerContexts();
	if (workflow && typeof workflow === "object") {
		const direct = workflowControllerUserIds.get(workflow);
		if (direct && direct.expiresAt >= Date.now()) return direct;
	}
	for (const key of getWorkflowContextKeys(workflow, message)) {
		const context = workflowControllerContexts.get(key);
		if (context && context.expiresAt >= Date.now()) return context;
	}
	return null;
}
function bindRollController(roll, userId, source) {
	if (!roll || typeof userId !== "string") return;
	const trace = String(source).endsWith(`->${userId}`) ? String(source) : `${source}->${userId}`;
	rollControllerUserIds.set(roll, userId);
	rollControllerTraces.set(roll, trace);
	for (const die of getRollDice(roll)) {
		dieControllerUserIds.set(die, userId);
		dieControllerTraces.set(die, trace);
	}
}
function resolveRollControllerUserId(actor, config = null, message = null) {
	const contextUserId = getContextControllerUserId(config, message);
	if (contextUserId) return contextUserId;
	const workflowContext = getWorkflowControllerContext(getWorkflowFromContext(config), message);
	if (workflowContext) return workflowContext.userId;
	const localUserId = getLocalControllerUserId();
	if (!(game.user?.isGM ?? false)) return localUserId ?? resolveActorControllerUserId(actor);
	return getPendingRollControllerUserId() ?? localUserId;
}
function createRollIntentId() {
	return `${game.user?.id ?? "unknown"}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
function acceptRemoteIntent(payload) {
	const intentId = payload?.intentId;
	if (typeof intentId !== "string" || !intentId) return true;
	const now = Date.now();
	for (const [knownId, receivedAt] of recentRemoteIntentIds) {
		if (now - receivedAt > 3e4) recentRemoteIntentIds.delete(knownId);
	}
	if (recentRemoteIntentIds.has(intentId)) return false;
	recentRemoteIntentIds.set(intentId, now);
	return true;
}
function rememberPendingRollController(actor, source = "unknown", relay = true, workflow = null, message = null) {
	const localUserId = getLocalControllerUserId();
	if (game.user?.isGM ?? false) {
		const workflowContext = getWorkflowControllerContext(workflow, message);
		const remoteUserId = workflowContext?.userId ?? getPendingRollControllerUserId();
		const controllerUserId = remoteUserId ?? localUserId;
		lastRollControllerTrace = `${source}:${actor?.id ?? "no-actor"}->${remoteUserId ?? "GM"}`;
		if (controllerUserId) rememberWorkflowController(workflow, message, controllerUserId, source);
		return controllerUserId;
	}
	const userId = localUserId ?? resolveActorControllerUserId(actor);
	lastRollControllerTrace = `${source}:${actor?.id ?? "no-actor"}->${userId ?? "no-player"}`;
	if (!userId) return null;
	rememberWorkflowController(workflow, message, userId, source);
	pendingRollController = {
		userId,
		expiresAt: Date.now() + 1e4,
		remote: false
	};
	const intentId = createRollIntentId();
	if (relay && !(game.user?.isGM ?? false)) game.socket?.emit(SOCKET_NAME, {
		type: "roll-controller",
		userId,
		actorId: actor?.id ?? null,
		source,
		intentId
	});
	if (relay && !(game.user?.isGM ?? false) && socketlibModule && actor?.id) {
		socketlibModule.executeAsGM("rollController", actor.id, source, intentId).catch((error) => {
			console.warn(`${MODULE_ID} | SocketLib roll controller failed`, error);
		});
	}
	return userId;
}
function applyRemoteRollController(payload, transport = "socket") {
	if (!(game.user?.isGM ?? false)) return;
	if (!acceptRemoteIntent(payload)) return;
	if (typeof payload.userId !== "string" || typeof payload.actorId !== "string") return;
	const user = game.users?.get?.(payload.userId);
	const actor = game.actors?.get?.(payload.actorId);
	if (!user || user.isGM || !actor) return;
	const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
	if (typeof actor.testUserPermission === "function" && !actor.testUserPermission(user, ownerLevel)) return;
	pendingRollController = {
		userId: user.id,
		expiresAt: Date.now() + 5e3,
		remote: true
	};
	lastRollControllerTrace = `${transport}-${payload.source ?? "unknown"}:${actor.id}->${user.id}`;
}
function applyRemoteRollIntent(payload, transport = "socket") {
	if (!(game.user?.isGM ?? false)) return;
	if (!acceptRemoteIntent(payload)) return;
	if (typeof payload.userId !== "string") return;
	const user = game.users?.get?.(payload.userId);
	if (!user || user.isGM) return;
	pendingRollController = {
		userId: user.id,
		expiresAt: Date.now() + 1.5e4,
		remote: true
	};
	lastRollControllerTrace = `${transport}-ui-intent:${payload.action ?? "roll"}->${user.id}`;
}
function initSocketlibIntegration() {
	if (socketlibModule) return;
	if (!globalThis.socketlib) return;
	socketlibModule = globalThis.socketlib.registerModule(MODULE_ID);
	if (!socketlibModule) return;
	socketlibModule.register("rollIntent", function(action, intentId) {
		applyRemoteRollIntent({ userId: this.socketdata?.userId, action, intentId }, "socketlib");
		return true;
	});
	socketlibModule.register("rollController", function(actorId, source, intentId) {
		applyRemoteRollController({ userId: this.socketdata?.userId, actorId, source, intentId }, "socketlib");
		return true;
	});
}
function relayRollIntent(action) {
	const intentId = createRollIntentId();
	game.socket?.emit(SOCKET_NAME, {
		type: "roll-intent",
		userId: game.user?.id,
		action,
		intentId
	});
	if (socketlibModule) socketlibModule.executeAsGM("rollIntent", action, intentId).catch((error) => {
		console.warn(`${MODULE_ID} | SocketLib roll intent failed`, error);
	});
}
function initSocketActivityCapture() {
	if (!(game.user?.isGM ?? false) || typeof game.socket?.prependAny !== "function") return;
	game.socket.prependAny((eventName, payload, senderId) => {
		if (typeof senderId !== "string") return;
		const sender = game.users?.get?.(senderId);
		if (!sender || sender.isGM) return;
		let action = null;
		if (eventName === "module.midi-qol") {
			const handler = String(payload?.handlerName ?? "");
			if (/roll|activityuse|itemuse/i.test(handler)) action = `midi:${handler || "request"}`;
		}
		else if (eventName === "system.dnd5e") {
			const handler = String(payload?.handlerName ?? payload?.action ?? payload?.type ?? "request");
			if (/roll|activity|item|use/i.test(handler)) action = `dnd5e:${handler}`;
		}
		else if (eventName === "chatMessage") action = "chat-message";
		if (action) applyRemoteRollIntent({ userId: senderId, action }, "wire");
	});
}
function initRollIntentRelay() {
	if (game.user?.isGM ?? false) {
		const clearRemoteContext = (event) => {
			if (event.type === "pointerdown" && event.button !== 0) return;
			pendingRollController = null;
			lastRollControllerTrace = `gm-local-${event.type}->GM`;
		};
		document.addEventListener("pointerdown", clearRemoteContext, true);
		document.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") clearRemoteContext(event);
		}, true);
		return;
	}
	const relay = (event) => {
		if (event.type === "pointerdown" && event.button !== 0) return;
		const target = event.target instanceof Element ? event.target : null;
		const actionable = target?.closest("[data-action], [data-roll], .rollable, .dice-tray__roll");
		if (!actionable) return;
		const action = actionable.dataset.action ?? (actionable.matches(".dice-tray__roll") ? "dice-tray-roll" : actionable.hasAttribute("data-roll") ? "data-roll" : "rollable");
		if (actionable.dataset.action && !/(roll|use|attack|damage|save|check|ability|skill)/i.test(action)) return;
		relayRollIntent(action);
	};
	document.addEventListener("pointerdown", relay, true);
	document.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		const target = event.target instanceof Element ? event.target : null;
		const actionable = target?.closest("[data-action], [data-roll], .rollable, .dice-tray__roll");
		if (actionable) {
			relay(event);
			return;
		}
		const chatInput = target?.closest("#chat-message, .chat-form textarea");
		if (event.key === "Enter" && chatInput && /^\s*\/(?:r|roll|gmr|gmroll|br|broll|sr|selfroll)\b/i.test(chatInput.value ?? "")) relayRollIntent("chat-roll");
	}, true);
	document.addEventListener("contextmenu", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest(".dice-tray__button")) relayRollIntent("dice-tray-context");
	}, true);
}
function getPendingRollControllerUserId() {
	if (!pendingRollController) return null;
	if (pendingRollController.expiresAt < Date.now()) {
		pendingRollController = null;
		return null;
	}
	return pendingRollController.userId;
}
function getRollDice(roll) {
	if (Array.isArray(roll?.dice)) return roll.dice;
	return (roll?.terms ?? []).flatMap((term) => {
		if (Array.isArray(term?.dice)) return term.dice;
		return typeof term?.faces === "number" ? [term] : [];
	});
}
function registerRollControllerHooks() {
	const captureDndRollContext = (config, _dialog, message) => {
		rememberPendingRollController(resolveActorFromRollContext(config, message), "dnd5e-pre", true, getWorkflowFromContext(config), message);
	};
	Hooks.on("dnd5e.preRollAttack", captureDndRollContext);
	Hooks.on("dnd5e.preRollD20Test", captureDndRollContext);
	Hooks.on("dnd5e.preRoll", captureDndRollContext);
	Hooks.on("midi-qol.preAttackRoll", (workflow) => {
		const actor = workflow?.actor ?? workflow?.activity?.actor ?? workflow?.item?.actor;
		rememberPendingRollController(actor, "midi-preAttack", true, workflow);
	});
	Hooks.on("midi-qol.preItemRoll", (workflow) => {
		const actor = workflow?.actor ?? workflow?.activity?.actor ?? workflow?.item?.actor;
		rememberPendingRollController(actor, "midi-preItem", true, workflow);
	});
	Hooks.on("dnd5e.preUseActivity", (activity) => {
		rememberPendingRollController(activity?.actor ?? activity?.item?.actor, "dnd5e-preUseActivity", true, activity);
	});
	Hooks.on("midi-qol.preDamageRoll", (workflow, activity) => {
		const actor = workflow?.actor ?? workflow?.activity?.actor ?? workflow?.item?.actor ?? activity?.actor ?? activity?.item?.actor;
		rememberPendingRollController(actor, "midi-preDamage", true, workflow);
	});
	Hooks.on("dnd5e.postRollConfiguration", (rolls, config, _dialog, message) => {
		const actor = resolveActorFromRollContext(config, message);
		const workflow = getWorkflowFromContext(config);
		const controllerUserId = rememberPendingRollController(actor, "dnd5e-post", true, workflow, message);
		if (!controllerUserId) return;
		for (const roll of rolls ?? []) bindRollController(roll, controllerUserId, `dnd5e-post:${workflow?.id ?? message?.id ?? "roll"}`);
	});
}
function patchDnd5eBuildEvaluate() {
	const rollClass = CONFIG.Dice?.BasicRoll;
	const originalBuildEvaluate = rollClass?.buildEvaluate;
	if (typeof originalBuildEvaluate !== "function") return;
	installWrapper(rollClass, "CONFIG.Dice.BasicRoll", "buildEvaluate", async function patchedBuildEvaluate(wrapped, rolls, config = {}, message = {}) {
		const actor = resolveActorFromRollContext(config, message);
		const workflow = getWorkflowFromContext(config);
		const controllerUserId = resolveRollControllerUserId(actor, config, message);
		if (!controllerUserId) return wrapped(rolls, config, message);
		const source = `dnd5e-buildEvaluate:${workflow?.id ?? message?.id ?? actor?.id ?? "roll"}`;
		lastRollControllerTrace = `${source}->${controllerUserId}`;
		rememberWorkflowController(workflow, message, controllerUserId, source);
		for (const roll of rolls ?? []) bindRollController(roll, controllerUserId, source);
		return await wrapped(rolls, config, message);
	});
}
function getControllerLabel(controllerUserId) {
	if (!controllerUserId) return game.user?.isGM ? "GM" : game.user?.name ?? "Player";
	return game.users?.get?.(controllerUserId)?.name ?? controllerUserId;
}
function isDieAffected(dieType) {
	return s$1().get(MODULE_ID, "affectedDice")[dieType] ?? DEFAULT_AFFECTED_DICE[dieType] ?? true;
}
function getPositiveDirection(dieType) {
	const overrides = s$1().get(MODULE_ID, "positiveDirectionOverrides");
	if (overrides[dieType]) return overrides[dieType];
	return s$1().get(MODULE_ID, "positiveDirection");
}
function getNudgeValue(dieType) {
	return s$1().get(MODULE_ID, "nudgeValues")[dieType] ?? DEFAULT_NUDGE_VALUES[dieType] ?? 2;
}
function getBiasLimit(dieType, state) {
	const settingKey = state === "better" ? "biasBetterLimits" : "biasWorseLimits";
	const limits = s$1().get(MODULE_ID, settingKey) ?? DEFAULT_BIAS_LIMITS;
	const value = Number(limits[dieType] ?? DEFAULT_BIAS_LIMITS[dieType] ?? 0);
	const faces = Number(dieType.slice(1));
	return Number.isFinite(value) ? Math.max(0, Math.min(faces, Math.trunc(value))) : 0;
}
//#endregion
//#region src/influence/strategies/full.ts
function applyFull(results, context) {
	results.filter((r) => r.active).forEach((r) => {
		r.result = context.direction === "better" ? context.faces : 1;
	});
}
//#endregion
//#region src/influence/strategies/bias.ts
function randomInt$1(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isBetter(a, b, direction) {
	return direction === "better" ? a >= b : a <= b;
}
function applyBias(results, context) {
	let secondRoll;
	const limit = context.state === "better" ? context.biasBetterLimit : context.biasWorseLimit;
	let limitApplied = false;
	results.filter((r) => r.active).forEach((r) => {
		secondRoll = randomInt$1(1, context.faces);
		if (isBetter(secondRoll, r.result, context.direction)) r.result = secondRoll;
		if (limit > 0) {
			const limitedResult = context.direction === "better" ? Math.max(r.result, limit) : Math.min(r.result, limit);
			limitApplied ||= limitedResult !== r.result;
			r.result = limitedResult;
		}
	});
	return { biasSecondRoll: secondRoll, biasLimit: limit, biasLimitApplied: limitApplied };
}
//#endregion
//#region src/influence/strategies/nudge.ts
function applyNudge(results, context) {
	const delta = context.direction === "better" ? context.nudgeValue : -context.nudgeValue;
	results.filter((r) => r.active).forEach((r) => {
		r.result = Math.max(1, Math.min(context.faces, r.result + delta));
	});
	return { nudgeDelta: delta };
}
//#endregion
//#region src/influence/strategies/threshold.ts
function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function applyThreshold(results, context) {
	const thresholdValue = Math.ceil(context.faces * (context.thresholdPercent / 100));
	let triggered = false;
	let reroll;
	results.filter((r) => r.active).forEach((r) => {
		if (context.direction === "better" ? r.result <= thresholdValue : r.result > context.faces - thresholdValue) {
			triggered = true;
			reroll = randomInt(1, context.faces);
			r.result = context.direction === "better" ? Math.max(r.result, reroll) : Math.min(r.result, reroll);
		}
	});
	return {
		thresholdValue,
		thresholdReroll: reroll,
		thresholdTriggered: triggered
	};
}
//#endregion
//#region src/influence/strategies/index.ts
function resolveDirection(state, positiveDirection) {
	if (state === "off") return null;
	if (positiveDirection === "lower") return state === "better" ? "worse" : "better";
	return state;
}
function applyStrategy(strategy, results, context) {
	switch (strategy) {
		case "full":
			applyFull(results, context);
			return {};
		case "bias": return applyBias(results, context);
		case "nudge": return applyNudge(results, context);
		case "threshold": return applyThreshold(results, context);
		default: return {};
	}
}
//#endregion
//#region src/influence/bad-luck.ts
/**
 * Kötü şans koruması: bir oyuncu art arda belirli sayıda kötü d20 atarsa
 * (doğal sonuç eşiğe eşit ya da altında) sonraki d20 zarı bir kez Bias ile atılır:
 * ikinci bir d20 atılır, yüksek olan tutulur. Yalnızca oyuncular için ve yalnızca
 * etkin durum Off iken çalışır; GM'in verdiği Better/Worse her zaman önceliklidir.
 * Seri, zarı değerlendiren istemcinin belleğinde tutulur (sayfa yenilenince sıfırlanır).
 */
var badLuckStreaks = /* @__PURE__ */ new Map();
function getBadLuckConfig() {
	return {
		enabled: Boolean(s$1().get(MODULE_ID, "badLuckEnabled")),
		threshold: Number(s$1().get(MODULE_ID, "badLuckThreshold") ?? 5),
		streak: Number(s$1().get(MODULE_ID, "badLuckStreak") ?? 3)
	};
}
function getBadLuckEntry(userId) {
	let entry = badLuckStreaks.get(userId);
	if (!entry) {
		entry = { streak: 0, pending: false };
		badLuckStreaks.set(userId, entry);
	}
	return entry;
}
function isBadLuckCandidate(controllerUserId, state) {
	if (state !== "off" || typeof controllerUserId !== "string") return false;
	if (!getBadLuckConfig().enabled) return false;
	const user = game.users?.get?.(controllerUserId);
	return Boolean(user && !user.isGM);
}
function isBadLuckProtectionPending(controllerUserId, state) {
	return isBadLuckCandidate(controllerUserId, state) && getBadLuckEntry(controllerUserId).pending;
}
/** Roll değerlendirildikten sonra seriyi günceller; korunan bir zar seriyi ve korumayı sıfırlar. */
function recordBadLuckRoll(roll, controllerUserId, state) {
	if (!isBadLuckCandidate(controllerUserId, state)) return;
	const d20Terms = (roll.terms ?? []).filter((term) => term?.faces === 20 && Array.isArray(term.results));
	if (d20Terms.length === 0) return;
	const entry = getBadLuckEntry(controllerUserId);
	if (d20Terms.some((term) => term._diceMasterBadLuck)) {
		entry.streak = 0;
		entry.pending = false;
		return;
	}
	const kept = d20Terms.flatMap((term) => term.results.filter((r) => r.active !== false).map((r) => r.result));
	if (kept.length === 0) return;
	const { threshold, streak } = getBadLuckConfig();
	if (Math.max(...kept) <= threshold) {
		entry.streak += 1;
		if (entry.streak >= streak) entry.pending = true;
	} else entry.streak = 0;
}
//#endregion
//#region src/influence/patch.ts
function getDieType(faces) {
	const key = `d${faces}`;
	return [
		"d4",
		"d6",
		"d8",
		"d10",
		"d12",
		"d20",
		"d100"
	].includes(key) ? key : null;
}
function applyPendingAdvantageSelection(die) {
	const expansion = die.options?.pending?.advantage;
	if (!expansion) return null;
	const modifierIndex = die.modifiers.findIndex((modifier) => /^(adv|dis)\d*/i.test(modifier));
	if (modifierIndex < 0) return null;
	const modifier = die.modifiers.splice(modifierIndex, 1)[0];
	const count = Number(expansion.count);
	const size = Number(expansion.size);
	if (!Number.isInteger(count) || count < 1 || !Number.isInteger(size) || size < 1) {
		die.modifiers.splice(modifierIndex, 0, modifier);
		return null;
	}
	const sets = Array(count + 1);
	let targetTotal = expansion.adv ? -Infinity : Infinity;
	for (const index of sets.keys()) {
		const startIndex = size * index;
		const results = die.results.slice(startIndex, startIndex + size);
		if (results.length !== size) {
			die.modifiers.splice(modifierIndex, 0, modifier);
			return null;
		}
		const total = results.reduce((sum, result) => sum + result.result, 0);
		sets[index] = { results, total };
		targetTotal = Math[expansion.adv ? "max" : "min"](targetTotal, total);
	}
	sets.forEach((set) => set.results.forEach((result) => {
		result.active = true;
		delete result.discarded;
	}));
	let kept = false;
	for (const set of sets) {
		if (!kept && set.total === targetTotal) {
			kept = true;
			continue;
		}
		set.results.forEach((result) => {
			result.discarded = true;
			result.active = false;
		});
	}
	delete die.options.pending.advantage;
	return modifier.toLowerCase();
}
function repairPendingAdvantageSelection(die) {
	const expansion = die.options?.pending?.advantage;
	if (!expansion) return null;
	const fallbackModifier = `${expansion.adv ? "adv" : "dis"}${expansion.adv && expansion.count > 1 ? expansion.count : ""}`;
	die.modifiers.unshift(fallbackModifier);
	const repairedModifier = applyPendingAdvantageSelection(die);
	if (!repairedModifier) {
		const fallbackIndex = die.modifiers.indexOf(fallbackModifier);
		if (fallbackIndex >= 0) die.modifiers.splice(fallbackIndex, 1);
		return null;
	}
	if (!expansion.adv) {
		const erroneousDropIndex = die.modifiers.indexOf("d");
		if (erroneousDropIndex >= 0) die.modifiers.splice(erroneousDropIndex, 1);
	}
	return repairedModifier;
}
var pendingInfluencedRoll = false;
var pendingDebugInfo = [];
function consumePendingInfluencedRoll() {
	if (!pendingInfluencedRoll) return false;
	pendingInfluencedRoll = false;
	return true;
}
function consumePendingDebugInfo() {
	const info = pendingDebugInfo;
	pendingDebugInfo = [];
	return info;
}
var installedWrappers = new Set();
/**
 * Wrap a method with libWrapper when it is active, so Dice Master chains with Midi-QOL
 * and other roll modules; otherwise patch the method directly. Each target is installed once.
 */
function installWrapper(owner, targetPath, method, wrapper) {
	const target = `${targetPath}.${method}`;
	if (installedWrappers.has(target)) return;
	if (globalThis.libWrapper?.register) {
		globalThis.libWrapper.register(MODULE_ID, target, wrapper, "WRAPPER");
		installedWrappers.add(target);
		return;
	}
	const original = owner?.[method];
	if (typeof original !== "function" || original._diceMasterPatched) return;
	const patched = function(...args) {
		return wrapper.call(this, (...wrappedArgs) => original.apply(this, wrappedArgs), ...args);
	};
	Object.defineProperty(patched, "_diceMasterPatched", { value: true });
	owner[method] = patched;
	installedWrappers.add(target);
}
function patchRollEvaluate() {
	installWrapper(foundry.dice.terms.Die.prototype, "foundry.dice.terms.Die.prototype", "roll", async function patchedRoll(wrapped, options) {
		const result = await wrapped(options);
		const controllerUserId = dieControllerUserIds.get(this) ?? getLocalControllerUserId();
		const config = getInfluenceConfig(controllerUserId);
		const { faces } = this;
		if (!faces) return result;
		const dieType = getDieType(faces);
		if (!dieType || !isDieAffected(dieType)) return result;
		const originalResult = result.result;
		if (config.state === "off") {
			if (dieType !== "d20" || !isBadLuckProtectionPending(controllerUserId, config.state)) return result;
			const badLuckDirection = resolveDirection("better", getPositiveDirection(dieType));
			const debug = applyBias([result], { state: "better", direction: badLuckDirection, faces, biasBetterLimit: 0, biasWorseLimit: 0 });
			this._diceMasterBadLuck = true;
			this._diceMasterInfluenced = true;
			this._diceMasterDirection = "better";
			if (config.debugMode) {
				if (!this._diceMasterDebug) this._diceMasterDebug = [];
				this._diceMasterDebug.push({
					dieType,
					faces,
					strategy: "badLuck",
					state: "better",
					controller: getControllerLabel(controllerUserId),
					controllerTrace: dieControllerTraces.get(this) ?? `local-die->${controllerUserId ?? "unknown"}`,
					direction: badLuckDirection,
					originalResult,
					finalResult: result.result,
					...debug
				});
			}
			return result;
		}
		const positiveDirection = getPositiveDirection(dieType);
		const direction = resolveDirection(config.state, positiveDirection);
		if (!direction) return result;
		const context = {
			state: config.state,
			direction,
			faces,
			nudgeValue: getNudgeValue(dieType),
			biasBetterLimit: getBiasLimit(dieType, "better"),
			biasWorseLimit: getBiasLimit(dieType, "worse"),
			thresholdPercent: config.thresholdPercent
		};
		const debug = applyStrategy(config.strategy, [result], context);
		this._diceMasterInfluenced = true;
		this._diceMasterDirection = config.state;
		if (config.debugMode) {
			const info = {
				dieType,
				faces,
				strategy: config.strategy,
				state: config.state,
				controller: getControllerLabel(controllerUserId),
				controllerTrace: dieControllerTraces.get(this) ?? `local-die->${controllerUserId ?? "unknown"}`,
				direction,
				originalResult,
				finalResult: result.result,
				...debug
			};
			if (!this._diceMasterDebug) this._diceMasterDebug = [];
			this._diceMasterDebug.push(info);
		}
		return result;
	});
	installWrapper(foundry.dice.terms.Die.prototype, "foundry.dice.terms.Die.prototype", "_evaluateModifiers", async function patchedEvaluateModifiers(wrapped, ...args) {
		let advantageModifier = applyPendingAdvantageSelection(this);
		const evaluated = await wrapped(...args);
		advantageModifier ??= repairPendingAdvantageSelection(this);
		if (advantageModifier) this.modifiers.unshift(advantageModifier);
		return evaluated;
	});
	installWrapper(Roll.prototype, "Roll.prototype", "evaluate", async function patchedEvaluate(wrapped, options) {
		const controllerUserId = rollControllerUserIds.get(this) ?? getLocalControllerUserId();
		const source = rollControllerTraces.get(this) ?? `local-roll:${this.id ?? this._id ?? "anonymous"}`;
		if (controllerUserId) bindRollController(this, controllerUserId, source);
		const result = await wrapped(options);
		const config = getInfluenceConfig(controllerUserId);
		recordBadLuckRoll(result, controllerUserId, config.state);
		if (!config.explicitMode && !config.debugMode) return result;
		if (!result.terms.some((term) => term._diceMasterInfluenced)) return result;
		if (config.explicitMode) {
			result.options.diceMasterInfluenced = true;
			result.options.diceMasterDirection = result.terms.some((term) => term._diceMasterBadLuck) ? "better" : config.state;
			pendingInfluencedRoll = true;
		}
		if (config.debugMode) {
			const debugInfo = result.terms.flatMap((term) => term._diceMasterDebug ?? []);
			if (debugInfo.length > 0) {
				result.options.diceMasterDebug = debugInfo;
				pendingDebugInfo.push(...debugInfo);
			}
		}
		return result;
	});
}
//#endregion
//#region src/ui/widget.ts
var STATES = [
	"off",
	"better",
	"worse"
];
var PLAYER_STATES = [
	"inherit",
	"off",
	"better",
	"worse"
];
var STATE_LABELS = {
	inherit: "↳",
	off: "○",
	better: "▲",
	worse: "▼"
};
var PRESETS = [
	{ id: "normal", label: "DICE_MASTER.widget.preset.normal", players: "off", gm: "off" },
	{ id: "helpPlayers", label: "DICE_MASTER.widget.preset.helpPlayers", players: "better", gm: "off" },
	{ id: "boostGm", label: "DICE_MASTER.widget.preset.boostGm", players: "off", gm: "better" },
	{ id: "hardMode", label: "DICE_MASTER.widget.preset.hardMode", players: "worse", gm: "better" }
];
var s = () => game.settings;
var widget;
var playersContainer;
var playerRows = /* @__PURE__ */ new Map();
var localState = {
	influenceStatePlayers: "off",
	influenceStateGm: "off"
};
var playerOverrides = {};
function hasActiveOverride() {
	return Object.values(playerOverrides).some((state) => state === "better" || state === "worse");
}
function getWidgetStateClass() {
	const { influenceStatePlayers: players, influenceStateGm: gm } = localState;
	if (players !== "off") return `dice-master--${players}`;
	if (hasActiveOverride()) {
		const firstActive = Object.values(playerOverrides).find((state) => state === "better" || state === "worse");
		if (firstActive) return `dice-master--${firstActive}`;
	}
	if (gm !== "off") return `dice-master--${gm}`;
	return "dice-master--off";
}
function updateWidgetClass() {
	if (!widget) return;
	widget.className = `dice-master ${getWidgetStateClass()}`;
}
function getStateTitle(state) {
	return game.i18n.localize(`DICE_MASTER.widget.${state}`);
}
function getEffectivePlayerState(userId) {
	const override = playerOverrides[userId] ?? "inherit";
	return override === "inherit" ? localState.influenceStatePlayers : override;
}
function updatePlayerRowEffective(userId) {
	const row = playerRows.get(userId);
	if (!row) return;
	const state = getEffectivePlayerState(userId);
	row.dataset.effectiveState = state;
	const badge = row.querySelector(".dice-master__effective");
	if (!badge) return;
	badge.textContent = STATE_LABELS[state];
	badge.title = game.i18n.format("DICE_MASTER.widget.effective", { state: getStateTitle(state) });
}
function refreshWidgetControls() {
	if (!widget) return;
	for (const row of widget.querySelectorAll("[data-setting-key]")) {
		const state = localState[row.dataset.settingKey];
		for (const button of row.querySelectorAll("[data-state]")) button.classList.toggle("dice-master__btn--active", button.dataset.state === state);
	}
	for (const [userId, row] of playerRows) {
		const state = playerOverrides[userId] ?? "inherit";
		for (const button of row.querySelectorAll("[data-state]")) button.classList.toggle("dice-master__btn--active", button.dataset.state === state);
		updatePlayerRowEffective(userId);
	}
	updateWidgetClass();
}
function toggleWidget() {
	if (!game.user?.isGM) return;
	if (!widget?.isConnected) {
		renderWidget();
		return;
	}
	widget.hidden = !widget.hidden;
}
function registerToolbarButton() {
	Hooks.on("getSceneControlButtons", (controls) => {
		if (!game.user?.isGM) return;
		const tool = {
			name: "dice-master-controls",
			title: game.i18n.localize("DICE_MASTER.widget.toolbar"),
			icon: "fas fa-dice-d20",
			button: true,
			visible: true,
			onClick: () => toggleWidget()
		};
		if (!Array.isArray(controls)) {
			const tokenControl = controls.tokens || controls.token || Object.values(controls)[0];
			if (!tokenControl) return;
			tokenControl.tools = tokenControl.tools || {};
			if (Array.isArray(tokenControl.tools)) {
				if (!tokenControl.tools.some((existing) => existing.name === tool.name)) tokenControl.tools.push(tool);
			} else {
				tokenControl.tools[tool.name] = tool;
			}
			return;
		}
		const tokenControl = controls.find((control) => control.name === "tokens" || control.name === "token") || controls[0];
		if (!tokenControl) return;
		tokenControl.tools = tokenControl.tools || [];
		if (Array.isArray(tokenControl.tools)) {
			if (!tokenControl.tools.some((existing) => existing.name === tool.name)) tokenControl.tools.push(tool);
		} else {
			tokenControl.tools[tool.name] = tool;
		}
	});
}
function createToggleRow(label, settingKey, currentState) {
	const row = document.createElement("div");
	row.classList.add("dice-master__row");
	row.dataset.settingKey = settingKey;
	const rowLabel = document.createElement("span");
	rowLabel.classList.add("dice-master__label");
	rowLabel.textContent = label;
	row.appendChild(rowLabel);
	const buttons = document.createElement("div");
	buttons.classList.add("dice-master__buttons");
	STATES.forEach((state) => {
		const btn = document.createElement("button");
		btn.classList.add("dice-master__btn", `dice-master__btn--${state}`);
		btn.dataset.state = state;
		if (state === currentState) btn.classList.add("dice-master__btn--active");
		btn.textContent = STATE_LABELS[state];
		btn.title = getStateTitle(state);
		btn.addEventListener("click", async () => {
			localState[settingKey] = state;
			buttons.querySelectorAll(".dice-master__btn").forEach((b) => b.classList.remove("dice-master__btn--active"));
			btn.classList.add("dice-master__btn--active");
			updateWidgetClass();
			if (settingKey === "influenceStatePlayers") for (const userId of playerRows.keys()) updatePlayerRowEffective(userId);
			await s().set(MODULE_ID, settingKey, state);
			broadcastInfluenceStateSnapshot();
		});
		buttons.appendChild(btn);
	});
	row.appendChild(buttons);
	return row;
}
async function savePlayerOverrides() {
	await s().set(MODULE_ID, "influenceStatePlayerOverrides", { ...playerOverrides });
	broadcastInfluenceStateSnapshot();
}
function createPlayerRow(user, userId) {
	const row = document.createElement("div");
	row.classList.add("dice-master__row", "dice-master__row--player");
	row.dataset.userId = userId;
	const rowLabel = document.createElement("span");
	rowLabel.classList.add("dice-master__label");
	const name = document.createElement("span");
	name.textContent = user.name;
	rowLabel.appendChild(name);
	const effective = document.createElement("span");
	effective.classList.add("dice-master__effective");
	rowLabel.appendChild(effective);
	row.appendChild(rowLabel);
	const buttons = document.createElement("div");
	buttons.classList.add("dice-master__buttons");
	const currentState = playerOverrides[userId] ?? "inherit";
	PLAYER_STATES.forEach((state) => {
		const btn = document.createElement("button");
		btn.classList.add("dice-master__btn", `dice-master__btn--${state}`);
		btn.dataset.state = state;
		if (state === currentState) btn.classList.add("dice-master__btn--active");
		btn.textContent = STATE_LABELS[state];
		btn.title = getStateTitle(state);
		btn.addEventListener("click", async () => {
			playerOverrides[userId] = state;
			buttons.querySelectorAll(".dice-master__btn").forEach((b) => b.classList.remove("dice-master__btn--active"));
			btn.classList.add("dice-master__btn--active");
			updateWidgetClass();
			updatePlayerRowEffective(userId);
			await savePlayerOverrides();
		});
		buttons.appendChild(btn);
	});
	row.appendChild(buttons);
	return row;
}
function addPlayerToWidget(user) {
	if (user.isGM) return;
	const userId = user.id;
	if (!userId) return;
	if (playerRows.has(userId)) return;
	const row = createPlayerRow(user, userId);
	playerRows.set(userId, row);
	playersContainer.appendChild(row);
	updatePlayerRowEffective(userId);
}
function removePlayerFromWidget(userId) {
	const row = playerRows.get(userId);
	if (!row) return;
	row.remove();
	playerRows.delete(userId);
	updateWidgetClass();
}
async function applyPreset(presetId) {
	const preset = PRESETS.find((entry) => entry.id === presetId);
	if (!preset || !(game.user?.isGM ?? false)) return;
	localState.influenceStatePlayers = preset.players;
	localState.influenceStateGm = preset.gm;
	playerOverrides = {};
	await s().set(MODULE_ID, "influenceStatePlayers", preset.players);
	await s().set(MODULE_ID, "influenceStateGm", preset.gm);
	await s().set(MODULE_ID, "influenceStatePlayerOverrides", {});
	applyInfluenceStateSnapshot(readInfluenceStateSnapshot());
	refreshWidgetControls();
	broadcastInfluenceStateSnapshot();
}
function createPresetControls() {
	const section = document.createElement("div");
	section.classList.add("dice-master__section", "dice-master__presets");
	const heading = document.createElement("div");
	heading.classList.add("dice-master__section-title");
	heading.textContent = game.i18n.localize("DICE_MASTER.widget.presets");
	section.appendChild(heading);
	const buttons = document.createElement("div");
	buttons.classList.add("dice-master__preset-buttons");
	for (const preset of PRESETS) {
		const button = document.createElement("button");
		button.classList.add("dice-master__preset");
		button.dataset.preset = preset.id;
		button.textContent = game.i18n.localize(preset.label);
		button.addEventListener("click", () => applyPreset(preset.id));
		buttons.appendChild(button);
	}
	section.appendChild(buttons);
	return section;
}
function makeDraggable(element, handle) {
	let isDragging = false;
	let offsetX = 0;
	let offsetY = 0;
	handle.addEventListener("mousedown", (e) => {
		isDragging = true;
		offsetX = e.clientX - element.offsetLeft;
		offsetY = e.clientY - element.offsetTop;
		e.preventDefault();
	});
	document.addEventListener("mousemove", (e) => {
		if (!isDragging) return;
		element.style.left = `${e.clientX - offsetX}px`;
		element.style.top = `${e.clientY - offsetY}px`;
	});
	document.addEventListener("mouseup", () => {
		if (!isDragging) return;
		isDragging = false;
		s().set(MODULE_ID, "widgetPosition", {
			top: element.offsetTop,
			left: element.offsetLeft
		});
	});
}
function renderWidget() {
	if (!game.user?.isGM) return;
	if (widget?.isConnected) {
		widget.hidden = false;
		return;
	}
	localState.influenceStatePlayers = s().get(MODULE_ID, "influenceStatePlayers");
	localState.influenceStateGm = s().get(MODULE_ID, "influenceStateGm");
	const savedOverrides = s().get(MODULE_ID, "influenceStatePlayerOverrides");
	playerOverrides = { ...savedOverrides };
	playerRows.clear();
	widget = document.createElement("div");
	widget.classList.add("dice-master", getWidgetStateClass());
	const position = s().get(MODULE_ID, "widgetPosition");
	widget.style.top = `${position.top}px`;
	widget.style.left = `${position.left}px`;
	const header = document.createElement("div");
	header.classList.add("dice-master__header");
	const title = document.createElement("span");
	title.classList.add("dice-master__title");
	title.textContent = game.i18n.localize("DICE_MASTER.widget.title");
	header.appendChild(title);
	const headerActions = document.createElement("div");
	headerActions.classList.add("dice-master__header-actions");
	const reset = document.createElement("button");
	reset.classList.add("dice-master__gear");
	const resetIcon = document.createElement("i");
	resetIcon.className = "fas fa-rotate-left";
	reset.appendChild(resetIcon);
	reset.title = game.i18n.localize("DICE_MASTER.widget.resetAll");
	reset.addEventListener("click", () => applyPreset("normal"));
	headerActions.appendChild(reset);
	const gear = document.createElement("button");
	gear.classList.add("dice-master__gear");
	const gearIcon = document.createElement("i");
	gearIcon.className = "fas fa-cog";
	gear.appendChild(gearIcon);
	gear.title = game.i18n.localize("DICE_MASTER.widget.diceSettings");
	gear.addEventListener("click", () => {
		new foundry.applications.settings.SettingsConfig({ initialCategory: MODULE_ID }).render(true);
	});
	headerActions.appendChild(gear);
	header.appendChild(headerActions);
	widget.appendChild(header);
	widget.appendChild(createPresetControls());
	widget.appendChild(createToggleRow(game.i18n.localize("DICE_MASTER.widget.players"), "influenceStatePlayers", localState.influenceStatePlayers));
	playersContainer = document.createElement("div");
	playersContainer.classList.add("dice-master__players");
	widget.appendChild(playersContainer);
	game.users?.forEach((user) => {
		if (!user.isGM && user.active) addPlayerToWidget(user);
	});
	widget.appendChild(createToggleRow(game.i18n.localize("DICE_MASTER.widget.gm"), "influenceStateGm", localState.influenceStateGm));
	makeDraggable(widget, header);
	document.body.appendChild(widget);
	refreshWidgetControls();
	Hooks.on("userConnected", (user, connected) => {
		if (user.isGM) return;
		const userId = user.id;
		if (!userId) return;
		if (connected) addPlayerToWidget(user);
		else removePlayerFromWidget(userId);
	});
}
//#endregion
//#region src/integrations/dice-so-nice.ts
var INFLUENCE_COLORS = {
	better: {
		colorset: "custom",
		labelColor: "#ffffff",
		diceColor: "#27ae60",
		outlineColor: "#2ecc71",
		edgeColor: "#1e8449"
	},
	worse: {
		colorset: "custom",
		labelColor: "#ffffff",
		diceColor: "#c0392b",
		outlineColor: "#e74c3c",
		edgeColor: "#922b21"
	}
};
function onDsnRollStart(_messageId, context) {
	const { roll } = context;
	if (!roll) return;
	const opts = roll.options;
	if (!(opts?.diceMasterInfluenced)) return;
	const colors = INFLUENCE_COLORS[opts.diceMasterDirection];
	if (!colors) return;
	const explicitMode = game.settings.get(MODULE_ID, "explicitMode");
	const isGm = game.user?.isGM ?? false;
	if (!explicitMode && !isGm) return;
	roll.options.appearance = colors;
}
function initDiceSoNice() {
	if (!(game.modules?.get("dice-so-nice"))?.active) return;
	Hooks.on("diceSoNiceRollStart", onDsnRollStart);
}
//#endregion
//#region src/influence/debug-message.ts
function formatSigned(n) {
	return n >= 0 ? `+${n}` : `${n}`;
}
function escapeHtml(value) {
	return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function formatModifier(info) {
	const t = (key, data) => game.i18n.format(key, data);
	switch (info.strategy) {
		case "full": return t("DICE_MASTER.debug.modifier.full", {
			direction: info.direction,
			value: String(info.finalResult)
		});
		case "bias": {
			const numericDirection = info.direction === "better" ? "higher" : "lower";
			return t("DICE_MASTER.debug.modifier.bias", {
				second: String(info.biasSecondRoll ?? "?"),
				state: String(info.state ?? "?"),
				controller: String(info.controller ?? "?"),
				trace: String(info.controllerTrace ?? "none"),
				limit: info.biasLimit > 0 ? String(info.biasLimit) : "off",
				direction: game.i18n.localize(`DICE_MASTER.debug.direction.${numericDirection}`)
			});
		}
		case "badLuck": return t("DICE_MASTER.debug.modifier.badLuck", {
			second: String(info.biasSecondRoll ?? "?"),
			controller: String(info.controller ?? "?")
		});
		case "nudge": return t("DICE_MASTER.debug.modifier.nudge", { delta: formatSigned(info.nudgeDelta ?? 0) });
		case "threshold":
			if (!info.thresholdTriggered) return t("DICE_MASTER.debug.modifier.thresholdSkipped", { threshold: String(info.thresholdValue ?? "?") });
			return t("DICE_MASTER.debug.modifier.threshold", {
				threshold: String(info.thresholdValue ?? "?"),
				reroll: String(info.thresholdReroll ?? "?")
			});
		default: return "";
	}
}
function renderDebugMessage(entries) {
	return `<div class="dice-master-debug"><strong>${escapeHtml(game.i18n.localize("DICE_MASTER.debug.title"))} v${escapeHtml(MODULE_VERSION)}</strong><ul>${entries.map((info) => {
		const modifier = formatModifier(info);
		const { dieType, originalResult, finalResult } = info;
		return `<li><strong>${escapeHtml(dieType)}</strong>: ${escapeHtml(originalResult)} → [${escapeHtml(modifier)}] → <strong>${escapeHtml(finalResult)}</strong></li>`;
	}).join("")}</ul></div>`;
}
//#endregion
//#region src/main.ts
function getActiveGmIds() {
	return (game.users?.contents ?? []).filter((u) => u.isGM && u.active).map((u) => u.id).filter((id) => typeof id === "string");
}
function captureActivityCardAuthor(message) {
	if (!(game.user?.isGM ?? false)) return;
	if ((message.rolls?.length ?? 0) > 0) return;
	const hasActivity = Boolean(message.flags?.dnd5e?.activity?.uuid ?? message.flags?.dnd5e?.activity?.id);
	const isMidiCard = Boolean(message.flags?.["midi-qol"]?.messageType) || String(message.content ?? "").includes("midi-chat-card");
	if (!hasActivity && !isMidiCard) return;
	const author = message?.author;
	if (!author?.id) return;
	const source = `activity-card-author:${message.id ?? "new"}`;
	rememberWorkflowController(null, message, author.id, source);
	if (author.isGM) {
		pendingRollController = null;
		lastRollControllerTrace = `${source}->GM`;
		return;
	}
	pendingRollController = {
		userId: author.id,
		expiresAt: Date.now() + 15e3,
		remote: true
	};
	lastRollControllerTrace = `${source}->${author.id}`;
}
registerToolbarButton();
Hooks.once("socketlib.ready", initSocketlibIntegration);
Hooks.once("init", () => {
	registerSettings();
	registerRollControllerHooks();
	patchRollEvaluate();
	patchDnd5eBuildEvaluate();
	Hooks.on("chatMessage", (_chatLog, _message, chatData) => {
		const userId = chatData?.user ?? game.user?.id;
		if (typeof userId !== "string") return;
		const user = game.users?.get?.(userId);
		if (!user || user.isGM) return;
		pendingRollController = { userId, expiresAt: Date.now() + 5e3, remote: false };
		lastRollControllerTrace = `chat-hook->${userId}`;
	});
});
Hooks.once("ready", async () => {
	await migrateLegacySettingKeys();
	await migratePlayerOverrideState();
	patchDnd5eBuildEvaluate();
	initSocketlibIntegration();
	initInfluenceStateSync();
	initSocketActivityCapture();
	initRollIntentRelay();
	initDiceSoNice();
});
Hooks.on("createChatMessage", captureActivityCardAuthor);
Hooks.on("createChatMessage", (message) => {
	if (!game.user?.isGM) return;
	const explicitMode = game.settings.get(MODULE_ID, "explicitMode");
	const debugMode = game.settings.get(MODULE_ID, "debugMode");
	if (!explicitMode && !debugMode) return;
	const hasRollFlag = message.rolls?.some((r) => r.options?.diceMasterInfluenced);
	const hasPendingFlag = consumePendingInfluencedRoll();
	const rollDebug = message.rolls?.flatMap((r) => r.options?.diceMasterDebug ?? []) ?? [];
	const pendingDebug = consumePendingDebugInfo();
	const debugInfo = rollDebug.length > 0 ? rollDebug : pendingDebug;
	if (!(hasRollFlag || hasPendingFlag || debugInfo.length > 0)) return;
	const speaker = { alias: game.i18n.localize("DICE_MASTER.explicit.speaker") };
	if (explicitMode) ChatMessage.create({
		content: `<em>${game.i18n.localize("DICE_MASTER.explicit.message")}</em>`,
		speaker
	});
	if (debugMode && debugInfo.length > 0) {
		const gmIds = getActiveGmIds();
		if (gmIds.length === 0) return;
		ChatMessage.create({
			content: renderDebugMessage(debugInfo),
			speaker,
			whisper: gmIds
		});
	}
});
//#endregion
