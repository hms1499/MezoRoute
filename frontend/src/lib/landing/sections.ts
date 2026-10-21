import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";

// U10 (spec §6): the two route sections under the simulator, in morpho.org's rhythm (pill, heading, paragraph,
// button; the illustration alternates sides). Copy comes from the one route copy source.

export type RouteSectionCopy = {
  route: "lp" | "sp";
  pill: string;
  title: string;
  body: string[];
  txs: string;
  illustration: "left" | "right";
};

export const ROUTE_SECTIONS: readonly RouteSectionCopy[] = [
  {
    route: "lp",
    pill: "MUSD/BTC LP",
    title: "Earn swap fees",
    body: [LP_RETURN_SOURCE, LP_RISKS[0]],
    txs: "One transaction in, after a permit or approval; one transaction out, back to MUSD.",
    illustration: "right",
  },
  {
    route: "sp",
    pill: "Stability Pool",
    title: "Back the system",
    body: [SP_RETURN_SOURCE, SP_RISKS[0]],
    txs: "Approve, then deposit; withdraw to exit.",
    illustration: "left",
  },
];
