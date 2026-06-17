import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyBoardDisplayName,
  dedupeListings,
  listingDedupeKey,
  listingUrlKey,
  normalizeListingUrl,
  resolveBoardCompanyName
} from "../src/jobs/listing-normalize.js";
import { parseJobSourceConfig } from "../src/jobs/source-config.js";
import type { JobListing } from "../src/jobs/types.js";

function sampleListing(overrides: Partial<JobListing> = {}): JobListing {
  return {
    provider: "greenhouse",
    providerKind: "company-board",
    source: "acme",
    externalId: "1",
    title: "Platform Engineer",
    company: "acme",
    location: "Remote",
    department: null,
    employmentType: null,
    workplaceType: null,
    remote: true,
    listingUrl: "https://boards.greenhouse.io/acme/jobs/1",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    postedAt: null,
    compensation: null,
    description: null,
    metadata: {},
    ...overrides
  };
}

test("parseJobSourceConfig accepts optional board companyName", () => {
  const parsed = parseJobSourceConfig({
    boards: [
      { provider: "greenhouse", source: "acme", companyName: "Acme Corp" },
      { provider: "lever", source: "vercel" }
    ]
  });

  assert.equal(parsed.boards[0]?.companyName, "Acme Corp");
  assert.equal(parsed.boards[1]?.companyName, undefined);
});

test("resolveBoardCompanyName prefers explicit configured display names", () => {
  assert.equal(resolveBoardCompanyName("Intel", "Intel Corporation", "intel/External"), "Intel Corporation");
  assert.equal(resolveBoardCompanyName("acme", "Acme Corp", "acme"), "Acme Corp");
  assert.equal(
    resolveBoardCompanyName("careers-example.icims.com", "Example Co", "careers-example.icims.com"),
    "Example Co"
  );
});

test("applyBoardDisplayName updates weak provider company labels", () => {
  const listing = applyBoardDisplayName(sampleListing({ company: "acme" }), {
    provider: "greenhouse",
    source: "acme",
    companyName: "Acme Corp"
  });

  assert.equal(listing.company, "Acme Corp");
});

test("normalizeListingUrl strips tracking params and trailing slashes", () => {
  assert.equal(
    normalizeListingUrl(
      "https://jobs.lever.co/Acme/Role?utm_source=newsletter&ref=abc#apply"
    ),
    "https://jobs.lever.co/Acme/Role"
  );
  assert.equal(
    normalizeListingUrl("https://www.example.com/jobs/1/"),
    "https://example.com/jobs/1"
  );
});

test("dedupeListings prefers company boards when meta keys match", () => {
  const aggregator = sampleListing({
    provider: "adzuna",
    providerKind: "aggregator",
    company: "Acme Corp",
    listingUrl: "https://www.adzuna.com/details/123?utm_source=email",
    applyUrl: "https://www.adzuna.com/details/123?ref=home",
    description: null
  });
  const board = sampleListing({
    providerKind: "company-board",
    company: "Acme Corp",
    listingUrl: "https://boards.greenhouse.io/acme/jobs/1/",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    description: "Full description"
  });

  const deduped = dedupeListings([aggregator, board]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.providerKind, "company-board");
  assert.equal(deduped[0]?.description, "Full description");
  assert.equal(listingUrlKey(deduped[0]), listingUrlKey(board));
});

test("dedupeListings merges normalized URL variants for the same posting", () => {
  const first = sampleListing({
    listingUrl: "https://www.jobs.example.com/posting/abc/?utm_source=email",
    applyUrl: "https://www.jobs.example.com/posting/abc/?utm_campaign=launch"
  });
  const second = sampleListing({
    provider: "jooble",
    providerKind: "aggregator",
    listingUrl: "https://jobs.example.com/posting/abc",
    applyUrl: "https://jobs.example.com/posting/abc"
  });

  const deduped = dedupeListings([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(listingUrlKey(deduped[0]), "https://jobs.example.com/posting/abc");
});

test("dedupeListings merges cross-source duplicates on title company and location", () => {
  const board = sampleListing({
    listingUrl: "https://boards.greenhouse.io/acme/jobs/9",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/9"
  });
  const aggregator = sampleListing({
    provider: "jooble",
    providerKind: "aggregator",
    listingUrl: "https://jooble.org/job/9",
    applyUrl: "https://jooble.org/job/9/apply"
  });

  const deduped = dedupeListings([aggregator, board]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.providerKind, "company-board");
});

test("dedupeListings does not merge unrelated roles with different titles", () => {
  const deduped = dedupeListings([
    sampleListing({
      title: "Backend Engineer",
      externalId: "1",
      listingUrl: "https://boards.greenhouse.io/acme/jobs/1",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/1"
    }),
    sampleListing({
      title: "Frontend Engineer",
      externalId: "2",
      listingUrl: "https://boards.greenhouse.io/acme/jobs/2",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/2"
    })
  ]);

  assert.equal(deduped.length, 2);
});

test("dedupeListings keeps separate direct postings with distinct urls", () => {
  const deduped = dedupeListings([
    sampleListing({
      externalId: "1",
      listingUrl: "https://boards.greenhouse.io/acme/jobs/1",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/1"
    }),
    sampleListing({
      externalId: "2",
      listingUrl: "https://boards.greenhouse.io/acme/jobs/2",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/2"
    })
  ]);

  assert.equal(deduped.length, 2);
});

test("dedupeListings removes stale URL indexes after canonical replacement", () => {
  const aggregator = sampleListing({
    provider: "jooble",
    providerKind: "aggregator",
    listingUrl: "https://jooble.org/job/1",
    applyUrl: "https://jooble.org/job/1/apply"
  });
  const direct = sampleListing({
    listingUrl: "https://boards.greenhouse.io/acme/jobs/1",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    description: "Full description"
  });
  const unrelatedAggregatorSameUrl = sampleListing({
    provider: "jooble",
    providerKind: "aggregator",
    title: "Frontend Engineer",
    externalId: "2",
    listingUrl: "https://jooble.org/job/1",
    applyUrl: "https://jooble.org/job/1/apply"
  });

  const deduped = dedupeListings([aggregator, direct, unrelatedAggregatorSameUrl]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0]?.providerKind, "company-board");
  assert.equal(deduped[1]?.title, "Frontend Engineer");
});

test("listingDedupeKey uses normalized URLs when present", () => {
  const listing = sampleListing({
    listingUrl: "https://boards.greenhouse.io/acme/jobs/1/?utm_source=x"
  });

  assert.equal(
    listingDedupeKey(listing),
    "https://boards.greenhouse.io/acme/jobs/1"
  );
});
