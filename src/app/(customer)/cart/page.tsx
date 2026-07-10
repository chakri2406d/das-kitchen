import { Navbar } from "@/components/layout/navbar";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">Your Cart</h1>
        <p className="mt-3 text-brown/70">
          Cart items load from the <code>cart_items</code> table for the signed-in user.
          Checkout (COD + Razorpay) is wired in the next build step.
        </p>
      </div>
    </main>
  );
}
