//--------------------------------------//
// SEO Auditor v1.0.5 full final complete
//--------------------------------------//

let currentUrl = "";

// Inject content.js and scrape page
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  currentUrl = tab.url;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => scrapePage()
    }, ([result]) => {
      if (!result || !result.result) {
        console.error("Scrape failed");
        return;
      }
      analyzePage(result.result);
    });
  });
});

// Fetch robots.txt, sitemap.xml, llms.txt, and llms-full.txt after extraction
function analyzePage(data) {
  const origin = new URL(data.url).origin;

  Promise.all([
    fetch(origin + "/robots.txt").then(res => res.ok ? res.text() : "robots.txt not found").catch(() => "robots.txt fetch error"),
    fetch(origin + "/sitemap.xml").then(res => res.ok ? res.text() : "sitemap.xml not found").catch(() => "sitemap.xml fetch error"),
    fetch(origin + "/llms.txt").then(res => res.ok ? res.text() : "llms.txt not found").catch(() => "llms.txt fetch error"),
    fetch(origin + "/llms-full.txt").then(res => res.ok ? res.text() : "llms-full.txt not found").catch(() => "llms-full.txt fetch error")
  ]).then(([robotsTxt, sitemapXml, llmsTxt, llmsFullTxt]) => {
    data.robotsTxt = robotsTxt;
    data.sitemapXml = sitemapXml;
    data.llmsTxt = llmsTxt; // Store llms.txt content
    data.llmsFullTxt = llmsFullTxt; // Store llms-full.txt content

    if (sitemapXml && !sitemapXml.startsWith("sitemap.xml not found")) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sitemapXml, "application/xml");
        const locs = Array.from(xmlDoc.querySelectorAll("url > loc")).map(loc => loc.textContent.trim());
        data.sitemapUrls = locs;
        data.inSitemap = locs.includes(data.url);
      } catch {
        data.sitemapUrls = [];
        data.inSitemap = null;
      }
    } else {
      data.sitemapUrls = [];
      data.inSitemap = null;
    }

    const robotsCombined = (data.meta.robotsTag + " " + data.meta.xRobotsTag).toLowerCase();
    data.indexable = !robotsCombined.includes("noindex");

    evaluateSuggestions(data);
    renderAll(data);
  });
}

//------------------------------------//
// TOP TABS ICON SETUP
//------------------------------------//

function tabIcon(name) {
  const icons = {
    overview: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 14h7v7H3z"/></svg>`,
    headings: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 6v12M20 6v12M4 12h16"/></svg>`,
    links: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L9.5 9.5M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L14.5 14.5"/></svg>`,
    images: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 4 4 8-8"/></svg>`,
    meta: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16M4 8h16M10 8v12"/></svg>`,
    indexing: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
    tools: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4z"/></svg>`,
    about: `<svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };
  return icons[name] || "";
}

const tabOrder = ["overview", "headings", "links", "images", "meta", "indexing", "tools", "about"];
document.querySelectorAll(".tab").forEach((tab, i) => {
  const key = tabOrder[i];
  tab.innerHTML = `${tabIcon(key)} ${key.charAt(0).toUpperCase() + key.slice(1)}`;
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.tab);
    target.classList.add('active');
    if (target.querySelector('.subtab')) target.querySelector('.subtab').click();
  });
});

//------------------------------------//
// FULL EVALUATION ENGINE (ultra-expanded)
//------------------------------------//

let audit = {};

function evaluateSuggestions(data) {
  audit = {};

  const titleLen = (data.meta.title || "").length;
  audit.title = titleLen === 0 ?
    { ok: false, reason: "Title missing" } :
    (titleLen < 50 ? { ok: false, reason: "Title too short (50-70 chars ideal)" } :
      (titleLen > 70 ? { ok: false, reason: "Title too long (50-70 chars ideal)" } : { ok: true }));

  const descLen = (data.meta.description || "").length;
  audit.description = descLen === 0 ?
    { ok: false, reason: "Meta description missing" } :
    (descLen < 120 ? { ok: false, reason: "Description too short (120-160 chars ideal)" } :
      (descLen > 160 ? { ok: false, reason: "Description too long (120-160 chars ideal)" } : { ok: true }));

  const canonicalURL = data.meta.canonical;
  audit.canonical = !canonicalURL ?
    { ok: false, reason: "Canonical missing" } :
    (canonicalURL !== data.url ? { ok: false, reason: `Canonical points to ${canonicalURL}` } : { ok: true });

  audit.robots = (data.meta.robotsTag || data.meta.xRobotsTag) ? { ok: true } : { ok: false, reason: "Robots meta missing" };
  audit.indexable = data.indexable ? { ok: true } : { ok: false, reason: "Page marked as noindex" };

  audit.sitemap = (data.sitemapXml && data.sitemapXml !== "sitemap.xml not found") ? { ok: true } : { ok: false, reason: "No sitemap.xml found" };
  audit.llmsTxt = (data.llmsTxt && data.llmsTxt !== "llms.txt not found") ? { ok: true } : { ok: false, reason: "No llms.txt found" };
  audit.llmsFullTxt = (data.llmsFullTxt && data.llmsFullTxt !== "llms-full.txt not found") ? { ok: true } : { ok: false, reason: "No llms-full.txt found" };

  audit.words = (data.wordCount < 300) ? { ok: false, reason: "Low word count" } : { ok: true };

  audit.h1 = data.content.headings.H1 === 0 ?
    { ok: false, reason: "No H1 found" } :
    (data.content.headings.H1 > 1 ? { ok: false, reason: "Multiple H1 tags" } : { ok: true });

  audit.images = (data.content.images.withoutAlt > 0) ?
    { ok: false, reason: `${data.content.images.withoutAlt} images missing alt` } : { ok: true };
  audit.srcset = (data.content.images.withSrcset / data.content.images.total < 0.5)
    ? { ok: false, reason: "Less than 50% images have srcset for responsive loading" }
    : { ok: true };

  const ext = data.content.links.external;
  const total = data.content.links.total;
  audit.links = (total > 0 && ext / total > 0.5) ?
    { ok: false, reason: "Too many external links" } : { ok: true };

  audit.internalLinks = (data.content.links.internal < 3) ?
    { ok: false, reason: "Too few internal links" } : { ok: true };

  audit.emptyAnchors = (data.content.links.emptyText > 0) ?
    { ok: false, reason: `${data.content.links.emptyText} links with empty text` } : { ok: true };

  audit.shortAnchors = (data.content.links.shortText > 0) ?
    { ok: false, reason: `${data.content.links.shortText} links too short` } : { ok: true };

  audit.language = (data.accessibility.lang) ? { ok: true } : { ok: false, reason: "HTML lang missing" };
  audit.favicon = (data.meta.favicon) ? { ok: true } : { ok: false, reason: "Favicon missing" };
  audit.opengraph = (Object.keys(data.meta.og).length > 0) ? { ok: true } : { ok: false, reason: "No Open Graph" };
  audit.jsonld = (data.meta.jsonld.length > 0) ? { ok: true } : { ok: false, reason: "No JSON-LD" };
  audit.viewport = (data.meta.viewport) ? { ok: true } : { ok: false, reason: "Viewport meta missing" };
  audit.charset = (data.meta.charset) ? { ok: true } : { ok: false, reason: "Charset meta missing" };
  audit.hreflang = (data.meta.hreflang.length > 0) ? { ok: true } : { ok: false, reason: "Hreflang missing: no language/region targeting for international SEO." };
}

//------------------------------------//
// STATUS ICONS (SVG)
//------------------------------------//

function statusIcon(result, size = 16) {
  if (!result || typeof result.ok === "undefined") return "";

  return result.ok
    ? `<svg width="${size}" height="${size}" stroke="#16a34a" fill="none" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>`
    : `<svg width="${size}" height="${size}" stroke="#eab308" fill="none" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86l-7.6 13.14A1 1 0 0 0 3.61 19h16.78a1 1 0 0 0 .87-1.5L13.71 3.86a1 1 0 0 0-1.42 0z"/></svg>`;
}

//------------------------------------//
// ICONS FOR LABELS
//------------------------------------//

function icon(name) {
  const icons = {
    title: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16M4 8h16M10 8v12"/></svg>`,
    description: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>`,
    canonical: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M10 13l2 2 4-4"/><path d="M4 6h16"/></svg>`,
    robots: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><rect x="7" y="10" width="10" height="10"/><path d="M12 4v6"/><path d="M8 4h8"/></svg>`,
    language: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M12 20v-8M12 4h0M4 12h16"/></svg>`,
    hreflang: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M12 20v-8M12 4h0M4 12h16"/></svg>`,
    words: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    headings: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 6v12M20 6v12M4 12h16"/></svg>`,
    images: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 4 4 8-8"/></svg>`,
    links: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L9.5 9.5M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L14.5 14.5"/></svg>`,
    url: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 12h16M12 4v16"/></svg>`,
    llms: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><path d="M7 7h.01"></path><path d="M12 7h.01"></path><path d="M17 7h.01"></path><path d="M7 12h.01"></path><path d="M12 12h.01"></path><path d="M17 12h.01"></path><path d="M7 17h.01"></path><path d="M12 17h.01"></path><path d="M17 17h.01"></path></svg>`
  };
  return icons[name] || "";
}

//------------------------------------//
// UNIVERSAL BLOCK RENDERING
//------------------------------------//

function renderBlock(label, value, auditKey, iconKey, hint = "", help = null) {
  const safeValue = (value !== undefined && value !== null) ? value : "Missing";
  const result = audit[auditKey];
  const iconSvg = statusIcon(result);

  const helpIcon = help
    ? `<a href="${help.link}" target="_blank" title="${help.description}" class="help-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
        <path d="M12 17h.01"></path>
      </svg>
     </a>`
    : "";

  let externalContent = ``
  if (!result.ok && help?.externalLink && help?.externalLinkTitle) {
    externalContent = `
      <div><a href="${help.externalLink}" target="_blank">${help.externalLinkTitle}</a></div>
    `
  }

  return `
    <div class="section-block">
      <div class="section-title">
        <div class="section-title-left">${icon(iconKey)} ${label} ${helpIcon}</div>
        ${iconSvg}
      </div>
      <div class="section-value">${safeValue} ${hint ? `<span style="color:#888;font-size:0.85rem;">(${hint})</span>` : ""}</div>
      ${result && !result.ok ? `<div class="suggestion">${result.reason}${externalContent}</div>` : ""}
    </div>`;
}



//------------------------------------//
// OVERVIEW TAB RENDERING
//------------------------------------//

function renderOverview(data) {
  const meta = data.meta;
  const content = data.content;
  const accessibility = data.accessibility;

  let html = `<div class="card">`;

  html += renderBlock("Title", meta.title, "title", "title", `${meta.title.length} chars`, {
    description: "The title tag defines the clickable headline in search results. It directly influences search ranking and click-through rate (CTR).",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#title-link"
  });

  html += renderBlock("Description", meta.description, "description", "description", `${meta.description.length} chars`, {
    description: "Meta description summarizes page content and influences CTR, though not directly used for ranking.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#description"
  });

  html += renderBlock("URL", data.url, "indexable", "url", data.indexable ? "Indexable" : "Noindex");

  html += renderBlock("Canonical", meta.canonical || "Missing", "canonical", "canonical", "", {
    description: "Prevents duplicate content issues by indicating the preferred version of a page.",
    link: "https://developers.google.com/search/docs/advanced/crawling/consolidate-duplicate-urls"
  });

  html += renderBlock("Robots Meta", meta.robotsTag || meta.xRobotsTag || "Missing", "robots", "robots", "", {
    description: "Controls whether search engines index or follow the page. Critical for controlling visibility.",
    link: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"
  });

  html += renderBlock("Sitemap", (audit.sitemap.ok ? "Found" : "Missing"), "sitemap", "canonical", "", {
    description: "Helps search engines discover site URLs and crawl more efficiently.",
    link: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"
  });

  // Add llms.txt and llms-full.txt to overview - FIX: Displaying proper string value
  html += renderBlock("llms.txt", (audit.llmsTxt.ok ? "Found" : "Missing"), "llmsTxt", "llms", "", {
    description: "Indicates rules for LLMs (Large Language Models) accessing content. This file is similar in concept to `robots.txt` but specifically for controlling how AI models interact with your site's content for training and data collection.",
    link: "https://llmstxt.org/",
    externalLink: "https://chromewebstore.google.com/detail/llmstxt-generator/hkfhiobimmpeimihkebmpmppjlkofjie",
    externalLinkTitle: "Generate with Chrome Extension"
  });

  html += renderBlock("llms-full.txt", (audit.llmsFullTxt.ok ? "Found" : "Missing"), "llmsFullTxt", "llms", "", {
    description: "A more comprehensive version of `llms.txt`, providing more detailed instructions or broader scope for LLM interaction with your site. It can include specific paths, content types, or usage policies for AI models.",
    link: "https://llmstxt.org/",
    externalLink: "https://chromewebstore.google.com/detail/llmstxt-generator/hkfhiobimmpeimihkebmpmppjlkofjie",
    externalLinkTitle: "Generate with Chrome Extension"
  });


  html += renderBlock("Language", accessibility.lang || "Missing", "language", "language", "", {
    description: "Indicates the primary language of the content, helping search engines serve users in their language.",
    link: "https://www.w3.org/International/questions/qa-html-language-declarations"
  });

  html += renderBlock("Favicon", meta.favicon || "Missing", "favicon", "canonical", "", {
    description: "Improves brand recognition and user experience in browser tabs, search results, and mobile devices.",
    link: "https://developers.google.com/search/docs/appearance/favicon-in-search"
  });

  html += renderBlock("Open Graph", (Object.keys(meta.og).length > 0 ? "Present" : "Missing"), "opengraph", "words", "", {
    description: "Enables better link previews when pages are shared on social media platforms.",
    link: "https://ogp.me/"
  });

  html += renderBlock("JSON-LD", (meta.jsonld.length > 0 ? "Present" : "Missing"), "jsonld", "words", "", {
    description: "Allows structured data markup to improve search appearance with rich snippets and special features.",
    link: "https://schema.org/docs/gs.html"
  });

  html += renderBlock("Words", `<strong>Words:</strong> ${data.wordCount}, <strong>Characters:</strong> ${data.charCount}`, "words", "words", "", {
    description: "Sufficient content length helps cover topics thoroughly; very thin pages may be seen as low-quality.",
    link: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content"
  });

  html += renderBlock("Viewport", meta.viewport || "Missing", "viewport", "words", "", {
    description: "Enables responsive design by controlling how a page scales on mobile devices.",
    link: "https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag"
  });

  html += renderBlock("Charset", meta.charset || "Missing", "charset", "words", "", {
    description: "Declares character encoding to ensure correct rendering of text content.",
    link: "https://www.w3.org/International/articles/definitions-characters/#charset"
  });

  html += renderBlock("Hreflang", (audit.hreflang.ok ? "Found" : "Missing"), "hreflang", "hreflang", "hreflang", {
    description: "The hreflang attribute tells search engines which language or regional version of a page to show to users. It prevents duplicate content issues across localized pages and improves international search targeting.",
    link: "https://developers.google.com/search/docs/specialty/international/localized-versions"
  });

  html += `
    <div class="section-block">
      <div class="section-title-left">${icon("headings")} Headings</div>
      <div class="section-value"><strong>H1:</strong> ${content.headings.H1}, <strong>H2:</strong> ${content.headings.H2}, <strong>H3:</strong> ${content.headings.H3}, <strong>H4:</strong> ${content.headings.H4}, <strong>H5:</strong> ${content.headings.H5}, <strong>H6:</strong> ${content.headings.H6}</div>
      ${audit.h1 && !audit.h1.ok ? `<div class="suggestion">${audit.h1.reason}</div>` : ""}
    </div>`;

  html += renderBlock("Images", `<strong>Total:</strong> ${content.images.withAlt + content.images.withoutAlt}, <strong>Missing alt:</strong> ${content.images.withoutAlt}, <strong>Missing srcset:</strong> ${content.images.listWithoutSrcset.length}`, "images", "images", "", {
    description: "Alt text improves accessibility and allows image indexing; srcset enables responsive images.",
    link: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-srcset"
  });

  html += renderBlock("Links", `<strong>Total:</strong> ${content.links.total}, <strong>Internal:</strong> ${content.links.internal}, <strong>External:</strong> ${content.links.external}, <strong>Unique:</strong> ${content.links.uniq}, <strong>Empty text:</strong> ${content.links.emptyText}, <strong>Short text:</strong> ${content.links.shortText}`, "links", "links", "", {
    description: "Balanced internal and external linking improves crawlability, authority flow, and navigation.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"
  });

  html += `</div>`;
  document.getElementById('overview').innerHTML = html;
}


//------------------------------------//
// META TAB RENDERING
//------------------------------------//

function renderMeta(meta) {
  let html = `<div class="card">`;

  html += renderBlock("Title", meta.title, "title", "title", "", {
    description: "The title tag defines the clickable headline in search results. It directly influences search ranking and click-through rate (CTR).",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#title-link"
  });

  html += renderBlock("Description", meta.description, "description", "description", "", {
    description: "Meta description summarizes page content and influences CTR, though not directly used for ranking.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#description"
  });

  html += renderBlock("Canonical", meta.canonical, "canonical", "canonical", "", {
    description: "Prevents duplicate content issues by indicating the preferred version of a page.",
    link: "https://developers.google.com/search/docs/advanced/crawling/consolidate-duplicate-urls"
  });

  html += renderBlock("Robots Meta", meta.robotsTag || meta.xRobotsTag, "robots", "robots", "", {
    description: "Controls whether search engines index or follow the page. Critical for controlling visibility.",
    link: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"
  });

  // Hreflang details
  if (Object.keys(meta.og).length === 0) {
    html += renderBlock("Hreflang", meta.hreflang, "hreflang", "hreflang", "hreflang", {
      description: "The hreflang attribute tells search engines which language or regional version of a page to show to users. It prevents duplicate content issues across localized pages and improves international search targeting.",
      link: "https://developers.google.com/search/docs/specialty/international/localized-versions"
    });
  } else {
    html += `<div class="section-block">
    <div class="section-title-left">${icon("hreflang")} Hreflang
      <a href="https://developers.google.com/search/docs/specialty/international/localized-versions" target="_blank" class="help-icon" title="The hreflang attribute tells search engines which language or regional version of a page to show to users. It prevents duplicate content issues across localized pages and improves international search targeting.">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </a>
    </div>`;
    html += `<ul>` + meta.hreflang.map(value =>
      `<li><strong>${value.lang}</strong>: ${value.href}</li>`).join('') + `</ul>`;
    html += `</div>`;
  }

  // Open Graph details
  html += `<div class="section-block">
    <div class="section-title-left">${icon("words")} Open Graph
      <a href="https://ogp.me/" target="_blank" class="help-icon" title="Enables better link previews when pages are shared on social media platforms.">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </a>
    </div>`;
  if (Object.keys(meta.og).length === 0) {
    html += `<div class="warn">No Open Graph tags found</div>`;
  } else {
    html += `<ul>` + Object.entries(meta.og).map(([key, value]) =>
      `<li><strong>${key}</strong>: ${value}</li>`).join('') + `</ul>`;
  }
  html += `</div>`;

  // Twitter Card details
  html += `<div class="section-block">
    <div class="section-title-left">${icon("words")} Twitter Card</div>`;
  if (Object.keys(meta.twitter).length === 0) {
    html += `<div class="warn">No Twitter tags found</div>`;
  } else {
    html += `<ul>` + Object.entries(meta.twitter).map(([key, value]) =>
      `<li><strong>${key}</strong>: ${value}</li>`).join('') + `</ul>`;
  }
  html += `</div>`;

  // JSON-LD details
  html += `<div class="section-block">
    <div class="section-title-left">${icon("words")} JSON-LD
      <a href="https://schema.org/docs/gs.html" target="_blank" class="help-icon" title="Allows structured data markup to improve search appearance with rich snippets and special features.">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </a>
    </div>`;
  if (meta.jsonld.length === 0) {
    html += `<div class="warn">No JSON-LD found</div>`;
  } else {
    const encodedUrl = encodeURIComponent(currentUrl);
    meta.jsonld.forEach(json => {
      html += `<pre style="background:#f1f1f1;padding:0.5rem;border-radius:5px;">${JSON.stringify(json, null, 2)}</pre>`;
    });
    html += `
      <div>
        <ul>
          <li><a href="https://validator.schema.org/#url=${encodedUrl}" target="_blank">Validate with Schema.org</a></li>
          <li><a href="https://search.google.com/test/rich-results?url=${encodedUrl}" target="_blank">Test with Google Rich Results</a></li>
        </ul>
      </div>`;
  }
  html += `</div>`;

  html += renderBlock("Viewport", meta.viewport || "Missing", "viewport", "words", "", {
    description: "Enables responsive design by controlling how a page scales on mobile devices.",
    link: "https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag"
  });

  html += renderBlock("Charset", meta.charset || "Missing", "charset", "words", "", {
    description: "Declares character encoding to ensure correct rendering of text content.",
    link: "https://www.w3.org/International/articles/definitions-characters/#charset"
  });

  html += `</div>`;
  document.getElementById('meta').innerHTML = html;
}


//------------------------------------//
// INDEXING TAB RENDERING
//------------------------------------//

function renderIndexing(robotsTxt, sitemapXml, inSitemap, llmsTxt, llmsFullTxt) {
  let html = `<div class="card">`;

  html += renderBlock("robots.txt", robotsTxt, "robots", "robots", "", {
    description: "Controls which parts of a site search engines can crawl, improving crawl efficiency.",
    link: "https://developers.google.com/search/docs/crawling-indexing/robots/intro"
  });

  html += renderBlock("sitemap.xml", (sitemapXml.length > 2000 ? sitemapXml.slice(0, 2000) + "..." : sitemapXml), "sitemap", "canonical", "", {
    description: "Helps search engines discover site URLs and crawl more efficiently.",
    link: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"
  });

  html += renderBlock("URL in Sitemap", (inSitemap === true ? "✔ Found" : (inSitemap === false ? "✖ Not Found" : "Parse failed")), "sitemap", "canonical", "", {
    description: "Verifies if the current page exists in your sitemap, ensuring it's discoverable.",
    link: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"
  });

  html += renderBlock("Indexability", (audit.indexable.ok ? "Indexable" : "Noindex"), "indexable", "robots", "", {
    description: "Controls whether search engines are allowed to index this page based on robots meta and HTTP headers.",
    link: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"
  });

  // Add llms.txt and llms-full.txt to indexing tab - FIX: Displaying proper string value and adding help
  html += renderBlock("llms.txt", (audit.llmsTxt.ok ? "Found" : "Missing"), "llmsTxt", "llms", "", {
    description: "Indicates rules for LLMs (Large Language Models) accessing content. This file is similar in concept to `robots.txt` but specifically for controlling how AI models interact with your site's content for training and data collection.",
    link: "https://llmstxt.org/",
    externalLink: "https://chromewebstore.google.com/detail/llmstxt-generator/hkfhiobimmpeimihkebmpmppjlkofjie",
    externalLinkTitle: "Generate with Chrome Extension"
  });

  html += renderBlock("llms-full.txt", (audit.llmsFullTxt.ok ? "Found" : "Missing"), "llmsFullTxt", "llms", "", {
    description: "A more comprehensive version of `llms.txt`, providing more detailed instructions or broader scope for LLM interaction with your site. It can include specific paths, content types, or usage policies for AI models.",
    link: "https://llmstxt.org",
    externalLink: "https://chromewebstore.google.com/detail/llmstxt-generator/hkfhiobimmpeimihkebmpmppjlkofjie",
    externalLinkTitle: "Generate with Chrome Extension"
  });

  html += `</div>`;
  document.getElementById('indexing').innerHTML = html;
}

//------------------------------------//
// TOOLS TAB RENDERING
//------------------------------------//

function renderTools() {
  const encodedUrl = encodeURIComponent(currentUrl);
  let html = `<div class="card">`; // Start card div

  html += `<div class="section-block">`; // Use section-block for consistent styling
  html += `<p>Utilize these external tools to further analyze the current page's SEO performance and technical aspects.</p>`;
  html += `<ul>`;
  html += `<li><a href="https://validator.w3.org/nu/?doc=${encodedUrl}" target="_blank" title="Validate HTML and CSS syntax according to W3C standards.">W3.org Validator</a></li>`;
  html += `<li><a href="https://search.google.com/test/rich-results?url=${encodedUrl}" target="_blank" title="Test your page's structured data to see if it's eligible for rich results on Google Search.">Google Rich Results Test</a></li>`;
  html += `<li><a href="https://validator.schema.org/#url=${encodedUrl}" target="_blank" title="Validate structured data markup (Schema.org) on your page.">Schema.org Validator</a></li>`;
  html += `<li><a href="https://pagespeed.web.dev/report?url=${encodedUrl}" target="_blank" title="Get insights into your page's performance and accessibility for both mobile and desktop.">Google PageSpeed Insights</a></li>`;
  html += `<li><a href="https://og.prevue.me/?urlInput=${encodedUrl}" target="_blank" title="Preview how your page will look when shared on social media platforms (Open Graph).">Open Graph Preview</a></li>`;
  html += `<li><a href="https://chromewebstore.google.com/detail/llmstxt-generator/hkfhiobimmpeimihkebmpmppjlkofjie" target="_blank" title="Generate an llms.txt file to control how AI models interact with your site's content.">LLMs.txt Generator Extension</a></li>`;
  html += `</ul>`;
  html += `</div>`; // Close section-block
  html += `</div>`; // Close card div
  document.getElementById('tools').innerHTML = html;
}

//------------------------------------//
// ABOUT TAB RENDERING
//------------------------------------//

function renderAbout() {
  let html = `<div class="card about">
    <h1>SEO Auditor</h1>
    <p>SEO Auditor is a Chrome Extension that runs technical SEO audit on the currently open webpage in the active tab of the browser when it is clicked on the extension icon. It analyzes the document and generates technical SEO report in seconds. Provides actionable feedback with references to enhance visibility on search engines and LLMs.</p>
    <p>Developed by <a href="https://plainsignal.com" target="_blank" title="Privacy-focused, simple website analytics">PlainSignal</a></p>
  </div>`;
  document.getElementById('about').innerHTML = html;
}

//------------------------------------//
// HEADINGS TAB Rendering
//------------------------------------//

// function renderHeadings(data) {
//   if (!data || !data.content || !data.content.headings) {
//     // Ensure the initial warning message also has the correct font size
//     document.getElementById('headings').innerHTML = `<div class="warn" style="font-size: 1rem;">No headings data available.</div>`;
//     return;
//   }

//   const headings = data.content.headings;
//   const headingContents = data.content.headingContents;

//   let html = `<div class="card">`;
//   html += `<div class="subtabs">`;
//   ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].forEach(h => {
//     html += `<div class="subtab" data-head="${h}">${h} (${headings[h]})</div>`;
//   });
//   html += `</div><div id="headings-detail"></div></div>`;
//   document.getElementById('headings').innerHTML = html;

//   document.querySelectorAll('.subtab').forEach(tab => {
//     tab.addEventListener('click', () => {
//       document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
//       tab.classList.add('active');
//       const h = tab.dataset.head;
//       const list = headingContents[h].map(t => `<li class="list">${t}</li>`).join('');

//       // Apply style to the warning message if no tags are found for the category
//       const content = list ? `<ul>${list}</ul>` : `<div class="warn" style="font-size: 1rem;">No ${h} tags found</div>`;
//       document.getElementById('headings-detail').innerHTML = content;
//     });
//   });

//   document.querySelector('.subtab[data-head="H1"]').click();
// }

//------------------------------------//
// HEADINGS TAB Rendering
//------------------------------------//

function renderHeadings(data) {
  if (!data || !data.content || !data.content.headings) {
    document.getElementById('headings').innerHTML = `<div class="warn" style="font-size: 1rem;">No headings data available.</div>`;
    return;
  }

  const headings = data.content.headings;
  const headingContents = data.content.headingContents;
  const headingElements = data.content.headingElements;

  let html = `<div class="card">`;
  html += `<div class="subtabs">`;
  // Move Hierarchy subtab to the first position
  html += `<div class="subtab" data-head="hierarchy">Hierarchy</div>`; //
  ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].forEach(h => {
    html += `<div class="subtab" data-head="${h}">${h} (${headings[h]})</div>`;
  });
  html += `</div><div id="headings-detail"></div></div>`;
  document.getElementById('headings').innerHTML = html;

  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.head;

      let content = '';
      if (type === 'hierarchy') {
        content = buildHeadingHierarchy(headingElements);
        if (!content) {
          content = `<div class="warn" style="font-size: 1rem;">No hierarchical heading data to display.</div>`;
        }
      } else {
        const list = headingContents[type].map(t => `<li class="list">${t}</li>`).join('');
        content = list ? `<ul>${list}</ul>` : `<div class="warn" style="font-size: 1rem;">No ${type} tags found</div>`;
      }
      document.getElementById('headings-detail').innerHTML = content;
    });
  });

  // Make Hierarchy the default active tab
  document.querySelector('.subtab[data-head="hierarchy"]').click(); //
}

// New function to build the hierarchical display
function buildHeadingHierarchy(headingElements) {
  if (!headingElements || headingElements.length === 0) {
    return null;
  }

  let html = `<div class="heading-hierarchy-container">`; // Add a container for overall styling

  // This function will recursively build the HTML
  function renderNestedHeadings(index, currentLevel) {
    let subHtml = '';
    while (index < headingElements.length) {
      const item = headingElements[index];
      const level = parseInt(item.tag.substring(1));

      if (level === currentLevel) {
        subHtml += `<div class="section-block heading-item">
                       <div class="section-title-left"><strong>${item.tag}</strong></div>
                       <div class="section-value">${item.text}</div>
                     </div>`;
        index++;
      } else if (level > currentLevel) {
        // Deeper level: start a new nested list
        subHtml += `<div class="heading-nested-group">`;
        const [nestedHtml, newIndex] = renderNestedHeadings(index, level);
        subHtml += nestedHtml;
        subHtml += `</div>`;
        index = newIndex;
      } else {
        // Higher level: stop recursion for current level
        break;
      }
    }
    return [subHtml, index];
  }

  const [hierarchyHtml] = renderNestedHeadings(0, 1); // Start with H1 level (level 1)
  html += hierarchyHtml;
  html += `</div>`;

  return html;
}

//------------------------------------//
// LINKS TAB Rendering
//------------------------------------//

function renderLinks(data) {
  if (!data || !data.content || !data.content.links) {
    // Ensure the warning message also has the correct font size
    document.getElementById('links').innerHTML = `<div class="warn" style="font-size: 1rem;">No link data available.</div>`;
    return;
  }

  const links = data.content.links;
  const fullList = links.fullList;
  const currentHost = new URL(data.url).hostname;

  let html = `<div class="card">`;
  html += `<div class="subtabs">`;

  // Subtabs with audit icons + help titles
  html += subtabWithAudit("total", `All (${links.total})`);
  html += subtabWithAudit("internal", `Internal (${links.internal})`, audit.internalLinks, {
    description: "Internal links improve crawlability and distribute authority across the site.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"
  });
  html += subtabWithAudit("external", `External (${links.external})`, audit.links, {
    description: "Excessive external linking may dilute page authority; aim for balance.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"
  });
  html += subtabWithAudit("nofollow", `Nofollow (${links.nofollow})`);
  html += subtabWithAudit("empty", `Empty Text (${links.emptyText})`, audit.emptyAnchors, {
    description: "Empty link text provides no context to users or search engines, reducing accessibility and SEO value.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"
  });
  html += subtabWithAudit("short", `Short Text (${links.shortText})`, audit.shortAnchors, {
    description: "Short link text may not describe target content well enough for users or crawlers.",
    link: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#linking"
  });

  html += `</div><div id="links-detail" class="links-detail-container"></div></div>`;
  document.getElementById('links').innerHTML = html;

  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.link;
      let filtered = [];

      if (type === 'total') filtered = fullList;
      if (type === 'internal') filtered = fullList.filter(l => {
        try {
          return new URL(l.href).hostname === currentHost;
        } catch (e) {
          return false;
        }
      });
      if (type === 'external') filtered = fullList.filter(l => {
        try {
          return new URL(l.href).hostname !== currentHost;
        } catch (e) {
          return false;
        }
      });
      if (type === 'nofollow') filtered = fullList.filter(l => l.rel.toLowerCase().includes('nofollow'));
      if (type === 'empty') filtered = fullList.filter(l => (l.text || '').trim() === '');
      if (type === 'short') filtered = fullList.filter(l => l.text.length > 0 && l.text.length < 3);

      let linksContentHtml = '';
      if (filtered.length > 0) {
        linksContentHtml = `
          <style>
            .link-item {
              border: 1px solid #e5e7eb;
              padding: 0.75rem;
              margin-bottom: 0.75rem;
              border-radius: 0.3rem;
              background-color: #ffffff;
              font-size: 1rem; /* Consistent with other text */
            }
            .link-item:last-child {
              margin-bottom: 0;
            }
            .link-url {
              font-weight: 600;
              color: #2563eb;
              word-break: break-all;
            }
            .link-text {
              margin-top: 0.25rem;
              color: #374151;
              font-size: 1rem; /* Consistent with other text */
            }
            .link-meta {
              font-size: 0.9rem; /* Slightly smaller for meta info */
              color: #6b7280;
              margin-top: 0.25rem;
            }
            .link-meta span {
              margin-right: 0.75rem;
            }
            .link-warn {
                color: #f97316;
                font-size: 1rem; /* Ensure warning text is also 1rem */
            }
          </style>
          <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
        `;
        linksContentHtml += filtered.map(l => `
          <div class="link-item">
            <div class="link-url"><a href="${l.href}" target="_blank">${l.href}</a></div>
            <div class="link-text">Anchor Text: ${l.text || '<span class="link-warn">(No anchor text)</span>'}</div>
            <div class="link-meta">
              <span>Rel: ${l.rel || '(none)'}</span>
              <span>Target: ${l.target || '(none)'}</span>
            </div>
          </div>`).join('');
        linksContentHtml += `</div>`;
      } else {
        // Apply the same styling to the warning message if no links are found
        linksContentHtml = `<div class="warn" style="font-size: 1rem;">No links found for this category.</div>`;
      }

      document.getElementById('links-detail').innerHTML = linksContentHtml;
    });
  });

  document.querySelector('.subtab[data-link="total"]').click();
}

function subtabWithAudit(key, label, auditField = null, help = null) {
  const iconSvg = auditField ? statusIcon(auditField, 14) : "";
  const helpIcon = help
    ? `<a href="${help.link}" target="_blank" class="help-icon" title="${help.description}">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </a>` : "";

  return `<div class="subtab" data-link="${key}">${label}${iconSvg}${helpIcon}</div>`;
}

//------------------------------------//
// IMAGES TAB Rendering
//------------------------------------//

function renderImages(data) {
  if (!data || !data.content || !data.content.images) {
    // Ensure the initial warning message also has the correct font size
    document.getElementById('images').innerHTML = `<div class="warn" style="font-size: 1rem;">No image data available.</div>`;
    return;
  }

  const images = data.content.images;
  const totalImagesCount = images.total;

  let html = `<div class="card">`;
  html += `<div class="subtabs">`;

  html += imageSubtabWithAudit("total", `All (${totalImagesCount})`);
  html += imageSubtabWithAudit("withalt", `With Alt (${images.withAlt})`);
  html += imageSubtabWithAudit("withoutalt", `Without Alt (${images.withoutAlt})`, audit.images, {
    description: "Alt text improves accessibility and allows image indexing by search engines.",
    link: "https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata#general-guidelines"
  });
  html += imageSubtabWithAudit("nosrcset", `No Srcset (${images.listWithoutSrcset.length})`, audit.srcset, {
    description: "Srcset enables responsive images for faster loading and better display on different devices.",
    link: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-srcset"
  });

  html += `</div><div id="images-detail" class="images-detail-container"></div></div>`;
  document.getElementById('images').innerHTML = html;

  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const type = tab.dataset.img;
      let displayImages = [];

      const allUnifiedImages = [].concat(
        images.listWithAlt.map(img => ({
          src: img.src,
          alt: img.alt,
          hasSrcset: !images.listWithoutSrcset.includes(img.src)
        })),
        images.listWithoutAlt.map(src => ({
          src: src,
          alt: null,
          hasSrcset: !images.listWithoutSrcset.includes(src)
        }))
      );

      const uniqueUnifiedImages = [];
      const seenSrcs = new Set();
      allUnifiedImages.forEach(img => {
        if (!seenSrcs.has(img.src)) {
          uniqueUnifiedImages.push(img);
          seenSrcs.add(img.src);
        }
      });


      if (type === 'total') {
        displayImages = uniqueUnifiedImages;
      } else if (type === 'withalt') {
        displayImages = uniqueUnifiedImages.filter(img => img.alt !== null);
      } else if (type === 'withoutalt') {
        displayImages = uniqueUnifiedImages.filter(img => img.alt === null);
      } else if (type === 'nosrcset') {
        displayImages = uniqueUnifiedImages.filter(img => !img.hasSrcset);
      }

      let imagesContentHtml = '';
      if (displayImages.length > 0) {
        imagesContentHtml = `
          <style>
            .image-item {
              border: 1px solid #e5e7eb;
              padding: 0.75rem;
              margin-bottom: 0.75rem;
              border-radius: 0.3rem;
              background-color: #ffffff;
              font-size: 1rem;
            }
            .image-item:last-child {
              margin-bottom: 0;
            }
            .image-label {
              font-weight: 600;
            }
            .image-source {
              color: #2563eb;
              word-break: break-all;
            }
            .image-alt-text, .image-srcset-status {
              margin-top: 0.25rem;
              color: #374151;
              font-size: 1rem;
            }
            .image-warn {
                color: #f97316;
                font-size: 1rem; /* Ensure warning text within items is 1rem */
            }
            .warn { /* Style for the main warning message */
                font-size: 1rem;
            }
          </style>
          <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
        `;
        imagesContentHtml += displayImages.map(img => `
          <div class="image-item">
            <div class="image-source"><span class="image-label">Source:</span> <a href="${img.src}" target="_blank">${img.src}</a></div>
            <div class="image-alt-text"><span class="image-label">Alt Text:</span> ${img.alt !== null ? img.alt : '<span class="image-warn">Missing</span>'}</div>
            <div class="image-srcset-status"><span class="image-label">Srcset:</span> ${img.hasSrcset ? '✔ Present' : '<span class="image-warn">✖ Missing</span>'}</div>
          </div>`).join('');
        imagesContentHtml += `</div>`;
      } else {
        // Apply inline style to the warning div for immediate effect
        imagesContentHtml = `<div class="warn" style="font-size: 1rem;">No images found for this category.</div>`;
      }

      document.getElementById('images-detail').innerHTML = imagesContentHtml;
    });
  });

  document.querySelector('.subtab[data-img="total"]').click();
}

function imageSubtabWithAudit(key, label, auditField = null, help = null) {
  const iconSvg = auditField ? statusIcon(auditField, 14) : "";
  const helpIcon = help
    ? `<a href="${help.link}" target="_blank" class="help-icon" title="${help.description}">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.81 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </a>` : "";

  return `<div class="subtab" data-img="${key}">${label}${iconSvg}${helpIcon}</div>`;
}

//------------------------------------//
// FINAL RENDER DISPATCHER
//------------------------------------//

function renderAll(data) {
  renderOverview(data);
  renderMeta(data.meta);
  renderIndexing(data.robotsTxt, data.sitemapXml, data.inSitemap, data.llmsTxt, data.llmsFullTxt);
  renderHeadings(data);
  renderLinks(data);
  renderImages(data);
  renderTools();
  renderAbout();
}