import { createFileRoute } from "@tanstack/react-router";
import { ActionIcon, Table, Title } from "@mantine/core";
import { ArrowSquareOut, Copy } from "@phosphor-icons/react";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };
import styles from "./recipes.module.css";

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function Recipes() {
  return (
    <>
      <Title order={1} className={styles.title}>
        レシピ一覧
      </Title>
      <Table
        className={styles.table}
        striped
        highlightOnHover
        layout="fixed"
        verticalSpacing="xs"
        horizontalSpacing="xs"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.colNo}>No</Table.Th>
            <Table.Th>メニュー名</Table.Th>
            <Table.Th className={styles.colLink}>リンク</Table.Th>
            <Table.Th className={styles.colCopy}>コピー</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((recipe, index) => (
            <Table.Tr key={`${recipe.title}-${recipe.url}-${String(index)}`}>
              <Table.Td>{index + 1}</Table.Td>
              <Table.Td className={styles.titleCell}>{recipe.title}</Table.Td>
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
                  <ArrowSquareOut size={18} aria-hidden="true" />
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
                  <Copy size={18} aria-hidden="true" />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
