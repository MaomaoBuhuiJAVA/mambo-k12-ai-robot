import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PythonLab } from "@/features/lab/python-lab";
import styles from "./page.module.css";

export default function LabPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="实验室导航">
        <Link href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          返回学习工作台
        </Link>
        <span>Mambo AI 教室</span>
      </nav>
      <PythonLab />
    </main>
  );
}
