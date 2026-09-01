import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Stack, Text, Title } from "@mantine/core";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };
import styles from "./index.module.css";

type Recipe = {
  title: string;
  url: string;
};

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
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

  function openUrl() {
    if (typeof recipe !== "undefined") {
      window.open(recipe.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Stack className={styles.page}>
      <Title order={1} className={styles.title}>
        クリックしてレシピをGET!
      </Title>
      <Stack className={styles.actions}>
        <Button size="lg" onClick={() => getUrl()}>
          レシピGETボタン
        </Button>
        <Text data-testid="recipe-name">
          {recipe != undefined && recipe.title}
        </Text>
        <Button variant="light" onClick={() => openUrl()}>
          開く
        </Button>
        <Button
          variant="light"
          onClick={() => {
            if (typeof recipe !== "undefined") {
              void copyUrl(recipe.url);
            }
          }}
        >
          コピーする
        </Button>
        <Button variant="default" onClick={() => setRecipe(undefined)}>
          クリア
        </Button>
      </Stack>
    </Stack>
  );
}
