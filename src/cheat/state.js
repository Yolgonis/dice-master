var s$1 = () => game.settings;
var syncedCheatState = null;
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
function readCheatStateSnapshot() {
	return {
		players: s$1().get(MODULE_ID, "cheatStatePlayers"),
		gm: s$1().get(MODULE_ID, "cheatStateGm"),
		playerOverrides: { ...s$1().get(MODULE_ID, "cheatStatePlayerOverrides") }
	};
}
function isCheatState(value) {
	return value === "off" || value === "better" || value === "worse";
}
function isPlayerOverrideState(value) {
	return value === "inherit" || isCheatState(value);
}
function normalizeCheatStateSnapshot(snapshot) {
	if (!snapshot || !isCheatState(snapshot.players) || !isCheatState(snapshot.gm)) return null;
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
function applyCheatStateSnapshot(snapshot) {
	const normalized = normalizeCheatStateSnapshot(snapshot);
	if (normalized) syncedCheatState = normalized;
}
function sendCheatStateSnapshot(targetUserId = null) {
	const snapshot = readCheatStateSnapshot();
	applyCheatStateSnapshot(snapshot);
	game.socket?.emit(SOCKET_NAME, {
		type: "cheat-state",
		targetUserId,
		snapshot
	});
}
function broadcastCheatStateSnapshot() {
	sendCheatStateSnapshot();
}
function isAuthorizedCheatStateSender(senderId) {
	if (typeof senderId !== "string") return false;
	const sender = game.users?.get?.(senderId);
	return Boolean(sender?.isGM && sender.active);
}
function initCheatStateSync() {
	applyCheatStateSnapshot(readCheatStateSnapshot());
	game.socket?.on(SOCKET_NAME, (payload, senderId) => {
		if (payload?.type === "roll-intent") {
			applyRemoteRollIntent({ ...payload, userId: senderId ?? payload.userId }, "raw-socket");
			return;
		}
		if (payload?.type === "roll-controller") {
			applyRemoteRollController({ ...payload, userId: senderId ?? payload.userId }, "raw-socket");
			return;
		}
		if (payload?.type === "request-cheat-state") {
			if (game.user?.isGM && typeof payload.userId === "string") sendCheatStateSnapshot(payload.userId);
			return;
		}
		if (payload?.type !== "cheat-state") return;
		if (!isAuthorizedCheatStateSender(senderId)) return;
		if (payload.targetUserId && payload.targetUserId !== game.user?.id) return;
		applyCheatStateSnapshot(payload.snapshot);
	});
	Hooks.on("updateSetting", (setting) => {
		const key = String(setting?.key ?? "");
		if (!key.startsWith(`${MODULE_ID}.cheatState`)) return;
		applyCheatStateSnapshot(readCheatStateSnapshot());
		if (key === `${MODULE_ID}.cheatStatePlayers`) localState.cheatStatePlayers = s$1().get(MODULE_ID, "cheatStatePlayers");
		if (key === `${MODULE_ID}.cheatStateGm`) localState.cheatStateGm = s$1().get(MODULE_ID, "cheatStateGm");
		if (key === `${MODULE_ID}.cheatStatePlayerOverrides`) playerOverrides = { ...s$1().get(MODULE_ID, "cheatStatePlayerOverrides") };
		refreshWidgetControls();
	});
	if (game.user?.isGM) broadcastCheatStateSnapshot();
	else if (game.user?.id) game.socket?.emit(SOCKET_NAME, {
		type: "request-cheat-state",
		userId: game.user.id
	});
}
function getCheatState(controllerUserId = null) {
	const snapshot = syncedCheatState ?? readCheatStateSnapshot();
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
async function migratePlayerOverrideState() {
	if (!(game.user?.isGM ?? false)) return;
	const schemaVersion = Number(s$1().get(MODULE_ID, "stateSchemaVersion") ?? 0);
	if (schemaVersion >= 2) return;
	const saved = s$1().get(MODULE_ID, "cheatStatePlayerOverrides") ?? {};
	const migrated = {};
	for (const [userId, state] of Object.entries(saved)) {
		migrated[userId] = state === "off" ? "inherit" : isPlayerOverrideState(state) ? state : "inherit";
	}
	await s$1().set(MODULE_ID, "cheatStatePlayerOverrides", migrated);
	await s$1().set(MODULE_ID, "stateSchemaVersion", 2);
	applyCheatStateSnapshot(readCheatStateSnapshot());
}
function getCheatConfig(controllerUserId = null) {
	return {
		state: getCheatState(controllerUserId),
		strategy: s$1().get(MODULE_ID, "cheatStrategy"),
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
	if (typeof originalBuildEvaluate !== "function" || originalBuildEvaluate._fumbleSwitchCustomPatched) return;
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
