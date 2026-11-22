import { test } from "node:test";
import assert from "node:assert/strict";
import { amazonHost, amazonSearch, isAmazon } from "../js/amazon.js";
test("dominio Amazon dal paese della posizione, non dalla lingua", () => {
  assert.equal(amazonHost("it"), "www.amazon.it");
  assert.equal(amazonHost("IT"), "www.amazon.it");
  assert.equal(amazonHost("fi"), "www.amazon.de");      // UE senza negozio proprio
  assert.equal(amazonHost("gb"), "www.amazon.co.uk");
  assert.equal(amazonHost("at"), "www.amazon.de");
  assert.equal(amazonHost(""), "www.amazon.com");       // paese ancora sconosciuto
  assert.equal(amazonSearch("Detersivo lavatrice 40 lavaggi", "it"), "https://www.amazon.it/s?k=Detersivo%20lavatrice%2040%20lavaggi");
  assert.ok(isAmazon("Amazon")); assert.ok(isAmazon("amazon.it")); assert.ok(!isAmazon("Lidl"));
});
