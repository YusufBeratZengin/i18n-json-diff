# Güvenlik Politikası

[English](SECURITY.md) | Türkçe

## Desteklenen sürümler

Yalnızca en son sürüm güvenlik düzeltmeleri alır.

## Güvenlik açığı bildirme

Lütfen güvenlik sorunları için herkese açık bir issue açmayın. Bu depo için GitHub'ın özel güvenlik açığı bildirimini (private vulnerability reporting) kullanın:
<https://github.com/YusufBeratZengin/i18n-json-diff/security/advisories/new>

Etkilenen sürümü, sorunun açıklamasını ve mümkünse en küçük yeniden üretim adımlarını ekleyin. Birkaç gün içinde geri dönüş bekleyebilirsiniz. Bir düzeltme hazır olduğunda, aksi talep edilmedikçe bildirim changelog içinde belirtilecektir.

## Kapsam

i18n-json-diff yalnızca işaret ettiğiniz JSON dosyalarını okur ve `merge` (`<hedef>` veya `--output`) ile `export-missing --output` komutlarına belirttiğiniz dosyaları yazar. Hiçbir ağ isteği yapmaz ve okuduğu dosyalardan herhangi bir kod çalıştırmaz. Ayrıştırıcı çökmeleri, özel hazırlanmış girdilerde sınırsız kaynak tüketimi veya istenen yolların dışına yazma bildirimleri kapsam dahilindedir.
