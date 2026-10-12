// R2 の型は @cloudflare/workers-types に頼らず、使う面だけを構造で宣言する。
// 実機の R2Bucket はこの形に適合する。

type ObjectInfo = {
  key: string;
  uploaded: Date;
};

type ObjectBody = ObjectInfo & {
  body: ReadableStream<Uint8Array>;
};

type ListResult = {
  objects: ObjectInfo[];
  truncated: boolean;
  cursor?: string;
};

export type Bucket = {
  get(key: string): Promise<ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  list(options: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ListResult>;
  delete(keys: string | string[]): Promise<void>;
};

export type Env = {
  BUCKET: Bucket;
  UPLOAD_TOKEN?: string;
  RETENTION_DAYS?: string;
};

const DEFAULT_RETENTION_DAYS = 14;
const DELETE_BATCH = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// pr-<PR 番号>/<run id>/<レポート内のパス>
const REPORT_KEY = /^pr-[0-9]+\/[0-9]+\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const PR_PREFIX = /^pr-[0-9]+\/$/;

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  webm: "video/webm",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  zip: "application/zip",
};

export function contentTypeFor(key: string): string {
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function isSafeKey(key: string): boolean {
  return REPORT_KEY.test(key) && !key.split("/").includes("..");
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

// 長さの違いやトークンの内容が、応答時間に出ないようにハッシュして比べる。
async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.UPLOAD_TOKEN;
  if (!expected) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [left, right] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function decodeKey(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
}

async function serve(
  request: Request,
  env: Env,
  rawKey: string,
): Promise<Response> {
  const key = rawKey.endsWith("/") ? `${rawKey}index.html` : rawKey;
  if (!isSafeKey(key)) {
    return text(404, "見つかりません");
  }
  const object = await env.BUCKET.get(key);
  if (!object) {
    return text(
      404,
      "見つかりません。期限が切れたか、PR がマージされた可能性があります。",
    );
  }
  const headers = new Headers({
    "content-type": contentTypeFor(key),
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex",
  });
  return new Response(request.method === "HEAD" ? null : object.body, {
    headers,
  });
}

async function upload(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (!isSafeKey(key)) {
    return text(400, "キーが不正です");
  }
  if (!request.body) {
    return text(400, "本文がありません");
  }
  await env.BUCKET.put(key, request.body, {
    httpMetadata: { contentType: contentTypeFor(key) },
  });
  return text(201, "保存しました");
}

async function removePrefix(env: Env, prefix: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({
      prefix,
      cursor,
      limit: DELETE_BATCH,
    });
    const keys = page.objects.map((object) => object.key);
    if (keys.length > 0) {
      await env.BUCKET.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function remove(env: Env, key: string): Promise<Response> {
  if (!PR_PREFIX.test(key)) {
    return text(400, "削除できるのは pr-<番号>/ の単位だけです");
  }
  const deleted = await removePrefix(env, key);
  return text(200, `${String(deleted)} 件を削除しました`);
}

function retentionDays(env: Env): number {
  const parsed = Number(env.RETENTION_DAYS);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_RETENTION_DAYS;
}

export async function deleteExpired(
  env: Env,
  now: Date = new Date(),
): Promise<number> {
  const limit = now.getTime() - retentionDays(env) * DAY_MS;
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ cursor, limit: DELETE_BATCH });
    const keys = page.objects
      .filter((object) => object.uploaded.getTime() < limit)
      .map((object) => object.key);
    if (keys.length > 0) {
      await env.BUCKET.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const key = decodeKey(new URL(request.url).pathname);
  if (key === null || key === "") {
    return text(404, "見つかりません");
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return serve(request, env, key);
  }
  if (request.method !== "PUT" && request.method !== "DELETE") {
    return text(405, "使えないメソッドです");
  }
  if (!(await isAuthorized(request, env))) {
    return text(401, "認証に失敗しました");
  }
  return request.method === "PUT"
    ? upload(request, env, key)
    : remove(env, key);
}

export default {
  fetch: handleRequest,
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await deleteExpired(env);
  },
};
