import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getDatabase, ref, serverTimestamp } from "firebase/database";
import type { Settings } from "./host";

export const firebaseConfig = {
  apiKey: "AIzaSyC9lCeWVjub1JjNjPmtzolQxX3W6au2160",
  authDomain: "kajiang.firebaseapp.com",
  databaseURL: "https://kajiang-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kajiang",
  storageBucket: "kajiang.firebasestorage.app",
  messagingSenderId: "692392324756",
  appId: "1:692392324756:web:15e3983b46cf4d04058e81",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
auth.languageCode = "zh-TW";

if (import.meta.env.VITE_FIREBASE_EMULATOR === "1") {
  const { connectAuthEmulator } = await import("firebase/auth");
  const { connectDatabaseEmulator } = await import("firebase/database");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

export function roomPath(code: string, child = ""): string {
  return `rooms/${code}${child ? `/${child}` : ""}`;
}
export function roomRef(code: string, child = "") {
  return ref(db, roomPath(code, child));
}
export { onAuthStateChanged, serverTimestamp, ref };
export type { User };

export function defaultSettings(): Settings {
  return { len: "quan", base: 50, per: 20, anim: "normal" };
}

export function shareUrl(code: string): string {
  const url = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  url.searchParams.set("room", code);
  return url.toString();
}

const KNOWN = "kajiang.rooms";
export function rememberRoom(code: string): void {
  const all = knownRooms().filter((c) => c !== code);
  all.unshift(code);
  localStorage.setItem(KNOWN, JSON.stringify(all.slice(0, 12)));
}
export function knownRooms(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KNOWN) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function savedName(): string {
  return localStorage.getItem("kajiang.name") || "";
}
export function saveName(name: string): void {
  localStorage.setItem("kajiang.name", name);
}

export async function ensureUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
