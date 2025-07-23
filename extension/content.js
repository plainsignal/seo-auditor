function scrapePage() {
  const meta = {};

  // Title & Description
  meta.title = document.title || "";
  const description = document.querySelector('meta[name="description"]');
  meta.description = description ? description.content : "";

  // Canonical
  const canonical = document.querySelector('link[rel="canonical"]');
  meta.canonical = canonical ? canonical.href : "";

  // Favicon
  const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  meta.favicon = favicon ? favicon.href : "";

  // Robots meta
  const robotsTag = document.querySelector('meta[name="robots"]');
  meta.robotsTag = robotsTag ? robotsTag.content : "";

  const xRobotsTag = document.querySelector('meta[http-equiv="X-Robots-Tag"]');
  meta.xRobotsTag = xRobotsTag ? xRobotsTag.content : "";

  // Viewport & charset
  const viewport = document.querySelector('meta[name="viewport"]');
  meta.viewport = viewport ? viewport.content : "";

  const charset = document.querySelector('meta[charset]');
  meta.charset = charset ? charset.getAttribute('charset') : "";

  // Open Graph
  meta.og = {};
  document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
    meta.og[tag.getAttribute('property')] = tag.content;
  });

  // Twitter Cards
  meta.twitter = {};
  document.querySelectorAll('meta[name^="twitter:"]').forEach(tag => {
    meta.twitter[tag.getAttribute('name')] = tag.content;
  });

  // JSON-LD
  meta.jsonld = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      meta.jsonld.push(JSON.parse(script.innerText));
    } catch (e) { }
  });

  // Hreflang
  meta.hreflang = [];
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => {
    meta.hreflang.push({
      lang: link.getAttribute('hreflang'),
      href: link.href
    });
  });

  // Headings extraction
  const headings = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
  const headingContents = { H1: [], H2: [], H3: [], H4: [], H5: [], H6: [] };
  const headingElements = []; // NEW: Store all heading elements in order
  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(h => {
    const tagName = h.tagName; // e.g., 'H1'
    headings[tagName]++; //
    headingContents[tagName].push(h.textContent.trim()); //
    headingElements.push({ // NEW: Add each heading with its tag and text to the ordered list
      tag: tagName, //
      text: h.textContent.trim() //
    });
  });

  // Images extraction (fully compatible)
  const imageNodes = Array.from(document.querySelectorAll("img"));
  const imagesWithAltList = imageNodes.filter(img => img.hasAttribute("alt") && img.getAttribute("alt").trim() !== "")
    .map(img => ({ src: img.src || "(no src)", alt: img.getAttribute("alt") }));
  const imagesWithSrcset = imageNodes.filter(img => img.hasAttribute("srcset")).length;

  const imagesWithoutAltList = imageNodes
    .filter(img => !img.hasAttribute("alt") || img.getAttribute("alt").trim() === "")
    .map(img => img.src || "(no src)");

  const imagesWithoutSrcsetList = imageNodes
    .filter(img => !img.hasAttribute("srcset"))
    .map(img => img.src || "(no src)");

  const images = {
    withAlt: imagesWithAltList.length,
    withoutAlt: imagesWithoutAltList.length,
    listWithAlt: imagesWithAltList,
    listWithoutAlt: imagesWithoutAltList,
    withSrcset: imagesWithSrcset,
    listWithoutSrcset: imagesWithoutSrcsetList,
    total: imagesWithAltList.length + imagesWithoutAltList.length,
  };

  // Links extraction (fully expanded)
  const links = Array.from(document.querySelectorAll("a[href]"));
  const fullLinks = [];
  let internal = 0, external = 0, nofollow = 0, blank = 0, emptyText = 0, shortText = 0;
  const currentHost = location.hostname;

  links.forEach(a => {
    try {
      const href = new URL(a.href).href;
      const text = a.textContent.trim();
      fullLinks.push({
        href: href,
        text: text,
        rel: a.getAttribute('rel') || '',
        target: a.getAttribute('target') || ''
      });
      const linkHost = new URL(href).hostname;
      if (linkHost === currentHost) internal++;
      else external++;
      if ((a.getAttribute('rel') || '').toLowerCase().includes('nofollow')) nofollow++;
      if (a.target === "_blank") blank++;

      if (text === "") emptyText++;
      if (text.length > 0 && text.length < 3) shortText++;

    } catch (e) { }
  });

  const uniqueHrefs = [...new Set(fullLinks.map(l => l.href))];

  // Accessibility extraction
  const lang = document.documentElement.lang || "";

  // Word count extraction
  const mainContent = document.querySelector('main') || document.body;
  let text = mainContent.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  const wordCount = text.length > 0 ? text.split(' ').length : 0;
  const charCount = text.length;

  return {
    url: location.href,
    meta: meta,
    wordCount: wordCount,
    charCount: charCount,
    content: {
      headings: headings,
      headingContents: headingContents,
      headingElements: headingElements, // NEW: Include the ordered list of heading elements
      images: images,
      links: {
        internal: internal,
        external: external,
        nofollow: nofollow,
        blank: blank,
        total: links.length,
        uniq: uniqueHrefs.length,
        emptyText: emptyText,
        shortText: shortText,
        fullList: fullLinks
      }
    },
    accessibility: { lang: lang }
  };
}