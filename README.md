# Yüzme Kulüp Yönetim Sistemi

Yüzme kulüpleri için kapsamlı yönetim platformu — hem **web (Firebase Hosting)** hem de **mobil (React Native / Expo)** üzerinden tam özellik paritesiyle çalışır.

## Roller

| Rol           | Temel Yetenekler |
|---------------|------------------|
| **Süper Admin** | Kulüp başvurularını onaylama, içerik yönetimi, sistem genel ayarları |
| **Admin**       | Şubeler, ders saatleri, fiyatlandırma, antrenör atamaları, giderler, raporlar |
| **Sekreter**    | Öğrenci kayıt/düzenleme, ön kayıt başvuruları, taksit & tahsilat, PDF rapor |
| **Antrenör**    | Yoklama, ödevler, performans (antrenman/yarış dereceleri), yapay zekâ destekli antrenman üretici |
| **Veli**        | Öğrenci ilerlemesi, taksitler, duyurular, etkinlikler, sohbet |

## Öne çıkan özellikler

- Public **ön kayıt formu** — kulübe özel gizli link, dinamik logo/video/metin, *Grup Dersi / Özel Ders* seçimi ve şube tercihi
- Sekreter ön kayıt panelinde **ders türü + şube filtresi**, başvurudan otomatik forma aktarma ve şubeye göre ders saati filtreleme
- Rol bazlı sohbet, AI destekli antrenman üretimi, taksit/tahsilat planlayıcı, PDF dışa aktarma
- **Mobil ↔ Web parite**: ortak veri modeli (`clubProfiles`, `schedules`, `students`, `branches`, `club_applications` …)
- `premium-system.css` tasarım dili: hem web hem mobil aynı renk paleti, gölgeler, tipografi

## Teknoloji yığını

- **Web:** Vanilla JS, HTML, CSS (Firebase Hosting üzerinden statik), Firebase SDK 8 (Auth, Firestore, Storage)
- **Mobil:** React Native + Expo, React Query, Zustand, Firebase Modular SDK, `expo-print`, `expo-sharing`, `expo-image-picker`
- **Backend:** Firebase (Auth + Firestore + Storage)

## Proje yapısı

```
public/                 # Web uygulaması (Firebase Hosting)
  pages/                # Rol bazlı sayfalar
  js/                   # Rol bazlı modüller + ortak yardımcılar
  css/                  # Tasarım sistemi + mobil responsive katmanı
  onkayit.html          # Public ön kayıt formu (token bazlı)

mobile-app/             # React Native / Expo uygulaması
  screens/              # Rol bazlı ekranlar
  components/           # Paylaşılan UI bileşenleri
  services/             # Firestore servis katmanı
  config/theme.js       # Web ile birebir aynı palet
  navigation/           # Rol bazlı navigation

firestore.rules         # Firestore güvenlik kuralları
firebase.json           # Firebase Hosting yapılandırması
```

## Kurulum

### Web
1. `public/js/config.js` içinde kendi Firebase proje bilgilerinizi tanımlayın.
2. Firestore Rules için `firestore.rules` dosyasını kullanın.
3. `firebase deploy --only hosting` ile yayına alın.

### Mobil
```bash
cd mobile-app
npm install
npx expo start
```

## Lisans

Bu proje özel kullanım amaçlıdır.
