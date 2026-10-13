var MODULE_ID = "dice-master";
var MODULE_VERSION = "0.7.0";
var SOCKET_NAME = `module.${MODULE_ID}`;
var socketlibModule = null;
var DIE_TYPES = [
	"d4",
	"d6",
	"d8",
	"d10",
	"d12",
	"d20",
	"d100"
];
var DEFAULT_NUDGE_VALUES = {
	d4: 1,
	d6: 2,
	d8: 2,
	d10: 3,
	d12: 3,
	d20: 4,
	d100: 15
};
var DEFAULT_BIAS_LIMITS = {
	d4: 0,
	d6: 0,
	d8: 0,
	d10: 0,
	d12: 0,
	d20: 0,
	d100: 0
};
var DEFAULT_AFFECTED_DICE = {
	d4: true,
	d6: true,
	d8: true,
	d10: true,
	d12: true,
	d20: true,
	d100: true
};
