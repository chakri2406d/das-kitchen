import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import { BUSINESS } from "@/lib/business";
import { osmEmbedUrl, directionsToUrl } from "@/lib/geo";
import type { MenuItem } from "@/types/database";
import { ChefHat, Sparkles, Truck, HeartHandshake, MapPin, Phone, Mail, Instagram } from "lucide-react";

const WHATSAPP_FALLBACK = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919999999999";

const WHY = [
  { icon: ChefHat, title: "Freshly prepared daily", body: "Cooked to order every morning — never reheated, never frozen." },
  { icon: Sparkles, title: "Hygienic kitchen", body: "Prepared in a clean, family-run kitchen you'd be happy to eat in." },
  { icon: Truck, title: "Free delivery within 3 km", body: "Warm meals brought to your door across Old Bowenpally and nearby." },
  { icon: HeartHandshake, title: "Taste that wins hearts", body: "Recipes made the way home cooking should taste — with care." },
];

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: specialRows }, { data: settings }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("is_special", true)
      .eq("is_available", true)
      .order("order_count", { ascending: false })
      .limit(6),
    supabase
      .from("business_settings")
      .select("phone, email, whatsapp, fssai_license, kitchen_address, kitchen_lat, kitchen_lng, open_time, close_time")
      .eq("id", 1)
      .single(),
  ]);

  const specials = (specialRows ?? []) as MenuItem[];
  const whatsapp = settings?.whatsapp || WHATSAPP_FALLBACK;
  const phone = settings?.phone;
  const email = settings?.email;
  const fssai = settings?.fssai_license;
  const address = settings?.kitchen_address || BUSINESS.location;
  const kLat = settings?.kitchen_lat ?? null;
  const kLng = settings?.kitchen_lng ?? null;
  const hours =
    settings?.open_time && settings?.close_time
      ? `${settings.open_time.slice(0, 5)} - ${settings.close_time.slice(0, 5)}`
      : null;

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-soft/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-brown/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brown">
              {BUSINESS.promise}
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] text-coffee sm:text-6xl">
              Taste That Wins Hearts
              <span className="block text-gold">Delivered Fresh</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-brown/80">
              Warm, freshly cooked meals from Das Kitchen in Old Bowenpally —
              made with the care of a home cook and brought straight to your door.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft/50 px-3 py-1 font-medium text-coffee">
                <Truck size={15} /> {BUSINESS.deliveryLine}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brown/5 px-3 py-1 font-medium text-brown">
                <MapPin size={15} /> Old Bowenpally
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/menu" variant="primary" size="lg">Order now</ButtonLink>
              <ButtonLink href="/menu" variant="outline" size="lg">View menu</ButtonLink>
              <ButtonLink
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Das Kitchen! I'd like to place an order.")}`}
                variant="whatsapp"
                size="lg"
              >
                WhatsApp order
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto animate-scale-in">
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
        <h2 className="animate-fade-up text-center font-display text-3xl text-coffee sm:text-4xl">
          Why families choose Das Kitchen
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="animate-fade-up rounded-2xl border border-brown/10 bg-soft p-6 shadow-card transition-shadow hover:shadow-warm"
              style={{ animationDelay: `${i * 90}ms` }}
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

      {/* ── Today's Specials (admin-controlled, live from Supabase) ── */}
      <section id="specials" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h2 className="animate-fade-up text-center font-display text-3xl text-coffee sm:text-4xl">Today&apos;s Specials</h2>
        {specials.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gold/40 bg-gold-soft/20 p-8 text-center">
            <p className="text-sm text-brown/70">
              No specials right now — check back soon, or browse the full menu.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {specials.map((item, i) => (
              <article
                key={item.id}
                className="animate-fade-up overflow-hidden rounded-2xl border border-brown/10 bg-soft shadow-card transition-shadow hover:shadow-warm"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {item.image_url && (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    width={400}
                    height={240}
                    className="h-40 w-full object-cover"
                  />
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-coffee">{item.name}</h3>
                    <span className="font-semibold text-coffee">{formatINR(item.price)}</span>
                  </div>
                  {item.description && <p className="mt-1 text-sm text-brown/70">{item.description}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <ButtonLink href="/menu" variant="outline" size="md">See full menu</ButtonLink>
        </div>
      </section>

      {/* ── Instagram ────────────────────────────────────── */}
      <section id="instagram" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex animate-fade-up flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brown/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brown">
            <Instagram size={14} /> @{BUSINESS.instagramHandle}
          </span>
          <h2 className="mt-4 font-display text-3xl text-coffee sm:text-4xl">Fresh from our kitchen</h2>
          <p className="mt-2 max-w-md text-brown/70">
            Follow us on Instagram for daily specials, behind-the-scenes cooking, and offers.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <a
              key={i}
              href={BUSINESS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ animationDelay: `${i * 80}ms` }}
              className="group relative aspect-square animate-scale-in overflow-hidden rounded-2xl border border-brown/10 bg-gradient-to-br from-gold-soft/50 to-cream"
            >
              <Image
                src="/logo.png"
                alt="Das Kitchen on Instagram"
                width={200}
                height={200}
                className="h-full w-full object-contain p-6 opacity-90 transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-coffee/0 text-cream opacity-0 transition-all duration-300 group-hover:bg-coffee/40 group-hover:opacity-100">
                <Instagram size={28} />
              </span>
            </a>
          ))}
        </div>

        <div className="mt-6 text-center">
          <ButtonLink href={BUSINESS.instagramUrl} variant="coffee" size="md">
            Follow @{BUSINESS.instagramHandle}
          </ButtonLink>
        </div>
      </section>

      {/* ── Visit us / takeaway ──────────────────────────── */}
      <section id="visit" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex animate-fade-up flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brown/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brown">
            <MapPin size={14} /> Takeaway welcome
          </span>
          <h2 className="mt-4 font-display text-3xl text-coffee sm:text-4xl">Find us</h2>
          <p className="mt-2 max-w-md text-brown/70">
            Prefer to pick it up yourself? Drop by the kitchen — we&apos;d love to see you.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-brown/10 shadow-card">
            {kLat != null && kLng != null ? (
              <iframe
                title="Das Kitchen location"
                src={osmEmbedUrl(kLat, kLng, 0.006)}
                className="h-72 w-full border-0 md:h-full"
                loading="lazy"
              />
            ) : (
              <div className="flex h-72 items-center justify-center bg-gold-soft/20 p-8 text-center text-sm text-brown/60">
                Map appears once the kitchen location is set in Settings.
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center gap-4 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
            <div>
              <p className="font-display text-xl text-coffee">Das Kitchen</p>
              <p className="mt-2 flex items-start gap-2 text-sm text-brown/75">
                <MapPin size={16} className="mt-0.5 shrink-0" /> {address}
              </p>
            </div>

            {hours && (
              <p className="text-sm text-brown/75">
                Open <span className="font-semibold text-coffee">{hours}</span> daily
              </p>
            )}

            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm font-medium text-brown hover:text-gold">
                <Phone size={16} /> {phone}
              </a>
            )}

            <div className="mt-1 flex flex-wrap gap-2">
              {kLat != null && kLng != null && (
                <ButtonLink href={directionsToUrl(kLat, kLng)} variant="coffee" size="md">
                  Get directions
                </ButtonLink>
              )}
              <ButtonLink
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Das Kitchen! I'd like to order for takeaway.")}`}
                variant="whatsapp"
                size="md"
              >
                Order takeaway
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact / footer ─────────────────────────────── */}
      <footer id="contact" className="mt-8 bg-coffee text-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl">Das Kitchen</p>
            <p className="mt-2 text-sm text-cream/70">{BUSINESS.tagline} · {BUSINESS.promise}</p>
            <a
              href={BUSINESS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-cream/80 hover:text-gold"
            >
              <Instagram size={16} /> @{BUSINESS.instagramHandle}
            </a>
          </div>
          <div className="space-y-2 text-sm text-cream/80">
            {phone && <p className="flex items-center gap-2"><Phone size={16} /> {phone}</p>}
            {email && <p className="flex items-center gap-2"><Mail size={16} /> {email}</p>}
            <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {address}</p>
            <p className="text-cream/70">{BUSINESS.deliveryLine}</p>
          </div>
          <div className="text-sm text-cream/70">
            {fssai && <p>FSSAI Lic. No: {fssai}</p>}
            <p className="mt-2">© {new Date().getFullYear()} Das Kitchen</p>
            <p className="mt-3 border-t border-cream/15 pt-3">
              Website by{" "}
              <span className="font-semibold text-cream/90">Varahi Technologies</span>
            </p>
            <p className="mt-0.5">
              Want a website like this?{" "}
              <a href="tel:+917989050925" className="font-semibold text-cream/90 hover:text-gold">
                +91 79890 50925
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
