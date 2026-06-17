import type { CompanyBoardProvider, SearchProvider } from "../types.js";
import { AdzunaProvider } from "./adzuna.js";
import { AshbyProvider } from "./ashby.js";
import { BambooHrProvider } from "./bamboohr.js";
import { GreenhouseProvider } from "./greenhouse.js";
import { IcimsClassicProvider } from "./icims-classic.js";
import { IcimsJibeProvider } from "./icims-jibe.js";
import { JoobleProvider } from "./jooble.js";
import { LeverProvider } from "./lever.js";
import { OracleCeProvider } from "./oracle-ce.js";
import { PersonioProvider } from "./personio.js";
import { RecruiteeProvider } from "./recruitee.js";
import { SmartRecruitersProvider } from "./smartrecruiters.js";
import { TaleoProvider } from "./taleo.js";
import { WorkdayProvider } from "./workday.js";
import { WorkableProvider } from "./workable.js";

export function createSearchProviders(): SearchProvider[] {
  return [new AdzunaProvider(), new JoobleProvider()];
}

export function createBoardProviders(): CompanyBoardProvider[] {
  return [
    new GreenhouseProvider(),
    new LeverProvider(),
    new AshbyProvider(),
    new WorkableProvider(),
    new WorkdayProvider(),
    new SmartRecruitersProvider(),
    new RecruiteeProvider(),
    new PersonioProvider(),
    new BambooHrProvider(),
    new IcimsJibeProvider(),
    new IcimsClassicProvider(),
    new OracleCeProvider(),
    new TaleoProvider()
  ];
}
