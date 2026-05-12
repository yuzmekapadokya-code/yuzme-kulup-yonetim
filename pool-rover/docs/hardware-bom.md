# Donanim Parcasi Listesi

## 1. Ana Kontrol ve UI

### Zorunlu

- Raspberry Pi 5
- 128GB SD kart veya SSD HAT
- 1 adet on tarafa bakacak parlak buyuk HDMI ekran
- 1 adet arka tarafa bakacak dokunmatik HDMI ekran
- 12V -> 5V regule guc modulu
- suya dayanikli muhafaza

### Neden

- mevcut Firebase ile kolay entegre olur
- web tabanli veya React tabanli bir cihaz arayuzu kolay calisir
- tek bilgisayar ile iki ekrani ayni anda surmek mumkundur
- ses, ekran, ag ve veri senkronizasyonu rahat yonetilir

## 2. Hareket Kontrol Katmani

### Zorunlu

- ESP32 gelistirme karti
- cift kanal motor surucu
- iki adet torklu DC gear motor veya uygun BLDC surus seti
- teker encoder sistemi
- limit switch sensori
- acil stop butonu

### Neden

- motor kontrolunu bilgisayardan ayirir
- daha kararlı gercek zamanli tepki verir
- kumanda ve fail-safe mekaniklerini sade tutar

## 3. Konum ve Guvenlik

### Onerilen

- wheel encoder
- IMU sensoru
- ultrasonik veya LiDAR tabanli yakinlik sensoru
- bumper switch

### Neden

- havuz kenarinda engel algilama
- duz hat uzerinde pozisyon tutarliligi
- carpma oncesi otomatik yavaslama

## 4. Ses Sistemi

### Zorunlu

- iki adet aktif hoparlor veya mini amfili pasif hoparlor
- USB veya 3.5mm ses cikisi

### Ses Olaylari

- tekrar ici kisa bip
- mola baslangic uzun bip
- yeni set uzun bip
- opsiyonel sesli komutlar

## 5. Kumanda

### V1 Oneri

- endustriyel 2.4GHz RC kumanda veya gamepad tipi kontrol

### Daha Iyi Secenek

- ESP32 tabanli ozel kumanda
- ileri, geri, dur, acil stop, mod gecisi tuslari

## 6. Guc Sistemi

### Dikkat Edilecekler

- ayri motor guc hatti
- ayri bilgisayar/ekran guc hatti
- sigorta
- voltaj koruma
- sicrama suya karsi IP koruma

## 7. Kamera Vizyonu Icin V2

- Raspberry Pi Camera veya USB kamera
- genis aci lens
- GPU/NPU destekli islem birimi

V2'de kamera ile secili sporcuyu takip etmek mumkun ama ilk urunde gereksiz risk ekler.

## 8. En Dogru Ilk Kombinasyon

Ilk prototip icin tavsiyem:

- Raspberry Pi 5
- ESP32
- encoderli 2 motorlu diferansiyel surus
- 1 on ekran
- 1 arka kontrol ekrani
- 2 hoparlor
- 1 fiziksel acil stop
- 1 kablosuz kumanda
- 25m/50m havuz secim mantigi

Bu kombinasyon maliyet-kontrol-guvenlik dengesinde en mantikli baslangictir.