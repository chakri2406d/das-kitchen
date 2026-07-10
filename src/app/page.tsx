import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { ChefHat, Sparkles, Truck, HeartHandshake, MapPin, Phone, Mail } from "lucide-react";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919999999999";

const WHY = [
  { icon: ChefHat, title: "Freshly prepared daily", body: "Cooked to order every morning — never reheated, never frozen." },
  { icon: Sparkles, title: "Hygienic kitchen", body: "Prepared in a clean, family-run kitchen you'd be happy to eat in." },
  { icon: Truck, title: "Fast delivery", body: "Warm meals brought to your door across our delivery areas." },
  { icon: HeartHandshake, title: "Homemade taste", body: "Recipes made the way home cooking should taste — with care." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-soft/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-brown/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brown">
              Family-run kitchen
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] text-coffee sm:text-6xl">
              Homemade Happiness
              <span className="block text-gold">Delivered Fresh</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-brown/80">
              Warm, freshly cooked meals from Das Kitchen — breakfast to dinner,
              made with the care of a home cook and brought straight to your door.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/menu" variant="primary" size="lg">Order now</ButtonLink>
              <ButtonLink href="/menu" variant="outline" size="lg">View menu</ButtonLink>
              <ButtonLink
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi Das Kitchen! I'd like to place an order.")}`}
                variant="whatsapp"
                size="lg"
              >
                WhatsApp order
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto animate-fade-up">
            <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-gold-soft/60 to-transparent blur-2xl" />
            <Image
              src="/logo.png"
              alt="Das Kitchen"
              width={440}
              height={440}
              priority
              className="mx-auto drop-shadow-[0_20px_40px_rgba(92,64,51,0.25)]"
            />
          </div>
        </div>
      </section>

      {/* ── Why choose us ────────────────────────────────── */}
      <section id="why" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl text-coffee sm:text-4xl">
          Why families choose Das Kitchen
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card transition-shadow hover:shadow-warm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-soft/50 text-gold-dark">
                <Icon size={24} />
              </div>
              <h3 className="mt-4 font-display text-lg text-coffee">{title}</h3>
              <p className="mt-2 text-sm text-brown/75">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Specials placeholder (admin-controlled, wired next) ── */}
      <section id="specials" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-dashed border-gold/40 bg-gold-soft/20 p-8 text-center">
          <p className="font-display text-xl text-coffee">Today&apos;s Specials</p>
          <p className="mt-1 text-sm text-brown/70">
            This section is admin-controlled and will load live specials from Supabase once the menu is seeded.
          </p>
        </div>
      </section>

      {/* ── Contact / footer ─────────────────────────────── */}
      <footer id="contact" className="mt-8 bg-coffee text-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl">Das Kitchen</p>
            <p className="mt-2 text-sm text-cream/70">Homemade happiness, delivered fresh.</p>
          </div>
          <div className="space-y-2 text-sm text-cream/80">
            <p className="flex items-center gap-2"><Phone size={16} /> +91 99999 99999</p>
            <p className="flex items-center gap-2"><Mail size={16} /> hello@daskitchen.in</p>
            <p className="flex items-center gap-2"><MapPin size={16} /> Your kitchen address here</p>
          </div>
          <div className="text-sm text-cream/70">
            <p>FSSAI Lic. No: ____________</p>
            <p className="mt-2">© {new Date().getFullYear()} Das Kitchen</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
