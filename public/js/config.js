// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEk3rweB33vuXh2j2vVLfCeYcoFCDJ5YU",
  authDomain: "course-abfe3.firebaseapp.com",
  projectId: "course-abfe3",
  storageBucket: "course-abfe3.appspot.com",
  messagingSenderId: "1093027241421",
  appId: "1:1093027241421:web:bb72890d59e40812c33884",
  measurementId: "G-CX86K5746H"
};

console.log('config.js: Firebase library durumu:', typeof firebase);

// Initialize Firebase (safer)
if (typeof firebase !== 'undefined') {
  try {
    window.firebaseApp = firebase.initializeApp(firebaseConfig);
    // Auth - Note: firebase.auth() may not be available if auth module not loaded yet
    if (firebase.auth) {
      window.auth = firebase.auth();
    } else {
      window.auth = undefined;
      console.warn('config.js: firebase.auth henüz mevcut değil (normal)');
    }

    // Firestore
    if (firebase.firestore) {
      try {
        window.db = firebase.firestore();
      } catch (e) {
        window.db = undefined;
        console.warn('config.js: firestore başlatılamadı:', e);
      }
    } else {
      window.db = undefined;
      console.warn('config.js: firebase.firestore mevcut değil');
    }

    // Storage
    if (firebase.storage) {
      try {
        window.storage = firebase.storage();
      } catch (e) {
        window.storage = undefined;
        console.warn('config.js: storage başlatılamadı:', e);
      }
    } else {
      window.storage = undefined;
      console.warn('config.js: firebase.storage mevcut değil');
    }

    console.log('config.js: Firebase başlatma tamamlandı');
  } catch (err) {
    console.error('config.js: Firebase initialize hatası:', err);
    window.auth = undefined;
    window.db = undefined;
  }
} else {
  console.error('config.js: Firebase kütüphanesi yüklenmedi!');
}

// Backward compatibility
const app = window.firebaseApp;
const auth = window.auth;
const db = window.db;
