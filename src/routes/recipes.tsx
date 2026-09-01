import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ActionIcon, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { ArrowSquareOut, Copy, X } from "@phosphor-icons/react";
import { copyUrl } from "../copyUrl.ts";
import data from "../mapping.json" with { type: "json" };
import { searchRecipes } from "../searchRecipes.ts";
import styles from "./recipes.module.css";

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function Recipes() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const effectiveQuery = query.trim() === "" ? "" : debouncedQuery;

  const filteredRecipes = useMemo(
    () => searchRecipes(data, effectiveQuery),
    [effectiveQuery],
  );

  const showClearButton = query.length > 0;

  function clearSearch() {
    setQuery("");
  }

  return (
    <>
      <Title order={1} className={styles.title}>
        レシピ一覧
      </Title>
      <TextInput
        className={styles.search}
        classNames={{ input: styles.searchInput }}
        label="レシピを検索"
        placeholder="メニュー名やかな"
        value={query}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
        }}
        rightSection={
          showClearButton ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="検索をクリア"
              title="検索をクリア"
              onClick={clearSearch}
            >
              <X size={16} aria-hidden="true" />
            </ActionIcon>
          ) : undefined
        }
      />
      {filteredRecipes.length === 0 ? (
        <Text className={styles.emptyMessage}>該当するレシピがありません</Text>
      ) : (
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
            {filteredRecipes.map((recipe, index) => (
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
      )}
    </>
  );
}
