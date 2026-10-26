# Katkıda Bulunma

[English](CONTRIBUTING.md) | Türkçe

Yardımınız için teşekkürler. Bu proje bilinçli olarak yalındır: sıfır çalışma zamanı bağımlılığı, Node.js 20 veya daha yeni sürüm ve sade ESM.

## Kurulum

```sh
git clone https://github.com/YusufBeratZengin/i18n-json-diff.git
cd i18n-json-diff
npm ci
npm test
npm run lint
```

`npm test`, Node'un yerleşik satır, dal ve fonksiyon kapsam raporunu da yazdırır.
Kapsam %85'in altına düşerse açıkta kalan üretim kodunu inceleyin ve davranış odaklı
testler ekleyin. Bu yalın JavaScript projesinde ayrı bir typecheck komutu yoktur.

CLI çıktısını veya demo test verilerini değiştirdiğinizde `npm run demo` komutunu
çalıştırın ve her iki README çıktı bloklarını güncelleyin. `node scripts/make-demo.mjs --check`
komutu SVG görselinin güncel olduğunu doğrular.

## Proje Düzeni

| Yol | Amaç |
|---|---|
| `src/json-ast.js` | Konum bilgisi tutan JSON ayrıştırıcısı (bayt düzeyinde minimal birleştirmeleri sağlayan ofsetler). |
| `src/files.js` | Dil dosyasını düz anahtar görünümü ve AST olarak yükler. |
| `src/icu.js`, `src/messages.js` | ICU belirteç ayrıştırıcı, yer tutucu, HTML etiketi ve noktalama yardımcıları. |
| `src/locale.js`, `src/plural.js` | Dil tespiti, BCP 47 standartlaştırması ve çoğul kategori yardımcıları. |
| `src/compare.js` | Kontroller. |
| `src/config.js` | Yapılandırma dosyası yükleme ve şema doğrulaması. |
| `src/merge.js`, `src/export.js` | `merge` ve `export-missing` komutları. |
| `src/cli.js`, `src/report.js` | Komut satırı arayüzü ve çıktı biçimleri. |
| `examples/` | CLI iş akışı, CI yapılandırması ve programatik API örneği içeren örnek proje. |
| `test/` | `node:test` testleri; `test/fixtures/` örnek dil dosyalarını barındırır. |

## İlkeler

- Yerleşik test çalıştırıcısını kullanın (`node --test`). Her kontrolün bir teste ihtiyacı vardır ve bir hata düzeltmesi, düzeltme olmadan başarısız olan bir test gerektirir.
- `merge` mantığına dokunan her değişiklik, mevcut satırların değişmeden kalması garantisini korumalıdır. `test/merge.test.js` dosyasına satır farkını doğrulayan bir durum ekleyin.
- Çalışma zamanı bağımlılığı eklenemez. Geliştirme bağımlılıkları (devDependencies) serbesttir.
- Kullanıcıya yönelik iletileri kısa ve net tutun: neyin yanlış olduğunu ve hangi anahtarda olduğunu belirtin.
- Yeni kontrol kodları için `src/compare.js` içinde bir önem düzeyi, her iki README'de bir satır ve bir CHANGELOG girdisi gerekir.

## Commit'ler ve pull request'ler

- [Conventional Commits](https://www.conventionalcommits.org/) mesajlarıyla küçük commit'ler: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Neyin değiştiğini ve nedenini açıklayın. Varsa ilgili sorunu (issue) bağlayın.
- `npm test` ve `npm run lint` başarılı olmalıdır; CI her ikisini de Ubuntu ve Windows üzerinde Node 20, 22 ve 24 ile çalıştırır.

## Sürüm Yayımlama

Sürüm yayımlama işlemi maintainer tarafından `v*.*.*` etiketleriyle tetiklenen `.github/workflows/release.yml` üzerinden yapılır.
İlk otomatik yayından önce, `YusufBeratZengin` sahibi, `i18n-json-diff` deposu, `release.yml` iş akışı ve `npm` ortamı için bir npm güvenilir yayıncısı (trusted publisher) yapılandırın. İlgili GitHub ortamını oluşturun. İş akışı OIDC için Node 24 ve npm 11.5.1 veya daha yenisini kullanır (`contents: read` ve `id-token: write`); kayıt anahtarı (token) saklanmaz. Bkz. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
Paket henüz npm üzerinde yoksa, ilk yayını ve güvenilir yayıncı kurulumu maintainer için bir ön koşuldur; iş akışına token yedeği eklemeyin.

1. İlgili CHANGELOG girdilerini Unreleased bölümünden tarihli bir sürüm bölümüne taşıyın.
2. SemVer kurallarına uyarak `package.json` ve kilit dosyasını birlikte güncelleyin.
3. `npm ci`, `npm run lint`, `npm test` ve `npm pack --dry-run` çalıştırın; paket dosya listesini inceleyin.
4. İncelenen sürümü `chore(release): vX.Y.Z` olarak commit edin ve eşleşen etiketi oluşturun.
5. Maintainer onaylanan commit'i ve etiketi push eder. İş akışı sürümü doğrular, kontrolleri yineler, ardından `npm publish --provenance --access public` çalıştırır. İş akışını izleyin ve yayımlanan paketi ve kanıtını (provenance) npm'de doğrulayın.

Güvenilir yayıncı yapılandırılana kadar sürümü yayımlanmamış tutun. Yerel performans kontrolü için `npm run bench`, disk G/Ç olmadan sentetik 20.000 anahtarlık kontrol ve birleştirmeyi ölçer.

## Hata Bildirimi

Sorunu yeniden üreten en küçük kaynak ve hedef JSON dosyalarını, çalıştırdığınız komutu ve beklediğiniz çıktıyı içeren bir issue açın. Gerçek müşteri verilerini veya sırları kesinlikle yapıştırmayın.
