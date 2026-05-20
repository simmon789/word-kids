import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBayp0T_Dq_HC8abs21Yc7Cesi8JPELIUA",
  authDomain: "word-star-kids.firebaseapp.com",
  projectId: "word-star-kids",
  storageBucket: "word-star-kids.firebasestorage.app",
  messagingSenderId: "818510968906",
  appId: "1:818510968906:web:4d4e47ed94b4ec2f738eb3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
