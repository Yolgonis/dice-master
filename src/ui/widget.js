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
	cheatStatePlayers: "off",
	cheatStateGm: "off"
};
var playerOverrides = {};
function hasActiveOverride() {
	return Object.values(playerOverrides).some((state) => state === "better" || state === "worse");
}
function getWidgetStateClass() {
	const { cheatStatePlayers: players, cheatStateGm: gm } = localState;
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
	return override === "inherit" ? localState.cheatStatePlayers : override;
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
			if (settingKey === "cheatStatePlayers") for (const userId of playerRows.keys()) updatePlayerRowEffective(userId);
			await s().set(MODULE_ID, settingKey, state);
			broadcastCheatStateSnapshot();
		});
		buttons.appendChild(btn);
	});
	row.appendChild(buttons);
	return row;
}
async function savePlayerOverrides() {
	await s().set(MODULE_ID, "cheatStatePlayerOverrides", { ...playerOverrides });
	broadcastCheatStateSnapshot();
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
	localState.cheatStatePlayers = preset.players;
	localState.cheatStateGm = preset.gm;
	playerOverrides = {};
	await s().set(MODULE_ID, "cheatStatePlayers", preset.players);
	await s().set(MODULE_ID, "cheatStateGm", preset.gm);
	await s().set(MODULE_ID, "cheatStatePlayerOverrides", {});
	applyCheatStateSnapshot(readCheatStateSnapshot());
	refreshWidgetControls();
	broadcastCheatStateSnapshot();
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
	localState.cheatStatePlayers = s().get(MODULE_ID, "cheatStatePlayers");
	localState.cheatStateGm = s().get(MODULE_ID, "cheatStateGm");
	const savedOverrides = s().get(MODULE_ID, "cheatStatePlayerOverrides");
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
	widget.appendChild(createToggleRow(game.i18n.localize("DICE_MASTER.widget.players"), "cheatStatePlayers", localState.cheatStatePlayers));
	playersContainer = document.createElement("div");
	playersContainer.classList.add("dice-master__players");
	widget.appendChild(playersContainer);
	game.users?.forEach((user) => {
		if (!user.isGM && user.active) addPlayerToWidget(user);
	});
	widget.appendChild(createToggleRow(game.i18n.localize("DICE_MASTER.widget.gm"), "cheatStateGm", localState.cheatStateGm));
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
