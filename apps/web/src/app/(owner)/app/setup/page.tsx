import type { Metadata } from "next";
import { SetupWizard } from "@/components/app/setup-wizard";

export const metadata: Metadata = { title: "Set up your booking page" };

export default function SetupPage() {
  return <SetupWizard />;
}
