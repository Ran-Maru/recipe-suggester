import { createFileRoute } from "@tanstack/react-router";
import { ActionIcon, Table, Title } from "@mantine/core";
import { IconCopy, IconExternalLink } from "@tabler/icons-react";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function Recipes() {
  return (
    <>
      <Title order={1} ta="center" mb="lg" fz="2rem" lh={1.1}>
        レシピ一覧
      </Title>
      <Table
        striped
        highlightOnHover
        layout="fixed"
        verticalSpacing="xs"
        horizontalSpacing="xs"
        fz="sm"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={44}>No</Table.Th>
            <Table.Th>メニュー名</Table.Th>
            <Table.Th w={72} style={{ whiteSpace: "nowrap" }}>
              リンク
            </Table.Th>
            <Table.Th w={72} style={{ whiteSpace: "nowrap" }}>
              コピー
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((recipe, index) => (
            <Table.Tr key={`${recipe.title}-${recipe.url}-${String(index)}`}>
              <Table.Td>{index + 1}</Table.Td>
              <Table.Td style={{ overflowWrap: "anywhere" }}>
                {recipe.title}
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  component="a"
                  variant="subtle"
                  href={recipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${recipe.title}のレシピサイトを開く`}
                  title="レシピサイトを開く"
                >
                  <IconExternalLink size={18} aria-hidden="true" />
                </ActionIcon>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="default"
                  aria-label={`${recipe.title}のURLをコピー`}
                  title="URLをコピー"
                  onClick={() => {
                    void copyUrl(recipe.url);
                  }}
                >
                  <IconCopy size={18} aria-hidden="true" />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
