import { redirect } from "next/navigation";

/**
 * The underground laboratory map was an exploratory prototype. Keep legacy
 * bookmarks and battle links working while sending the main flow to the
 * unified middle-school hub.
 */
export default function MiddleSchoolMapPage() {
  redirect("/learn?stage=middle_school&grade=middle_1&view=courses");
}
