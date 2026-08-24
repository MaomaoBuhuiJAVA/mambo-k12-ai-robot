import { redirect } from "next/navigation";

export default function HighPage() {
  redirect("/learn?stage=high_school&view=path");
}
