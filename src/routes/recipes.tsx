import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink } from "lucide-react";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };
import styles from "./recipes.module.css";

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function Recipes() {
  return (
    <div>
      <h1 className={styles.title}>レシピ一覧</h1>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headRow}>
              <th className={`${styles.cell} ${styles.colNo} ${styles.nowrap}`}>
                No
              </th>
              <th className={styles.cell}>メニュー名</th>
              <th className={`${styles.cell} ${styles.colLink}`}>リンク</th>
              <th
                className={`${styles.cell} ${styles.colCopy} ${styles.nowrap}`}
              >
                コピー
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((recipe, index) => (
              <tr key={`${recipe.title}-${recipe.url}-${String(index)}`}>
                <td className={`${styles.cell} ${styles.nowrap}`}>
                  {index + 1}
                </td>
                <td className={`${styles.cell} ${styles.titleCell}`}>
                  {recipe.title}
                </td>
                <td className={styles.cell}>
                  <a
                    className={styles.iconAction}
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${recipe.title}のレシピサイトを開く`}
                    title="レシピサイトを開く"
                  >
                    <ExternalLink size={18} aria-hidden="true" />
                  </a>
                </td>
                <td className={`${styles.cell} ${styles.nowrap}`}>
                  <button
                    type="button"
                    className={styles.iconAction}
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
