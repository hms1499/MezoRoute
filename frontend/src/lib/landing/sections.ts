import { troveRisks } from "@/lib/leverage/risks";
import { LP_RETURN_SOURCE, LP_RISKS, SP_RETURN_SOURCE, SP_RISKS } from "@/lib/routes/copy";

// U10 (spec §6): the sections under the simulator, in morpho.org's rhythm (pill, heading, paragraph, button; the
// illustration alternates sides). U16 adds the Trove and turns the "how it is sent" sentence into icon facts.
// Return sources and risks come from the one route copy source.

export type FactIcon = "tx" | "sign" | "exit" | "oracle" | "wallet";

export type SectionAction = { kind: "plan"; route: "lp" | "sp"; label: string } | { kind: "connect"; label: string };

export type RouteSectionCopy = {
  route: "lp" | "sp" | "trove";
  pill: string;
  title: string;
  body: string;
  risk: string;
  facts: { icon: FactIcon; text: string }[];
  action: SectionAction;
  illustration: "left" | "right";
};

export const ROUTE_SECTIONS: readonly RouteSectionCopy[] = [
  {
    route: "lp",
    pill: "MUSD/BTC LP",
    title: "Collect swap fees or MEZO",
    body: `${LP_RETURN_SOURCE}.`,
    risk: LP_RISKS[0],
    facts: [
      { icon: "tx", text: "One transaction in" },
      { icon: "sign", text: "Permit or approval" },
      { icon: "exit", text: "Unstake, exit to MUSD" },
    ],
    action: { kind: "plan", route: "lp", label: "Plan an LP deposit" },
    illustration: "right",
  },
  {
    route: "sp",
    pill: "Stability Pool",
    title: "Back the system",
    body: `${SP_RETURN_SOURCE}.`,
    risk: SP_RISKS[0],
    facts: [
      { icon: "sign", text: "Approve, then deposit" },
      { icon: "exit", text: "Withdraw to exit" },
    ],
    action: { kind: "plan", route: "sp", label: "Deposit to the Stability Pool" },
    illustration: "left",
  },
  {
    route: "trove",
    pill: "Your Trove",
    title: "Unwind, close, or lever up in one transaction",
    body: "A flash swap on the MUSD/BTC pool repays debt from your collateral or adds BTC with new debt. No MUSD needed first.",
    risk: troveRisks("leverage")[0],
    facts: [
      { icon: "tx", text: "One transaction" },
      { icon: "sign", text: "Authorisation and permit" },
      { icon: "oracle", text: "Oracle cost and queue shown" },
      { icon: "wallet", text: "EVM wallets only" },
    ],
    action: { kind: "connect", label: "Connect to manage your Trove" },
    illustration: "right",
  },
];
