import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAbcTG6pApsXd7vN-4kkCeanGksDIx2rwU",
  authDomain: "upasthiti-155fd.firebaseapp.com",
  projectId: "upasthiti-155fd",
  storageBucket: "upasthiti-155fd.firebasestorage.app",
  messagingSenderId: "330453900881",
  appId: "1:330453900881:web:a35234564eead218a22270"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export {auth}