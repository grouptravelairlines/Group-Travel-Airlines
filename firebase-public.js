
// PUBLIC SITE FIREBASE DATA LOADER
// This module safely reads only public content. Firestore Rules decide what can be read.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value && !value.startsWith("PASTE_")
);

const app = configured ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

export async function getPublicSettings() {
  if (!db) return null;
  const snap = await getDoc(doc(db,"siteSettings","global"));
  return snap.exists() ? snap.data() : null;
}

export async function getPublicHome() {
  if (!db) return null;
  const snap = await getDoc(doc(db,"siteSettings","home"));
  return snap.exists() ? snap.data() : null;
}

export async function getPublishedPosts() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db,"posts"), where("published","==",true)));
  return snap.docs
    .map(d=>({id:d.id,...d.data()}))
    .filter(p=>p.published)
    .sort((a,b)=>{
      const aa=a.publishedAt?.seconds || a.createdAt?.seconds || 0;
      const bb=b.publishedAt?.seconds || b.createdAt?.seconds || 0;
      return bb-aa;
    });
}

export async function getPostBySlug(slug) {
  const posts = await getPublishedPosts();
  return posts.find(p=>p.slug===slug) || null;
}
