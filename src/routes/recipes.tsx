import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink } from "lucide-react";
import { buttonClassName } from "../buttonClassName.ts";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function Recipes() {
  return (
    <div>
      <h1 className="mb-6 text-center text-[2em] leading-[1.1]">レシピ一覧</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 whitespace-nowrap">No</th>
              <th className="p-2">メニュー名</th>
              <th className="p-2">リンク</th>
              <th className="p-2 whitespace-nowrap">コピー</th>
            </tr>
          </thead>
          <tbody>
            {data.map((recipe, index) => (
              <tr key={`${recipe.title}-${recipe.url}-${String(index)}`}>
                <td className="p-2 whitespace-nowrap">{index + 1}</td>
                <td className="p-2">{recipe.title}</td>
                <td className="p-2">
                  <a
                    className="inline-flex rounded p-2 text-brand hover:text-brand-hover focus:outline-4 focus-visible:outline-4"
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${recipe.title}のレシピサイトを開く`}
                    title="レシピサイトを開く"
                  >
                    <ExternalLink size={18} aria-hidden="true" />
                  </a>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <button
                    type="button"
                    className={buttonClassName}
                    aria-label={`${recipe.title}のURLをコピー`}
                    title="URLをコピー"
                    onClick={() => {
                      void copyUrl(recipe.url);
                    }}
                  >
                    <Copy size={18} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
