import {
  isConfigured, auth, db, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "./firebase-app.js";

const $ = (id) => document.getElementById(id);
const loginView = $("loginView");
const adminView = $("adminView");
const setupNotice = $("setupNotice");

const defaultHome = {
  eyebrow: "GROUP TRAVEL MADE EASY",
  title1: "Travel together.",
  title2: "Plan smarter.",
  heroText: "Your resource for group flight information, travel planning and practical tips for a smooth and successful journey.",
  heroNote: "Get started on our main website.",
  contentEyebrow: "WHAT YOU'LL FIND",

contentTitle:
  "Useful travel information, without the clutter.",

contentText:
  "One clear content hub for group travel planning, tips and answers to common questions.",
  steps: [
    {title:"REQUEST A GROUP QUOTE", text:"Submit the group travel details on our website or contact us directly at 1-888-928-7796."},
    {title:"EXPERT WILL REVIEW THE QUOTE", text:"Our travel expert team will evaluate your details and look for suitable options to accommodate your request."},
    {title:"WE WILL SEND THE BEST OFFER", text:"Once we review your requirement, we will provide the best available options for your group within your budget."},
    {title:"FINALIZE THE BOOKING", text:"You get to accept one of the available offers and follow the instructions. Later, the e-ticket will be delivered to your email address."}
  ],
  features: [
    {title:"Group Travel Information", text:"Learn about group booking processes, airline requirements and important planning steps.", image:"assets/group-travel.jpg"},
    {title:"Travel Planning", text:"Practical ideas for organizing people, dates, routes and important trip details.", image:"assets/travel-planning.jpg"},
    {title:"Helpful Articles", text:"Easy-to-read travel content designed for people researching their next group journey.", image:"assets/travel-articles.jpg"}
  ]
};

const defaultSettings = {
  phone: "1-888-928-7796",
  email: "info@grouptravelairlines.com",
  quoteUrl: "https://www.grouptravelairlines.com/",
  topBarText: "Practical travel information for groups, families, teams and business travelers.",
  footerText: "Practical travel information for groups, families, teams and business travelers."
};

let posts = [];
let currentPostId = null;

function setMessage(id, text, good=false){
  const el = $(id); if(!el) return;
  el.textContent = text;
  el.style.color = good ? "#1f8f58" : "";
}

function slugify(text){
  return (text||"").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
}

function formatDate(value){
  if(!value) return "";
  if(typeof value.toDate === "function") return value.toDate().toLocaleDateString();
  const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

async function isAdminUser(user){
  if(!user || !db) return false;
  const ref = doc(db, "admins", user.uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

function openPanel(id){
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".side-link").forEach(b=>b.classList.remove("active"));
  $(id)?.classList.add("active");
  document.querySelector(`.side-link[data-panel="${id}"]`)?.classList.add("active");
}

async function loadPosts(){
  const snap = await getDocs(collection(db,"posts"));
  posts = snap.docs.map(d=>({id:d.id,...d.data()}));
  posts.sort((a,b)=>{
    const aa=a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const bb=b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return bb-aa;
  });
  renderPostList();
  renderStats();
}

function renderStats(){
  const published=posts.filter(p=>p.published).length;
  $("statTotal").textContent=posts.length;
  $("statPublished").textContent=published;
  $("statDrafts").textContent=posts.length-published;
  $("recentPosts").innerHTML = posts.slice(0,5).map(p=>`
    <div class="post-row" data-id="${p.id}">
      <strong>${escapeHtml(p.title||"Untitled")}</strong>
      <span>${p.published ? "Published" : "Draft"}${p.updatedAt ? " · "+formatDate(p.updatedAt) : ""}</span>
    </div>
  `).join("") || '<p class="muted">No posts yet.</p>';
  document.querySelectorAll("#recentPosts .post-row").forEach(r=>r.addEventListener("click",()=>{openPanel("postsPanel");loadPostIntoEditor(r.dataset.id)}));
}

function renderPostList(){
  $("postList").innerHTML = posts.map(p=>`
    <div class="post-row" data-id="${p.id}">
      <strong>${escapeHtml(p.title||"Untitled")}</strong>
      <span>${escapeHtml(p.category||"Travel")} · ${p.published ? "Published" : "Draft"}</span>
    </div>
  `).join("") || '<p class="muted">No posts yet. Click “New Post”.</p>';
  document.querySelectorAll("#postList .post-row").forEach(r=>r.addEventListener("click",()=>loadPostIntoEditor(r.dataset.id)));
}

function renderHomepageEditor(data){
  const h={...defaultHome,...data};
  $("homeEyebrow").value=h.eyebrow||"";
  $("homeTitle1").value=h.title1||"";
  $("homeTitle2").value=h.title2||"";
  $("homeHeroText").value=h.heroText||"";
  $("homeHeroNote").value=h.heroNote||"";
  $("homeContentEyebrow").value =
  h.contentEyebrow ||
  "WHAT YOU'LL FIND";

$("homeContentTitle").value =
  h.contentTitle ||
  "Useful travel information, without the clutter.";

$("homeContentText").value =
  h.contentText ||
  "One clear content hub for group travel planning, tips and answers to common questions.";
  $("stepsEditor").innerHTML=(h.steps||defaultHome.steps).map((s,i)=>`
    <div class="card" style="margin-bottom:12px;padding:16px">
      <label>Step ${i+1} title<input id="stepTitle${i}" value="${escapeAttr(s.title||"")}"></label>
      <label>Step ${i+1} text<textarea id="stepText${i}" rows="3">${escapeHtml(s.text||"")}</textarea></label>
    </div>
  `).join("");
}

async function loadHomepage(){
  const snap=await getDoc(doc(db,"siteSettings","home"));
  renderHomepageEditor(snap.exists()?snap.data():defaultHome);
}

async function loadSettings(){
  const snap=await getDoc(doc(db,"siteSettings","global"));
  const s=snap.exists()?snap.data():defaultSettings;
  $("settingPhone").value=s.phone||"";
  $("settingEmail").value=s.email||"";
  $("settingQuoteUrl").value=s.quoteUrl||"";
  $("settingTopBarText").value=s.topBarText||"";
  $("settingFooterText").value=s.footerText||"";
}

function newPost(){
  currentPostId=null;
  $("postForm").reset();
  $("postCategory").value="Travel Guide";
  $("postPublished").checked=false;
  $("postEditorTitle").textContent="New Blog Post";
  $("postStatusBadge").textContent="Draft";
  $("postStatusBadge").className="status draft";
  $("deletePostButton").classList.add("hidden");
  setMessage("postMessage","");
}

function loadPostIntoEditor(id){
  const p=posts.find(x=>x.id===id); if(!p) return;
  currentPostId=id;
  $("postTitle").value=p.title||"";
  $("postSlug").value=p.slug||"";
  $("postCategory").value=p.category||"Travel Guide";
  $("postImageUrl").value=p.imageUrl||"";
  $("postExcerpt").value=p.excerpt||"";
  $("postContent").value=p.content||"";
  $("postSeoTitle").value=p.seoTitle||"";
  $("postMetaDescription").value=p.metaDescription||"";
  $("postPublished").checked=!!p.published;
  $("postEditorTitle").textContent="Edit Blog Post";
  $("postStatusBadge").textContent=p.published?"Published":"Draft";
  $("postStatusBadge").className="status "+(p.published?"published":"draft");
  $("deletePostButton").classList.remove("hidden");
  setMessage("postMessage","");
}

async function handlePostSave(e){
  e.preventDefault();
  const title=$("postTitle").value.trim();
  const slug=($("postSlug").value.trim()||slugify(title));
  if(!title) return;
  const published=$("postPublished").checked;
  const payload={
    title,slug,
    category:$("postCategory").value.trim(),
    imageUrl:$("postImageUrl").value.trim(),
    excerpt:$("postExcerpt").value.trim(),
    content:$("postContent").value,
    seoTitle:$("postSeoTitle").value.trim()||title,
    metaDescription:$("postMetaDescription").value.trim()||$("postExcerpt").value.trim(),
    published,
    updatedAt:serverTimestamp()
  };
  try{
    if(currentPostId){
      if(published && !posts.find(p=>p.id===currentPostId)?.published) payload.publishedAt=serverTimestamp();
      await updateDoc(doc(db,"posts",currentPostId),payload);
    }else{
      payload.createdAt=serverTimestamp();
      if(published) payload.publishedAt=serverTimestamp();
      const ref=await addDoc(collection(db,"posts"),payload);
      currentPostId=ref.id;
    }
    setMessage("postMessage","Post saved.",true);
    await loadPosts();
    const saved=posts.find(p=>p.id===currentPostId); if(saved) loadPostIntoEditor(saved.id);
  }catch(err){setMessage("postMessage",err.message||"Save failed.");}
}

async function handlePostDelete(){
  if(!currentPostId) return;
  const p=posts.find(x=>x.id===currentPostId);
  if(!confirm(`Delete "${p?.title||"this post"}"?`)) return;
  try{
    await deleteDoc(doc(db,"posts",currentPostId));
    newPost();
    await loadPosts();
    setMessage("postMessage","Post deleted.",true);
  }catch(err){setMessage("postMessage",err.message||"Delete failed.");}
}

async function handleHomepageSave(e){
  e.preventDefault();
  const steps=[0,1,2,3].map(i=>({title:$(`stepTitle${i}`).value.trim(),text:$(`stepText${i}`).value.trim()}));
  const features=[0,1,2].map(i=>({title:$(`featureTitle${i}`).value.trim(),text:$(`featureText${i}`).value.trim(),image:$(`featureImage${i}`).value.trim()}));
  const data={
    eyebrow:$("homeEyebrow").value.trim(),
    title1:$("homeTitle1").value.trim(),
    title2:$("homeTitle2").value.trim(),
    heroText:$("homeHeroText").value.trim(),
    heroNote:$("homeHeroNote").value.trim(),
    steps,features,updatedAt:serverTimestamp()
  };
  try{await setDoc(doc(db,"siteSettings","home"),data,{merge:true});setMessage("homepageMessage","Homepage saved.",true);}
  catch(err){setMessage("homepageMessage",err.message||"Save failed.");}
}

async function handleSettingsSave(e){
  e.preventDefault();
  const data={
    phone:$("settingPhone").value.trim(),
    email:$("settingEmail").value.trim(),
    quoteUrl:$("settingQuoteUrl").value.trim(),
    topBarText:$("settingTopBarText").value.trim(),
    footerText:$("settingFooterText").value.trim(),
    updatedAt:serverTimestamp()
  };
  try{await setDoc(doc(db,"siteSettings","global"),data,{merge:true});setMessage("settingsMessage","Settings saved.",true);}
  catch(err){setMessage("settingsMessage",err.message||"Save failed.");}
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}

function bindUI(){
  document.querySelectorAll(".side-link").forEach(b=>b.addEventListener("click",()=>openPanel(b.dataset.panel)));
  document.querySelectorAll("[data-open-posts]").forEach(b=>b.addEventListener("click",()=>{openPanel("postsPanel");newPost()}));
  $("newPostButton").addEventListener("click",newPost);
  $("postForm").addEventListener("submit",handlePostSave);
  $("deletePostButton").addEventListener("click",handlePostDelete);
  $("homepageForm").addEventListener("submit",handleHomepageSave);
  $("settingsForm").addEventListener("submit",handleSettingsSave);
  $("logoutButton").addEventListener("click",()=>signOut(auth));
  $("loginForm").addEventListener("submit",async(e)=>{
    e.preventDefault();
    if(!isConfigured) return setMessage("loginMessage","Firebase is not configured yet.");
    try{await signInWithEmailAndPassword(auth,$("loginEmail").value,$("loginPassword").value);setMessage("loginMessage","Signing in...",true);}
    catch(err){setMessage("loginMessage",err.message||"Sign-in failed.");}
  });
  $("resetPassword").addEventListener("click",async()=>{
    if(!isConfigured) return setMessage("loginMessage","Firebase is not configured yet.");
    const email=$("loginEmail").value.trim();
    if(!email) return setMessage("loginMessage","Enter your email first.");
    try{await sendPasswordResetEmail(auth,email);setMessage("loginMessage","Password reset email sent.",true);}
    catch(err){setMessage("loginMessage",err.message||"Could not send reset email.");}
  });
}

if(!isConfigured){
  setupNotice.classList.remove("hidden");
  setupNotice.textContent="Firebase is not configured. Open firebase-config.js and replace the PASTE_* values from your Firebase Web App settings.";
  bindUI();
}else{
  bindUI();
  onAuthStateChanged(auth,async(user)=>{
    if(!user){
      loginView.classList.remove("hidden");
      adminView.classList.add("hidden");
      return;
    }
    try{
      const allowed=await isAdminUser(user);
      if(!allowed){
        await signOut(auth);
        return setMessage("loginMessage","This account is not authorized as an administrator.");
      }
      loginView.classList.add("hidden");
      adminView.classList.remove("hidden");
      $("currentEmail").textContent=user.email||"";
      await Promise.all([loadPosts(),loadHomepage(),loadSettings()]);
    }catch(err){
      adminView.classList.add("hidden");
      loginView.classList.remove("hidden");
      setMessage("loginMessage",err.message||"Admin access check failed.");
    }
  });
}
