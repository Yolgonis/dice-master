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
