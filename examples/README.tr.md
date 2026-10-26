# Cloud Garden çevirmen iş akışı

[English](README.md) | Türkçe

Bu örnekteki tüm metinler kurgusal bir bahçe arayüzünü tanımlar. Hiçbir dış
servisle bağlantı kurulmaz. Depo kök dizininden başlayıp `cd examples` komutunu
çalıştırın. Bu komutlar yerel CLI'ı kullandığı için paket kurulumu gerekmez.
Başlangıç dosyalarını saklamak isterseniz denemeler öncesinde `examples/` klasörünü
kopyalayın.

## Eksik metinleri dışa aktarma

```sh
node ../bin/i18n-diff.js export-missing locales/en.json locales/fr.json -o todo-fr.json
```

```text
Wrote 2 keys to todo-fr.json
```

Oluşturulan dosyanın içeriği:

```json
{
  "greeting": "Hello, {name}!",
  "hint": "Choose a <b>seed</b>."
}
```

## Çeviri ve birleştirme

`todo-fr.json` dosyasındaki iki değeri yer tutucuları ve HTML etiketlerini koruyarak
çevirin. Hazır çeviri `filled-fr.json` dosyasında da verilmiştir:

```json
{
  "greeting": "Bonjour, {name} !",
  "hint": "Choisissez une <b>graine</b>."
}
```

```sh
node ../bin/i18n-diff.js merge locales/fr.json todo-fr.json --source locales/en.json
```

```text
Merged into locales/fr.json
added 2, filled 0, overwritten 0, kept 0, skipped 0
```

Her iki yeni satır da mevcut üyelerin önüne yerleşir. Tüm özgün satırlar korunur;
satır farkı yalnızca iki ekleme ve sıfır silme içerir. Mevcut boş bir değeri
doldurmak ya da bir nesnenin sonuna anahtar eklemek de ilgili satırı değiştirebilir.

## Sonucu doğrulama

```sh
node ../bin/i18n-diff.js check locales/en.json locales/fr.json
```

```text
locales/fr.json (fr)
  OK

1 file checked: 0 errors, 0 warnings
```

## Tamamlanma oranını izleme

```sh
node ../bin/i18n-diff.js stats locales/en.json locales/fr.json locales/de.json locales/ru.json --format markdown --sort completion
```

```text
| File | Locale | Translated | Missing | Empty | Untranslated | Extra | Complete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| locales/de.json | de | 6/6 | 0 | 0 | 0 | 0 | 100.0% |
| locales/fr.json | fr | 7/7 | 0 | 0 | 0 | 0 | 100.0% |
| locales/ru.json | ru | 8/8 | 0 | 0 | 0 | 0 | 100.0% |
```

Fransızca ve Rusça, İngilizceye göre daha fazla çoğul kategorisine ihtiyaç duyar.
Yerel `.i18n-diff.json`, katı uyarıları ve tamamlanma barajlarını (varsayılan %90,
Almanca için %100) etkinleştirir; `--min` seçeneği o çalıştırma için yapılandırılmış
tüm barajların yerine geçebilir.

## CI

Kullanan bir projenin iş akışı için [github-actions.yml](github-actions.yml) dosyasına bakın.
Projenin bu paketi dev dependency olarak kurduğunu ve bir kilit dosyasına sahip olduğunu
varsayar. Örnek kod projenin `locales/` klasörünü denetler; bu depoya uyarlarken
`examples/locales/` ve yerel `bin/i18n-diff.js` dosyasını kullanın.

## Programatik API

Kütüphane örneğini bu dizinden çalıştırın:

```sh
node api.mjs
```
