import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/family-recipe/gyoza")({
  component: Gyoza,
});

function Gyoza() {
  return (
    <div className="text-left">
      <h1 className="mb-4 text-[3.2em] leading-[1.1]">うちの餃子</h1>
      <p>白菜、ニラ、豚ミンチ、中華系（ダシダとか）少々 ごま油少々、醤油少々</p>
      <p>野菜多めにして、にんにく、しょうがは好きなように</p>
    </div>
  );
}
