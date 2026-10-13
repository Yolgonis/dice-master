function applyFull(results, context) {
	results.filter((r) => r.active).forEach((r) => {
		r.result = context.direction === "better" ? context.faces : 1;
	});
}
