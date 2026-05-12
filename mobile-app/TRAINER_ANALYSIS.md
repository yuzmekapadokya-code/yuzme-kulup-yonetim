# Trainer Mobile Analysis

Bu belge, web antrenor panelindeki ana akislarin mobil uygulamada nasil karsilanacagini ozetler.

## Ana Moduller

- Dashboard: kredi bakiyesi, ders grup sayisi, aktif sporcu sayisi, tahmini/odenmis kazanc ozeti.
- Classes: ders gruplari, antrenor musaitlik tercihleri, bitis takvimi, yoklama ve ders erteleme etkileri.
- Students and Comments: antrenore ait sporcular, ders yorumu girisi ve veliye yansiyan notlar.
- Performance: derece girisi, stil-mesafe bazli gecmis, rapor ve baraj karsilastirmasi.
- Workouts: workout olusturma, schedule ogrencilerine paylasma, silme ve satisa cikarma.
- Workout Market: diger antrenorlerin workoutlarini inceleme, pazarlik, satin alma ve sohbet baslatma.
- Credits and Finance: urun satin alma, kredi talebi, EFT ile kredi paketi siparisi ve kredi bozdurma.
- Standards: global, admin veya trainer kapsamli barajlarin goruntulenmesi.
- AI Workout: web panelinde de gecici kapali, mobilde bilgilendirme olarak tutulacak.

## Onemli Koleksiyonlar

- trainers, users
- branches, schedules, students
- attendance, lesson_comments, performances, standards
- workouts, student_workouts, active_workouts
- workout_sales, workout_library, notifications
- products, orders
- user_credits, credit_transactions, credit_requests, credit_packages
- cash_withdrawal_requests
- trainer_time_programs, trainer_time_preferences
- app_settings/credit_purchase_bank
- app_settings/credit_exchange_rate

## Mobil Uygulama Kararlari

- Trainer deneyimi generik dashboard yerine rol-ozel ekranlara ayrilacak.
- Workouts ve finance ayri operasyon ekranlarinda tutulacak.
- Firestore alan adlari web ile uyumlu tutulacak.
- AI workout akisi kapali oldugu icin mobilde de salt bilgilendirme olarak yer alacak.