# Dice Master

Dice Master, Foundry Virtual Tabletop V13 için GM kontrollü zar etkisi modülüdür. Eski **Fumble Switch** modülünden bağımsız `dice-master` kimliğiyle çalışır ve iki modülün aynı dünyada birlikte etkinleştirilmemesi gerekir.

## Özellikler

- Oyuncular ve GM için ayrı `Off`, `Better` ve `Worse` durumları
- Her oyuncuya özel `Inherit`, `Off`, `Better` ve `Worse` seçimi
- Full, Bias, Nudge ve Threshold stratejileri
- d4, d6, d8, d10, d12, d20 ve d100 desteği
- Zar türüne göre pozitif yön ve etki ayarları
- Better/Worse bias taban ve tavan sınırları
- D&D5e ve Midi-QOL zar akışlarında kullanıcı ayrımı
- İsteğe bağlı Socketlib, Dice So Nice ve libWrapper entegrasyonu
- GM için sürüklenebilir hızlı kontrol paneli
- İsteğe bağlı açık bildirim ve GM debug mesajları

## Kullanım

1. Modülü `Data/modules/dice-master/` klasörüne kurun.
2. Foundry VTT dünyasında **Dice Master** modülünü etkinleştirin.
3. GM olarak Token araçlarındaki zar düğmesinden kontrol panelini açın.
4. Oyuncular veya GM için `Off`, `Better` ya da `Worse` seçin.
5. Ayrıntılı zar ayarlarına paneldeki dişli düğmesinden ulaşın.

`Normal`, `Hard Mode` ve `Player Advantage` presetleri oyuncu override’larını temizleyerek tutarlı bir başlangıç durumu uygular.

## Güvenlik modeli

- Dünya ayarlarını yalnızca GM değiştirir.
- Raw socket üzerinden gelen durum snapshot’ları yalnızca aktif GM göndereninden kabul edilir.
- Roll-controller mesajlarında gönderen kimliği socket tarafından sağlanan kullanıcı kimliğinden alınır.
- Debug chat HTML’i kullanıcı kontrollü metinleri kaçırır.

## Uyumluluk

- Foundry Virtual Tabletop V13
- D&D5e roll akışları
- Opsiyonel: Socketlib
- Opsiyonel: Dice So Nice
- Opsiyonel (önerilir): libWrapper. Etkinse zar yamaları libWrapper `WRAPPER` zinciriyle kaydedilir ve Midi-QOL gibi aynı zar metotlarını saran modüllerle uyumlu çalışır; yoksa doğrudan yamaya geri düşülür.
- Midi-QOL etkinlik bağlamları için entegrasyon hook’ları

## Geliştirme

Harici npm bağımlılığı yoktur. Node.js ile:

```text
npm run build
npm test
npm run check
npm run test:coverage
```

`src/` dizini bakım yapılan kaynak koddur. `npm run build`, bu bölgeleri birleştirerek Foundry'nin yüklediği `dice-master.js` bundle'ını yeniden üretir; derleme testi iki sürümün byte-for-byte aynı kalmasını zorunlu tutar.

Testler kullanıcı izolasyonu, eşzamanlı workflow’lar, durum migrasyonu, dört etki stratejisi, advantage/disadvantage seçimi, bias sınırları, socket yetkilendirmesi, HTML kaçışı ve patch idempotence davranışlarını doğrular. Coverage komutu dinamik VM test harness’inde çalıştırılan bundle için V8 fonksiyon kapsamını ölçer ve %80 altını başarısız sayar.

Runtime işaretleri yalnızca `diceMaster*` adlarını kullanır. 0.8.0 ile eski `fumbleSwitch*` işaretleri ve `FumbleSwitchSettingsMenu` alias'ı kaldırıldı. Eski `cheat*` dünya ayarları ilk açılışta aktif GM tarafından `influence*` anahtarlarına taşınır.

## Lisans

MIT — ayrıntılar için `LICENSE` dosyasına bakın.
