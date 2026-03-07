import type { NextApiRequest, NextApiResponse } from "next";
import { getCheckoutPriceId, TIERS, CYCLES, type PlanLine, type PlanTier, type BillingCycle } from "@/lib/billing";
import { fetchPriceDetails, type PriceDetails } from "@/lib/paddle-product";

export type PlanPriceEntry = PriceDetails | null;

/** GET /api/paddle/plan-prices?planLine=business → { plans: { basic: { monthly, annual }, pro: {...}, plus: {...} } } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const planLine = (req.query.planLine as string)?.toLowerCase();
  if (planLine !== "business") {
    return res.status(400).json({ error: "planLine must be 'business'" });
  }

  const result: Record<PlanTier, Record<BillingCycle, PlanPriceEntry>> = {
    basic: { monthly: null, annual: null },
    pro: { monthly: null, annual: null },
    plus: { monthly: null, annual: null },
  };

  for (const tier of TIERS) {
    for (const cycle of CYCLES) {
      const priceId = getCheckoutPriceId(planLine as PlanLine, tier, cycle);
      if (!priceId) continue;
      const details = await fetchPriceDetails(priceId);
      result[tier][cycle] = details;
    }
  }

  return res.status(200).json({ plans: result });
}
