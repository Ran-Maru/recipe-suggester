import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FILLERS = [
  "シャキシャキの",
  "シャキシャキ",
  "ふわふわの",
  "もちもちの",
  "サクサクの",
  "とろとろの",
  "ふわふわ",
  "もちもち",
  "サクサク",
  "とろとろ",
  "基本の",
  "定番の",
  "絶品",
  "簡単",
];

const SUFFIXES = [
  "のレシピ動画・作り方",
  "のレシピ・つくり方",
  "のレシピ・作り方",
  "の作り方・レシピ",
  "作り方・レシピ",
  "レシピ・作り方",
  "の作り方",
  "のつくり方",
  "のレシピ",
];

const TRACKING_KEYS = new Set(["srsltid", "fbclid", "gclid"]);

function isDirectRun() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

function decodeHtml(value) {
  return value
    .replaceAll(/&#(\d+);/g, (_, digits) =>
      String.fromCodePoint(Number(digits)),
    )
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function normalizeSpace(value) {
  return decodeHtml(value)
    .replaceAll(/[\s\u3000]+/g, " ")
    .trim();
}

function takeBracketDish(text) {
  const match = /^【([^】]+)】\s*(.*)$/u.exec(text);
  if (match === null) {
    return text;
  }
  const inside = match[1].trim();
  const rest = match[2].trim();
  if (inside.length < 2) {
    return text;
  }
  if (rest === "" || /[！♪|｜]/u.test(rest)) {
    return inside;
  }
  return text;
}

function stripTrailingAside(text) {
  return text.replace(/\s*【[^】]*】\s*$/u, "").trim();
}

function stripAuthor(text) {
  return text.replace(/\s+by\s+.+$/iu, "").trim();
}

function stripSiteSuffix(text) {
  const [head] = text.split(/\s*[|｜]\s*/u);
  return (head ?? text).trim();
}

function stripOnce(text, parts, fromEnd) {
  const ordered = parts.toSorted((left, right) => right.length - left.length);
  const part = ordered.find((item) => {
    const next = fromEnd
      ? text.slice(0, text.length - item.length)
      : text.slice(item.length);
    const matches = fromEnd ? text.endsWith(item) : text.startsWith(item);
    return matches && next.trim().length >= 2;
  });
  if (part === undefined) {
    return text;
  }
  const next = fromEnd
    ? text.slice(0, text.length - part.length)
    : text.slice(part.length);
  return next.trim();
}

function stripRepeated(text, parts, fromEnd) {
  let current = text;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = stripOnce(current, parts, fromEnd);
  }
  return current;
}

function stripSlogan(text) {
  const match = /^(?:[^！♪]{1,20}[！♪]\s*)+(.+)$/u.exec(text);
  if (match === null) {
    return text;
  }
  const rest = match[1].trim();
  if (rest.length < 2) {
    return text;
  }
  return rest;
}

export function cleanRecipeName(raw) {
  let text = normalizeSpace(raw);
  if (text === "") {
    return "";
  }
  text = takeBracketDish(text);
  text = stripTrailingAside(text);
  text = stripAuthor(text);
  text = stripSiteSuffix(text);
  text = stripRepeated(text, SUFFIXES, true);
  text = stripSlogan(text);
  text = stripRepeated(text, FILLERS, false);
  text = stripRepeated(text, SUFFIXES, true);
  return text.trim();
}

function readName(value) {
  if (typeof value === "string") {
    const name = normalizeSpace(value);
    return name === "" ? null : name;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return readName(value["@value"]);
  }
  return null;
}

function isRecipeType(type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (item) => typeof item === "string" && /(?:^|\/)Recipe$/u.test(item),
  );
}

function collectRecipeNames(node, found, seen) {
  if (node === null || typeof node !== "object") {
    return;
  }
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRecipeNames(item, found, seen);
    }
    return;
  }
  if (isRecipeType(node["@type"])) {
    const name = readName(node.name);
    if (name !== null && !found.includes(name)) {
      found.push(name);
    }
  }
  for (const value of Object.values(node)) {
    if (value !== null && typeof value === "object") {
      collectRecipeNames(value, found, seen);
    }
  }
}

function parseJsonLd(raw) {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(decodeHtml(text));
    } catch {
      return null;
    }
  }
}

function jsonLdNames(html) {
  const found = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
  );
  for (const script of scripts) {
    const data = parseJsonLd(script[1] ?? "");
    if (data !== null) {
      collectRecipeNames(data, found, new WeakSet());
    }
  }
  return found;
}

function h1Texts(html) {
  const found = [];
  for (const match of html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)) {
    const text = normalizeSpace((match[1] ?? "").replaceAll(/<[^>]+>/g, " "));
    if (text !== "" && !found.includes(text)) {
      found.push(text);
    }
  }
  return found;
}

function metaContent(html, attribute, expected) {
  const tags = html.match(/<meta\b[^>]*>/giu) ?? [];
  for (const tag of tags) {
    const attrs = new Map();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/giu)) {
      attrs.set(match[1].toLowerCase(), decodeHtml(match[2] ?? ""));
    }
    if (
      (attrs.get(attribute) ?? "").toLowerCase() === expected &&
      (attrs.get("content") ?? "") !== ""
    ) {
      return attrs.get("content") ?? null;
    }
  }
  return null;
}

function documentTitle(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html);
  if (match === null) {
    return null;
  }
  const text = normalizeSpace(match[1] ?? "");
  return text === "" ? null : text;
}

export function candidatesFromHtml(html) {
  return {
    jsonLd: jsonLdNames(html),
    h1: h1Texts(html),
    ogTitle: metaContent(html, "property", "og:title"),
    documentTitle: documentTitle(html),
  };
}

function distinctTitles(values) {
  const titles = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const title = cleanRecipeName(value);
    if (title.length >= 2 && !titles.includes(title)) {
      titles.push(title);
    }
  }
  return titles;
}

export function pickTitle(candidates) {
  const sources = [
    ["json-ld", candidates.jsonLd[0]],
    ["h1", candidates.h1[0]],
    ["og:title", candidates.ogTitle],
    ["title", candidates.documentTitle],
  ];
  for (const [source, raw] of sources) {
    if (typeof raw !== "string") {
      continue;
    }
    const title = cleanRecipeName(raw);
    if (title.length >= 2) {
      const titles = distinctTitles([candidates.jsonLd[0], candidates.h1[0]]);
      const weakSource = source === "og:title" || source === "title";
      return {
        title,
        source,
        needsReview: titles.length > 1 || weakSource,
        titles: titles.length > 0 ? titles : [title],
      };
    }
  }
  return { title: null, source: null, needsReview: true, titles: [] };
}

function isTrackingKey(key) {
  const name = key.toLowerCase();
  return name.startsWith("utm_") || TRACKING_KEYS.has(name);
}

export function cleanUrl(input) {
  const url = new URL(input.trim());
  url.hash = "";
  const keys = Array.from(url.searchParams.keys());
  for (const key of keys) {
    if (isTrackingKey(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.href;
}

function identityOf(input) {
  const url = new URL(cleanUrl(input));
  const pathname =
    url.pathname.length > 1 ? url.pathname.replace(/\/+$/u, "") : url.pathname;
  const params = [...url.searchParams.entries()].toSorted((left, right) => {
    if (left[0] === right[0]) {
      return left[1].localeCompare(right[1]);
    }
    return left[0].localeCompare(right[0]);
  });
  return `${url.hostname.toLowerCase()}${pathname}?${JSON.stringify(params)}`;
}

export function sameRecipeUrl(left, right) {
  return identityOf(left) === identityOf(right);
}

export function findDuplicate(storeUrl, recipes) {
  for (const recipe of recipes) {
    if (recipe === null || typeof recipe !== "object" || !("url" in recipe)) {
      continue;
    }
    if (typeof recipe.url !== "string") {
      continue;
    }
    try {
      if (sameRecipeUrl(recipe.url, storeUrl)) {
        return {
          title: typeof recipe.title === "string" ? recipe.title : "",
          url: recipe.url,
        };
      }
    } catch {
      // 既存データの URL が壊れていても、他の行は見る。
    }
  }
  return null;
}

function readMapping(cwd) {
  try {
    const text = readFileSync(resolve(cwd, "src/mapping.json"), "utf8");
    const data = JSON.parse(text);
    return Array.isArray(data)
      ? { mappingRead: true, recipes: data }
      : {
          mappingRead: false,
          recipes: [],
        };
  } catch {
    return { mappingRead: false, recipes: [] };
  }
}

export function describeHtml(html, requestedUrl, finalUrl, recipes) {
  const candidates = candidatesFromHtml(html);
  const picked = pickTitle(candidates);
  const storeUrl = cleanUrl(finalUrl);
  return {
    ok: true,
    requestedUrl,
    finalUrl,
    storeUrl,
    title: picked.title,
    source: picked.source,
    needsReview: picked.needsReview,
    titles: picked.titles,
    duplicate: findDuplicate(storeUrl, recipes),
    candidates,
  };
}

export async function fetchRecipe(url, recipes) {
  let requested;
  try {
    requested = new URL(url.trim());
  } catch {
    return { ok: false, requestedUrl: url, error: "URL が不正です" };
  }
  if (requested.protocol !== "http:" && requested.protocol !== "https:") {
    return {
      ok: false,
      requestedUrl: url,
      error: "http と https だけ開けます",
    };
  }
  try {
    const response = await fetch(requested, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ja,en;q=0.5",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        requestedUrl: requested.href,
        finalUrl: response.url,
        error: `ページを開けませんでした (${response.status})`,
      };
    }
    const html = await response.text();
    return describeHtml(html, requested.href, response.url, recipes);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "取得に失敗しました";
    return {
      ok: false,
      requestedUrl: requested.href,
      error: message,
    };
  }
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    process.stderr.write(
      "usage: vp node .agents/skills/add-recipe-from-url/scripts/extract-recipe-title.mjs <url>...\n",
    );
    process.exitCode = 1;
    return;
  }
  const { mappingRead, recipes } = readMapping(process.cwd());
  const results = [];
  for (const url of urls) {
    const result = await fetchRecipe(url, recipes);
    results.push({ ...result, mappingRead });
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

if (isDirectRun()) {
  await main();
}
