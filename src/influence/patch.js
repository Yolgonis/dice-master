function getDieType(faces) {
	const key = `d${faces}`;
	return [
		"d4",
		"d6",
		"d8",
		"d10",
		"d12",
		"d20",
		"d100"
	].includes(key) ? key : null;
}
function applyPendingAdvantageSelection(die) {
	const expansion = die.options?.pending?.advantage;
	if (!expansion) return null;
	const modifierIndex = die.modifiers.findIndex((modifier) => /^(adv|dis)\d*/i.test(modifier));
	if (modifierIndex < 0) return null;
	const modifier = die.modifiers.splice(modifierIndex, 1)[0];
	const count = Number(expansion.count);
	const size = Number(expansion.size);
	if (!Number.isInteger(count) || count < 1 || !Number.isInteger(size) || size < 1) {
		die.modifiers.splice(modifierIndex, 0, modifier);
		return null;
	}
	const sets = Array(count + 1);
	let targetTotal = expansion.adv ? -Infinity : Infinity;
	for (const index of sets.keys()) {
		const startIndex = size * index;
		const results = die.results.slice(startIndex, startIndex + size);
		if (results.length !== size) {
			die.modifiers.splice(modifierIndex, 0, modifier);
			return null;
		}
		const total = results.reduce((sum, result) => sum + result.result, 0);
		sets[index] = { results, total };
		targetTotal = Math[expansion.adv ? "max" : "min"](targetTotal, total);
	}
	sets.forEach((set) => set.results.forEach((result) => {
		result.active = true;
		delete result.discarded;
	}));
	let kept = false;
	for (const set of sets) {
		if (!kept && set.total === targetTotal) {
			kept = true;
			continue;
		}
		set.results.forEach((result) => {
			result.discarded = true;
			result.active = false;
		});
	}
	delete die.options.pending.advantage;
	return modifier.toLowerCase();
}
function repairPendingAdvantageSelection(die) {
	const expansion = die.options?.pending?.advantage;
	if (!expansion) return null;
	const fallbackModifier = `${expansion.adv ? "adv" : "dis"}${expansion.adv && expansion.count > 1 ? expansion.count : ""}`;
	die.modifiers.unshift(fallbackModifier);
	const repairedModifier = applyPendingAdvantageSelection(die);
	if (!repairedModifier) {
		const fallbackIndex = die.modifiers.indexOf(fallbackModifier);
		if (fallbackIndex >= 0) die.modifiers.splice(fallbackIndex, 1);
		return null;
	}
	if (!expansion.adv) {
		const erroneousDropIndex = die.modifiers.indexOf("d");
		if (erroneousDropIndex >= 0) die.modifiers.splice(erroneousDropIndex, 1);
	}
	return repairedModifier;
}
var pendingInfluencedRoll = false;
var pendingDebugInfo = [];
function consumePendingInfluencedRoll() {
	if (!pendingInfluencedRoll) return false;
	pendingInfluencedRoll = false;
	return true;
}
function consumePendingDebugInfo() {
	const info = pendingDebugInfo;
	pendingDebugInfo = [];
	return info;
}
var installedWrappers = new Set();
/**
 * Wrap a method with libWrapper when it is active, so Dice Master chains with Midi-QOL
 * and other roll modules; otherwise patch the method directly. Each target is installed once.
 */
function installWrapper(owner, targetPath, method, wrapper) {
	const target = `${targetPath}.${method}`;
	if (installedWrappers.has(target)) return;
	if (globalThis.libWrapper?.register) {
		globalThis.libWrapper.register(MODULE_ID, target, wrapper, "WRAPPER");
		installedWrappers.add(target);
		return;
	}
	const original = owner?.[method];
	if (typeof original !== "function" || original._diceMasterPatched) return;
	const patched = function(...args) {
		return wrapper.call(this, (...wrappedArgs) => original.apply(this, wrappedArgs), ...args);
	};
	Object.defineProperty(patched, "_diceMasterPatched", { value: true });
	owner[method] = patched;
	installedWrappers.add(target);
}
function patchRollEvaluate() {
	installWrapper(foundry.dice.terms.Die.prototype, "foundry.dice.terms.Die.prototype", "roll", async function patchedRoll(wrapped, options) {
		const result = await wrapped(options);
		const controllerUserId = dieControllerUserIds.get(this) ?? getLocalControllerUserId();
		const config = getInfluenceConfig(controllerUserId);
		const { faces } = this;
		if (!faces) return result;
		const dieType = getDieType(faces);
		if (!dieType || !isDieAffected(dieType)) return result;
		const originalResult = result.result;
		if (config.state === "off") {
			if (dieType !== "d20" || !isBadLuckProtectionPending(controllerUserId, config.state)) return result;
			const badLuckDirection = resolveDirection("better", getPositiveDirection(dieType));
			const debug = applyBias([result], { state: "better", direction: badLuckDirection, faces, biasBetterLimit: 0, biasWorseLimit: 0 });
			this._diceMasterBadLuck = true;
			this._diceMasterInfluenced = true;
			this._diceMasterDirection = "better";
			if (config.debugMode) {
				if (!this._diceMasterDebug) this._diceMasterDebug = [];
				this._diceMasterDebug.push({
					dieType,
					faces,
					strategy: "badLuck",
					state: "better",
					controller: getControllerLabel(controllerUserId),
					controllerTrace: dieControllerTraces.get(this) ?? `local-die->${controllerUserId ?? "unknown"}`,
					direction: badLuckDirection,
					originalResult,
					finalResult: result.result,
					...debug
				});
			}
			return result;
		}
		const positiveDirection = getPositiveDirection(dieType);
		const direction = resolveDirection(config.state, positiveDirection);
		if (!direction) return result;
		const context = {
			state: config.state,
			direction,
			faces,
			nudgeValue: getNudgeValue(dieType),
			biasBetterLimit: getBiasLimit(dieType, "better"),
			biasWorseLimit: getBiasLimit(dieType, "worse"),
			thresholdPercent: config.thresholdPercent
		};
		const debug = applyStrategy(config.strategy, [result], context);
		this._diceMasterInfluenced = true;
		this._diceMasterDirection = config.state;
		if (config.debugMode) {
			const info = {
				dieType,
				faces,
				strategy: config.strategy,
				state: config.state,
				controller: getControllerLabel(controllerUserId),
				controllerTrace: dieControllerTraces.get(this) ?? `local-die->${controllerUserId ?? "unknown"}`,
				direction,
				originalResult,
				finalResult: result.result,
				...debug
			};
			if (!this._diceMasterDebug) this._diceMasterDebug = [];
			this._diceMasterDebug.push(info);
		}
		return result;
	});
	installWrapper(foundry.dice.terms.Die.prototype, "foundry.dice.terms.Die.prototype", "_evaluateModifiers", async function patchedEvaluateModifiers(wrapped, ...args) {
		let advantageModifier = applyPendingAdvantageSelection(this);
		const evaluated = await wrapped(...args);
		advantageModifier ??= repairPendingAdvantageSelection(this);
		if (advantageModifier) this.modifiers.unshift(advantageModifier);
		return evaluated;
	});
	installWrapper(Roll.prototype, "Roll.prototype", "evaluate", async function patchedEvaluate(wrapped, options) {
		const controllerUserId = rollControllerUserIds.get(this) ?? getLocalControllerUserId();
		const source = rollControllerTraces.get(this) ?? `local-roll:${this.id ?? this._id ?? "anonymous"}`;
		if (controllerUserId) bindRollController(this, controllerUserId, source);
		const result = await wrapped(options);
		const config = getInfluenceConfig(controllerUserId);
		recordBadLuckRoll(result, controllerUserId, config.state);
		if (!config.explicitMode && !config.debugMode) return result;
		if (!result.terms.some((term) => term._diceMasterInfluenced)) return result;
		if (config.explicitMode) {
			result.options.diceMasterInfluenced = true;
			result.options.diceMasterDirection = result.terms.some((term) => term._diceMasterBadLuck) ? "better" : config.state;
			pendingInfluencedRoll = true;
		}
		if (config.debugMode) {
			const debugInfo = result.terms.flatMap((term) => term._diceMasterDebug ?? []);
			if (debugInfo.length > 0) {
				result.options.diceMasterDebug = debugInfo;
				pendingDebugInfo.push(...debugInfo);
			}
		}
		return result;
	});
}
