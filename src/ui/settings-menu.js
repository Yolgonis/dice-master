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
