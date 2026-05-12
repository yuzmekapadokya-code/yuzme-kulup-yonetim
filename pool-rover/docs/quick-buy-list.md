# HIZLI SATIN ALMA VE KURULUM LISTESI

Bu dosya uzun dokumanlari okumadan direkt ne alinacagini ve nasil kurulacagini ozetler.

## 1. Direkt Satin Al

### Ana beyin

1. Raspberry Pi 5
2. 128GB microSD veya SSD HAT
3. On taraf icin buyuk ve parlak HDMI ekran
4. Arka taraf icin dokunmatik HDMI ekran
5. Raspberry Pi icin metal veya kapali koruma kutusu

Not:

- Burada iki HDD degil, iki ekran var.
- Tek Raspberry Pi ile iki ekran surulebilir.
- On ekran sadece kronometreyi gosterir.
- Arka ekran sadece antrenman girme ve kontrol icindir.

### Hareket beyni

1. ESP32 gelistirme karti
2. Cift motor surucu karti
3. 2 adet encoderli DC gear motor
4. 2 ana surus tekeri
5. 2 destek tekeri veya caster teker

### Guvenlik ve konum

1. 2 adet limit switch
2. 1 adet acil stop butonu
3. 1 adet yakinlik sensoru

### Ses ve kontrol

1. 2 adet aktif mini hoparlor
2. 1 adet kablosuz kumanda

### Guc

1. Uygun akulu guc paketi
2. 12V -> 5V regulator
3. Sigorta
4. Acma kapama anahtari
5. Kablo ve soket seti

## 2. Benim Net Onerim

Kafa karistirmadan V1 icin bunu kur:

1. Raspberry Pi 5
2. ESP32
3. 2 motorlu encoderli taban
4. 1 on sporcu ekrani
5. 1 arka kontrol ekrani
6. 2 hoparlor
7. 1 kumanda
8. 1 acil stop
9. 2 limit switch

Bu kombinasyon ilk urun icin yeterli.

## 3. Kurulum Sirasi

### Asama 1: Hareket eden taban

1. Saseyi kur
2. Motorlari bagla
3. Tekerleri tak
4. Motor surucuyu bagla
5. ESP32'yi bagla
6. Acil stop ve limit switchleri bagla

Bu asamada hedef:

- arac ileri gitsin
- geri gelsin
- durabilsin
- sinira gelince dursun

### Asama 2: Ekran ve ses

1. Raspberry Pi'yi yerlestir
2. On ekrani bagla
3. Arka kontrol ekranini bagla
4. Hoparlorleri bagla
5. Wi-Fi baglantisini ac

Bu asamada hedef:

- on ekranda sadece kronometre gorelim
- arka ekranda workout giris paneli gorelim
- bip sesi gelsin

### Asama 3: Iki sistemi konustur

1. Raspberry Pi -> ESP32 komut gondersin
2. ESP32 -> motorlari sursun
3. Raspberry Pi -> hoparlor bip sesi versin

Bu asamada hedef:

- workout baslayinca arac hareket etsin
- mola gelince ses versin
- yeni set baslayinca ses versin

## 4. Yazilim Tarafinda Ilk Yapilacaklar

1. Workout secme ekrani
2. Arka ekrandan workout girme ekrani
3. 25m mi 50m mi havuz secimi
4. Baslat durdur sifirla
5. Kisa bip uzun bip
6. Ileri geri hareket komutlari

## 5. Simdilik Alma

Su an alma:

1. Kamera
2. AI takip sistemi
3. Cok pahali lidarlar
4. Fazla sensor

Bunlar V2 isleri.

## 6. Sana En Kisa Haliyle

Satin al:

1. Raspberry Pi 5
2. On ekran
3. Arka dokunmatik ekran
4. ESP32
5. Motor surucu
6. 2 encoderli motor
7. 2 hoparlor
8. Kumanda
9. Acil stop
10. Limit switch
11. Regulator ve guc paketi

Kur:

1. Once araci yurut
2. Sonra iki ekrani calistir
3. On ekranda kronometreyi goster
4. Arka ekranda workout panelini ac
5. Sonra sesi ver
6. Sonra workout bagla

Sonra bana kodlari ver, ben entegrasyonu kurayim.