import { createFileRoute } from "@tanstack/react-router";
import { Stack, Text, Title } from "@mantine/core";
import { findOriginalRecipe } from "../loadRecipes.ts";
import styles from "./family-recipe.$id.module.css";

export const Route = createFileRoute("/family-recipe/$id")({
  component: FamilyRecipePage,
});

function FamilyRecipePage() {
  const { id } = Route.useParams();
  const recipe = findOriginalRecipe(id);

  if (recipe === undefined) {
    return (
      <Stack className={styles.page}>
        <Title order={1} className={styles.title}>
          レシピが見つかりません
        </Title>
      </Stack>
    );
  }

  return (
    <Stack className={styles.page}>
      <Title order={1} className={styles.title}>
        {recipe.title}
      </Title>
      {recipe.paragraphs.map((paragraph, index) => (
        <Text key={`${String(index)}-${paragraph}`}>{paragraph}</Text>
      ))}
    </Stack>
  );
}
