import { test } from "node:test";
import assert from "node:assert/strict";
import { amazonHost, amazonSearch, isAmazon } from "../js/amazon.js";
test("dominio Amazon per valuta e lingua", () => {
  assert.equal(amazonHost("EUR", "it"), "www.amazon.it");
  assert.equal(amazonHost("EUR", "fi"), "www.amazon.de");
  assert.equal(amazonHost("GBP", "en"), "www.amazon.co.uk");
  assert.equal(amazonHost("CHF", "de"), "www.amazon.com");
  assert.equal(amazonSearch("Detersivo lavatrice 40 lavaggi", "EUR", "it"), "https://www.amazon.it/s?k=Detersivo%20lavatrice%2040%20lavaggi");
  assert.ok(isAmazon("Amazon")); assert.ok(isAmazon("amazon.it")); assert.ok(!isAmazon("Lidl"));
});
