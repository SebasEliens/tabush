import { expect, type Page, type Route } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "./fixtures";

const { Given, When, Then } = createBdd(test);

// ---------------------------------------------------------------- the assistant, stubbed
// The stub stands in for the Claude API behind /llm. It answers in the Messages API format,
// so the real SDK and the real agent loop run; only the model's words are scripted. SQL
// still runs for real in DuckDB-WASM.

type Reply = { tool?: { purpose: string; sql: string }; text?: string };

function message(i: number, reply: Reply) {
  const content = reply.tool
    ? [{ type: "tool_use", id: `toolu_${i}`, name: "run_sql", input: reply.tool }]
    : [{ type: "text", text: reply.text }];
  return {
    id: `msg_${i}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason: reply.tool ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

async function scriptAssistant(page: Page, replies: Reply[], sent: unknown[]) {
  await page.route("**/llm/v1/models*", (r) => r.fulfill({ json: { data: [] } }));
  let i = 0;
  await page.route("**/llm/v1/messages*", async (route: Route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: message(i, replies[Math.min(i, replies.length - 1)]) });
    i += 1;
  });
}

async function examples(page: Page) {
  const res = await page.request.get("/open/examples.json");
  return (await res.json()).examples as { id: string; question: string; sql: string; expected: { rows: Record<string, unknown>[] } }[];
}

// ---------------------------------------------------------------- givens

Given("the open data is published", async ({ page }) => {
  const res = await page.request.get("/open/semantic_model.json");
  expect(res.ok(), "run `npm run e2e:data` (fixture) or the publish step first").toBeTruthy();
});

Given("the assistant is not connected", async ({ page }) => {
  await page.route("**/llm/**", (r) => r.fulfill({ status: 503, json: { type: "error", error: { type: "not_configured" } } }));
});

Given("the assistant is connected", async ({ page }) => {
  const res = await page.request.get("/llm/v1/models?limit=1");
  expect(res.ok(), "set ANTHROPIC_API_KEY to run the @llm scenarios").toBeTruthy();
});

Given(
  "the assistant will run the reference query of {string} and then answer",
  async ({ page, ctx }, id: string) => {
    const ex = (await examples(page)).find((e) => e.id === id)!;
    await scriptAssistant(
      page,
      [
        { tool: { purpose: "Find properties that overlap indigenous lands", sql: ex.sql } },
        {
          text:
            "One private property, **PA-1507300-I** in São Félix do Xingu, overlaps the Terra Indígena Exemplo: 61 ha, half of the property.\n\n" +
            "Half of a property inside a regularised indigenous land is hard to explain as a drawing error, so confidence is high.\n\n" +
            "Sources: rural_properties (SICAR), indigenous_lands (FUNAI via IBGE), edges (overlaps).",
        },
      ],
      ctx.sent,
    );
  },
);

Given("the assistant will run {string} and then answer", async ({ page, ctx }, sql: string) => {
  await scriptAssistant(page, [{ tool: { purpose: "Export properties", sql } }, { text: "I can only read the data, not export it." }], ctx.sent);
});

// ---------------------------------------------------------------- whens

When("I open {string}", async ({ page }, _name: string) => {
  await page.goto("/ask");
  await expect(page.getByText("DuckDB in your browser")).toBeVisible({ timeout: 30_000 });
});

When("I choose the worked example {string}", async ({ page }, question: string) => {
  await page.locator(".ask__examples .chip", { hasText: question }).click();
});

When("I ask {string}", async ({ page }, question: string) => {
  await page.getByLabel("Your question").fill(question);
  await page.getByRole("button", { name: "Ask" }).click();
});

When("I ask the golden question {string}", async ({ page, ctx }, id: string) => {
  const ex = (await examples(page)).find((e) => e.id === id)!;
  ctx.expected = ex.expected.rows;
  await page.getByLabel("Your question").fill(ex.question);
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator(".ask__answer").first()).toBeVisible({ timeout: 170_000 });
});

When("I open the {string} scheme", async ({ page }, name: string) => {
  await page.locator(".ask__aside summary", { hasText: name }).click();
});

// ---------------------------------------------------------------- thens

Then("I see that the assistant is not connected", async ({ page }) => {
  await expect(page.getByText("The assistant is not connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask" })).toBeDisabled();
});

Then("I see the reference query", async ({ page }) => {
  await expect(page.locator(".ask__sql").first()).toContainText("FROM rural_properties");
});

Then("the result has the columns {string}", async ({ page }, cols: string) => {
  const head = page.locator(".ask__result thead th");
  await expect(head).toHaveText(cols.split(",").map((c) => c.trim()));
});

Then("the result has the row {string}", async ({ page }, cells: string) => {
  const row = page.locator(".ask__result tbody tr").first().locator("td");
  await expect(row).toHaveText(cells.split(",").map((c) => c.trim()));
});

Then("the sources include {string} with its snapshot date", async ({ page }, table: string) => {
  await expect(page.locator(".ask__sources li", { hasText: table }).first()).toContainText(/snapshot \d{1,2} \w{3} \d{4}/);
});

Then("I see the step {string} with {int} row(s)", async ({ page }, purpose: string, n: number) => {
  const step = page.locator(".ui-disclosure", { hasText: purpose }).first();
  await expect(step.locator(".ui-disclosure__meta")).toContainText(`${n} row`);
  await expect(step.locator(".ask__result tbody tr")).toHaveCount(n);
});

Then("I see the answer", async ({ page }) => {
  await expect(page.locator(".ask__answer").first()).toContainText("PA-1507300-I");
});

Then("the assistant was sent the query result", async ({ ctx }) => {
  const last = ctx.sent.at(-1) as { messages: { role: string; content: unknown }[] };
  const result = JSON.stringify(last.messages.at(-1)?.content);
  expect(result).toContain("tool_result");
  expect(result).toContain("PA-1507300-I");
});

Then("I see the step fail with {string}", async ({ page }, text: string) => {
  await expect(page.locator(".ui-disclosure__meta", { hasText: "failed" }).first()).toBeVisible();
  await expect(page.locator(".ui-callout--warning").first()).toContainText(text);
});

Then("the assistant was told the query failed", async ({ ctx }) => {
  const last = ctx.sent.at(-1) as { messages: { role: string; content: { is_error?: boolean }[] }[] };
  expect(last.messages.at(-1)?.content.some((b) => b.is_error)).toBe(true);
});

Then("the semantic layer lists the table {string}", async ({ page }, table: string) => {
  await expect(page.locator(".ask__aside code", { hasText: table }).first()).toBeVisible();
});

Then("it lists {string} as {string}", async ({ page }, code: string, label: string) => {
  const item = page.locator(".ask__aside li", { has: page.locator("code", { hasText: new RegExp(`^${code}$`) }) });
  await expect(item.first()).toContainText(label);
});

Then("the answer contains the numbers of the reference answer", async ({ page, ctx }) => {
  // Numbers as people write them: "3,783", "3.783" or "3783" all count.
  const answer = (await page.locator(".ask__answer").first().innerText()).replace(/(\d)[.,\s](?=\d{3}\b)/g, "$1");
  const first = ctx.expected[0] ?? {};
  const numbers = Object.values(first).filter((v): v is number => typeof v === "number" && Number.isInteger(v));
  expect(numbers.length, "reference answer has whole numbers to check").toBeGreaterThan(0);
  for (const n of numbers) expect(answer, `answer mentions ${n}`).toContain(String(n));
});

Then("the answer names its sources", async ({ page }) => {
  await expect(page.locator(".ask__answer").first()).toContainText(/sources?:|fontes?:/i);
});

Then("I save a screenshot {string}", async ({ page }, name: string) => {
  // The app scrolls inside its own layout, so grow the window to fit the page instead.
  const height = await page.evaluate(() => document.querySelector("main")!.scrollHeight + 56);
  await page.setViewportSize({ width: 1440, height: Math.min(Math.max(height, 900), 4000) });
  await page.screenshot({ path: `e2e/screenshots/${name}.png` });
});
