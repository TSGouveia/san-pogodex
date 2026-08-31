import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const firebaseConfig = {
  apiKey: "AIzaSyAHsUktWNFdK8IiOYSAchnFxR-pqVQZJbU",
  authDomain: isLocalhost ? "pogo-website-14a46.firebaseapp.com" : window.location.hostname,
  projectId: "pogo-website-14a46",
  storageBucket: "pogo-website-14a46.firebasestorage.app",
  messagingSenderId: "591678243465",
  appId: "1:591678243465:web:46d3d8acb9bd7a235b7c58",
  measurementId: "G-TL1BB2E8QY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with local IndexedDB persistence (critical for mobile browsers)
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});

export const db = getFirestore(app);
