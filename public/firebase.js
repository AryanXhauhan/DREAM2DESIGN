// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { 
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAQR8q-v3lC2W6enbx9sLQ1B1BVAR9IuiY",
  authDomain: "dream2design-465c2.firebaseapp.com",
  projectId: "dream2design-465c2",
  storageBucket: "dream2design-465c2.appspot.com",
  messagingSenderId: "204548058585",
  appId: "1:204548058585:web:1615604ba3c085a06b3dc8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged };