import { createFileRoute } from "@tanstack/react-router";
import styles from "./family-recipe.gyoza.module.css";

export const Route = createFileRoute("/family-recipe/gyoza")({
  component: Gyoza,
});

function Gyoza() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>うちの餃子</h1>
      <p>白菜、ニラ、豚ミンチ、中華系（ダシダとか）少々 ごま油少々、醤油少々</p>
      <p>野菜多めにして、にんにく、しょうがは好きなように</p>
    </div>
  );
}
