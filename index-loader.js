import {
  getPublicSettings,
  getPublicHome,
  getPublishedPosts
} from "./firebase-public.js";


const $ = (id) => document.getElementById(id);


function setText(id, value) {

  const el = $(id);

  if (
    el &&
    value !== undefined &&
    value !== null
  ) {

    el.textContent = value;

  }

}


function setQuoteLinks(value) {

  if (!value) return;

  document
    .querySelectorAll("[data-quote-link]")
    .forEach((el) => {

      el.href = value;

    });

}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/[&<>"']/g, (char) => {

      const map = {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

      };

      return map[char];

    });

}


function renderLatestPosts(posts) {

  const container = $("latestPosts");

  if (!container) return;


  const latest = posts.slice(0, 3);


  if (!latest.length) {

    container.innerHTML = `
      <div class="article-card">
        <div class="article-body">
          <span class="article-label">
            ARTICLES
          </span>

          <h2>
            New travel articles coming soon.
          </h2>

          <p>
            Original group travel content will appear here
            after it is published from the Admin panel.
          </p>
        </div>
      </div>
    `;

    return;

  }


  container.innerHTML = latest.map((post) => {

    const title =
      escapeHtml(post.title || "Untitled Article");

    const category =
      escapeHtml(post.category || "TRAVEL");

    const excerpt =
      escapeHtml(
        post.excerpt ||
        "Read the latest group travel information."
      );


    const slug =
      encodeURIComponent(post.slug || "");


    const image = post.imageUrl
      ? `
        <img
          class="article-image"
          src="${escapeHtml(post.imageUrl)}"
          alt="${title}">
      `
      : "";


    return `
      <article class="article-card">

        ${image}

        <div class="article-body">

          <span class="article-label">
            ${category}
          </span>

          <h2>
            ${title}
          </h2>

          <p>
            ${excerpt}
          </p>

          <a href="/blog/${slug}">
            Read article →
          </a>

        </div>

      </article>
    `;

  }).join("");

}


async function loadHomepageContent() {

  try {

    const [
      settings,
      home,
      posts
    ] = await Promise.all([

      getPublicSettings(),

      getPublicHome(),

      getPublishedPosts()

    ]);


    /* GLOBAL SETTINGS */

    if (settings) {

      setText(
        "siteTopBarText",
        settings.topBarText
      );

      setText(
        "siteFooterText",
        settings.footerText
      );

      setText(
        "sitePhoneTop",
        settings.phone
      );

      setText(
        "sitePhoneFooter",
        settings.phone
      );

      setText(
        "siteEmailTop",
        settings.email
      );

      setText(
        "siteEmailFooter",
        settings.email
      );


      const topPhone =
        $("sitePhoneTop");

      const footerPhone =
        $("sitePhoneFooter");

      const topEmail =
        $("siteEmailTop");

      const footerEmail =
        $("siteEmailFooter");


      if (
        topPhone &&
        settings.phone
      ) {

        topPhone.href =
          "tel:" +
          settings.phone.replace(/[^\d+]/g, "");

      }


      if (
        footerPhone &&
        settings.phone
      ) {

        footerPhone.href =
          "tel:" +
          settings.phone.replace(/[^\d+]/g, "");

      }


      if (
        topEmail &&
        settings.email
      ) {

        topEmail.href =
          "mailto:" +
          settings.email;

      }


      if (
        footerEmail &&
        settings.email
      ) {

        footerEmail.href =
          "mailto:" +
          settings.email;

      }


      setQuoteLinks(
        settings.quoteUrl
      );

    }



    /* HOMEPAGE CMS */

    if (home) {

      setText(
        "homeEyebrowPublic",
        home.eyebrow
      );

      setText(
        "homeTitle1Public",
        home.title1
      );

      setText(
        "homeTitle2Public",
        home.title2
      );

      setText(
        "homeHeroTextPublic",
        home.heroText
      );

      setText(
        "homeHeroNotePublic",
        home.heroNote
      );


      /*
       * WHAT YOU'LL FIND
       */

      setText(
        "homeContentEyebrowPublic",
        home.contentEyebrow
      );

      setText(
        "homeContentTitlePublic",
        home.contentTitle
      );

      setText(
        "homeContentTextPublic",
        home.contentText
      );


      /*
       * BOOKING STEPS
       */

      (home.steps || [])
        .forEach((step, i) => {

          setText(
            `stepTitlePublic${i}`,
            step.title
          );

          setText(
            `stepTextPublic${i}`,
            step.text
          );

        });

    }


    /*
     * LATEST BLOG POSTS
     */

    renderLatestPosts(posts);


  } catch (error) {

    console.warn(
      "Homepage CMS data unavailable:",
      error
    );

  }

}


loadHomepageContent();
