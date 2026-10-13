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
	await migratePlayerOverrideState();
	patchDnd5eBuildEvaluate();
	initSocketlibIntegration();
	initCheatStateSync();
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
	const hasRollFlag = message.rolls?.some((r) => r.options?.diceMasterInfluenced ?? r.options?.fumbleSwitchCheated);
	const hasPendingFlag = consumePendingCheatedRoll();
	const rollDebug = message.rolls?.flatMap((r) => r.options?.diceMasterDebug ?? r.options?.fumbleSwitchDebug ?? []) ?? [];
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
