import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import type { Saved } from "./types";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

export type CloudUser = Pick<User, "uid" | "displayName" | "email">;

export const cloud = {
  onUser: (cb: (u: CloudUser | null) => void) => onAuthStateChanged(auth, cb),
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()).then(() => undefined),
  signOut: () => signOut(auth),
  idToken: () => auth.currentUser?.getIdToken() ?? Promise.resolve(null),
  watchSaved: (uid: string, cb: (items: Saved[]) => void) =>
    onSnapshot(collection(db, "users", uid, "saved"), (snap) => cb(snap.docs.map((d) => d.data() as Saved))),
  put: (uid: string, item: Saved) => setDoc(doc(db, "users", uid, "saved", item.id), item),
  del: (uid: string, id: string) => deleteDoc(doc(db, "users", uid, "saved", id)),
  watchState: (uid: string, cb: (d: Record<string, string> | undefined) => void) =>
    onSnapshot(doc(db, "users", uid, "config", "state"), (s) => cb(s.data() as Record<string, string> | undefined)),
  mergeState: (uid: string, data: Record<string, string>) => setDoc(doc(db, "users", uid, "config", "state"), data, { merge: true }),
};
