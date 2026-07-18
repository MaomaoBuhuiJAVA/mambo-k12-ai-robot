import { ProgressDashboard } from "@/features/progress/progress-dashboard";
import styles from "./page.module.css";

export default function ProgressPage() {
  return <main className={styles.page}><ProgressDashboard /></main>;
}
