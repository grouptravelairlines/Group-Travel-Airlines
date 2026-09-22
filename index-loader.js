import { getPublicSettings, getPublicHome } from "./firebase-public.js";

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

function setHref(id, value) {
  const el = $(id);
  if (el && value) el.href = value;
}

function setQuoteLinks(value) {
  if (!value) return;
  document.querySelectorAll("[data-quote-link]").forEach((el) => {
    el.href = value;
  });
}

function setContact(id, text, scheme) {
  const el = $(id);
  if (!el || !text) return;
  el.textContent = text;
  el.href = `${scheme}:${scheme === "tel" ? text.replace(/[^\d+]/g, "") : text}`;
}

async function loadHomepageContent() {
  try {
    const [settings, home] = await Promise.all([
      getPublicSettings(),
      getPublicHome()
    ]);

    if (settings) {
      setText("siteTopBarText", settings.topBarText);
      setText("siteFooterText", settings.footerText);

      setText("sitePhoneTop", settings.phone);
      setText("sitePhoneFooter", settings.phone);
      setText("siteEmailTop", settings.email);
      setText("siteEmailFooter", settings.email);

      const topPhone = $("sitePhoneTop");
      const footerPhone = $("sitePhoneFooter");
      const topEmail = $("siteEmailTop");
      const footerEmail = $("siteEmailFooter");

      if (topPhone && settings.phone) topPhone.href = "tel:" + settings.phone.replace(/[^\d+]/g, "");
      if (footerPhone && settings.phone) footerPhone.href = "tel:" + settings.phone.replace(/[^\d+]/g, "");
      if (topEmail && settings.email) topEmail.href = "mailto:" + settings.email;
      if (footerEmail && settings.email) footerEmail.href = "mailto:" + settings.email;

      setQuoteLinks(settings.quoteUrl);
    }

    if (home) {
      setText("homeEyebrowPublic", home.eyebrow);
      setText("homeTitle1Public", home.title1);
      setText("homeTitle2Public", home.title2);
      setText("homeHeroTextPublic", home.heroText);
      setText("homeHeroNotePublic", home.heroNote);

      (home.steps || []).forEach((step, i) => {
        setText(`stepTitlePublic${i}`, step.title);
        setText(`stepTextPublic${i}`, step.text);
      });

      (home.features || []).forEach((feature, i) => {
        setText(`featureTitlePublic${i}`, feature.title);
        setText(`featureTextPublic${i}`, feature.text);

        const image = $(`featureImagePublic${i}`);
        if (image && feature.image) image.src = feature.image;
      });
    }
  } catch (error) {
    // Keep the static HTML fallback visible if Firebase is not configured
    // or temporarily unavailable.
    console.warn("Homepage CMS data unavailable:", error);
  }
}

loadHomepageContent();
