import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// IMPORTANT: Replace this with your own Firebase project's configuration.
// You can find this in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyCQJV7sRFMBdYdifjuwUx7ML4iSbJJaGPc",
  authDomain: "ridelinkapp-93b09.firebaseapp.com",
  projectId: "ridelinkapp-93b09",
  storageBucket: "ridelinkapp-93b09.firebasestorage.app",
  messagingSenderId: "688616778948",
  appId: "1:688616778948:web:6e30b77369c50f5741ed91",
  measurementId: "G-GM64VKNH0S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);