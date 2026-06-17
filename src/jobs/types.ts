export interface JobListing {
  provider: ProviderId;
  providerKind: ProviderKind;
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  remote: boolean | null;
  listingUrl: string;
  applyUrl: string | null;
  postedAt: string | null;
  compensation: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
}

export type ProviderKind = "aggregator" | "company-board";
export type ProviderId =
  | "adzuna"
  | "jooble"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "workday"
  | "smartrecruiters"
  | "recruitee"
  | "personio"
  | "bamboohr"
  | "icims-jibe"
  | "icims-classic"
  | "oracle-ce"
  | "taleo";

export type ListingSearchRequest = {
  provider: "adzuna" | "jooble";
  query: string;
  location?: string;
  page?: number;
  limit?: number;
};

export type CompanyBoardDisplayName = {
  companyName?: string;
};

export type CompanyBoardRequest = CompanyBoardDisplayName &
  (
  | {
      provider: "greenhouse";
      source: string;
      includeDescription?: boolean;
    }
  | {
      provider: "lever";
      source: string;
      includeDescription?: boolean;
      location?: string;
      team?: string;
      limit?: number;
    }
  | {
      provider: "ashby";
      source: string;
      includeDescription?: boolean;
    }
  | {
      provider: "workable";
      source: string;
      includeDescription?: boolean;
    }
  | {
      provider: "workday";
      source: string;
      includeDescription?: boolean;
      searchText?: string;
      limit?: number;
      maxPages?: number;
    }
  | {
      provider: "smartrecruiters";
      source: string;
      includeDescription?: boolean;
      limit?: number;
      maxPages?: number;
    }
  | {
      provider: "recruitee";
      source: string;
      includeDescription?: boolean;
    }
  | {
      provider: "personio";
      source: string;
      includeDescription?: boolean;
      language?: string;
    }
  | {
      provider: "bamboohr";
      source: string;
      includeDescription?: boolean;
    }
  | {
      provider: "icims-jibe";
      source: string;
      includeDescription?: boolean;
      limit?: number;
    }
  | {
      provider: "icims-classic";
      source: string;
      includeDescription?: boolean;
      keyword?: string;
    }
  | {
      provider: "oracle-ce";
      source: string;
      includeDescription?: boolean;
      keyword?: string;
      limit?: number;
    }
  | {
      provider: "taleo";
      source: string;
      includeDescription?: boolean;
      keyword?: string;
      lang?: string;
    }
  );

export interface SearchProvider {
  readonly id: "adzuna" | "jooble";
  readonly kind: "aggregator";
  search(request: ListingSearchRequest): Promise<JobListing[]>;
}

export interface CompanyBoardProvider {
  readonly id:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "workable"
    | "workday"
    | "smartrecruiters"
    | "recruitee"
    | "personio"
    | "bamboohr"
    | "icims-jibe"
    | "icims-classic"
    | "oracle-ce"
    | "taleo";
  readonly kind: "company-board";
  fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]>;
}
