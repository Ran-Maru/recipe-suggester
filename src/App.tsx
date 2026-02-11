import { useState } from "react";
import data from "./mapping.json" with { type: "json" };
import "./App.css";

type Recipe = {
  title: string;
  url: string;
};

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

  function copyUrl() {
    if (typeof recipe !== "undefined") {
      navigator.clipboard.writeText(recipe.url);
    }
  }

  function openUrl() {
    if (typeof recipe !== "undefined") {
      window.open(recipe.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <h1>クリックしてレシピをGET!</h1>
      <div className="card">
        <button onClick={() => getUrl()}>レシピGETボタン</button>
        <br />
        <span>{recipe != undefined && recipe.title}</span>
        <button onClick={() => openUrl()}>開く</button>
        <button onClick={() => copyUrl()}>コピーする</button>
        <br />
        <button onClick={() => setRecipe(undefined)}>クリア</button>
      </div>
    </>
  );
}

export default App;
