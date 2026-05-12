# Yuzme Mobile App

Expo tabanli mobil istemci. Bu uygulama mevcut web projesindeki Firebase Auth, Firestore ve Storage altyapisini kullanir.

## Kurulum

```bash
npm install
expo start
```

## Mimari

- React Native + Expo
- React Navigation ile stack + tab + role based navigation
- Firebase Auth + Firestore + Storage
- Zustand ile oturum ve offline queue store
- TanStack Query ile caching, retry ve veri esitleme

## Notlar

- Web projesindeki hicbir dosya degistirilmemistir.
- Tum mobil kodlar sadece `/mobile-app` altindadir.
- Realtime senkronizasyon Firestore `onSnapshot` dinleyicileri ile saglanir.