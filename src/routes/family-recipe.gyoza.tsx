import { createFileRoute } from "@tanstack/react-router";
import { Stack, Text, Title } from "@mantine/core";

export const Route = createFileRoute("/family-recipe/gyoza")({
  component: Gyoza,
});

function Gyoza() {
  return (
    <Stack gap="xs" ta="left">
      <Title order={1} fz="3.2rem" lh={1.1} mb="md">
        うちの餃子
      </Title>
      <Text>
        白菜、ニラ、豚ミンチ、中華系（ダシダとか）少々 ごま油少々、醤油少々
      </Text>
      <Text>野菜多めにして、にんにく、しょうがは好きなように</Text>
    </Stack>
  );
}
