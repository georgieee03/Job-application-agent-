import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NORMAL_TEXT_CONTRAST = 4.5;

test("core UI color pairs keep readable contrast", async () => {
  const css = await readFile(join(repoRoot, "ui", "styles.css"), "utf8");
  const colors = extractColorVariables(css);
  const pairs = [
    ["body text", colors["text-dark"], colors.bg],
    ["panel text", colors.text, colors.panel],
    ["panel muted text", colors.muted, colors.panel],
    ["deep panel text", colors.text, colors["panel-deep"]],
    ["primary button text", "#ffffff", colors.accent],
    ["warning pill text", colors.warn, colors.panel],
    ["success pill text", "#d1ffd1", colors.panel],
    ["danger pill text", colors.danger, colors.panel],
    ["remove action text", "#ffb29e", colors.panel],
    ["link button text", resolveCssColor(extractRuleDeclaration(css, ".link-button", "color"), colors), colors.panel],
    ["link button hover text", resolveCssColor(extractRuleDeclaration(css, ".link-button:hover", "color"), colors), colors.panel]
  ] as const;

  for (const [label, foreground, background] of pairs) {
    assert.ok(foreground, `${label}: missing foreground color`);
    assert.ok(background, `${label}: missing background color`);
    assert.ok(
      contrastRatio(foreground, background) >= MIN_NORMAL_TEXT_CONTRAST,
      `${label}: expected ${foreground} on ${background} to meet ${MIN_NORMAL_TEXT_CONTRAST}:1 contrast`
    );
  }
});

function extractColorVariables(css: string): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const match of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    variables[match[1]] = normalizeHex(match[2]);
  }

  return variables;
}

function extractRuleDeclaration(css: string, selector: string, property: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = css.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]+)\\}`));
  const body = rule?.groups?.body ?? "";
  const declaration = body.match(new RegExp(`${property}:\\s*(?<value>[^;]+);`));
  return declaration?.groups?.value.trim() ?? "";
}

function resolveCssColor(value: string, variables: Record<string, string>): string {
  const variable = value.match(/^var\(--([a-z-]+)\)$/);
  if (variable) {
    return variables[variable[1]];
  }

  return normalizeHex(value);
}

function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function normalizeHex(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${[...trimmed.slice(1)].map((digit) => digit + digit).join("")}`;
  }

  return trimmed;
}
