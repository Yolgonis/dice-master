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
