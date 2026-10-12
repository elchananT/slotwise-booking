import type { Metadata } from "next";
import { PublicFlow } from "@/components/booking/public-flow";

export const metadata: Metadata = { title: "Book an appointment" };

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFlow slug={slug} />;
}
