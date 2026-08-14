import { useState } from "react";
import data from "./mapping.json" with { type: "json" };

type Recipe = {
  title: string;
  url: string;
};

const buttonClassName =
  "cursor-pointer rounded-lg border border-transparent bg-button px-[1.2em] py-[0.6em] text-[1em] font-medium transition-[border-color] duration-250 hover:border-brand focus:outline-4 focus-visible:outline-4 dark:bg-button-dark";

function App() {
  // recipeの型付けをする。
  const [recipe, setRecipe] = useState<Recipe>();
  // const [recipe, setRecipe] = useState({})

  function getUrl() {
    const count = data.length;

    // 使い方（例：1から10までのランダムな数）
    const nth = getRandomInt(count - 1);

    setRecipe(data[nth]);
  }

  function getRandomInt(max: number) {
    // Math.random() は 0以上1未満の小数を返す
    // それに max を掛けて切り捨てることで 0 〜 max-1 にし、最後に +1 する
    return Math.floor(Math.random() * max) + 1;
  }

  async function copyUrl() {
    if (typeof recipe !== "undefined") {
      await navigator.clipboard.writeText(recipe.url);
    }
  }

  function openUrl() {
    if (typeof recipe !== "undefined") {
      window.open(recipe.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <h1 className="text-[3.2em] leading-[1.1]">クリックしてレシピをGET!</h1>
      <div className="flex flex-col items-center gap-4 p-[2em]">
        <button className={buttonClassName} onClick={() => getUrl()}>
          レシピGETボタン
        </button>
        <span data-testid="recipe-name">
          {recipe != undefined && recipe.title}
        </span>
        <button className={buttonClassName} onClick={() => openUrl()}>
          開く
        </button>
        <button className={buttonClassName} onClick={() => copyUrl()}>
          コピーする
        </button>
        <button
          className={buttonClassName}
          onClick={() => setRecipe(undefined)}
        >
          クリア
        </button>
      </div>
    </>
  );
}

export default App;
