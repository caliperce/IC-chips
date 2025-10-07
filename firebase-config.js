// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc} from "firebase/firestore";
import firebaseConfig from "./firebase-cred.json" with { type: "json" };
console.log(firebaseConfig);
const firebaseConfigObj = firebaseConfig.firebaseConfig;

// i have to parse the firebase-cred.json file
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
 const firebaseconfig = {
  apiKey: firebaseConfigObj.apiKey,
  authDomain: firebaseConfigObj.authDomain,
  projectId: firebaseConfigObj.projectId,
  storageBucket: firebaseConfigObj.storageBucket,
  messagingSenderId: firebaseConfigObj.messagingSenderId,
  appId: firebaseConfigObj.appId,
  measurementId: firebaseConfigObj.measurementId
}; 

// Initialize Firebase
const app = initializeApp(firebaseconfig);
const db = getFirestore(app);

// // Create a function to test the database connection (commented out to prevent auto-execution)
// async function testDatabase() {
//   try {
//     const docRef = doc(db, "test", "test");
//     await setDoc(docRef, { name: "John Doe", timestamp: new Date() });
//     console.log("✅ SUCCESS: Document written with ID: test");
//   } catch (error) {
//     console.error("❌ ERROR: Failed to write document:", error.message);
//     console.error("Error code:", error.code);
//   }
// }
// testDatabase();
// Export the app so other files can use it
export { app, db };