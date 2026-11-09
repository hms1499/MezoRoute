"use client";

import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatToken } from "@/lib/format";
import { FLOW_TOKEN_DIGITS, FLOW_TOKEN_UNIT, maxFillAmount, type FlowToken } from "@/lib/flow/amount";
import { cx } from "@/lib/ui/cx";
import { menuKeys, triggerKey } from "@/lib/ui/menu";
import { MaxButton } from "@/components/ui/MaxButton";
import { Segmented } from "@/components/ui/Segmented";
import { PairIcon, TokenIcon, type Token } from "@/components/ui/TokenIcon";

// U11 §6.1: the amount field. A well box: label on the left, balance and Max on the right; the amount as a large
// figure with a token chip. Two tokens turn the chip into a menu (it replaces the U11 Phase 1 AssetSwitch). Percent
// mode (exit, withdraw) shows the amount the preset picks and the 25/50/75/Max presets under the field.

export type PercentMode = { value: number; presets: readonly number[]; onPreset: (percent: number) => void; label?: string; disabled?: boolean };

function FlowTokenIcon({ token }: { token: FlowToken }) {
  return token === "lp" ? <PairIcon tokens={["musd", "btc"]} size={20} /> : <TokenIcon token={token} size={20} />;
}

const CHIP = "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-pill bg-surface pl-2 pr-3 text-sm font-semibold ring-1 ring-inset ring-line";

function TokenMenu({ token, tokens, onToken }: { token: Token; tokens: Token[]; onToken: (token: Token) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const checked = Math.max(0, tokens.indexOf(token));

  useEffect(() => {
    if (open) items.current[focus]?.focus();
  }, [open, focus]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function choose(next: Token) {
    close(true);
    if (next !== token) onToken(next);
  }

  function openAt(at: number) {
    setFocus(at);
    setOpen(true);
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const result = menuKeys(event.key, focus, tokens.length);
    if (result === null) return;
    if (result !== "close" || event.key !== "Tab") event.preventDefault();
    if (result === "close") close(event.key !== "Tab");
    else if (result === "activate") choose(tokens[focus]);
    else setFocus(result.index);
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Token: ${FLOW_TOKEN_UNIT[token]}`}
        onClick={() => (open ? close(false) : openAt(checked))}
        onKeyDown={(event) => {
          const at = triggerKey(event.key, checked, tokens.length);
          if (at === null) return;
          event.preventDefault();
          openAt(at);
        }}
        className={cx("hit", CHIP, "hover:bg-well")}
      >
        <TokenIcon token={token} size={20} />
        {FLOW_TOKEN_UNIT[token]}
        <ChevronDown aria-hidden className={cx("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Token"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-40 mt-2 w-40 rounded-tip border border-line bg-surface p-1 shadow-overlay"
        >
          {tokens.map((option, index) => (
            <button
              key={option}
              ref={(node) => {
                items.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option === token}
              tabIndex={index === focus ? 0 : -1}
              onClick={() => choose(option)}
              className="hit flex min-h-9 w-full items-center gap-2 rounded-tip px-3 text-left text-sm text-ink hover:bg-well focus-visible:bg-well"
            >
              <TokenIcon token={option} size={20} />
              <span className="flex-1">{FLOW_TOKEN_UNIT[option]}</span>
              {option === token && <Check aria-hidden className="h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TokenAmountInput({
  id,
  label,
  amount,
  onAmount,
  token,
  tokens,
  onToken,
  balance,
  balanceLabel = "Balance",
  max,
  note,
  error,
  percent,
}: {
  id: string;
  label: ReactNode;
  amount: string;
  onAmount?: (amount: string) => void;
  token: FlowToken;
  /** Two entries open a token menu; otherwise the chip is static. */
  tokens?: Token[];
  onToken?: (token: Token) => void;
  balance: bigint;
  balanceLabel?: string;
  /** What Max fills; `null` disables Max (BTC while the gas price is unknown). */
  max: bigint | null;
  note?: ReactNode;
  error?: ReactNode;
  percent?: PercentMode;
}) {
  const unit = FLOW_TOKEN_UNIT[token];
  const helpId = `${id}-help`;
  const noteId = `${id}-note`;
  const describedBy = note ? `${helpId} ${noteId}` : helpId;
  const menu = token !== "lp" && tokens && tokens.length === 2 && onToken ? { token, tokens, onToken } : null;

  return (
    <div className="space-y-2">
      <div className="rounded-inset bg-well px-4 py-3 focus-within:ring-2 focus-within:ring-accent/20">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <label htmlFor={percent ? undefined : id} id={`${id}-label`} className="font-medium">
            {label}
          </label>
          <span id={helpId} className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {balanceLabel} {formatToken(balance, 18, FLOW_TOKEN_DIGITS[token])}
            </span>
            {!percent && onAmount && <MaxButton onClick={() => max !== null && onAmount(maxFillAmount(max, token))} disabled={max === null} />}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {percent ? (
            <output id={id} aria-describedby={describedBy} aria-labelledby={`${id}-label`} className="min-w-0 flex-1 truncate text-title font-semibold">
              {amount || "0"}
            </output>
          ) : (
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amount}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              onChange={(event) => onAmount?.(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-title font-semibold outline-none placeholder:text-muted/60"
            />
          )}
          {menu ? (
            <TokenMenu {...menu} />
          ) : (
            <span className={CHIP}>
              <FlowTokenIcon token={token} />
              {unit}
            </span>
          )}
        </div>
        {note && (
          <p id={noteId} className="mt-1 text-xs text-muted">
            {note}
          </p>
        )}
      </div>
      {percent && (
        // Locked once a flow pins the amount ("Start over" unlocks it).
        <fieldset disabled={percent.disabled}>
          <Segmented
            label={percent.label ?? "Share"}
            options={percent.presets.map((value) => ({ value: String(value), label: value === 100 ? "Max" : `${value}%`, disabled: percent.disabled }))}
            value={String(percent.value)}
            onChange={(next) => percent.onPreset(Number(next))}
          />
        </fieldset>
      )}
      {error && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
