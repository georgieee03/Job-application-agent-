import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProviderCoverage } from "../src/jobs/search.js";
import { parseJobSourceConfig } from "../src/jobs/source-config.js";
import { detectCompanyBoardSource } from "../src/jobs/source-discovery.js";
import { BambooHrProvider } from "../src/jobs/providers/bamboohr.js";
import { IcimsClassicProvider } from "../src/jobs/providers/icims-classic.js";
import { IcimsJibeProvider } from "../src/jobs/providers/icims-jibe.js";
import { OracleCeProvider } from "../src/jobs/providers/oracle-ce.js";
import { PersonioProvider } from "../src/jobs/providers/personio.js";
import { RecruiteeProvider } from "../src/jobs/providers/recruitee.js";
import { SmartRecruitersProvider } from "../src/jobs/providers/smartrecruiters.js";
import { TaleoProvider } from "../src/jobs/providers/taleo.js";
import { WorkdayProvider, parseWorkdaySource } from "../src/jobs/providers/workday.js";

test("config schema accepts expanded direct-employer board providers", () => {
  const parsed = parseJobSourceConfig({
    boards: [
      { provider: "workday", source: "intel.wd1.myworkdayjobs.com/intel/External", limit: 20, maxPages: 2 },
      { provider: "smartrecruiters", source: "smartrecruiters" },
      { provider: "recruitee", source: "bunq" },
      { provider: "personio", source: "personio.jobs.personio.de", language: "en" },
      { provider: "bamboohr", source: "zapier" },
      { provider: "icims-jibe", source: "careers.example.icims.com", limit: 25 },
      { provider: "icims-classic", source: "careers-example.icims.com", keyword: "software" },
      { provider: "oracle-ce", source: "eeho.fa.us2.oraclecloud.com/jobsearch", keyword: "software", limit: 25 },
      { provider: "taleo", source: "unifirst.taleo.net/unf_external", lang: "en" }
    ],
    filters: {
      preferredProviders: ["workday", "workday", "personio"]
    }
  });

  assert.equal(parsed.boards.length, 9);
  assert.deepEqual(parsed.filters.preferredProviders, ["workday", "personio"]);
});

test("config schema accepts search and direct board sources without provider preference", () => {
  const parsed = parseJobSourceConfig({
    searches: [
      { provider: "jooble", query: "robotics engineer", location: "United States" },
      { provider: "adzuna", query: "controls engineer", location: "United States" }
    ],
    boards: [
      { provider: "greenhouse", source: "locusrobotics" },
      { provider: "lever", source: "anduril" },
      { provider: "ashby", source: "zipline" }
    ]
  });

  assert.deepEqual(parsed.searches.map((search) => search.provider), ["jooble", "adzuna"]);
  assert.deepEqual(parsed.boards.map((board) => board.provider), ["greenhouse", "lever", "ashby"]);
  assert.deepEqual(parsed.filters.preferredProviders, []);
});

test("provider coverage summarizes configured, completed, and failed sources", () => {
  const parsed = parseJobSourceConfig({
    searches: [
      { provider: "jooble", query: "robotics engineer", location: "United States" },
      { provider: "adzuna", query: "robotics engineer", location: "United States" }
    ],
    boards: [
      { provider: "greenhouse", source: "locusrobotics" },
      { provider: "greenhouse", source: "mavenrobotics" },
      { provider: "ashby", source: "zipline" }
    ]
  });

  const coverage = buildProviderCoverage(
    parsed,
    [
      { provider: "jooble", mode: "search", source: "robotics engineer", count: 12 },
      { provider: "greenhouse", mode: "board", source: "locusrobotics", count: 3 },
      { provider: "ashby", mode: "board", source: "zipline", count: 8 }
    ],
    [
      { provider: "adzuna", mode: "search", source: "robotics engineer", message: "temporarily unavailable" },
      { provider: "greenhouse", mode: "board", source: "mavenrobotics", message: "404 Not Found" }
    ]
  );

  assert.deepEqual(coverage, [
    {
      provider: "ashby",
      mode: "board",
      configuredSources: 1,
      completedSources: 1,
      fetchedListings: 8,
      errors: 0
    },
    {
      provider: "greenhouse",
      mode: "board",
      configuredSources: 2,
      completedSources: 1,
      fetchedListings: 3,
      errors: 1
    },
    {
      provider: "adzuna",
      mode: "search",
      configuredSources: 1,
      completedSources: 0,
      fetchedListings: 0,
      errors: 1
    },
    {
      provider: "jooble",
      mode: "search",
      configuredSources: 1,
      completedSources: 1,
      fetchedListings: 12,
      errors: 0
    }
  ]);
});

test("source discovery detects common public ATS URLs", () => {
  assert.deepEqual(detectCompanyBoardSource("https://jobs.ashbyhq.com/openai"), {
    provider: "ashby",
    source: "openai"
  });
  assert.deepEqual(detectCompanyBoardSource("https://jobs.lever.co/vercel"), {
    provider: "lever",
    source: "vercel"
  });
  assert.deepEqual(detectCompanyBoardSource("https://job-boards.greenhouse.io/ramp"), {
    provider: "greenhouse",
    source: "ramp"
  });
  assert.deepEqual(detectCompanyBoardSource("https://careers.smartrecruiters.com/SmartRecruiters"), {
    provider: "smartrecruiters",
    source: "SmartRecruiters"
  });
  assert.deepEqual(detectCompanyBoardSource("https://intel.wd1.myworkdayjobs.com/en-US/External/job/Phoenix/Role_JR1"), {
    provider: "workday",
    source: "intel.wd1.myworkdayjobs.com/intel/External"
  });
  assert.deepEqual(detectCompanyBoardSource("https://bunq.recruitee.com/o/offboarding-agent"), {
    provider: "recruitee",
    source: "bunq"
  });
  assert.deepEqual(detectCompanyBoardSource("https://personio.jobs.personio.de/"), {
    provider: "personio",
    source: "personio.jobs.personio.de"
  });
  assert.deepEqual(detectCompanyBoardSource("https://example.bamboohr.com/careers"), {
    provider: "bamboohr",
    source: "example"
  });
  assert.deepEqual(detectCompanyBoardSource("https://careers-example.icims.com/jobs/search?in_iframe=1"), {
    provider: "icims-classic",
    source: "careers-example.icims.com"
  });
  assert.deepEqual(detectCompanyBoardSource("https://careers.example.icims.com/api/jobs"), {
    provider: "icims-jibe",
    source: "careers.example.icims.com"
  });
  assert.deepEqual(detectCompanyBoardSource("https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch/jobs"), {
    provider: "oracle-ce",
    source: "eeho.fa.us2.oraclecloud.com/jobsearch"
  });
  assert.deepEqual(detectCompanyBoardSource("https://unifirst.taleo.net/careersection/unf_external/jobsearch.ftl"), {
    provider: "taleo",
    source: "unifirst.taleo.net/unf_external"
  });
});

test("Workday provider posts to public CXS feed and optionally reads bounded detail", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  await withMockFetch(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    requests.push({ url, init });

    if (url === "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs") {
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "test"
      });
      return jsonResponse({
        total: 1,
        jobPostings: [
          {
            title: "Test Module Development Engineer",
            externalPath: "/job/US-Arizona-Phoenix/Test-Module-Development-Engineer_JR0281627",
            locationsText: "US, Arizona, Phoenix",
            remoteType: "Onsite",
            bulletFields: ["JR0281627"]
          }
        ]
      });
    }

    if (url === "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/job/US-Arizona-Phoenix/Test-Module-Development-Engineer_JR0281627") {
      return jsonResponse({
        jobPostingInfo: {
          id: "abc",
          title: "Test Module Development Engineer",
          jobDescription: "<p>Validate test modules.</p>",
          location: "Phoenix, AZ",
          timeType: "Full time",
          jobReqId: "JR0281627",
          externalUrl: "https://intel.wd1.myworkdayjobs.com/en-US/External/job/US-Arizona-Phoenix/Test-Module-Development-Engineer_JR0281627"
        },
        hiringOrganization: {
          name: "Intel"
        }
      });
    }

    return new Response("not found", { status: 404 });
  }, async () => {
    const listings = await new WorkdayProvider().fetchBoard({
      provider: "workday",
      source: "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs",
      includeDescription: true,
      searchText: "test",
      limit: 20,
      maxPages: 1
    });

    assert.equal(listings.length, 1);
    assert.equal(listings[0].provider, "workday");
    assert.equal(listings[0].company, "Intel");
    assert.equal(listings[0].externalId, "abc");
    assert.equal(listings[0].description, "<p>Validate test modules.</p>");
    assert.equal(requests.length, 2);
  });
});

test("SmartRecruiters provider paginates and normalizes detail apply URLs", async () => {
  let detailCalls = 0;
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);

    if (url === "https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings?limit=2&offset=0") {
      return jsonResponse({
        totalFound: 1,
        content: [
          {
            id: "744000127910040",
            name: "Senior Information Security Specialist",
            company: { identifier: "smartrecruiters", name: "SmartRecruiters Inc" },
            releasedDate: "2026-05-22T14:26:41.828Z",
            location: { fullLocation: "Poland, REMOTE, Poland", remote: true },
            department: { label: "Engineering" },
            typeOfEmployment: { label: "Full-time" },
            ref: "https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings/744000127910040"
          }
        ]
      });
    }

    if (url === "https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings/744000127910040") {
      detailCalls += 1;
      return jsonResponse({
        id: "744000127910040",
        name: "Senior Information Security Specialist",
        postingUrl: "https://jobs.smartrecruiters.com/SmartRecruiters/744000127910040",
        applyUrl: "https://jobs.smartrecruiters.com/SmartRecruiters/744000127910040/apply",
        jobAd: {
          sections: {
            jobDescription: { title: "Job Description", text: "<p>Secure systems.</p>" }
          }
        }
      });
    }

    return new Response("not found", { status: 404 });
  }, async () => {
    const listings = await new SmartRecruitersProvider().fetchBoard({
      provider: "smartrecruiters",
      source: "smartrecruiters",
      includeDescription: true,
      limit: 2,
      maxPages: 1
    });

    assert.equal(listings.length, 1);
    assert.equal(listings[0].applyUrl, "https://jobs.smartrecruiters.com/SmartRecruiters/744000127910040/apply");
    assert.equal(listings[0].department, "Engineering");
    assert.equal(listings[0].remote, true);
    assert.match(listings[0].description ?? "", /Secure systems/);
    assert.equal(detailCalls, 1);
  });
});

test("SmartRecruiters provider skips detail calls unless descriptions are requested", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);

    if (url === "https://api.smartrecruiters.com/v1/companies/smartrecruiters/postings?limit=1&offset=0") {
      return jsonResponse({
        totalFound: 1,
        content: [
          {
            id: "posting-1",
            name: "Platform Engineer",
            company: { name: "SmartRecruiters Inc" },
            location: { fullLocation: "Remote", remote: true }
          }
        ]
      });
    }

    if (url.includes("/postings/posting-1")) {
      throw new Error("detail endpoint should not be called");
    }

    return new Response("not found", { status: 404 });
  }, async () => {
    const listings = await new SmartRecruitersProvider().fetchBoard({
      provider: "smartrecruiters",
      source: "smartrecruiters",
      includeDescription: false,
      limit: 1,
      maxPages: 1
    });

    assert.equal(listings[0].listingUrl, "https://jobs.smartrecruiters.com/smartrecruiters/posting-1");
    assert.equal(listings[0].applyUrl, "https://jobs.smartrecruiters.com/smartrecruiters/posting-1/apply");
  });
});

test("Recruitee provider normalizes public offers feed", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://bunq.recruitee.com/api/offers/");

    return jsonResponse({
      offers: [
        {
          id: 101,
          title: "Offboarding Agent",
          company_name: "bunq",
          department: "Operations",
          location: "Sofia, Bulgaria",
          employment_type_code: "fulltime_fixed_term",
          remote: false,
          hybrid: true,
          careers_url: "https://careers.bunq.com/o/offboarding-agent-4",
          careers_apply_url: "https://careers.bunq.com/o/offboarding-agent-4/c/new",
          published_at: "2026-05-21 07:41:12 UTC",
          description: "<p>Handle closures.</p>",
          requirements: "<p>Be careful.</p>"
        }
      ]
    });
  }, async () => {
    const listings = await new RecruiteeProvider().fetchBoard({
      provider: "recruitee",
      source: "bunq",
      includeDescription: true
    });

    assert.equal(listings[0].provider, "recruitee");
    assert.equal(listings[0].workplaceType, "Hybrid");
    assert.equal(listings[0].applyUrl, "https://careers.bunq.com/o/offboarding-agent-4/c/new");
    assert.match(listings[0].description ?? "", /Be careful/);
  });
});

test("Personio provider parses the public XML feed without extra dependencies", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://personio.jobs.personio.de/xml?language=en");

    return new Response(`
      <?xml version="1.0" encoding="UTF-8"?>
      <workzag-jobs>
        <position>
          <id>1834171</id>
          <subcompany>Personio SE &amp; Co. KG</subcompany>
          <office>Munich</office>
          <additionalOffices><office><![CDATA[Berlin]]></office></additionalOffices>
          <department>Product and Tech</department>
          <name>Staff Software Engineer, Data Platform</name>
          <jobDescriptions>
            <jobDescription><name>The Role</name><value><![CDATA[<p>Build data platforms.</p>]]></value></jobDescription>
          </jobDescriptions>
          <employmentType>permanent</employmentType>
          <schedule>full-time</schedule>
          <createdAt>2024-11-13T14:10:41+00:00</createdAt>
        </position>
      </workzag-jobs>
    `, {
      status: 200,
      headers: { "Content-Type": "application/xml" }
    });
  }, async () => {
    const listings = await new PersonioProvider().fetchBoard({
      provider: "personio",
      source: "personio.jobs.personio.de",
      includeDescription: true
    });

    assert.equal(listings.length, 1);
    assert.equal(listings[0].company, "Personio SE & Co. KG");
    assert.equal(listings[0].location, "Munich; Berlin");
    assert.equal(listings[0].employmentType, "permanent / full-time");
    assert.match(listings[0].description ?? "", /Build data platforms/);
  });
});

test("BambooHR provider normalizes the public careers list", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://example.bamboohr.com/careers/list");

    return jsonResponse({
      meta: { totalCount: 1 },
      result: [
        {
          id: 12,
          jobOpeningName: "Platform Engineer",
          department: { label: "Engineering" },
          employmentStatus: { label: "Full-time" },
          location: { city: "Phoenix", state: "AZ", country: "United States" },
          jobOpeningUrl: "/careers/12",
          applicationUrl: "/careers/12/application",
          datePosted: "2026-05-20T00:00:00.000Z",
          description: "Build internal tools."
        }
      ]
    });
  }, async () => {
    const listings = await new BambooHrProvider().fetchBoard({
      provider: "bamboohr",
      source: "example",
      includeDescription: true
    });

    assert.equal(listings[0].provider, "bamboohr");
    assert.equal(listings[0].location, "Phoenix, AZ, United States");
    assert.equal(listings[0].applyUrl, "https://example.bamboohr.com/careers/12/application");
    assert.equal(listings[0].description, "Build internal tools.");
  });
});

test("iCIMS Jibe provider normalizes public /api/jobs JSON", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://careers.example.icims.com/api/jobs?limit=10");

    return jsonResponse({
      jobs: [
        {
          id: 1234,
          title: "Software Engineer",
          canonical_url: "https://careers.example.icims.com/jobs/1234/software-engineer/job",
          apply_url: "https://careers.example.icims.com/jobs/1234/software-engineer/apply",
          location: { city: "Phoenix", state: "AZ", country: "US" },
          department: "Engineering",
          employment_type: "Full-time",
          posted_at: "2026-05-20T12:00:00Z",
          description: "Build products."
        }
      ]
    });
  }, async () => {
    const listings = await new IcimsJibeProvider().fetchBoard({
      provider: "icims-jibe",
      source: "careers.example.icims.com",
      includeDescription: true,
      limit: 10
    });

    assert.equal(listings[0].provider, "icims-jibe");
    assert.equal(listings[0].location, "Phoenix, AZ, US");
    assert.equal(listings[0].applyUrl, "https://careers.example.icims.com/jobs/1234/software-engineer/apply");
    assert.equal(listings[0].description, "Build products.");
  });
});

test("iCIMS Classic provider parses search cards and JSON-LD detail", async () => {
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);

    if (url === "https://careers-example.icims.com/jobs/search?in_iframe=1&searchKeyword=software") {
      return new Response('<a href="/jobs/2931/applications-developer/job">Applications Developer</a>', {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }

    if (url === "https://careers-example.icims.com/jobs/2931/applications-developer/job") {
      return new Response(`
        <html><head><script type="application/ld+json">
          {"@type":"JobPosting","title":"Applications Developer","hiringOrganization":{"name":"Example Co"},"jobLocation":{"address":{"addressLocality":"Atlanta","addressRegion":"GA","addressCountry":"US"}},"employmentType":"FULL_TIME","datePosted":"2026-05-19","description":"Build business apps.","url":"https://careers-example.icims.com/jobs/2931/applications-developer/job"}
        </script></head></html>
      `, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response("not found", { status: 404 });
  }, async () => {
    const listings = await new IcimsClassicProvider().fetchBoard({
      provider: "icims-classic",
      source: "careers-example.icims.com",
      includeDescription: true,
      keyword: "software"
    });

    assert.equal(listings[0].provider, "icims-classic");
    assert.equal(listings[0].company, "Example Co");
    assert.equal(listings[0].location, "Atlanta, GA, US");
    assert.equal(listings[0].description, "Build business apps.");
  });
});

test("Oracle CE provider uses site discovery, search, and finder detail", async () => {
  const seenUrls: string[] = [];
  await withMockFetch(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    seenUrls.push(url);

    if (url.startsWith("https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCESites")) {
      return jsonResponse({ items: [{ SiteNumber: "42", SiteURLName: "jobsearch" }] });
    }

    if (url.startsWith("https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions")) {
      return jsonResponse({
        items: [
          {
            requisitionList: [
              {
                Id: "1001",
                Title: "Software Engineer",
                Department: "Engineering",
                WorkLocation: "Austin, TX",
                JobSchedule: "Full time"
              }
            ]
          }
        ]
      });
    }

    if (url.startsWith("https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails")) {
      assert.match(url, /finder=ById%3BId%3D%221001%22%2CsiteNumber%3D42/);
      return jsonResponse({
        items: [
          {
            Id: "1001",
            ExternalDescriptionStr: "<p>Build cloud services.</p>",
            ExternalQualificationsStr: "<p>TypeScript.</p>"
          }
        ]
      });
    }

    return new Response("not found", { status: 404 });
  }, async () => {
    const listings = await new OracleCeProvider().fetchBoard({
      provider: "oracle-ce",
      source: "eeho.fa.us2.oraclecloud.com/jobsearch",
      includeDescription: true,
      keyword: "software",
      limit: 10
    });

    assert.equal(listings[0].provider, "oracle-ce");
    assert.equal(listings[0].listingUrl, "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch/job/1001");
    assert.match(listings[0].description ?? "", /Build cloud services/);
    assert.equal(seenUrls.length, 3);
  });
});

test("Taleo provider posts to jobboard search and builds stable detail URL", async () => {
  await withMockFetch(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://unifirst.taleo.net/careersection/rest/jobboard/searchjobs?lang=en&portal=unf_external");
    assert.equal(init?.method, "POST");

    return jsonResponse({
      requisitionList: [
        {
          contestNo: "12345",
          title: "Route Trainee",
          location: "Phoenix, AZ",
          organization: "Operations",
          jobSchedule: "Full-time",
          postedDate: "2026-05-18",
          description: "Service customers."
        }
      ]
    });
  }, async () => {
    const listings = await new TaleoProvider().fetchBoard({
      provider: "taleo",
      source: "unifirst.taleo.net/unf_external",
      includeDescription: true,
      keyword: "route",
      lang: "en"
    });

    assert.equal(listings[0].provider, "taleo");
    assert.equal(listings[0].listingUrl, "https://unifirst.taleo.net/careersection/unf_external/jobdetail.ftl?lang=en&job=12345");
    assert.equal(listings[0].description, "Service customers.");
  });
});

test("Workday source parser accepts CXS endpoints and careers URLs", () => {
  assert.deepEqual(parseWorkdaySource("https://avav.wd1.myworkdayjobs.com/wday/cxs/avav/AVAV/jobs"), {
    host: "avav.wd1.myworkdayjobs.com",
    tenant: "avav",
    board: "AVAV"
  });
  assert.deepEqual(parseWorkdaySource("https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin/job/Test_R1"), {
    host: "blueorigin.wd5.myworkdayjobs.com",
    tenant: "blueorigin",
    board: "BlueOrigin",
    locale: "en-US"
  });
  assert.deepEqual(parseWorkdaySource("https://intel.wd1.myworkdayjobs.com/intel/External"), {
    host: "intel.wd1.myworkdayjobs.com",
    tenant: "intel",
    board: "External"
  });
});

async function withMockFetch(
  mockFetch: typeof fetch,
  callback: () => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
