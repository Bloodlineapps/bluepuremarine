import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CartSync } from "@/components/shop/CartParts";
import { CartLinesCompact, CartTotals, FreeShippingBar } from "@/components/shop/CartTotals";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { computeCart, readCartState } from "@/lib/cart";
import { currentCustomer } from "@/lib/customer";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { listMethods, paymentMode } from "@/lib/mollie";
import { getShop } from "@/lib/settings";

export const metadata: Metadata = { title: "Afrekenen", robots: { index: false, follow: true } };

export default async function CheckoutPage() {
  const [state, customer, shop] = await Promise.all([readCartState(), currentCustomer(), getShop()]);
  const address = customer ? await db.address.findFirst({ where: { customerId: customer.id, type: "shipping" }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : null;
  // Nog geen land gekozen in de winkelwagen: het land van het standaardadres bepaalt de verzendkosten
  const country = state.country ?? (address && shop.shipping.some((s) => s.country === address.country) ? address.country : undefined);
  const { cart } = await computeCart({ ...state, country });
  if (!cart.lines.length) redirect("/winkelwagen/?melding=leeg");
  if (cart.lines.some((l) => !l.inStock)) redirect("/winkelwagen/");

  const mode = await paymentMode();
  const methods = mode === "mollie" && cart.total > 0 ? await listMethods(cart.total) : [];
  const useAddress = address && address.country === cart.shippingCountry ? address : null;
  const defaults: Record<string, string> = {
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    firstName: useAddress?.firstName ?? customer?.firstName ?? "",
    lastName: useAddress?.lastName ?? customer?.lastName ?? "",
    company: useAddress?.company ?? "",
    country: cart.shippingCountry,
    postalCode: useAddress?.postalCode ?? "",
    houseNumber: useAddress?.houseNumber ?? "",
    addition: useAddress?.addition ?? "",
    street: useAddress?.street ?? "",
    city: useAddress?.city ?? "",
    b_country: cart.shippingCountry,
  };

  const summary = (
    <div className="space-y-5">
      <CartLinesCompact cart={cart} />
      <FreeShippingBar cart={cart} />
      <CartTotals cart={cart} />
      <p className="text-xs text-muted">
        Verzending naar {cart.countries.find((c) => c.country === cart.shippingCountry)?.label ?? cart.shippingCountry}.{" "}
        <Link href="/winkelwagen/" className="link">
          Winkelwagen aanpassen
        </Link>
      </p>
    </div>
  );

  return (
    <div className="container-x py-8 md:py-12">
      <CartSync count={cart.count} total={cart.total} />
      <h1 className="text-3xl md:text-4xl">Afrekenen</h1>

      <details className="card mt-5 lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 font-semibold text-ink">
          <span>
            Je bestelling ({cart.count} {cart.count === 1 ? "artikel" : "artikelen"})
          </span>
          <span className="price text-lg">{money(cart.total)}</span>
        </summary>
        <div className="border-t border-rule p-5">{summary}</div>
      </details>

      <div className="mt-5 grid gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
        <CheckoutForm
          customer={customer ? { email: customer.email, firstName: customer.firstName } : null}
          defaults={defaults}
          countries={cart.countries.map((c) => ({ value: c.country, label: c.label }))}
          mode={mode}
          methods={methods}
          total={cart.total}
          hasIban={!!shop.iban.trim()}
        />
        <aside className="card hidden p-5 lg:sticky lg:top-28 lg:block" aria-label="Je bestelling">
          <h2 className="mb-4 text-xl">Je bestelling</h2>
          {summary}
        </aside>
      </div>
    </div>
  );
}
