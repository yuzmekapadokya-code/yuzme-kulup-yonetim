# Pool Rover

Bu klasor, mevcut yuzme yonetim sistemiyle entegre calisacak ama ondan bagimsiz gelistirilecek hareketli havuz antrenman ekrani projesinin baslangic alanidir.

## Amac

Antrenorun havuz kenarinda takip etmekte zorlandigi setleri, havuz boyunca ileri-geri hareket eden bir ekran ve ses sistemi ile sporcuya daha net gostermek.

## Temel Senaryo

- Antrenor cihazin arka tarafindaki kontrol ekranindan veya mevcut panelden bir antrenman secer.
- Havuz tipi secilir: `kisa havuz (25m)` veya `uzun havuz (50m)`.
- Sistem, secilen setin parcali hedeflerini siyah cizgi referansina gore hesaplar.
- Arac, havuz boyunca ileri ve geri hareket eder.
- On taraftaki sporcu ekraninda sadece kronometre, hedef ve set bilgisi gosterilir.
- Arka taraftaki kontrol ekraninda sadece workout secme, workout girme ve kontrol paneli bulunur.
- Hoparlorler kisa bip, uzun bip ve set gecis sinyallerini verir.
- Kumanda ile manuel surus yapilabilir.

## Alt Sistemler

1. Surus sistemi
2. Hareketli ekran arayuzu
3. Ses ve uyarilar
4. Kumanda ile manuel kontrol
5. Antrenman veri senkronizasyonu
6. Istege bagli kamera ile sporcu takibi

## Bu Klasordeki Dokumanlar

- [docs/system-architecture.md](docs/system-architecture.md)
- [docs/hardware-bom.md](docs/hardware-bom.md)
- [docs/feature-ideas.md](docs/feature-ideas.md)
- [docs/quick-buy-list.md](docs/quick-buy-list.md)

## Mevcut Sistemle Baglanti

Bu proje mevcut `workouts`, `trainers` ve ileride acilacak yeni cihaz koleksiyonlariyla entegre olabilir. Ilk hedef, mevcut antrenman verisini tekrar yazmadan kullanmaktir.

## Ilk Teknik Karar

V1 icin sistemi iki beyne bolmek daha dogru:

- Ust seviye kontrol bilgisayari: ekran UI, Firebase senkronizasyonu, workout secimi, ses akisi
- Ust seviye kontrol bilgisayari: iki ekrani yonetir. On ekran sporcuya bakar, arka ekran antrenore bakar.
- Alt seviye hareket kontrolcusu: motor, encoder, guvenlik sensorleri, manuel kumanda, acil durdurma

Tek ciple her seyi yapmak mumkun ama ilk urunde risklidir. Hareket kontrolunu ayrismis tutmak daha guvenli olur.