import { getPublishedPosts } from "./firebase-public.js";

const grid = document.querySelector("#dynamicArticles");
const fallback = document.querySelector("#fallbackArticles");

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

try {
  const posts = await getPublishedPosts();
  if (posts.length) {
    fallback?.remove();
    grid.innerHTML = posts.map(p => `
      <article class="article-card">
        <img class="article-image" src="${esc(p.imageUrl || 'assets/group-travel.jpg')}" alt="">
        <div class="article-body">
          <span class="article-label">${esc(p.category || "TRAVEL")}</span>
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.excerpt || "")}</p>
          <a href="/blog/${encodeURIComponent(p.slug || "")}">Read article →</a>
        </div>
      </article>
    `).join("");
  }
} catch (err) {
  console.warn("Firebase Blog fallback:", err);
}
