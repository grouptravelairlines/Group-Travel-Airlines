import fs from "node:fs/promises";
import path from "node:path";

import { initializeApp } from "firebase/app";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";

import { firebaseConfig } from "../firebase-config.js";

const ROOT = process.cwd();
const SITE = "https://grouptravelairlines.github.io";
const BLOG_DIR = path.join(ROOT, "blog");
const GENERATED_MARKER = "<!-- GENERATED-BY-HEALING-AGENT -->";

const esc = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const absoluteUrl = (value = "") => {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return `${SITE}${v}`;
  return `${SITE}/${v.replace(/^\.\//, "")}`;
};

const slugify = (value = "") => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

const asDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dateOnly = (value) => {
  const d = asDate(value);
  return d ? d.toISOString().slice(0, 10) : "";
};

const dateTime = (value) => {
  const d = asDate(value);
  return d ? d.toISOString() : "";
};

function seoBlock(canonical, title, description, image) {
  return `<!-- HEALING-AGENT-SEO:START -->
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Group Travel Airlines">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<!-- HEALING-AGENT-SEO:END -->`;
}

function upsertSeo(html, block) {
  const start = html.indexOf("<!-- HEALING-AGENT-SEO:START -->");
  const end = html.indexOf("<!-- HEALING-AGENT-SEO:END -->");
  if (start !== -1 && end !== -1 && end > start) {
    return html.slice(0, start) + block + html.slice(end + "<!-- HEALING-AGENT-SEO:END -->".length);
  }
  html = html.replace(/\s*<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, "\n");
  html = html.replace(/\s*<meta\b[^>]*property=["']og:[^"']+["'][^>]*>\s*/gi, "\n");
  html = html.replace(/\s*<meta\b[^>]*name=["']twitter:[^"']+["'][^>]*>\s*/gi, "\n");
  const titleEnd = html.match(/<\/title>/i);
  if (!titleEnd) throw new Error("Missing </title>");
  const insertAt = titleEnd.index + titleEnd[0].length;
  return html.slice(0, insertAt) + "\n" + block + "\n" + html.slice(insertAt);
}

async function patchStaticPages() {
  const files = [
    ["index.html", seoBlock(
      `${SITE}/`,
      "Group Travel Airlines | Group Travel Information",
      "Group travel airlines, flight insights, MICE group travel and practical planning ideas for smoother journeys.",
      `${SITE}/assets/hero-airplane.jpg`
    )],
    ["blog/index.html", seoBlock(
      `${SITE}/blog/`,
      "Blog | Group Travel Airlines",
      "Practical group travel guides, airline insights, booking information and travel planning tips.",
      `${SITE}/assets/travel-articles.jpg`
    )],
  ];

  for (const [file, block] of files) {
    const full = path.join(ROOT, file);
    const html = await fs.readFile(full, "utf8");
    await fs.writeFile(full, upsertSeo(html, block), "utf8");
  }

  const adminPath = path.join(ROOT, "admin.html");
  let admin = await fs.readFile(adminPath, "utf8");
  admin = admin.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)
    ? admin.replace(/<meta\b[^>]*name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow">')
    : admin.replace(/<\/head>/i, '<meta name="robots" content="noindex,nofollow">\n</head>');
  await fs.writeFile(adminPath, admin, "utf8");

  const postPath = path.join(ROOT, "post.html");
  let post = await fs.readFile(postPath, "utf8");
  post = post.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)
    ? post.replace(/<meta\b[^>]*name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,follow">')
    : post.replace(/<\/head>/i, '<meta name="robots" content="noindex,follow">\n</head>');
  await fs.writeFile(postPath, post, "utf8");
}

function articleHtml(post, slug) {
  const url = `${SITE}/blog/${slug}`;
  const title = String(post.title || "Untitled");
  const desc = String(post.metaDescription || post.excerpt || title).trim();
  const image = absoluteUrl(post.imageUrl || "");
  const alt = String(post.imageAlt || title).trim();
  const category = String(post.category || "TRAVEL").trim();
  const content = String(post.content || "");
  const published = dateTime(post.createdAt);
  const modified = dateTime(post.updatedAt || post.createdAt);
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: desc,
    url,
    mainEntityOfPage: url,
    image: image ? [image] : undefined,
    author: { "@type": "Organization", name: "Group Travel Airlines" },
    publisher: {
      "@type": "Organization",
      name: "Group Travel Airlines",
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo.png` },
    },
    datePublished: published || undefined,
    dateModified: modified || undefined,
  };

  return `---
permalink: /blog/${slug}
---
<!doctype html>
<html lang="en">
<head>
${GENERATED_MARKER}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<title>${esc(post.seoTitle || title)}</title>
<link rel="stylesheet" href="/styles.css">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Group Travel Airlines">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ""}
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
.post-wrap{padding:70px 0}.post-shell{max-width:880px;margin:auto}.post-kicker{color:var(--blue);font-weight:900;letter-spacing:.08em;font-size:12px}.post-shell h1{font-size:clamp(40px,6vw,64px);line-height:1.02;color:var(--navy);letter-spacing:-.04em;margin:10px 0 16px}.post-meta{color:var(--muted);font-size:14px;margin-bottom:30px}.post-hero{width:100%;max-height:480px;object-fit:cover;border-radius:18px;margin:0 0 32px}.post-content{font-size:17px;color:#3e4b60}.post-content p{margin:0 0 18px}.post-content h2{margin-top:32px}.post-content h3{margin-top:26px}.post-content img{max-width:100%;height:auto}.post-content a{color:var(--blue)}
</style>
</head>
<body>
<div class="topbar"><div class="container topbar-inner"><span>Ideas, insights and inspiration for smarter group and business travel.</span><div class="contact-line"><a href="mailto:info@grouptravelairlines.com">info@grouptravelairlines.com</a><span>|</span><a href="tel:18889287796">1-888-928-7796</a></div></div></div>
<header class="site-header"><div class="container nav-inner"><a class="brand" href="/"><img src="/assets/logo.png" alt="Group Travel Airlines"></a><nav class="main-nav"><a href="/">Home</a><a class="active" href="/blog/">Blog</a></nav></div></header>
<main class="post-wrap"><div class="container post-shell"><p class="post-kicker">${esc(category)}</p><h1>${esc(title)}</h1><div class="post-meta">Group Travel Airlines</div>${image ? `<img class="post-hero" src="${esc(image)}" alt="${esc(alt)}">` : ""}<article class="post-content">${content}</article></div></main>
<footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><img src="/assets/logo.png" alt="Group Travel Airlines"><p>Practical travel information for groups, families, teams and business travelers.</p></div><div><h3>Quick Links</h3><a href="/">Home</a><a href="/blog/">Blog</a></div><div><h3>Contact Us</h3><a href="tel:18889287796">1-888-928-7796</a><a href="mailto:info@grouptravelairlines.com">info@grouptravelairlines.com</a></div></div><div class="container footer-bottom"><span>© 2026 Group Travel Airlines. All rights reserved.</span></div></footer>
</body></html>`;
}

async function loadPosts() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const q = query(collection(db, "posts"), where("published", "==", true));
  const snap = await getDocs(q);
  const posts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).map((post) => ({
    ...post,
    slug: slugify(post.slug || post.title || ""),
  })).filter((post) => post.slug && post.title);

  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.slug)) throw new Error(`Duplicate published slug: ${post.slug}`);
    seen.add(post.slug);
  }
  return posts.sort((a, b) => (asDate(b.updatedAt || b.createdAt)?.getTime() || 0) - (asDate(a.updatedAt || a.createdAt)?.getTime() || 0));
}

async function writeRobots() {
  await fs.writeFile(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /post.html\n\nSitemap: ${SITE}/sitemap.xml\n`, "utf8");
}

async function writeSitemap(posts) {
  const entries = [
    [`${SITE}/`, ""],
    [`${SITE}/blog/`, ""],
    ...posts.map((p) => [`${SITE}/blog/${p.slug}`, dateOnly(p.updatedAt || p.createdAt)]),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([loc, lastmod]) => `  <url>\n    <loc>${esc(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}  </url>`).join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

async function writeArticles(posts) {
  await fs.mkdir(BLOG_DIR, { recursive: true });

  const activeFiles = new Set(
    posts.map((post) => `${post.slug}.html`)
  );

  // Remove old generated article folders.
  // These created the unwanted trailing-slash URLs.
  for (const entry of await fs.readdir(BLOG_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const oldFile = path.join(
      BLOG_DIR,
      entry.name,
      "index.html"
    );

    try {
      const html = await fs.readFile(oldFile, "utf8");

      if (html.includes(GENERATED_MARKER)) {
        await fs.rm(
          path.join(BLOG_DIR, entry.name),
          {
            recursive: true,
            force: true
          }
        );
      }
    } catch {}
  }

  // Create Jekyll source files.
  // Example:
  // blog/how-to-book-an-air-transat-group-flight.html
  for (const post of posts) {
    const file = path.join(
      BLOG_DIR,
      `${post.slug}.html`
    );

    await fs.writeFile(
      file,
      articleHtml(post, post.slug),
      "utf8"
    );
  }

  // Remove old generated flat article files
  // that are no longer published.
  for (const entry of await fs.readdir(BLOG_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    // Never remove the main Blog page.
    if (entry.name === "index.html") continue;

    if (!activeFiles.has(entry.name)) {
      const file = path.join(
        BLOG_DIR,
        entry.name
      );

      try {
        const html = await fs.readFile(file, "utf8");

        if (html.includes(GENERATED_MARKER)) {
          await fs.rm(file, {
            force: true
          });
        }
      } catch {}
    }
  }
}

async function main() {
  console.log("Healing Agent started");
  await patchStaticPages();
  await writeRobots();
  const posts = await loadPosts();
  await writeArticles(posts);
  await writeSitemap(posts);
  console.log(`Healing Agent completed. Published posts: ${posts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
