import sanitizeHtml from "sanitize-html";

export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "span", "div", "section", "article", "header", "footer", "main",
      "details", "summary", "sup", "sub", "mark", "small", "del", "ins",
      "dl", "dt", "dd", "kbd", "samp", "code", "pre",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener nofollow" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}

export function cleanText(s: string): string {
  return sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).trim();
}
