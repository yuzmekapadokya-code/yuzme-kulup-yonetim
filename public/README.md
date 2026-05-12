# 🏊 Yüzme Kurs Yönetim Sistemi

Profesyonel ve modern bir yüzme kurs yönetim web uygulaması.

## 📋 Özellikler

### 👨‍💼 Yönetici Paneli
- **Şube Yönetimi**: Yeni şube açma, düzenleme ve silme
- **Antrenör Yönetimi**: Antrenörleri oluşturma ve birden fazla şubeye atama
- **Ders Saatleri**: Her şubeye ders saatleri ekleme
- **Fiyatlandırma**: Her şube ve ders saatine ayrı fiyat belirleme
- **Gelir/Gider Tablosu**: Grafik görüntüleme ile gelir gider takibi
- **Duyurular**: Herkese, antrenörlere veya belirli saatlere duyuru gönderme
- **Dashboard**: İstatistikler ve özet bilgiler

### 📝 Sekreter Paneli
- **Öğrenci Kayıt**: Ad, soyad, yaş, telefon, veli bilgileri, adres ve taksit bilgileri
- **Fiyat Entegrasyonu**: Seçilen şube-saat üzerinden otomatik fiyat çekme
- **Veli Hesabı**: Otomatik olarak veli için giriş hesabı oluşturma
- **Kayıtlı Öğrenciler**: Mevcut kayıtları görüntüleme, düzenleme ve silme

### 👨‍👩‍👧 Veli Paneli
- **Öğrenci Bilgileri**: Kayıtlı öğrencinin bilgilerini görüntüleme
- **Ödeme Durumu**: 
  - Toplam tutar, ödenen tutar, kalan tutar
  - Taksit planı ve ödemeler
  - Taksit durumları (Ödendi/Beklemede)
- **Devam Durumu**: 
  - Katılan/katılmayan dersler
  - Devam yüzdesi
  - Grafik gösterim
- **Duyurular**: Kendisine gönderilen duyuruları görüntüleme

### 🏊 Antrenör Paneli
- **Antrenman Oluşturma**: Mesafe, stil ve mola süresi ile antrenman hazırlama
- **Antrenman Yayınlama**: Antrenmanları taslak/yayınlı olarak yönetme
- **Kronometer**: 
  - Profesyonel zamanlayıcı
  - Her 50 metre için otomatik mola
  - Mola süresi (son 4 saniyede sıradaki egzersiz gösterimi)
  - Canlı egzersiz görüntüleme

## 🔐 Kullanıcı Rolleri ve Giriş

### Test Hesapları (Setup sonrası)
```
Yönetici:
Email: admin@yuzme.com
Şifre: Admin123

Sekreter:
Email: secretary@yuzme.com
Şifre: Secretary123

Antrenör:
Email: trainer@yuzme.com
Şifre: Trainer123

Veli (Örnek):
Email: parent@yuzme.com
Şifre: Parent123
```

## 🚀 Başlangıç

### 1. Proje Dosyalarını Aç
```
yüzme/
├── index.html              # Giriş sayfası
├── setup.html              # Firebase Setup
├── pages/
│   ├── admin.html          # Yönetici paneli
│   ├── secretary.html      # Sekreter paneli
│   ├── parent.html         # Veli paneli
│   └── trainer.html        # Antrenör paneli
├── js/
│   ├── config.js           # Firebase config
│   ├── auth.js             # Giriş sistemi
│   ├── admin.js            # Yönetici JS
│   ├── secretary.js        # Sekreter JS
│   ├── parent.js           # Veli JS
│   └── trainer.js          # Antrenör JS
└── css/
    ├── style.css           # Ana stiller
    ├── admin.css           # Yönetici CSS
    ├── secretary.css       # Sekreter CSS
    ├── parent.css          # Veli CSS
    └── trainer.css         # Antrenör CSS
```

### 2. Firebase Setup'ı Çalıştır
1. Browser'da `setup.html` dosyasını aç
2. "Firebase Setup Başla" butonuna tıkla
3. "Test Verisi Ekle" butonuna tıkla
4. Sekreter güvenlik kurallarını Firebase Console'a kopyala

### 3. Giriş Yap
1. `index.html` sayfasına git
2. Test hesaplarından birini kullan
3. Rol seçtiğinde ilgili panele yönlendirileceksin

## 📱 Sayfalar

### Giriş Sayfası (index.html)
- Firebase Authentication ile e-mail/şifre giriş
- Kullanıcı rolüne göre otomatik yönlendirme

### Yönetici Paneli (pages/admin.html)
- Dashboard, Şubeler, Antrenörler, Ders Saatleri
- Fiyatlandırma, Duyurular, Gelir/Gider

### Sekreter Paneli (pages/secretary.html)
- Öğrenci Kayıt Formu
- Kayıtlı Öğrenciler Listesi

### Veli Paneli (pages/parent.html)
- Özet (Toplam tutar, ödenen, kalan)
- Ödeme Durumu
- Devam Durumu
- Duyurular

### Antrenör Paneli (pages/trainer.html)
- Dashboard
- Antrenmanlar
- Dersler
- Öğrenciler
- Kronometer (Mükemmel zamanlayıcı)

## 🛠️ Teknolojiler

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase Firestore Database
- **Kimlik Doğrulama**: Firebase Authentication
- **Grafik**: Chart.js
- **Responsive**: Mobile-first tasarım

## 📊 Firestore Koleksiyonları

```
users/          - Kullanıcı hesapları
branches/       - Şubeler
trainers/       - Antrenörler
schedules/      - Ders saatleri
students/       - Öğrenciler
prices/         - Fiyatlandırma
workouts/       - Antrenmanlar
announcements/  - Duyurular
expenses/       - Gider kayıtları
```

## 🎨 Tasarım

- Modern ve profesyonel UI
- Responsive (Mobil uyumlu)
- Gradyan arka planlar
- Gölge ve animasyonlar
- Kolay kullanılabilir arayüz

## ✨ Kronometer Özellikleri

- **Zamanlayıcı**: Gerçek zamanlı sayaç
- **Mola**: Egzersiz aralıklarında otomatik mola
- **Geri Sayış**: Mola süresinde geri sayış
- **Sırada Olanı Gösterme**: Mola süresi son 4 saniyede sıradaki egzersizi gösterme
- **Egzersiz Listesi**: Tüm egzersizlerin görsel gösterimi
- **Kontrol Butonları**: Başlat, Duraklat, Devam Et, Mola, Sonraki, Bitir

## 📞 İletişim

Firebase Firestore ve Authentication üzerinde çalışan tam entegre sistem.

---

**Sürüm**: 1.0.0  
**Tarih**: 2026  
**Dil**: Türkçe
