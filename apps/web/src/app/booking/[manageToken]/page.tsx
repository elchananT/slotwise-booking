import type { Metadata } from "next";
import { ManageBooking } from "@/components/booking/manage-booking";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ manageToken: string }> }) {
  const { manageToken } = await params;
  return <ManageBooking token={manageToken} />;
}
