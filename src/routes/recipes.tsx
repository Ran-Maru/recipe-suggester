import { useRef, useState, type PointerEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ActionIcon,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useWindowEvent } from "@mantine/hooks";
import { ArrowSquareOut, Copy, Note, X } from "@phosphor-icons/react";
import { copyUrl } from "../copyUrl.ts";
import { recipes } from "../loadRecipes.ts";
import { searchRecipes } from "../searchRecipes.ts";
import {
  TOUCH_ACTION_ICON_SIZE,
  TOUCH_ICON_PX,
  TOUCH_INPUT_ACTION_ICON_SIZE,
  TOUCH_INPUT_SIZE,
} from "../touchTarget.ts";
import styles from "./recipes.module.css";

export const Route = createFileRoute("/recipes")({
  component: Recipes,
});

function RecipeMemoButton({ title, memo }: { title: string; memo: string }) {
  const [opened, setOpened] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // iOS Safari はタップでボタンにフォーカスを渡さないため、開閉はクリックで切り替える
  const lastPointerTypeRef = useRef<string | null>(null);

  useWindowEvent("keydown", (event) => {
    if (opened && event.key === "Escape") {
      setOpened(false);
    }
  });

  useWindowEvent("pointerdown", (event) => {
    if (
      opened &&
      event.target instanceof Node &&
      !buttonRef.current?.contains(event.target)
    ) {
      setOpened(false);
    }
  });

  function openFromPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") {
      setOpened(true);
    }
  }

  function closeFromPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse") {
      setOpened(false);
    }
  }

  function handleClick() {
    const pointerType = lastPointerTypeRef.current;
    lastPointerTypeRef.current = null;
    if (pointerType === "mouse") {
      setOpened(true);
      return;
    }
    setOpened((current) => !current);
  }

  return (
    <Tooltip
      label={memo}
      multiline
      opened={opened}
      position="left"
      classNames={{ tooltip: styles.memoTooltip }}
    >
      <ActionIcon
        ref={buttonRef}
        variant="subtle"
        size={TOUCH_ACTION_ICON_SIZE}
        aria-label={`${title}のメモ`}
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType;
        }}
        onPointerEnter={openFromPointer}
        onPointerLeave={closeFromPointer}
        onClick={handleClick}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            setOpened(true);
          }
        }}
        onBlur={() => {
          setOpened(false);
        }}
      >
        <Note size={TOUCH_ICON_PX} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  );
}

function Recipes() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 150);
  const effectiveQuery = query.trim() === "" ? "" : debouncedQuery;

  const filteredRecipes = searchRecipes(recipes, effectiveQuery);

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
        size={TOUCH_INPUT_SIZE}
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
              size={TOUCH_INPUT_ACTION_ICON_SIZE}
              aria-label="検索をクリア"
              title="検索をクリア"
              onClick={clearSearch}
            >
              <X size={TOUCH_ICON_PX} aria-hidden="true" />
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
              <Table.Th className={styles.colMemo}>メモ</Table.Th>
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
                    size={TOUCH_ACTION_ICON_SIZE}
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${recipe.title}のレシピサイトを開く`}
                    title="レシピサイトを開く"
                  >
                    <ArrowSquareOut size={TOUCH_ICON_PX} aria-hidden="true" />
                  </ActionIcon>
                </Table.Td>
                <Table.Td className={styles.colCopy}>
                  <ActionIcon
                    variant="default"
                    size={TOUCH_ACTION_ICON_SIZE}
                    aria-label={`${recipe.title}のURLをコピー`}
                    title="URLをコピー"
                    onClick={() => {
                      void copyUrl(recipe.url);
                    }}
                  >
                    <Copy size={TOUCH_ICON_PX} aria-hidden="true" />
                  </ActionIcon>
                </Table.Td>
                <Table.Td className={styles.colMemo}>
                  {recipe.memo.trim() === "" ? null : (
                    <RecipeMemoButton title={recipe.title} memo={recipe.memo} />
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
