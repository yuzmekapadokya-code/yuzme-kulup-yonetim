# Super Admin Panel Analizi

Bu belge web panelindeki `public/pages/superadmin.html` ve `public/js/superadmin.js` uzerinden cikarilan operasyonel kapsami ozetler.

## Navigasyon bolumleri

- Dashboard
- Yoneticiler
- Basvurular
- Kredi Yonetimi
- Market
- Kredi Paketleri
- Kredi Bozdurma
- Barajlar
- Yaris Sonuclari Yukleme
- Reklam Yonetimi
- Siparisler
- Sohbet

## Yonetici yasam dongusu

- Yeni admin olusturma: `users/{uid}` ve `admins/{uid}` kayitlari ayni anda yaziliyor.
- Uyeligi biten admin login sirasinda `frozen` durumuna alinabiliyor.
- Admin odemeleri `adminPayments` koleksiyonuna tarih ve yeni bakiye bilgisi ile kaydediliyor.
- Admin silme akisi bagli `branches`, `students`, bazi `trainers` ve `admins` kayitlarini temizliyor.

## Uyelilik basvurulari

- Kaynak koleksiyon `applications`.
- Bekleyen basvurular `status = pending` ile listeleniyor.
- Basvuru form alanlari admin olusturma formuna aktarilabiliyor.
- Onayda `applications/{id}` icine `adminUid`, `approvedBy`, `reviewedAt` yaziliyor.

## Kredi ve cüzdan islemleri

- `credit_requests`: antrenorlerin manuel kredi talepleri.
- `user_credits`: antrenor bazli bakiye.
- `credit_transactions`: bakiye hareket logu.
- Super admin kredi ekleyip dusurebiliyor, talebi onaylayip reddedebiliyor.

## Market ve siparis

- `products`: urun katalogu.
- `orders`: market siparisleri ve kredi paketi satin alimlari.
- Kredi paketi siparisi onaylaninca aliciya kredi aktariliyor.

## Kredi paketleri ve banka ayarlari

- `credit_packages`: kredi/fiyat paketleri.
- `app_settings/credit_purchase_bank`: EFT-Havale bilgileri.

## Reklam yonetimi

- `advertisements`: reklam kartlari.
- `homepage_settings/advertisement`: ana sayfada aktif reklam referansi.
- Reklamlar ana sayfaya aktive edilip kaldirilabiliyor.

## Kredi bozdurma

- `app_settings/credit_exchange_rate`: kredi-TL cevirim orani.
- `cash_withdrawal_requests`: antrenor bozdurma talepleri.
- Reddedilen talepte kredi `user_credits` belgesine geri ekleniyor ve `credit_transactions` kaydi olusuyor.
- `notifications`: antrenore karar bildirimi gidiyor.

## Barajlar ve yaris sonuclari

- `standards`: global veya kulup bazli barajlar.
- Manuel ekleme, duzenleme, silme ve filtreleme var.
- `race_result_imports`: yaris sonucu import ozeti.
- Performans eslestirme sonucu `performances` koleksiyonuna kayit dusulebiliyor.

## Sohbet

- `chats` ve `chats/{chatId}/messages` koleksiyonlari kullaniliyor.
- Birebir ve grup sohbetleri destekleniyor.
- Grup uye yonetimi, grup fotografi ve yeni grup olusturma var.

## Mobil tasarim karari

- Dashboard: kritik metrikler ve bekleyen isler.
- Admin Operasyonlari: admin olusturma, admin detay/odeme, basvuru kararlari.
- Finans Operasyonlari: kredi, kredi paketleri, siparis, bozdurma.
- Icerik Operasyonlari: market, reklam, baraj, yaris import izleme.
- Sohbet ve profil ortak sekmelerde calisir.