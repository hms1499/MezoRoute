/** U20: the Trove page's Loan | Multiply switch, remembered per browser (a convenience: it changes no data). */
export type TroveView = "loan" | "multiply";

const KEY = "mezoroute.trove-view";

export function readTroveView(): TroveView {
  try {
    return localStorage.getItem(KEY) === "multiply" ? "multiply" : "loan";
  } catch {
    return "loan";
  }
}

export function writeTroveView(view: TroveView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Storage blocked (private window, previews): the switch still works for this visit.
  }
}
