import { describe, expect, it } from "vite-plus/test";
import worker, {
  contentTypeFor,
  deleteExpired,
  handleRequest,
  type Bucket,
  type Env,
} from "./index.ts";

type Stored = {
  body: Uint8Array;
  uploaded: Date;
  contentType?: string;
};

function fakeBucket(now: () => Date = () => new Date()): {
  bucket: Bucket;
  store: Map<string, Stored>;
} {
  const store = new Map<string, Stored>();
  const bucket: Bucket = {
    get(key) {
      const found = store.get(key);
      if (!found) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        key,
        uploaded: found.uploaded,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(found.body);
            controller.close();
          },
        }),
      });
    },
    async put(key, value, options) {
      const body = new Uint8Array(await new Response(value).arrayBuffer());
      store.set(key, {
        body,
        uploaded: now(),
        contentType: options?.httpMetadata?.contentType,
      });
    },
    list({ prefix = "", cursor, limit = 1000 }) {
      // R2 の cursor と同じく、削除で位置がずれない「最後に返したキー」にする。
      const keys = [...store.keys()]
        .filter((key) => key.startsWith(prefix))
        .toSorted()
        .filter((key) => cursor === undefined || key > cursor);
      const page = keys.slice(0, limit);
      const truncated = keys.length > limit;
      return Promise.resolve({
        objects: page.map((key) => ({
          key,
          uploaded: store.get(key)?.uploaded ?? new Date(0),
        })),
        truncated,
        cursor: truncated ? page.at(-1) : undefined,
      });
    },
    delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        store.delete(key);
      }
      return Promise.resolve();
    },
  };
  return { bucket, store };
}

const base = "https://vrt.example.workers.dev";
const authorization = { authorization: "Bearer secret-token" };

function setup(): { env: Env; store: Map<string, Stored> } {
  const { bucket, store } = fakeBucket();
  return { env: { BUCKET: bucket, UPLOAD_TOKEN: "secret-token" }, store };
}

function put(
  path: string,
  body: string,
  headers: Record<string, string> = authorization,
) {
  return new Request(`${base}${path}`, { method: "PUT", body, headers });
}

describe("アップロード", () => {
  it("トークンがあれば保存し、拡張子から Content-Type を決める", async () => {
    const { env, store } = setup();
    const response = await handleRequest(
      put("/pr-138/42/index.html", "<p>hi</p>"),
      env,
    );
    expect(response.status).toBe(201);
    expect(store.get("pr-138/42/index.html")?.contentType).toBe(
      "text/html; charset=utf-8",
    );
  });

  it("トークンがない、違う、サーバー側が未設定のときは 401", async () => {
    const { env, store } = setup();
    const wrong: Record<string, string>[] = [
      {},
      { authorization: "Bearer wrong" },
    ];
    for (const headers of wrong) {
      const response = await handleRequest(
        put("/pr-138/42/index.html", "x", headers),
        env,
      );
      expect(response.status).toBe(401);
    }
    const unset = await handleRequest(put("/pr-138/42/index.html", "x"), {
      BUCKET: env.BUCKET,
    });
    expect(unset.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it("決まった形のキー以外は受け付けない", async () => {
    const { env, store } = setup();
    for (const path of [
      "/index.html",
      "/pr-abc/42/index.html",
      "/pr-138/42/../x.html",
      "/pr-138/42/%2e%2e/x.html",
      "/pr-138//x.html",
      "/other/42/index.html",
    ]) {
      const response = await handleRequest(put(path, "x"), env);
      expect(response.status, path).toBe(400);
    }
    expect(store.size).toBe(0);
  });
});

describe("配信", () => {
  it("認証なしで読め、末尾が / なら index.html を返す", async () => {
    const { env } = setup();
    await handleRequest(put("/pr-138/42/index.html", "<p>hi</p>"), env);
    await handleRequest(put("/pr-138/42/data/a.png", "png"), env);
    const page = await handleRequest(new Request(`${base}/pr-138/42/`), env);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("<p>hi</p>");
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.headers.get("x-robots-tag")).toBe("noindex");
    const image = await handleRequest(
      new Request(`${base}/pr-138/42/data/a.png`),
      env,
    );
    expect(image.headers.get("content-type")).toBe("image/png");
  });

  it("HEAD は本文を返さない", async () => {
    const { env } = setup();
    await handleRequest(put("/pr-138/42/index.html", "<p>hi</p>"), env);
    const response = await handleRequest(
      new Request(`${base}/pr-138/42/index.html`, { method: "HEAD" }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("ないものは 404、使えないメソッドは 405", async () => {
    const { env } = setup();
    expect(
      (await handleRequest(new Request(`${base}/pr-1/2/index.html`), env))
        .status,
    ).toBe(404);
    expect((await handleRequest(new Request(`${base}/`), env)).status).toBe(
      404,
    );
    expect(
      (
        await handleRequest(
          new Request(`${base}/pr-1/2/index.html`, { method: "POST" }),
          env,
        )
      ).status,
    ).toBe(405);
  });
});

describe("PR 単位の削除", () => {
  it("pr-<番号>/ 以下だけを消す", async () => {
    const { env, store } = setup();
    await handleRequest(put("/pr-138/1/index.html", "a"), env);
    await handleRequest(put("/pr-138/2/data/x.png", "b"), env);
    await handleRequest(put("/pr-1380/1/index.html", "c"), env);
    const response = await handleRequest(
      new Request(`${base}/pr-138/`, {
        method: "DELETE",
        headers: authorization,
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect([...store.keys()]).toEqual(["pr-1380/1/index.html"]);
  });

  it("認証がなければ消さず、PR 単位でない削除は断る", async () => {
    const { env, store } = setup();
    await handleRequest(put("/pr-138/1/index.html", "a"), env);
    const anonymous = await handleRequest(
      new Request(`${base}/pr-138/`, { method: "DELETE" }),
      env,
    );
    expect(anonymous.status).toBe(401);
    const wide = await handleRequest(
      new Request(`${base}/pr-138/1/`, {
        method: "DELETE",
        headers: authorization,
      }),
      env,
    );
    expect(wide.status).toBe(400);
    expect(store.size).toBe(1);
  });

  it("1000 件を超えても全部消す", async () => {
    const { env, store } = setup();
    for (let index = 0; index < 1205; index += 1) {
      store.set(`pr-7/1/data/${String(index)}.png`, {
        body: new Uint8Array(),
        uploaded: new Date(),
      });
    }
    await handleRequest(
      new Request(`${base}/pr-7/`, {
        method: "DELETE",
        headers: authorization,
      }),
      env,
    );
    expect(store.size).toBe(0);
  });
});

describe("期限切れの削除", () => {
  it("保持日数を過ぎたものだけを消す", async () => {
    const { bucket, store } = fakeBucket();
    const now = new Date("2026-10-30T00:00:00Z");
    store.set("pr-1/1/index.html", {
      body: new Uint8Array(),
      uploaded: new Date("2026-10-10T00:00:00Z"),
    });
    store.set("pr-2/2/index.html", {
      body: new Uint8Array(),
      uploaded: new Date("2026-10-25T00:00:00Z"),
    });
    const deleted = await deleteExpired({ BUCKET: bucket }, now);
    expect(deleted).toBe(1);
    expect([...store.keys()]).toEqual(["pr-2/2/index.html"]);
  });

  it("RETENTION_DAYS で保持日数を変えられる", async () => {
    const { bucket, store } = fakeBucket();
    store.set("pr-2/2/index.html", {
      body: new Uint8Array(),
      uploaded: new Date("2026-10-25T00:00:00Z"),
    });
    const deleted = await deleteExpired(
      { BUCKET: bucket, RETENTION_DAYS: "3" },
      new Date("2026-10-30T00:00:00Z"),
    );
    expect(deleted).toBe(1);
  });

  it("scheduled から呼べる", async () => {
    const { bucket, store } = fakeBucket();
    store.set("pr-1/1/index.html", {
      body: new Uint8Array(),
      uploaded: new Date("2020-01-01T00:00:00Z"),
    });
    await worker.scheduled(undefined, { BUCKET: bucket });
    expect(store.size).toBe(0);
  });
});

describe("contentTypeFor", () => {
  it("知らない拡張子は octet-stream にする", () => {
    expect(contentTypeFor("a/b.png")).toBe("image/png");
    expect(contentTypeFor("a/b.exe")).toBe("application/octet-stream");
  });
});
