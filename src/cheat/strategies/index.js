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
