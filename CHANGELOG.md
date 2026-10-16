# Changelog

Bu projedeki önemli değişiklikler bu dosyada belgelenir.

## 0.8.0 — 2026-10-16

### Breaking

- 0.7.x geçiş dönemi bitti: `fumbleSwitch*` zar ve roll işaretleri artık yazılmıyor ve okunmuyor; `FumbleSwitchSettingsMenu` alias'ı kaldırıldı. Makro ve entegrasyonlar `diceMasterInfluenced`, `diceMasterDirection` ve `diceMasterDebug` kullanmalı.
- Ayar anahtarları nötr adlara taşındı: `cheatStrategy` → `influenceStrategy`, `cheatStatePlayers` / `cheatStateGm` / `cheatStatePlayerOverrides` → `influenceState*`. Socket mesaj türleri `influence-state` ve `request-influence-state` oldu; bütün istemciler aynı sürümde olmalı.

### Migration

- Aktif GM ilk açılışta eski `cheat*` dünya ayarlarının değerlerini yeni anahtarlara kopyalar ve eski kayıtları siler. Yeni anahtarda zaten bir değer varsa o korunur.

### Maintainability

- `src/cheat/` klasörü `src/influence/` oldu; iç tanımlayıcılardaki "cheat" adları "influence" ile değiştirildi.
- İngilizce ve Lehçe arayüz metinlerinden "cheat" / "oszustwo" ifadeleri kaldırıldı ("Influence Strategy", "Strategia wpływu").

### Testing

- Ayar taşıması ve eski işaretlerin yok sayılması için testler eklendi. Test sayısı 35.

## 0.7.1 — 2026-10-13

### Compatibility

- libWrapper etkinse `Die#roll`, `Die#_evaluateModifiers`, `Roll#evaluate` ve dnd5e `BasicRoll.buildEvaluate` yamaları libWrapper `WRAPPER` zinciri üzerinden kaydedilir; Midi-QOL ve aynı metotları saran diğer zar modülleriyle zincirleme korunur. libWrapper yoksa önceki doğrudan yama davranışı aynen sürer.
- libWrapper isteğe bağlı ilişki olarak manifeste eklendi; doğrulanan Foundry sürümü 13.351.

### Testing

- libWrapper yolu için test eklendi: dört yamanın her biri bir kez `WRAPPER` olarak kaydedilir ve zar etkisi çalışmaya devam eder. Test sayısı 33.

## 0.7.0 — 2026-09-10

### Maintainability

- Dağıtım bundle'ındaki çalışma bölgeleri bakım yapılabilir `src/` dosyalarına ayrıldı.
- `npm run build`, kaynak ağacından `dice-master.js` dosyasını byte-for-byte yeniden üretir.
- Derleme çıktısı ile kaynak ağacının eşitliğini doğrulayan test kapısı eklendi.

### Compatibility

- Runtime zar ve roll işaretleri kanonik `diceMaster*` adlarına taşındı.
- Eski `fumbleSwitch*` işaretleri ve ayar sınıfı adı 0.7.x geçiş dönemi için uyumlu alias olarak korundu.
- Dice So Nice ve chat entegrasyonları hem yeni hem eski işaretleri okuyabilir.

### Testing

- Stratejiler, Foundry hook'ları, Socketlib, Dice So Nice, widget durumu ve ayar formu için karakterizasyon kapsamı genişletildi.
- Test sayısı 30'a, gerçek bundle üzerindeki V8 fonksiyon kapsamı %82'nin üzerine çıkarıldı.

## 0.6.1 — 2026-09-10

### Security

- Raw socket `cheat-state` snapshot’ları için aktif GM gönderen doğrulaması eklendi.
- Payload içindeki kullanıcı kimliğine güvenilmesi engellendi.
- Debug chat kartındaki kullanıcı kontrollü metinler HTML için güvenli hâle getirildi.

### Stability

- Die, modifier ve Roll prototype yamaları tekrar kurulmaya karşı idempotent hâle getirildi.
- Manifest ve runtime sürümleri eşitlendi.
- Tekrarlanabilir test ve sözdizimi kontrol komutları eklendi.
- Gerçek bundle üzerinde en az %80 V8 fonksiyon kapsamı zorunlu hâle getirildi.

### Documentation

- Kurulum, kullanım, güvenlik modeli ve geliştirme komutları belgelendi.

## 0.6.0

- Dice Master adı ve bağımsız `dice-master` modül kimliği kullanıma alındı.
- Oyuncu bazlı Better/Worse override’ları, presetler ve bias sınırları eklendi.
- D&D5e, Midi-QOL, Socketlib ve Dice So Nice entegrasyonları geliştirildi.
