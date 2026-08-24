import { redirect } from "next/navigation";

/**
 * Keep the pre-migration project entry usable when an old link has no id.
 * The capstone project is the only standalone H-09 workspace entry.
 */
export default function HighProjectPage() {
  redirect("/learn/project/capstone");
}
