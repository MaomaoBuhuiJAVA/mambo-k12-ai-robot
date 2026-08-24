import { notFound } from "next/navigation";

import { getImportedStorybookById } from "@/data/storybooks";
import { ImportedStorybookPlayer } from "@/features/storybook/imported-storybook-player";

import styles from "./page.module.css";

interface ImportedStorybookPageProps {
  params: Promise<{ storybookId: string }>;
}

export default async function ImportedStorybookPage({ params }: ImportedStorybookPageProps) {
  const { storybookId } = await params;
  const storybook = getImportedStorybookById(storybookId);
  if (!storybook) notFound();

  return (
    <main className={styles.page}>
      <ImportedStorybookPlayer storybook={storybook} />
    </main>
  );
}
