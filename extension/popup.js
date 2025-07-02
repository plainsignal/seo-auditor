//------------------------------------//
// SEO Auditor v1.0 full final complete
//------------------------------------//

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

// Fetch robots.txt and sitemap.xml after extraction
function analyzePage(data) {
  const origin = new URL(data.url).origin;

  Promise.all([
    fetch(origin + "/robots.txt").then(res => res.ok ? res.text() : "robots.txt not found").catch(() => "robots.txt fetch error"),
    fetch(origin + "/sitemap.xml").then(res => res.ok ? res.text() : "sitemap.xml not found").catch(() => "sitemap.xml fetch error")
  ]).then(([robotsTxt, sitemapXml]) => {
    data.robotsTxt = robotsTxt;
    data.sitemapXml = sitemapXml;

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
    links: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M10 14L5 19a3 3 0 0 0 4 4l5-5"/><path d="M14 10l5-5a3 3 0 0 0-4-4l-5 5"/></svg>`,
    images: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 4 4 8-8"/></svg>`,
    meta: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 4h16M4 8h16M10 8v12"/></svg>`,
    indexing: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
    tools: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4z"/></svg>`,
    about: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
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
    links: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M10 14L5 19a3 3 0 0 0 4 4l5-5"/><path d="M14 10l5-5a3 3 0 0 0-4-4l-5 5"/></svg>`,
    url: `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 12h16M12 4v16"/></svg>`
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
       <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
         <circle cx="12" cy="12" r="10"/>
         <path d="M12 16v-4M12 8h.01"/>
       </svg>
     </a>`
    : "";

  return `
    <div class="section-block">
      <div class="section-title">
        <div class="section-title-left">${icon(iconKey)} ${label} ${helpIcon}</div>
        ${iconSvg}
      </div>
      <div class="section-value">${safeValue} ${hint ? `<span style="color:#888;font-size:0.85rem;">(${hint})</span>` : ""}</div>
      ${result && !result.ok ? `<div class="suggestion">${result.reason}</div>` : ""}
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
          <path d="M12 16v-4M12 8h.01"/>
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
          <path d="M12 16v-4M12 8h.01"/>
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
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </a>
    </div>`;
  if (meta.jsonld.length === 0) {
    html += `<div class="warn">No JSON-LD found</div>`;
  } else {
    meta.jsonld.forEach(json => {
      html += `<pre style="background:#f1f1f1;padding:0.5rem;border-radius:5px;">${JSON.stringify(json, null, 2)}</pre>`;
    });
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

function renderIndexing(robotsTxt, sitemapXml, inSitemap) {
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

  html += `</div>`;
  document.getElementById('indexing').innerHTML = html;
}

//------------------------------------//
// TOOLS TAB RENDERING
//------------------------------------//

function renderTools() {
  const encodedUrl = encodeURIComponent(currentUrl);
  let html = `<div class="card"><ul>`;
  html += `<li><a href="https://validator.w3.org/nu/?doc=${encodedUrl}" target="_blank" title="Validate html schema">W3.org Validator</a></li>`;
  html += `<li><a href="https://search.google.com/test/rich-results?url=${encodedUrl}" target="_blank" title="Validate structured snippets for Google">Rich Results Test</a></li>`;
  html += `<li><a href="https://validator.schema.org/#url=${encodedUrl}" target="_blank" title="Validate structured snippets">Schema.org Validator</a></li>`;
  html += `<li><a href="https://pagespeed.web.dev/report?url=${encodedUrl}" target="_blank">PageSpeed Insights</a></li>`;
  html += `<li><a href="https://og.prevue.me/?urlInput=${encodedUrl}" target="_blank">Open Graph Preview</li>`;
  html += `</ul></div>`;
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

function renderHeadings(data) {
  if (!data || !data.content || !data.content.headings) {
    document.getElementById('headings').innerHTML = `<div class="warn">No headings data available.</div>`;
    return;
  }

  const headings = data.content.headings;
  const headingContents = data.content.headingContents;

  let html = `<div class="card">`;
  html += `<div class="subtabs">`;
  ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].forEach(h => {
    html += `<div class="subtab" data-head="${h}">${h} (${headings[h]})</div>`;
  });
  html += `</div><div id="headings-detail"></div></div>`;
  document.getElementById('headings').innerHTML = html;

  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const h = tab.dataset.head;
      const list = headingContents[h].map(t => `<li class="list">${t}</li>`).join('');
      document.getElementById('headings-detail').innerHTML = list ? `<ul>${list}</ul>` : `<div class="warn">No ${h} tags found</div>`;
    });
  });

  document.querySelector('.subtab[data-head="H1"]').click();
}

//------------------------------------//
// LINKS TAB Rendering
//------------------------------------//

function renderLinks(data) {
  if (!data || !data.content || !data.content.links) {
    document.getElementById('links').innerHTML = `<div class="warn">No link data available.</div>`;
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

  html += `</div><div id="links-detail" class="list"></div></div>`;
  document.getElementById('links').innerHTML = html;

  // Subtab click handler remains same
  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const type = tab.dataset.link;
      let filtered = [];

      if (type === 'total') filtered = fullList;
      if (type === 'internal') filtered = fullList.filter(l => new URL(l.href).hostname === currentHost);
      if (type === 'external') filtered = fullList.filter(l => new URL(l.href).hostname !== currentHost);
      if (type === 'nofollow') filtered = fullList.filter(l => l.rel.toLowerCase().includes('nofollow'));
      if (type === 'empty') filtered = fullList.filter(l => (l.text || '').trim() === '');
      if (type === 'short') filtered = fullList.filter(l => l.text.length > 0 && l.text.length < 3);

      const list = filtered.map(l => `
        <li style="margin-bottom:10px;">
          <div><a href="${l.href}" target="_blank">${l.href}</a></div>
          <div style="color:#666;">Text: ${l.text || "(no text)"}</div>
          <div style="color:#aaa;">rel: ${l.rel || "(none)"}, target: ${l.target || "(none)"}</div>
        </li>`).join('');

      document.getElementById('links-detail').innerHTML = list ? `<ul>${list}</ul>` : `<div class="warn">No links found</div>`;
    });
  });

  document.querySelector('.subtab[data-link="total"]').click();
}

function subtabWithAudit(key, label, auditField = null, help = null) {
  const iconSvg = auditField ? statusIcon(auditField, 14) : "";
  const helpIcon = help
    ? `<a href="${help.link}" target="_blank" class="help-icon" title="${help.description}">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </a>` : "";

  return `<div class="subtab" data-link="${key}">${label}${iconSvg}${helpIcon}</div>`;
}

//------------------------------------//
// IMAGES TAB Rendering
//------------------------------------//

function renderImages(data) {
  if (!data || !data.content || !data.content.images) {
    document.getElementById('images').innerHTML = `<div class="warn">No image data available.</div>`;
    return;
  }

  const images = data.content.images;
  const total = images.withAlt + images.withoutAlt;

  let html = `<div class="card">`;
  html += `<div class="subtabs">`;

  html += imageSubtabWithAudit("total", `All (${total})`);
  html += imageSubtabWithAudit("withalt", `With Alt (${images.withAlt})`);
  html += imageSubtabWithAudit("withoutalt", `Without Alt (${images.withoutAlt})`, audit.images, {
    description: "Alt text improves accessibility and allows image indexing by search engines.",
    link: "https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata#general-guidelines"
  });
  html += imageSubtabWithAudit("nosrcset", `No Srcset (${images.listWithoutSrcset.length})`, audit.srcset, {
    description: "Srcset enables responsive images for faster loading and better display on different devices.",
    link: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#attr-srcset"
  });

  html += `</div><div id="images-detail" class="list"></div></div>`;
  document.getElementById('images').innerHTML = html;

  document.querySelectorAll('.subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const type = tab.dataset.img;
      let list = '';

      if (type === 'total') {
        const totalList = [].concat(
          images.listWithAlt.map(img => ({ src: img.src, alt: img.alt })),
          images.listWithoutAlt.map(src => ({ src: src, alt: null }))
        );
        list = totalList.map(img => {
          return `<li>${img.src} — alt: ${img.alt || "<span class='warn'>Missing alt</span>"}</li>`;
        }).join('');
      }
      if (type === 'withalt') {
        list = images.listWithAlt.map(img => `<li>${img.src} — alt: ${img.alt}</li>`).join('');
      }
      if (type === 'withoutalt') {
        list = images.listWithoutAlt.map(src => `<li>${src} — <span class="warn">Missing alt</span></li>`).join('');
      }
      if (type === 'nosrcset') {
        list = images.listWithoutSrcset.map(src => `<li>${src} — <span class="warn">Missing srcset</span></li>`).join('');
      }

      document.getElementById('images-detail').innerHTML = list ? `<ul>${list}</ul>` : `<div class="warn">No images found</div>`;
    });
  });

  document.querySelector('.subtab[data-img="total"]').click();
}

function imageSubtabWithAudit(key, label, auditField = null, help = null) {
  const iconSvg = auditField ? statusIcon(auditField, 14) : "";
  const helpIcon = help
    ? `<a href="${help.link}" target="_blank" class="help-icon" title="${help.description}">
        <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
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
  renderIndexing(data.robotsTxt, data.sitemapXml, data.inSitemap);
  renderHeadings(data);
  renderLinks(data);
  renderImages(data);
  renderTools();
  renderAbout();
}
