# Sistem Mimarisi

## 1. Problem Tanimi

Hareketli ekran sistemi, havuz boyunca sporcu ile birlikte ilerleyen ve set hedeflerini gercek zamanda gosteren bir havuz kenari aracidir.

Temel ihtiyaclar:

- 25m ve 50m havuz icin farkli hedef mantigi
- ileri ve geri yonlu hareket
- on tarafta sadece kronometre gosteren sporcu ekrani
- arka tarafta sadece antrenman girilen ve kontrol edilen antrenor ekrani
- set ici parcali hedef gostergesi
- bip ve mola sesleri
- manuel kumanda ile bagimsiz surus
- mevcut antrenor workout kutuphanesinden secim

## 2. Onerilen Mimari

### Katman A: Kontrol Bilgisayari

Oneri:

- Raspberry Pi 5 veya benzeri mini bilgisayar
- iki HDMI ekran
- on taraf icin daha buyuk parlak ekran
- arka taraf icin dokunmatik kontrol ekrani
- mevcut sistemle ayni Firebase altyapisina baglanti

Raspberry Pi 5 bu is icin uygundur cunku iki adet micro-HDMI cikisi vardir. Yani ikinci bilgisayar gerekmeyebilir.

Gorevleri:

- arka ekranda antrenman secimi
- arka ekranda trainer workout listesini cekme
- arka ekranda yeni antrenman girme
- arka ekranda havuz tipini secme
- arka ekranda set akisini baslatma/duraklatma
- on ekranda sadece kronometre, hedef, tekrar ve mola bilgisini gosterme
- hoparlor seslerini tetikleme
- hareket kontrolcusu ile seri/Wi-Fi/Bluetooth haberlesme

## 2.1 Ekran Rolleri

### On ekran

- sporcuya bakar
- sadece kronometre gorunur
- buyuk sayac, hedef cizgisi, set ve mola bilgisi gosterir
- dokunmatik olmak zorunda degil

### Arka ekran

- antrenore bakar
- workout secme veya yeni workout girme buradan yapilir
- baslat, durdur, sifirla gibi kontroller burada olur
- dokunmatik olursa daha kullanisli olur

### Katman B: Hareket Kontrolcusu

Oneri:

- ESP32 veya STM32 tabanli bir kart

Gorevleri:

- sag/sol motor surme
- encoder okuma
- mesafe takibi
- ileri/geri hareket
- manuel kumanda komutlarini alma
- acil durdurma ve sinir anahtari kontrolu

Bu ayrim onemli cunku UI tarafi takilsa bile arac guvenli sekilde durdurulabilir.

## 3. Havuz Mantigi

### Kisa Havuz 25m

- 75m icin hedef cizgiler: 25, 50, 75
- sporcu her 25m tek katinda siyah cizgiye gelir
- sistem parcali hedefleri buna gore sayar

### Uzun Havuz 50m

- 100m icin hedef cizgiler: 50, 100
- 150m icin hedef cizgiler: 50, 100, 150
- sistem bu kez 50m katlarini referans alir

### Genel Hesap

- `poolLength = 25 | 50`
- `splitCount = distance / poolLength`
- her split icin hedef sure hesaplanir

Antrenor isterse iki mod sunulabilir:

1. Esit bolunmus split modu: toplam sure split sayisina esit dagitilir
2. Ozel split modu: her parcaya ayri hedef sure girilir

## 4. Hareket Kurallari

V1 icin en dogru yaklasim:

- ekran her zaman sporcunun beklenen konumuna gore hareket eder
- duz hatta ileri ve geri gider
- havuz sonlarinda yavaslama yapar
- her donus noktasinda tampon guvenlik payi olur

Gerekli alt kurallar:

- maksimum hiz limiti
- yumusak hizlanma ve yavaslama
- fiziksel limit switch
- encoder ile dogrulama
- baglanti koparsa fail-safe stop

## 5. Ses Akisi

Temel ses kurgusu:

- kisa bip: set icindeki ara hedef veya tekrar gecisi
- uzun bip: mola baslangici
- uzun bip: yeni set baslangici
- istege bagli sesli anons: `5 saniye`, `basla`, `mola`

Sesler bilgisayar tarafindan uretilip hoparlore verilebilir.

## 6. Kumanda Mantigi

Kumanda modlari:

1. Manuel surus modu
2. Otomatik antrenman modu
3. Yardimci hizalama modu

Kumandada minimum su kontroller olmali:

- ileri
- geri
- dur
- acil stop
- otomatik/manual gecis
- ses kapat/ac

## 7. Mevcut Sistemle Entegrasyon

V1 entegrasyon hedefi:

- mevcut `trainers/{trainerId}` verisini kullan
- mevcut `workouts/{workoutId}` verisini kullan
- yeni bir `pool_rover_devices` koleksiyonu ekle
- yeni bir `pool_rover_sessions` koleksiyonu ekle

Onerilen koleksiyonlar:

```firestore
pool_rover_devices/{deviceId}
  name
  adminId
  branchId
  status
  batteryLevel
  firmwareVersion
  lastSeenAt

pool_rover_sessions/{sessionId}
  deviceId
  trainerId
  workoutId
  poolLength
  mode
  status
  startedAt
  completedAt

pool_rover_session_events/{eventId}
  sessionId
  type
  payload
  createdAt
```

## 8. V1 ve V2 Siniri

### V1

- workout secme
- arka ekrandan yeni workout girme
- 25m / 50m havuz secme
- otomatik ileri/geri hareket
- on ekranda sadece kronometre gostergesi
- arka ekranda sadece kontrol paneli
- temel bip sesleri
- manuel kumanda
- guvenli stop altyapisi

### V2

- kamera ile sporcu takibi
- otomatik lane takip
- sesli anons
- tablet/telefon uzaktan kontrol
- birden fazla sporcuyu ayri modlarla takip

## 9. En Kritik Riskler

- suya yakin ortamda elektronik koruma
- kayma/engel/carpma riski
- baglanti kopmasinda kontrol kaybi
- motor gucu yetersizligi
- encoder sapmasi ile konum hatasi

Bu nedenle V1 icin guvenlik, gosterisli ozelliklerden once gelmeli.