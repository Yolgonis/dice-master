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
