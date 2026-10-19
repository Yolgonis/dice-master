var s$2 = () => game.settings;
function registerSettings() {
	s$2().register(MODULE_ID, "influenceStrategy", {
		name: "DICE_MASTER.settings.influenceStrategy.name",
		hint: "DICE_MASTER.settings.influenceStrategy.hint",
		scope: "world",
		config: true,
		type: String,
		default: "bias",
		choices: {
			full: "DICE_MASTER.settings.influenceStrategy.full",
			bias: "DICE_MASTER.settings.influenceStrategy.bias",
			nudge: "DICE_MASTER.settings.influenceStrategy.nudge",
			threshold: "DICE_MASTER.settings.influenceStrategy.threshold"
		}
	});
	s$2().register(MODULE_ID, "positiveDirection", {
		name: "DICE_MASTER.settings.positiveDirection.name",
		hint: "DICE_MASTER.settings.positiveDirection.hint",
		scope: "world",
		config: true,
		type: String,
		default: "higher",
		choices: {
			higher: "DICE_MASTER.settings.positiveDirection.higher",
			lower: "DICE_MASTER.settings.positiveDirection.lower"
		}
	});
	s$2().register(MODULE_ID, "thresholdPercent", {
		name: "DICE_MASTER.settings.thresholdPercent.name",
		hint: "DICE_MASTER.settings.thresholdPercent.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 25,
		range: {
			min: 1,
			max: 50,
			step: 1
		}
	});
	s$2().register(MODULE_ID, "explicitMode", {
		name: "DICE_MASTER.settings.explicitMode.name",
		hint: "DICE_MASTER.settings.explicitMode.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "debugMode", {
		name: "DICE_MASTER.settings.debugMode.name",
		hint: "DICE_MASTER.settings.debugMode.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "badLuckEnabled", {
		name: "DICE_MASTER.settings.badLuckEnabled.name",
		hint: "DICE_MASTER.settings.badLuckEnabled.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	s$2().register(MODULE_ID, "badLuckThreshold", {
		name: "DICE_MASTER.settings.badLuckThreshold.name",
		hint: "DICE_MASTER.settings.badLuckThreshold.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 5,
		range: {
			min: 1,
			max: 10,
			step: 1
		}
	});
	s$2().register(MODULE_ID, "badLuckStreak", {
		name: "DICE_MASTER.settings.badLuckStreak.name",
		hint: "DICE_MASTER.settings.badLuckStreak.hint",
		scope: "world",
		config: true,
		type: Number,
		default: 3,
		range: {
			min: 2,
			max: 6,
			step: 1
		}
	});
	s$2().registerMenu(MODULE_ID, "diceSettingsMenu", {
		name: "DICE_MASTER.settings.diceSettingsMenu.name",
		label: "DICE_MASTER.settings.diceSettingsMenu.label",
		hint: "DICE_MASTER.settings.diceSettingsMenu.hint",
		icon: "fas fa-dice",
		type: DiceMasterSettingsMenu,
		restricted: true
	});
	s$2().register(MODULE_ID, "positiveDirectionOverrides", {
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});
	s$2().register(MODULE_ID, "nudgeValues", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_NUDGE_VALUES
	});
	s$2().register(MODULE_ID, "biasBetterLimits", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_BIAS_LIMITS
	});
	s$2().register(MODULE_ID, "biasWorseLimits", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_BIAS_LIMITS
	});
	s$2().register(MODULE_ID, "affectedDice", {
		scope: "world",
		config: false,
		type: Object,
		default: DEFAULT_AFFECTED_DICE
	});
	s$2().register(MODULE_ID, "influenceStatePlayers", {
		scope: "world",
		config: false,
		type: String,
		default: "off"
	});
	s$2().register(MODULE_ID, "influenceStateGm", {
		scope: "world",
		config: false,
		type: String,
		default: "off"
	});
	s$2().register(MODULE_ID, "influenceStatePlayerOverrides", {
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});
	s$2().register(MODULE_ID, "stateSchemaVersion", {
		scope: "world",
		config: false,
		type: Number,
		default: 0
	});
	s$2().register(MODULE_ID, "widgetPosition", {
		scope: "client",
		config: false,
		type: Object,
		default: {
			top: 100,
			left: 100
		}
	});
}
