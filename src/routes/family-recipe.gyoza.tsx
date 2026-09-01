import { createFileRoute } from "@tanstack/react-router";
import { Stack, Text, Title } from "@mantine/core";
import styles from "./family-recipe.gyoza.module.css";

export const Route = createFileRoute("/family-recipe/gyoza")({
  component: Gyoza,
});

function Gyoza() {
  return (
    <Stack className={styles.page}>
      <Title order={1} className={styles.title}>
        うちの餃子
      </Title>
      <Text>
        白菜、ニラ、豚ミンチ、中華系（ダシダとか）少々 ごま油少々、醤油少々
      </Text>
      <Text>野菜多めにして、にんにく、しょうがは好きなように</Text>
    </Stack>
  );
}
