/**
 * Kötü şans koruması: bir oyuncu art arda belirli sayıda kötü d20 atarsa
 * (doğal sonuç eşiğe eşit ya da altında) sonraki d20 zarı bir kez Bias ile atılır:
 * ikinci bir d20 atılır, yüksek olan tutulur. Yalnızca oyuncular için ve yalnızca
 * etkin durum Off iken çalışır; GM'in verdiği Better/Worse her zaman önceliklidir.
 * Seri, zarı değerlendiren istemcinin belleğinde tutulur (sayfa yenilenince sıfırlanır).
 */
var badLuckStreaks = /* @__PURE__ */ new Map();
function getBadLuckConfig() {
	return {
		enabled: Boolean(s$1().get(MODULE_ID, "badLuckEnabled")),
		threshold: Number(s$1().get(MODULE_ID, "badLuckThreshold") ?? 5),
		streak: Number(s$1().get(MODULE_ID, "badLuckStreak") ?? 3)
	};
}
function getBadLuckEntry(userId) {
	let entry = badLuckStreaks.get(userId);
	if (!entry) {
		entry = { streak: 0, pending: false };
		badLuckStreaks.set(userId, entry);
	}
	return entry;
}
function isBadLuckCandidate(controllerUserId, state) {
	if (state !== "off" || typeof controllerUserId !== "string") return false;
	if (!getBadLuckConfig().enabled) return false;
	const user = game.users?.get?.(controllerUserId);
	return Boolean(user && !user.isGM);
}
function isBadLuckProtectionPending(controllerUserId, state) {
	return isBadLuckCandidate(controllerUserId, state) && getBadLuckEntry(controllerUserId).pending;
}
/** Roll değerlendirildikten sonra seriyi günceller; korunan bir zar seriyi ve korumayı sıfırlar. */
function recordBadLuckRoll(roll, controllerUserId, state) {
	if (!isBadLuckCandidate(controllerUserId, state)) return;
	const d20Terms = (roll.terms ?? []).filter((term) => term?.faces === 20 && Array.isArray(term.results));
	if (d20Terms.length === 0) return;
	const entry = getBadLuckEntry(controllerUserId);
	if (d20Terms.some((term) => term._diceMasterBadLuck)) {
		entry.streak = 0;
		entry.pending = false;
		return;
	}
	const kept = d20Terms.flatMap((term) => term.results.filter((r) => r.active !== false).map((r) => r.result));
	if (kept.length === 0) return;
	const { threshold, streak } = getBadLuckConfig();
	if (Math.max(...kept) <= threshold) {
		entry.streak += 1;
		if (entry.streak >= streak) entry.pending = true;
	} else entry.streak = 0;
}
