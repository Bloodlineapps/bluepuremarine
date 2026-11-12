"use client";
import { useEffect } from "react";
import { finishOrder } from "@/app/(site)/afrekenen/actions";
import { announceCart } from "./CartIndicator";

/** Op de bedankpagina: leegt de winkelwagen die bij deze bestelling hoort en werkt de header bij. */
export function OrderDone({ token }: { token: string }) {
  useEffect(() => {
    finishOrder(token)
      .then((s) => {
        announceCart(s);
        window.dispatchEvent(new Event("customer:changed"));
      })
      .catch(() => {});
  }, [token]);
  return null;
}
