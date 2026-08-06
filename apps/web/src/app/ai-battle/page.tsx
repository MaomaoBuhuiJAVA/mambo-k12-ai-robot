import { AiBattleGame } from "@/features/ai-battle/ai-battle-game";
import { resolveAiBattleModule } from "@/features/ai-battle/ai-battle-modules";

import styles from "./page.module.css";

interface AiBattlePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AiBattlePage({ searchParams }: AiBattlePageProps) {
  const query = await searchParams;
  const battleModule = resolveAiBattleModule(firstParam(query.module));

  return (
    <main className={styles.page}>
      <AiBattleGame battleModule={battleModule} />
    </main>
  );
}
