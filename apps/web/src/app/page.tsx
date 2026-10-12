import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Nav } from "@/components/landing/nav";
import { ClosingCta, Details, HowItWorks, NeverTwice } from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <main>
        <Hero nav={<Nav />} />
        <HowItWorks />
        <NeverTwice />
        <Details />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
