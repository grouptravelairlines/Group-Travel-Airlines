import {
  isConfigured,
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
deleteDoc,
serverTimestamp
} from "./firebase-app.js";


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const adminView = $("adminView");
const setupNotice = $("setupNotice");

let posts = [];
let currentPostId = null;
let slugManuallyChanged = false;
let quillEditor = null;


/* =========================================================
   CLOUDINARY
========================================================= */

const CLOUDINARY_CLOUD_NAME = "dceou5iz";

const CLOUDINARY_UPLOAD_PRESET =
  "group_travel_blog_images";

const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


/* =========================================================
   DEFAULT HOMEPAGE
========================================================= */

const defaultHome = {

  eyebrow: "GROUP TRAVEL MADE EASY",

  title1: "Travel together.",

  title2: "Plan smarter.",

  heroText:
    "Your resource for group flight information, travel planning and practical tips for a smooth and successful journey.",

  heroNote:
    "Get started on our main website.",

  contentEyebrow:
    "WHAT YOU'LL FIND",

  contentTitle:
    "Useful travel information, without the clutter.",

  contentText:
    "One clear content hub for group travel planning, tips and answers to common questions.",

  steps: [
    {
      title: "REQUEST A GROUP QUOTE",
      text:
        "Submit the group travel details on our website or contact us directly at 1-888-928-7796."
    },
    {
      title: "EXPERT WILL REVIEW THE QUOTE",
      text:
        "Our travel expert team will evaluate your details and look for suitable options to accommodate your request."
    },
    {
      title: "WE WILL SEND THE BEST OFFER",
      text:
        "Once we review your requirement, we will provide the best available options for your group within your budget."
    },
    {
      title: "FINALIZE THE BOOKING",
      text:
        "You get to accept one of the available offers and follow the instructions. Later, the e-ticket will be delivered to your email address."
    }
  ]

};


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const defaultSettings = {

  phone:
    "1-888-928-7796",

  email:
    "info@grouptravelairlines.com",

  quoteUrl:
    "https://www.grouptravelairlines.com/",

  topBarText:
    "Practical travel information for groups, families, teams and business travelers.",

  footerText:
    "Practical travel information for groups, families, teams and business travelers."

};


/* =========================================================
   MESSAGES
========================================================= */

function setMessage(
  id,
  text,
  good = false
) {

  const element = $(id);

  if (!element) {
    return;
  }

  element.textContent = text;

  element.style.color =
    good
      ? "#1f8f58"
      : "";

}


/* =========================================================
   SLUG
========================================================= */

function slugify(text) {

  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

  if (!value) {
    return "";
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toLocaleDateString();
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString();

}


/* =========================================================
   ADMIN CHECK
========================================================= */

async function isAdminUser(user) {

  if (!user || !db) {
    return false;
  }

  const adminRef =
    doc(
      db,
      "admins",
      user.uid
    );

  const snapshot =
    await getDoc(adminRef);

  return snapshot.exists();

}


/* =========================================================
   PANEL NAVIGATION
========================================================= */

function openPanel(id) {

  document
    .querySelectorAll(".panel")
    .forEach(panel => {
      panel.classList.remove(
        "active"
      );
    });


  document
    .querySelectorAll(".side-link")
    .forEach(button => {
      button.classList.remove(
        "active"
      );
    });


  $(id)?.classList.add(
    "active"
  );


  document
    .querySelector(
      `.side-link[data-panel="${id}"]`
    )
    ?.classList.add(
      "active"
    );

}


/* =========================================================
   QUILL RICH TEXT EDITOR
========================================================= */

function initializeRichEditor() {

  if (typeof window.Quill === "undefined") {

    setMessage(
      "postMessage",
      "Rich text editor could not be loaded."
    );

    return;
  }

  const editorElement =
    $("postContentEditor");

  if (!editorElement) {
    return;
  }

  quillEditor = new window.Quill(
    editorElement,
    {
      theme: "snow",

      placeholder:
        "Write your article here...",

      modules: {

        toolbar: {
          container: "#editorToolbar",

          handlers: {

            link: function(value) {

              if (!value) {
                this.quill.format(
                  "link",
                  false
                );
                return;
              }

              const range =
                this.quill.getSelection();

              if (!range) {
                return;
              }

              const url =
                window.prompt(
                  "Enter the URL:",
                  "https://"
                );

              if (url) {

                this.quill.format(
                  "link",
                  url
                );

              }

            }

          }

        }

      }

    }
  );


  quillEditor.on(
    "text-change",
    () => {

      syncRichTextFields();

    }
  );

}


/* =========================================================
   RICH TEXT → FIRESTORE FIELDS
========================================================= */

function syncRichTextFields() {

  if (!quillEditor) {
    return;
  }


  const html =
    quillEditor.root.innerHTML;


  const text =
    quillEditor
      .getText()
      .replace(/\s+/g, " ")
      .trim();


  $("postContent").value =
    text
      ? html
      : "";


  const generatedExcerpt =
    createExcerpt(text);


  $("postExcerpt").value =
    generatedExcerpt;

}


/* =========================================================
   AUTOMATIC EXCERPT
========================================================= */

function createExcerpt(
  text,
  length = 180
) {

  const clean =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();


  if (
    clean.length <= length
  ) {
    return clean;
  }


  return (
    clean
      .slice(0, length)
      .replace(/\s+\S*$/, "")
      .trim() +
    "…"
  );

}


/* =========================================================
   LOAD POSTS
========================================================= */

async function loadPosts() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "posts"
      )
    );


  posts =
    snapshot.docs.map(
      document => ({
        id: document.id,
        ...document.data()
      })
    );


  posts.sort(
    (a, b) => {

      const aTime =
        a.updatedAt?.seconds ||
        a.createdAt?.seconds ||
        0;

      const bTime =
        b.updatedAt?.seconds ||
        b.createdAt?.seconds ||
        0;

      return bTime - aTime;

    }
  );


  renderPostList();

  renderStats();

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderStats() {

  const published =
    posts.filter(
      post =>
        post.published === true
    ).length;


  $("statTotal").textContent =
    posts.length;


  $("statPublished").textContent =
    published;


  $("statDrafts").textContent =
    posts.length - published;


  $("recentPosts").innerHTML =
    posts
      .slice(0, 5)
      .map(
        post => `

          <div
            class="post-row"
            data-id="${post.id}"
          >

            <strong>
              ${escapeHtml(
                post.title ||
                "Untitled"
              )}
            </strong>

            <span>
              ${
                post.published
                  ? "Published"
                  : "Draft"
              }

              ${
                post.updatedAt
                  ? " · " +
                    formatDate(
                      post.updatedAt
                    )
                  : ""
              }
            </span>

          </div>

        `
      )
      .join("")

    ||

    '<p class="muted">No posts yet.</p>';


  document
    .querySelectorAll(
      "#recentPosts .post-row"
    )
    .forEach(row => {

      row.addEventListener(
        "click",
        () => {

          openPanel(
            "postsPanel"
          );

          loadPostIntoEditor(
            row.dataset.id
          );

        }
      );

    });

}


/* =========================================================
   POST LIST
========================================================= */

function renderPostList(){

  $("postList").innerHTML = posts.map(p=>`
    <div class="post-row" data-id="${p.id}">

      <div class="post-row-content">
        <strong>
          ${escapeHtml(p.title || "Untitled")}
        </strong>

        <span>
          ${escapeHtml(p.category || "Travel")}
          ·
          ${p.published ? "Published" : "Draft"}
        </span>
      </div>

      <button
        type="button"
        class="danger post-delete-button"
        data-delete-id="${p.id}"
      >
        Delete
      </button>

    </div>
  `).join("") || '<p class="muted">No posts yet. Click “New Post”.</p>';


  document
    .querySelectorAll("#postList .post-row")
    .forEach(row => {

      row.addEventListener(
        "click",
        () => {
          loadPostIntoEditor(
            row.dataset.id
          );
        }
      );

    });


  document
    .querySelectorAll(".post-delete-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        async event => {

          event.stopPropagation();

          const postId =
            button.dataset.deleteId;

          const post =
            posts.find(
              p => p.id === postId
            );

          if (!post) {
            return;
          }

          const confirmed =
            confirm(
              `Delete "${post.title || "this post"}"?`
            );

          if (!confirmed) {
            return;
          }

          try {

            await deleteDoc(
              doc(
                db,
                "posts",
                postId
              )
            );

            if (currentPostId === postId) {
              newPost();
            }

            await loadPosts();

            setMessage(
              "postMessage",
              "Post deleted.",
              true
            );

          } catch (err) {

            setMessage(
              "postMessage",
              err.message ||
                "Delete failed."
            );

          }

        }
      );

    });

}


/* =========================================================
   NEW POST
========================================================= */

function newPost() {

  currentPostId = null;

  slugManuallyChanged = false;


  $("postForm")?.reset();


  $("postEditorTitle").textContent =
    "New Blog Post";


  $("postStatusBadge").textContent =
    "Draft";


  $("postStatusBadge").className =
    "status draft";


  $("postPublished").checked =
    false;


  $("publishSummary").textContent =
    "Save as draft";


  $("postImageUrl").value =
    "";


  $("postImageAlt").value =
    "";


  $("postContent").value =
    "";


  $("postExcerpt").value =
    "";


  if (quillEditor) {

    quillEditor.setText(
      ""
    );

  }


  updatePostImagePreview(
    ""
  );


  setUploadStatus(
    ""
  );


  setMessage(
    "postMessage",
    ""
  );

}


/* =========================================================
   LOAD POST
========================================================= */

function loadPostIntoEditor(id) {

  const post =
    posts.find(
      item =>
        item.id === id
    );


  if (!post) {
    return;
  }


  currentPostId = id;


  slugManuallyChanged =
    !!post.slug;


  $("postTitle").value =
    post.title || "";


  $("postSlug").value =
    post.slug ||
    slugify(
      post.title
    );


  $("postFocusKeyphrase").value =
    post.focusKeyphrase ||
    "";


  $("postSeoTitle").value =
    post.seoTitle ||
    post.title ||
    "";


  $("postMetaDescription").value =
    post.metaDescription ||
    "";


  $("postImageUrl").value =
    post.imageUrl ||
    "";


  $("postImageAlt").value =
    post.imageAlt ||
    "";


  $("postPublished").checked =
    !!post.published;


  $("postEditorTitle").textContent =
    "Edit Blog Post";


  $("postStatusBadge").textContent =
    post.published
      ? "Published"
      : "Draft";


  $("postStatusBadge").className =
    "status " +
    (
      post.published
        ? "published"
        : "draft"
    );


  $("publishSummary").textContent =
    post.published
      ? "This post is published"
      : "Save as draft";


  if (quillEditor) {

    quillEditor.setText(
      ""
    );


    if (post.content) {

      quillEditor.clipboard.dangerouslyPasteHTML(
        post.content
      );

    }

  }


  syncRichTextFields();


  updatePostImagePreview(
    post.imageUrl || ""
  );


  setUploadStatus(
    ""
  );


  setMessage(
    "postMessage",
    ""
  );

}


/* =========================================================
   SAVE POST
========================================================= */

async function savePost(
  publishedValue
) {

  syncRichTextFields();


  const title =
    $("postTitle")
      .value
      .trim();


  if (!title) {

    setMessage(
      "postMessage",
      "Please enter an article title."
    );

    $("postTitle").focus();

    return;

  }


  const slug =
    $("postSlug")
      .value
      .trim() ||
    slugify(title);


  if (!slug) {

    setMessage(
      "postMessage",
      "Please enter a valid slug."
    );

    return;

  }


  const content =
    $("postContent")
      .value
      .trim();


  if (!content) {

    setMessage(
      "postMessage",
      "Please write some article content."
    );

    return;

  }


  const published =
    publishedValue === true;


  const previousPost =
    currentPostId
      ? posts.find(
          post =>
            post.id ===
            currentPostId
        )
      : null;


  const excerpt =
    $("postExcerpt")
      .value
      .trim();


  const metaDescription =
    $("postMetaDescription")
      .value
      .trim();


  const payload = {

    title,

    slug,

    category:
      "Travel Blog",

    focusKeyphrase:
      $("postFocusKeyphrase")
        .value
        .trim(),

    imageUrl:
      $("postImageUrl")
        .value
        .trim(),

    imageAlt:
      $("postImageAlt")
        .value
        .trim(),

    excerpt,

    content,

    seoTitle:
      $("postSeoTitle")
        .value
        .trim() ||
      title,

    metaDescription:
      metaDescription ||
      excerpt,

    published,

    updatedAt:
      serverTimestamp()

  };


  try {

    if (currentPostId) {

      if (
        published &&
        !previousPost?.published
      ) {

        payload.publishedAt =
          serverTimestamp();

      }


      await updateDoc(
        doc(
          db,
          "posts",
          currentPostId
        ),
        payload
      );

    } else {

      payload.createdAt =
        serverTimestamp();


      if (published) {

        payload.publishedAt =
          serverTimestamp();

      }


      const reference =
        await addDoc(
          collection(
            db,
            "posts"
          ),
          payload
        );


      currentPostId =
        reference.id;

    }


    setMessage(
      "postMessage",
      published
        ? "Post published successfully."
        : "Draft saved successfully.",
      true
    );


    await loadPosts();


    if (currentPostId) {

      loadPostIntoEditor(
        currentPostId
      );

    }

  } catch (error) {

    console.error(
      "Post save error:",
      error
    );


    setMessage(
      "postMessage",
      error.message ||
      "Unable to save the post."
    );

  }

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function updatePostImagePreview(
  url = null
) {

  const imageUrlInput =
    $("postImageUrl");

  const altInput =
    $("postImageAlt");

  const preview =
    $("postImagePreview");

  const emptyState =
    $("postImagePreviewEmpty");

  const removeButton =
    $("removeImageButton");


  if (
    !imageUrlInput ||
    !preview
  ) {

    return;

  }


  const source =
    url !== null
      ? String(url).trim()
      : imageUrlInput.value.trim();


  if (!source) {

    preview.src = "";

    preview.alt =
      "Featured image preview";

    preview.classList.add(
      "hidden"
    );

    emptyState?.classList.remove(
      "hidden"
    );

    removeButton?.classList.add(
      "hidden"
    );

    return;

  }


  preview.src = source;

  preview.alt =
    altInput?.value.trim() ||
    "Featured image";


  preview.onload = () => {

    preview.classList.remove(
      "hidden"
    );

    emptyState?.classList.add(
      "hidden"
    );

    removeButton?.classList.remove(
      "hidden"
    );

  };


  preview.onerror = () => {

    preview.src = "";

    preview.classList.add(
      "hidden"
    );

    emptyState?.classList.remove(
      "hidden"
    );

    removeButton?.classList.add(
      "hidden"
    );

    setUploadStatus(
      "The image URL could not be loaded."
    );

  };

}


/* =========================================================
   UPLOAD STATUS
========================================================= */

function setUploadStatus(
  message,
  good = false
) {

  const status =
    $("imageUploadStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message || "";

  status.style.color =
    good
      ? "#1f8f58"
      : "";

}


/* =========================================================
   CLOUDINARY UPLOAD
========================================================= */

async function uploadFeaturedImage(
  file
) {

  if (!file) {
    return;
  }


  if (
    !file.type.startsWith(
      "image/"
    )
  ) {

    setUploadStatus(
      "Please select an image file."
    );

    return;

  }


  const maxSize =
    10 * 1024 * 1024;


  if (file.size > maxSize) {

    setUploadStatus(
      "Please choose an image smaller than 10 MB."
    );

    return;

  }


  const uploadButton =
    $("uploadImageButton");


  uploadButton.disabled =
    true;


  uploadButton.textContent =
    "Uploading...";


  setUploadStatus(
    "Uploading image..."
  );


  try {

    const formData =
      new FormData();


    formData.append(
      "file",
      file
    );


    formData.append(
      "upload_preset",
      CLOUDINARY_UPLOAD_PRESET
    );


    const response =
      await fetch(
        CLOUDINARY_UPLOAD_URL,
        {
          method: "POST",
          body: formData
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error?.message ||
        "Cloudinary upload failed."
      );

    }


    const imageUrl =
      result.secure_url;


    if (!imageUrl) {

      throw new Error(
        "Cloudinary did not return an image URL."
      );

    }


    $("postImageUrl").value =
      imageUrl;


    updatePostImagePreview(
      imageUrl
    );


    setUploadStatus(
      "Image uploaded successfully.",
      true
    );


  } catch (error) {

    console.error(
      "Cloudinary upload error:",
      error
    );


    setUploadStatus(
      error.message ||
      "Image upload failed."
    );

  } finally {

    uploadButton.disabled =
      false;

    uploadButton.textContent =
      "Upload Image";

    $("postImageFile").value =
      "";

  }

}


/* =========================================================
   PUBLISH SUMMARY
========================================================= */

function updatePublishSummary() {

  const checkbox =
    $("postPublished");

  const summary =
    $("publishSummary");


  if (
    !checkbox ||
    !summary
  ) {
    return;
  }


  summary.textContent =
    checkbox.checked
      ? "This post will be published"
      : "Save as draft";

}


/* =========================================================
   HOMEPAGE
========================================================= */

function renderHomepageEditor(
  data
) {

  const home = {
    ...defaultHome,
    ...data
  };


  $("homeEyebrow").value =
    home.eyebrow || "";


  $("homeTitle1").value =
    home.title1 || "";


  $("homeTitle2").value =
    home.title2 || "";


  $("homeHeroText").value =
    home.heroText || "";


  $("homeHeroNote").value =
    home.heroNote || "";


  $("homeContentEyebrow").value =
    home.contentEyebrow ||
    defaultHome.contentEyebrow;


  $("homeContentTitle").value =
    home.contentTitle ||
    defaultHome.contentTitle;


  $("homeContentText").value =
    home.contentText ||
    defaultHome.contentText;


  $("stepsEditor").innerHTML =
    (
      home.steps ||
      defaultHome.steps
    )
      .map(
        (step, index) => `

          <div
            class="card"
            style="margin-bottom:12px;padding:16px"
          >

            <label>

              Step ${index + 1} title

              <input
                id="stepTitle${index}"
                value="${escapeAttr(
                  step.title ||
                  ""
                )}"
              >

            </label>


            <label>

              Step ${index + 1} text

              <textarea
                id="stepText${index}"
                rows="3"
              >${escapeHtml(
                step.text ||
                ""
              )}</textarea>

            </label>

          </div>

        `
      )
      .join("");

}


async function loadHomepage() {

  const snapshot =
    await getDoc(
      doc(
        db,
        "siteSettings",
        "home"
      )
    );


  renderHomepageEditor(
    snapshot.exists()
      ? snapshot.data()
      : defaultHome
  );

}


async function handleHomepageSave(
  event
) {

  event.preventDefault();


  const steps =
    [0, 1, 2, 3]
      .map(
        index => ({

          title:
            $(
              `stepTitle${index}`
            )
              .value
              .trim(),

          text:
            $(
              `stepText${index}`
            )
              .value
              .trim()

        })
      );


  const data = {

    eyebrow:
      $("homeEyebrow")
        .value
        .trim(),

    title1:
      $("homeTitle1")
        .value
        .trim(),

    title2:
      $("homeTitle2")
        .value
        .trim(),

    heroText:
      $("homeHeroText")
        .value
        .trim(),

    heroNote:
      $("homeHeroNote")
        .value
        .trim(),

    contentEyebrow:
      $("homeContentEyebrow")
        .value
        .trim(),

    contentTitle:
      $("homeContentTitle")
        .value
        .trim(),

    contentText:
      $("homeContentText")
        .value
        .trim(),

    steps,

    updatedAt:
      serverTimestamp()

  };


  try {

    await setDoc(
      doc(
        db,
        "siteSettings",
        "home"
      ),
      data,
      {
        merge: true
      }
    );


    setMessage(
      "homepageMessage",
      "Homepage saved successfully.",
      true
    );

  } catch (error) {

    setMessage(
      "homepageMessage",
      error.message ||
      "Unable to save homepage."
    );

  }

}


/* =========================================================
   SITE SETTINGS
========================================================= */

async function loadSettings() {

  const snapshot =
    await getDoc(
      doc(
        db,
        "siteSettings",
        "global"
      )
    );


  const settings =
    snapshot.exists()
      ? snapshot.data()
      : defaultSettings;


  $("settingPhone").value =
    settings.phone || "";


  $("settingEmail").value =
    settings.email || "";


  $("settingQuoteUrl").value =
    settings.quoteUrl || "";


  $("settingTopBarText").value =
    settings.topBarText || "";


  $("settingFooterText").value =
    settings.footerText || "";

}


async function handleSettingsSave(
  event
) {

  event.preventDefault();


  const data = {

    phone:
      $("settingPhone")
        .value
        .trim(),

    email:
      $("settingEmail")
        .value
        .trim(),

    quoteUrl:
      $("settingQuoteUrl")
        .value
        .trim(),

    topBarText:
      $("settingTopBarText")
        .value
        .trim(),

    footerText:
      $("settingFooterText")
        .value
        .trim(),

    updatedAt:
      serverTimestamp()

  };


  try {

    await setDoc(
      doc(
        db,
        "siteSettings",
        "global"
      ),
      data,
      {
        merge: true
      }
    );


    setMessage(
      "settingsMessage",
      "Site settings saved successfully.",
      true
    );

  } catch (error) {

    setMessage(
      "settingsMessage",
      error.message ||
      "Unable to save settings."
    );

  }

}


/* =========================================================
   UI
========================================================= */

function bindUI() {


  document
    .querySelectorAll(
      ".side-link"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openPanel(
            button.dataset.panel
          );

        }
      );

    });


  document
    .querySelectorAll(
      "[data-open-posts]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openPanel(
            "postsPanel"
          );

          newPost();

        }
      );

    });


  $("newPostButton")
    ?.addEventListener(
      "click",
      newPost
    );


  $("postForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        savePost(
          $("postPublished")
            .checked
        );

      }
    );


  $("saveDraftButton")
    ?.addEventListener(
      "click",
      () => {

        $("postPublished")
          .checked = false;

        updatePublishSummary();

        savePost(false);

      }
    );


  $("publishPostButton")
    ?.addEventListener(
      "click",
      () => {

        $("postPublished")
          .checked = true;

        updatePublishSummary();

        savePost(true);

      }
    );


  $("postPublished")
    ?.addEventListener(
      "change",
      updatePublishSummary
    );


  $("postTitle")
    ?.addEventListener(
      "input",
      () => {

        if (
          !slugManuallyChanged
        ) {

          $("postSlug").value =
            slugify(
              $("postTitle")
                .value
            );

        }

      }
    );


  $("postSlug")
    ?.addEventListener(
      "input",
      () => {

        slugManuallyChanged =
          true;

      }
    );


  $("postImageUrl")
    ?.addEventListener(
      "input",
      () => {

        updatePostImagePreview();

      }
    );


  $("postImageAlt")
    ?.addEventListener(
      "input",
      () => {

        if (
          $("postImagePreview")
        ) {

          $("postImagePreview")
            .alt =
              $("postImageAlt")
                .value
                .trim() ||
              "Featured image";

        }

      }
    );


  $("useImageUrlButton")
    ?.addEventListener(
      "click",
      () => {

        updatePostImagePreview();

      }
    );


  $("removeImageButton")
    ?.addEventListener(
      "click",
      () => {

        $("postImageUrl").value =
          "";

        $("postImageAlt").value =
          "";

        updatePostImagePreview(
          ""
        );

        setUploadStatus(
          ""
        );

      }
    );


  $("uploadImageButton")
    ?.addEventListener(
      "click",
      () => {

        $("postImageFile")
          ?.click();

      }
    );


  $("postImageFile")
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];


        if (file) {

          uploadFeaturedImage(
            file
          );

        }

      }
    );


  $("homepageForm")
    ?.addEventListener(
      "submit",
      handleHomepageSave
    );


  $("settingsForm")
    ?.addEventListener(
      "submit",
      handleSettingsSave
    );


  $("logoutButton")
    ?.addEventListener(
      "click",
      () => {

        signOut(
          auth
        );

      }
    );


  $("loginForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (!isConfigured) {

          setMessage(
            "loginMessage",
            "Firebase is not configured yet."
          );

          return;

        }


        try {

          await signInWithEmailAndPassword(
            auth,
            $("loginEmail").value,
            $("loginPassword").value
          );


          setMessage(
            "loginMessage",
            "Signing in...",
            true
          );

        } catch (error) {

          setMessage(
            "loginMessage",
            error.message ||
            "Sign-in failed."
          );

        }

      }
    );


  $("resetPassword")
    ?.addEventListener(
      "click",
      async () => {

        if (!isConfigured) {

          setMessage(
            "loginMessage",
            "Firebase is not configured yet."
          );

          return;

        }


        const email =
          $("loginEmail")
            .value
            .trim();


        if (!email) {

          setMessage(
            "loginMessage",
            "Enter your email first."
          );

          return;

        }


        try {

          await sendPasswordResetEmail(
            auth,
            email
          );


          setMessage(
            "loginMessage",
            "Password reset email sent.",
            true
          );

        } catch (error) {

          setMessage(
            "loginMessage",
            error.message ||
            "Could not send reset email."
          );

        }

      }
    );

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character])
    );

}


function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );

}


/* =========================================================
   START
========================================================= */

bindUI();


if (!isConfigured) {

  setupNotice.classList.remove(
    "hidden"
  );


  setupNotice.textContent =
    "Firebase is not configured. Open firebase-config.js and add your Firebase Web App configuration.";

} else {

  onAuthStateChanged(
    auth,
    async user => {

      if (!user) {

        loginView.classList.remove(
          "hidden"
        );

        adminView.classList.add(
          "hidden"
        );

        return;

      }


      try {

        const allowed =
          await isAdminUser(
            user
          );


        if (!allowed) {

          await signOut(
            auth
          );


          setMessage(
            "loginMessage",
            "This account is not authorized as an administrator."
          );

          return;

        }


        loginView.classList.add(
          "hidden"
        );

        adminView.classList.remove(
          "hidden"
        );


        $("currentEmail")
          .textContent =
            user.email || "";


        initializeRichEditor();


        await Promise.all([
          loadPosts(),
          loadHomepage(),
          loadSettings()
        ]);


        newPost();

      } catch (error) {

        console.error(
          "Admin initialization error:",
          error
        );


        adminView.classList.add(
          "hidden"
        );

        loginView.classList.remove(
          "hidden"
        );


        setMessage(
          "loginMessage",
          error.message ||
          "Admin access check failed."
        );

      }

    }
  );

}
