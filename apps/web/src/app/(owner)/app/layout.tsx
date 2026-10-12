import { AppGate } from "@/components/app/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}
