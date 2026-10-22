# i18n-json-diff

[![CI](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/i18n-json-diff/actions/workflows/ci.yml)
[![lisans: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Çeviri JSON dosyalarını kaynak dille karşılaştırır. Eksik, fazla, boş ve bozuk anahtarları raporlar; çevirmenin boşlukları doldurmasına yardım eder ama dosyanın biçimini bozmaz: `merge` yeni çevirileri yeni satırlar olarak ekler, geri kalan her şey bayt bayt aynı kalır.

[English](README.md) | Türkçe

- Çalışma zamanı bağımlılığı yok, Node.js 20 ve üzeri, ESM.
- İç içe ve düz (flat) JSON ile çalışır (vue-i18n, i18next, react-intl, Hoppscotch tarzı dosyalar).
- i18next çoğul ekleri (`_one`, `_other`, `_few` ...), ICU MessageFormat, `{{çift}}` yer tutucular ve HTML etiketlerini tanır.
- Çıktı: düz metin, JSON veya GitHub Actions bildirimleri.

## Kurulum

```sh
npm install --save-dev i18n-json-diff
# ya da tek seferlik
npx i18n-json-diff check locales/en.json locales/*.json
```

Paket henüz npm kayıt defterinde yayımlanmadı; o zamana kadar GitHub'dan kurulabilir:
`npm install --save-dev github:YusufBeratZengin/i18n-json-diff`.

Komutun adı `i18n-diff`.

## Hızlı başlangıç

```sh
i18n-diff check locales/en.json locales/fr.json locales/de.json
```

Örnek çıktı için [İngilizce README](README.md#quick-start) bölümüne bakın.

Çevirmen için iş akışı:

```sh
# 1. eksikleri kaynak metinle birlikte küçük bir JSON dosyasına yaz
i18n-diff export-missing locales/en.json locales/fr.json -o todo-fr.json

# 2. todo-fr.json içindeki değerleri çevir

# 3. geri ekle; locales/fr.json için git diff yalnızca eklenen satırları gösterir
i18n-diff merge locales/fr.json todo-fr.json --source locales/en.json

# 4. doğrula
i18n-diff check locales/en.json locales/fr.json
```

## Komutlar

### `check <kaynak> <hedef...>`

Her hedefi kaynakla karşılaştırır ve sorunları yazar. Hata varsa çıkış kodu `1`, yoksa `0`.

| Seçenek | Anlamı |
|---|---|
| `--format text\|json\|github` | Çıktı biçimi. `github` iş akışı komutları yazar (`::error file=...`); eksik anahtarlar dosya başına tek bildirimde toplanır. |
| `--ignore a,b` | Bu kontrolleri atla (aşağıdaki tabloya bakın). |
| `--warnings-as-errors` | Uyarılarda da `1` ile çık. |
| `--allow-key <desen>` | Kaynakla aynı kalabilecek anahtar. `*` ve `?` joker karakterdir. Tekrarlanabilir. |
| `--allow-value <metin>` | Kaynakla aynı kalabilecek değer (marka adı, `OK`). Tekrarlanabilir. |
| `--locale <etiket>` | Hedeflerin dili. Varsayılan olarak dosya adından (`fr.json`, `pt_BR.json`, `messages.de.json`) ya da üst klasörden (`ja/common.json`) bulunur. |
| `--source-locale <etiket>` | Kaynağın dili, aynı yöntemle bulunur. |
| `--config <dosya>` | Ayar dosyası. Varsayılan: çalışma klasöründe varsa `.i18n-diff.json`. |

Hedef dosya adında `*` veya `?` kullanılabilir (joker karakteri açmayan Windows kabuklarında işe yarar). Kaynak dosyanın kendisi eşleşirse atlanır.

### `export-missing <kaynak> <hedef>`

Çevirisi gereken anahtarları, değer olarak kaynak metinle ve kaynak sırasıyla küçük bir JSON'a yazar. Hedef dosya henüz yoksa da çalışır (yeni dil).

| Seçenek | Anlamı |
|---|---|
| `-o, --output <dosya>` | Çıktıyı ekrana değil dosyaya yaz. |
| `--only-missing` | Var ama boş olan anahtarları dışarıda bırak. |
| `--include-untranslated` | Değeri kaynakla aynı olan anahtarları da listele. |
| `--shape auto\|nested\|flat` | Çıktının biçimi. `auto` kaynak dosyayı izler. |

Hedef dilin ihtiyaç duyduğu ama kaynakta olmayan çoğul biçimleri (örneğin Rusça için `item_few`) kaynağın `_other` metniyle gelir.

### `merge <hedef> <doldurulmuş>`

`doldurulmuş` dosyadaki (iç içe ya da düz) çevirileri `hedef` dosyaya ekler.

- Yeni anahtarlar kaynak sırasına göre doğru yere konur. `--source <dosya>` verilirse sıra kaynaktan, verilmezse doldurulmuş dosyadan alınır.
- Girinti (boşluk ya da sekme), satır sonu (LF ya da CRLF), eksik son satır sonu ve BOM korunur. Mevcut satırlar yeniden biçimlendirilmez; bu yüzden `git diff` yalnızca eklenen satırları gösterir.
- Kaçınılmaz tek istisna: anahtar bir nesnenin son kaydından sonra gelecekse o satıra virgül eklenir.
- Hedefteki boş değerler (`""` ya da `null`) yerinde doldurulur. Dolu çevirilere `--overwrite` verilmedikçe dokunulmaz.
- `--source` ile kaynakta olmayan anahtarlar atlanır (bilinen çoğul gruplarının biçimleri kabul edilir).
- Hedef dosya yoksa oluşturulur.

| Seçenek | Anlamı |
|---|---|
| `--source <dosya>` | Kaynak dosya: anahtar sırasını belirler, bilinmeyen anahtarları reddeder. |
| `--overwrite` | Dolu çevirilerin üzerine de yaz. |
| `--dry-run` | Ne değişeceğini yaz, hiçbir şey kaydetme. |
| `-o, --output <dosya>` | Sonucu başka bir dosyaya yaz. |

### `stats <kaynak> <hedef...>`

Dosya başına tamamlanma oranı. `--format json` aynı veriyi JSON verir. `--min <yüzde>`, herhangi bir dosya eşiğin altındaysa `1` ile çıkar; CI'da kapı olarak kullanışlıdır.

## Kontroller

| Kontrol | Önem | Ne bulur |
|---|---|---|
| `missing` | hata | Kaynaktaki anahtar hedefte yok. |
| `extra` | hata | Hedefteki anahtar kaynakta yok. |
| `empty` | hata | Çeviri `""`, boşluk ya da `null`. |
| `placeholder` | hata | Yer tutucu kümesi kaynaktan farklı: `{name}`, `{{name}}`, `$t(key)`, `@:key` ve ICU plural/select dalları içindeki argümanlar. Sıra önemsizdir. |
| `icu-syntax` | hata | Çeviri geçerli ICU MessageFormat değil (kapanmamış parantez, eksik `other` dalı, hatalı seçici ...). Kaynağın kendisi ayrışmıyorsa raporlanmaz. |
| `html-tag` | hata | Etiketler kaynaktan farklı (`<b>`, `</b>`, `<br/>`, `<0>`). Öznitelikler yok sayılır; yerelleştirilmiş `href` sorun değildir. |
| `duplicate-key` | hata | Aynı anahtar hedef dosyada iki kez geçiyor. |
| `invalid-file` | hata | Hedef geçerli bir JSON nesnesi değil. |
| `untranslated` | uyarı | Değer kaynakla aynı. İki dilin ana dili aynıysa (`en` ve `en-GB`), değerde harf yoksa ve izin listesindeki anahtar ya da değerlerde atlanır. |
| `punctuation` | uyarı | Sondaki noktalama sınıfı farklı (`.`, `!`, `?`, `:`, `;`, `,`, `...`). Tam genişlikli, Arapça ve Devanagari işaretler ASCII karşılığı sayılır. |

### Çoğul biçimler

`item_one` / `item_other` gibi anahtarlar, kaynakta `_other` biçimi ve en az bir başka biçim varsa çoğul grubu sayılır. Hedefte o dilin ihtiyaç duyduğu kategoriler beklenir; bunlar `Intl.PluralRules`'tan gelir (Rusça: `one`, `few`, `many`, `other`; Japonca: `other`). Dil, dosya adından ya da `--locale`'den alınır; bulunamazsa kaynağın biçimleri beklenir. Çoğul biçimlerde `_other` biçimine göre yer tutucu eksik olabilir ("bir öğe" gibi), ama bilinmeyen yer tutucu yine raporlanır.

## Ayar dosyası

`.i18n-diff.json` (tüm alanlar isteğe bağlı):

```json
{
  "ignore": ["punctuation"],
  "allowKeys": ["brand.*", "*.url"],
  "allowValues": ["OK", "Email"],
  "sourceLocale": "en",
  "warningsAsErrors": false,
  "format": "text"
}
```

Komut satırı seçenekleri, ayar dosyasındaki listelere eklenir.

## GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx i18n-diff check locales/en.json 'locales/*.json' --format github
```

## Kütüphane olarak kullanım

```js
import { compareFiles, loadLocaleFile, mergeTranslations } from 'i18n-json-diff';

const source = loadLocaleFile('locales/en.json');
const target = loadLocaleFile('locales/fr.json');
const { issues, summary } = compareFiles(source, target);
```

## Çıkış kodları

| Kod | Anlamı |
|---|---|
| 0 | Hata yok (`--warnings-as-errors` ile uyarı da yok; `--min` üstünde). |
| 1 | Sorun bulundu. |
| 2 | Kullanım hatası, okunamayan ya da geçersiz kaynak/doldurulmuş dosya, hatalı ayar. |

## Sınırlar

- Yalnızca JSON. YAML, `.po`, `.properties` ve JSON5 (yorum, sondaki virgül) desteklenmez.
- ICU desteği sözdizimini ve argüman adlarını kapsar, biçimlendirmeyi değil. Bilinmeyen argüman türleri sözdizimi hatası sayılır.
- Diziler, indeks anahtar olacak şekilde düzleştirilir (`list.0`).
- Noktalama ve "çevrilmemiş" kontrolleri sezgiseldir; bu yüzden uyarıdır.

## Katkı

[CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın. Güvenlik sorunları için: [SECURITY.md](SECURITY.md).

## Lisans

[MIT](LICENSE) (c) 2026 Yusuf Berat Zengin
