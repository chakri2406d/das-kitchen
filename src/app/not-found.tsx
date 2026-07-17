import Link from "next/link";
import Image from "next/image";

/** Friendly 404 instead of a bare "page not found". */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-2xl border border-brown/10 bg-soft p-8 text-center shadow-warm">
        <Image src="/logo.png" alt="Das Kitchen" width={72} height={72} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-display text-2xl text-coffee">Page not found</h1>
        <p className="mt-2 text-sm text-brown/75">
          This page doesn&apos;t exist — but the food does.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/menu"
            className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark"
          >
            See the menu
          </Link>
          <Link
            href="/"
            className="rounded-full border border-brown/25 px-6 py-2.5 text-sm font-medium text-brown hover:bg-brown/5"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
