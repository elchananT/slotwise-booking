import { AuthProvider } from "@/lib/auth";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
