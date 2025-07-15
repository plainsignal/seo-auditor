# SEO Auditor Chrome Extension

SEO Auditor is a powerful Chrome Extension that performs instant, full on-page SEO audits directly inside your browser. It analyzes meta tags, headings, images, links, indexing signals, accessibility, structured data, and more — all client-side, privacy-first, and fully open-source.

---

## 🔧 Features

- ✅ llms.txt checker for LLM SEO / LEO / AI SEO Improvements
- ✅ llms-full.txt checker for LLM SEO / LEO / AI SEO Improvements
- ✅ Meta tag audits (title, description, canonical, robots, Open Graph, Twitter, JSON-LD, viewport, charset, language, favicon)
- ✅ Headings structure audit (H1–H6 with hierarchy)
- ✅ Image audits (alt attributes, srcset, missing tags)
- ✅ Link audits (internal, external, nofollow, empty anchor text, short text)
- ✅ Indexability checks (robots.txt, sitemap.xml, sitemap inclusion)
- ✅ Accessibility checks (lang attribute, headings, image alt)
- ✅ Word count, character count, thin content detection
- ✅ Technical SEO signals (structured data, charset, viewport, Open Graph completeness)
- ✅ Color-coded audit scores, helpful suggestions, official documentation links
- ✅ Clean Lighthouse-style interface with full drilldowns
- ✅ Fully client-side, no servers, no tracking, no data collection
- ✅ Chrome Manifest v3 compliant

---

## 📦 Repository Structure

```
├── extension
│ ├── background.js
│ ├── content.js
│ ├── icons
│ │ ├── icon128.png
│ │ ├── icon16.png
│ │ └── icon48.png
│ ├── manifest.json
│ ├── popup.html
│ └── popup.js
├── LICENSE
├── README.md
```

- All extension source files are stored inside the `/extension` folder.
- `seo-auditor-extension.zip` is the ready-to-upload package for Chrome Web Store submission.
- `Makefile` includes optional helper tasks for packaging.

---

## 🚀 Installation (Developer Mode)

1. Clone this repository.
2. Open `chrome://extensions/` in your Chrome browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `/extension` folder.
5. The extension will be loaded for testing and development.

---

## 🔐 Privacy-First

- 100% client-side execution
- No tracking, no analytics, no data collection
- No external servers involved
- Fully GDPR & CCPA compliant

---

## 🔓 Open Source

This project is fully open-source and community-driven.

- GitHub: [https://github.com/plainsignal/seo-auditor](https://github.com/plainsignal/seo-auditor)

Contributions, bug reports and feature suggestions are welcome.

---

## 📝 License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

Developed by [PlainSignal](https://plainsignal.com/ "privacy-focused simple web analytics").
