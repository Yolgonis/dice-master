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
