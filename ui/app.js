const steps = [
  {
    id: "quick-setup",
    title: "Quick Setup",
    subtitle: "Answer a few plain-language questions",
    description:
      "Tell the workbench what kind of jobs you want, whether you prefer remote work, and which companies to track. It will build a recommended setup for you."
  },
  {
    id: "search-apis",
    title: "Search APIs",
    subtitle: "Add broad multi-company search feeds",
    description:
      "Use Adzuna and Jooble when you want wide coverage across many companies. These are best for discovery."
  },
  {
    id: "company-boards",
    title: "Company Boards",
    subtitle: "Add direct company-hosted listings",
    description:
      "Use direct ATS feeds when you want the canonical job pages from specific companies."
  },
  {
    id: "filters",
    title: "Filters",
    subtitle: "Decide what gets kept or removed",
    description:
      "Tell the system what you do and do not want before ranking so the results stay focused."
  },
  {
    id: "ranking",
    title: "Ranking",
    subtitle: "Teach the system what good looks like",
    description:
      "Adjust how much remote work, freshness, compensation, and specific keywords should influence the final score."
  },
  {
    id: "alerts",
    title: "Alerts & Schedule",
    subtitle: "Choose how and when to hear about matches",
    description:
      "Create alert rules, decide whether to use browser notifications or webhooks, and optionally run searches on an interval."
  },
  {
    id: "review",
    title: "Review & Run",
    subtitle: "Check the full setup before launching",
    description:
      "Review the entire configuration, confirm missing pieces, and run the search when everything looks right."
  }
];

const BOARD_PROVIDERS = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "workday",
  "smartrecruiters",
  "recruitee",
  "personio",
  "bamboohr",
  "icims-jibe",
  "icims-classic",
  "oracle-ce",
  "taleo"
];
const KNOWN_PROVIDERS = ["adzuna", "jooble", ...BOARD_PROVIDERS];
const KNOWN_PROVIDER_SET = new Set(KNOWN_PROVIDERS);
const KNOWN_PROVIDER_HINT =
  "Allowed providers: Adzuna, Jooble, Greenhouse, Lever, Ashby, Workable, Workday, SmartRecruiters, Recruitee, Personio, BambooHR, iCIMS Jibe, iCIMS Classic, Oracle CE, Taleo. Unknown entries are ignored on save.";
const LISTING_PAGE_SIZE = 40;
const SOURCE_FILTER_TOP_LIMIT = 25;
const VIEWS = ["dashboard", "tracker", "settings"];
const VIEW_SET = new Set(VIEWS);
const VIEW_PATHS = {
  dashboard: "/dashboard",
  tracker: "/tracker",
  settings: "/settings"
};
const TRACKER_SYNC_CHANNEL = "jobWorkbenchTrackerSync";
const TRACKER_SYNC_STORAGE_KEY = "jobWorkbenchTrackerSync";
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const state = {
  config: null,
  results: null,
  statusMessage: null,
  listingFilters: {
    query: "",
    sort: "score",
    newOnly: false,
    source: "all"
  },
  listingVisibleLimit: LISTING_PAGE_SIZE,
  listingVisibleContext: {
    resultsAt: "",
    filterFingerprint: ""
  },
  careersImport: {
    input: "",
    preview: null,
    busy: false
  },
  tracker: [],
  trackerFilters: {
    query: "",
    status: "all"
  },
  pendingListingVisits: new Set(),
  pendingTrackerRemoveId: null,
  pendingTrackerMutations: new Set(),
  pendingSettingsRemove: null,
  resumeSource: "",
  status: null,
  quickSetup: null,
  currentStep: 0,
  lastSeenRunAt: null,
  activeView: "dashboard",
  deferredTrackerSync: false
};

let trackerSyncChannel = null;

const elements = {
  saveButton: document.querySelector("#saveButton"),
  runButton: document.querySelector("#runButton"),
  backButton: document.querySelector("#backButton"),
  nextButton: document.querySelector("#nextButton"),
  notifyPermissionButton: document.querySelector("#notifyPermissionButton"),
  stepRail: document.querySelector("#stepRail"),
  readinessCard: document.querySelector("#readinessCard"),
  stepEyebrow: document.querySelector("#stepEyebrow"),
  stepTitle: document.querySelector("#stepTitle"),
  stepDescription: document.querySelector("#stepDescription"),
  stepContent: document.querySelector("#stepContent"),
  stepProgressLabel: document.querySelector("#stepProgressLabel"),
  resultsList: document.querySelector("#resultsList"),
  alertMatches: document.querySelector("#alertMatches"),
  resultsGrid: document.querySelector("#dashboardResultsGrid"),
  trackerList: document.querySelector("#trackerList"),
  lastRunMetric: document.querySelector("#lastRunMetric"),
  nextRunMetric: document.querySelector("#nextRunMetric"),
  listingCountMetric: document.querySelector("#listingCountMetric"),
  alertCountMetric: document.querySelector("#alertCountMetric"),
  appStatus: document.querySelector("#appStatus"),
  viewTabs: document.querySelector("#viewTabs"),
  dashboardView: document.querySelector("#dashboardView"),
  trackerView: document.querySelector("#trackerView"),
  settingsView: document.querySelector("#settingsView")
};

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING WIZARD CONTROLLER
   ═══════════════════════════════════════════════════════════════ */

const ONBOARDING_TOTAL_STEPS = 6;
const ONBOARDING_STORAGE_KEY = "jobWorkbenchOnboardingDone";
const RESUME_SOURCE_STORAGE_KEY = "jobWorkbenchResumeSource";
const RESUME_TEXT_MAX_LENGTH = 50_000;

const onboarding = {
  overlay: document.querySelector("#onboardingOverlay"),
  progressFill: document.querySelector("#onboardingProgressFill"),
  dotsContainer: document.querySelector("#onboardingDots"),
  btnNext: document.querySelector("#obNext"),
  btnBack: document.querySelector("#obBack"),
  btnSkip: document.querySelector("#obSkip"),
  status: document.querySelector("#obStatus"),
  credentialsStatus: document.querySelector("#obCredentialsStatus"),
  summary: document.querySelector("#obSummary"),
  currentStep: 0,
  transitioning: false,
  previousFocus: null
};

function shouldShowOnboarding() {
  try {
    return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return true;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch { }
}

function showOnboarding() {
  if (!state.config) {
    showStatusMessage("Setup wizard unavailable until configuration loads. Check the workbench server and refresh.", "error");
    return;
  }

  onboarding.currentStep = 0;
  onboarding.transitioning = false;
  onboarding.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  clearOnboardingStatus();
  renderOnboardingStep(0, null);
  setMainAppModalState(true);
  onboarding.overlay.hidden = false;
  onboarding.overlay.removeAttribute("inert");
  onboarding.overlay.inert = false;
  onboarding.overlay.setAttribute("aria-hidden", "false");
  onboarding.overlay.classList.add("visible");
  document.body.style.overflow = "hidden";
  setTimeout(() => onboarding.btnNext.focus(), 0);
}

function hideOnboarding() {
  onboarding.overlay.classList.add("closing");
  document.body.style.overflow = "";
  const focusTarget = onboarding.previousFocus;
  markOnboardingDone();
  onboarding.previousFocus = null;
  clearOnboardingStatus();

  return new Promise((resolve) => {
    setTimeout(() => {
      onboarding.overlay.classList.remove("visible", "closing");
      onboarding.overlay.setAttribute("aria-hidden", "true");
      onboarding.overlay.setAttribute("inert", "");
      onboarding.overlay.inert = true;
      onboarding.overlay.hidden = true;
      setMainAppModalState(false);
      focusTarget?.focus?.();
      resolve();
    }, 500);
  });
}

function setMainAppModalState(isModalOpen) {
  const mainApp = document.querySelector("#mainApp");
  if (!mainApp) {
    return;
  }

  if (isModalOpen) {
    mainApp.setAttribute("aria-hidden", "true");
    mainApp.setAttribute("inert", "");
    mainApp.inert = true;
    return;
  }

  mainApp.removeAttribute("aria-hidden");
  mainApp.removeAttribute("inert");
  mainApp.inert = false;
}

function renderOnboardingStep(nextIndex, prevIndex) {
  const allSteps = onboarding.overlay.querySelectorAll(".onboarding-step");
  const nextTitle = onboarding.overlay.querySelector(`#onboardingTitle${nextIndex}`);
  if (nextTitle?.id) {
    onboarding.overlay.setAttribute("aria-labelledby", nextTitle.id);
  }

  // Animate out old step
  if (prevIndex !== null && prevIndex !== nextIndex) {
    const oldStep = allSteps[prevIndex];
    if (oldStep) {
      const direction = nextIndex > prevIndex ? "slide-out-left" : "slide-out-right";
      oldStep.classList.add(direction);
      setTimeout(() => {
        oldStep.classList.remove("active", direction);
      }, 300);
    }
  }

  // Animate in new step
  setTimeout(() => {
    allSteps.forEach((s) => s.classList.remove("active"));
    if (allSteps[nextIndex]) {
      allSteps[nextIndex].classList.add("active");
    }
  }, prevIndex !== null && prevIndex !== nextIndex ? 300 : 0);

  // Progress bar
  const progress = (nextIndex / (ONBOARDING_TOTAL_STEPS - 1)) * 100;
  onboarding.progressFill.style.width = `${progress}%`;

  // Dots
  onboarding.dotsContainer.innerHTML = Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => {
    const cls = i === nextIndex ? "active" : i < nextIndex ? "completed" : "";
    const current = i === nextIndex ? ' aria-current="step"' : "";
    return `<button class="onboarding-dot ${cls}" data-ob-dot="${i}" aria-label="Step ${i + 1}"${current}></button>`;
  }).join("");

  // Back button visibility
  onboarding.btnBack.style.visibility = nextIndex === 0 ? "hidden" : "visible";

  // Next button text & style
  setOnboardingNextBusy(false);
  if (nextIndex === 0) {
    onboarding.btnNext.innerHTML = 'Get Started <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    onboarding.btnNext.className = "onboarding-btn onboarding-btn-primary";
  } else if (nextIndex === ONBOARDING_TOTAL_STEPS - 1) {
    onboarding.btnNext.textContent = "Launch Workbench";
    onboarding.btnNext.className = "onboarding-btn onboarding-btn-success";
  } else {
    onboarding.btnNext.innerHTML = 'Continue <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    onboarding.btnNext.className = "onboarding-btn onboarding-btn-primary";
  }

  // Populate dynamic content for specific steps
  if (nextIndex === 4) {
    renderOnboardingCredentials();
  }

  if (nextIndex === ONBOARDING_TOTAL_STEPS - 1) {
    applyOnboardingToQuickSetup();
    renderOnboardingSummary();
  }

  onboarding.currentStep = nextIndex;
  onboarding.transitioning = false;
}

function renderOnboardingCredentials() {
  const readiness = state.status?.providerReadiness ?? {};

  const items = [
    {
      name: "Adzuna",
      desc: "Broad job search aggregator",
      configured: readiness.adzuna?.configured,
      needs: "ADZUNA_APP_ID + ADZUNA_APP_KEY"
    },
    {
      name: "Jooble",
      desc: "Multi-market job search API",
      configured: readiness.jooble?.configured,
      needs: "JOOBLE_API_KEY"
    },
    {
      name: "Greenhouse",
      desc: "Company board — no key needed",
      configured: true,
      needs: "Board token from URL"
    },
    {
      name: "Lever",
      desc: "Company board — no key needed",
      configured: true,
      needs: "Site slug from URL"
    }
  ];

  onboarding.credentialsStatus.innerHTML = items.map(item => `
    <div class="onboarding-cred-item">
      <div class="onboarding-cred-icon ${item.configured ? "ready" : "missing"}" aria-hidden="true">
        ${item.configured ? "OK" : "Set"}
      </div>
      <div class="onboarding-cred-info">
        <strong>${item.name}</strong>
        <span>${item.desc}</span>
      </div>
      <span class="onboarding-cred-status ${item.configured ? "ready" : "missing"}">
        ${item.configured ? "Ready" : "Needs setup"}
      </span>
    </div>
  `).join("");
}

function applyOnboardingToQuickSetup() {
  const obRoles = document.querySelector("#obTargetRoles")?.value.trim() ?? "";
  const obSkills = document.querySelector("#obSkills")?.value.trim() ?? "";
  const obLocations = document.querySelector("#obLocations")?.value.trim() ?? "";
  const obSearchStyle = document.querySelector("#obSearchStyle")?.value ?? "balanced";
  const obRemoteOnly = document.querySelector("#obRemoteOnly")?.checked ?? false;
  const obEnableAlerts = document.querySelector("#obEnableAlerts")?.checked ?? true;
  const obInterval = document.querySelector("#obInterval")?.value ?? "manual";
  const obCompanyInput = document.querySelector("#obCompanyInput")?.value.trim() ?? "";

  // Write into quickSetup state
  state.quickSetup = {
    targetRoles: obRoles,
    skillKeywords: obSkills,
    locations: obLocations,
    searchStyle: obSearchStyle,
    remoteOnly: obRemoteOnly,
    enableAlerts: obEnableAlerts,
    interval: obInterval,
    companyInput: obCompanyInput
  };

  saveQuickSetup(state.quickSetup);

  // Apply the quick setup to the config
  applyQuickSetup();
}

function renderOnboardingSummary() {
  const searches = state.config.searches.length;
  const boards = state.config.boards.length;
  const alerts = state.config.alerts.length;
  const filters = state.config.filters;
  const keywords = filters.includeKeywords.length + filters.excludeKeywords.length;

  onboarding.summary.innerHTML = `
    <div class="onboarding-summary-item">
      <span class="ob-sum-value">${searches}</span>
      <span class="ob-sum-label">Search API source${searches === 1 ? "" : "s"}</span>
    </div>
    <div class="onboarding-summary-item">
      <span class="ob-sum-value">${boards}</span>
      <span class="ob-sum-label">Company board${boards === 1 ? "" : "s"}</span>
    </div>
    <div class="onboarding-summary-item">
      <span class="ob-sum-value">${keywords}</span>
      <span class="ob-sum-label">Filter keyword${keywords === 1 ? "" : "s"}</span>
    </div>
    <div class="onboarding-summary-item">
      <span class="ob-sum-value">${alerts}</span>
      <span class="ob-sum-label">Alert rule${alerts === 1 ? "" : "s"}</span>
    </div>
  `;
}

function showOnboardingStatus(message, tone = "info") {
  onboarding.status.textContent = message;
  onboarding.status.hidden = false;
  onboarding.status.className = `onboarding-status ${tone}`;
  onboarding.status.setAttribute("role", tone === "error" ? "alert" : "status");
  onboarding.status.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
}

function clearOnboardingStatus() {
  onboarding.status.textContent = "";
  onboarding.status.hidden = true;
  onboarding.status.className = "onboarding-status";
  onboarding.status.removeAttribute("role");
  onboarding.status.removeAttribute("aria-live");
}

function setOnboardingNextBusy(running) {
  onboarding.btnNext.disabled = running;
  onboarding.btnNext.setAttribute("aria-busy", String(running));
  if (running) {
    onboarding.btnNext.textContent = "Saving Setup";
    onboarding.btnNext.className = "onboarding-btn onboarding-btn-success";
  } else if (onboarding.currentStep === ONBOARDING_TOTAL_STEPS - 1) {
    onboarding.btnNext.textContent = "Launch Workbench";
    onboarding.btnNext.className = "onboarding-btn onboarding-btn-success";
  }
}

function bindOnboarding() {
  onboarding.btnNext.addEventListener("click", () => {
    if (onboarding.transitioning) return;

    if (onboarding.currentStep === ONBOARDING_TOTAL_STEPS - 1) {
      onboarding.transitioning = true;
      clearOnboardingStatus();
      setOnboardingNextBusy(true);
      saveConfig()
        .then(async (saved) => {
          if (!saved) {
            showOnboardingStatus("Setup cannot launch until configuration loads.", "error");
            return;
          }

          await hideOnboarding();
          renderAll();
        })
        .catch((error) => {
          showOnboardingStatus(`Setup could not be saved: ${formatErrorMessage(error)}`, "error");
        })
        .finally(() => {
          setOnboardingNextBusy(false);
          onboarding.transitioning = false;
        });
      return;
    }

    onboarding.transitioning = true;
    clearOnboardingStatus();
    const prev = onboarding.currentStep;
    renderOnboardingStep(prev + 1, prev);
  });

  onboarding.btnBack.addEventListener("click", () => {
    if (onboarding.transitioning) return;
    if (onboarding.currentStep === 0) return;

    onboarding.transitioning = true;
    clearOnboardingStatus();
    const prev = onboarding.currentStep;
    renderOnboardingStep(prev - 1, prev);
  });

  onboarding.btnSkip.addEventListener("click", () => {
    if (onboarding.transitioning) return;
    hideOnboarding();
  });

  onboarding.dotsContainer.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-ob-dot]");
    if (!dot || onboarding.transitioning) return;
    const target = Number(dot.getAttribute("data-ob-dot"));
    if (target === onboarding.currentStep) return;

    onboarding.transitioning = true;
    clearOnboardingStatus();
    const prev = onboarding.currentStep;
    renderOnboardingStep(target, prev);
  });

  onboarding.overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (onboarding.transitioning) {
        event.preventDefault();
        return;
      }
      hideOnboarding();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = [...onboarding.overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.disabled && element.offsetParent !== null);

    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Reopen button in main UI
  const reopenBtn = document.querySelector("#reopenOnboarding");
  if (reopenBtn) {
    reopenBtn.addEventListener("click", () => {
      showOnboarding();
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT + BINDING (original, updated with onboarding integration)
   ═══════════════════════════════════════════════════════════════ */

async function init() {
  bindActions();
  bindOnboarding();
  bindTrackerSync();
  await refreshAll();
  switchView(readViewFromLocation(), { updateRoute: false });
  renderAll();
  renderNotificationPermissionButton();
  window.setInterval(pollStatus, 30000);

  // Show onboarding on first visit
  if (shouldShowOnboarding()) {
    showOnboarding();
  }
}

function bindActions() {
  elements.saveButton.addEventListener("click", () => saveConfig().catch(() => { }));
  elements.runButton.addEventListener("click", runSearch);
  elements.backButton.addEventListener("click", () => moveStep(-1));
  elements.nextButton.addEventListener("click", () => moveStep(1));
  elements.notifyPermissionButton.addEventListener("click", requestNotificationPermission);

  elements.stepRail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-step-index]");
    if (!button) {
      return;
    }

    setCurrentStep(Number(button.getAttribute("data-step-index")));
  });

  elements.stepContent.addEventListener("click", handleStepClick);
  elements.stepContent.addEventListener("change", handleStepChange);
  elements.resultsList.addEventListener("click", handleListingNavigation);
  elements.resultsList.addEventListener("change", handleListingFilterChange);
  elements.resultsList.addEventListener("input", handleListingFilterInput);
  elements.trackerList.addEventListener("click", handleTrackerClick);
  elements.trackerList.addEventListener("change", handleTrackerChange);
  elements.trackerList.addEventListener("input", handleTrackerInput);
  elements.appStatus.addEventListener("click", (event) => {
    if (event.target.closest("[data-dismiss-status]")) {
      clearStatusMessage();
    }
  });

  // Tab switching
  elements.viewTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-view]");
    if (!tab) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
      return;
    }
    event.preventDefault();
    const view = tab.getAttribute("data-view");
    switchView(view);
  });

  elements.viewTabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    const tabs = [...elements.viewTabs.querySelectorAll("[role='tab']")];
    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement));
    const lastIndex = tabs.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];

    event.preventDefault();
    nextTab.focus();
    switchView(nextTab.getAttribute("data-view"));
  });

  window.addEventListener("popstate", () => {
    switchView(readViewFromLocation(), { updateRoute: false });
  });

  window.addEventListener("focus", () => {
    refreshTrackerFromServer("focus").catch((error) => {
      showTrackerError("Tracker refresh failed", error);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    refreshTrackerFromServer("visibility").catch((error) => {
      showTrackerError("Tracker refresh failed", error);
    });
  });

  elements.trackerList.addEventListener("focusout", () => {
    window.setTimeout(flushDeferredTrackerSync, 0);
  });
}

function switchView(view, options = {}) {
  const nextView = VIEW_SET.has(view) ? view : "dashboard";
  const views = {
    dashboard: elements.dashboardView,
    tracker: elements.trackerView,
    settings: elements.settingsView
  };

  elements.viewTabs.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab.getAttribute("data-view") === nextView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  Object.entries(views).forEach(([viewName, element]) => {
    const active = viewName === nextView;
    element.classList.toggle("active", active);
    element.hidden = !active;
  });

  state.activeView = nextView;
  if (options.updateRoute !== false) {
    updateViewRoute(nextView);
  }
}
window.switchView = switchView;

function focusViewTab(view) {
  const tab = elements.viewTabs.querySelector(`[data-view="${cssEscape(view)}"]`);
  tab?.focus();
}

function readViewFromLocation() {
  const pathView = window.location.pathname.replace(/^\/+/, "").split("/")[0];
  if (VIEW_SET.has(pathView)) {
    return pathView;
  }

  const hashView = window.location.hash.replace(/^#\/?/, "");
  return VIEW_SET.has(hashView) ? hashView : "dashboard";
}

function updateViewRoute(view) {
  const path = VIEW_PATHS[view] ?? VIEW_PATHS.dashboard;
  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({ view }, "", path);
}

function bindTrackerSync() {
  if ("BroadcastChannel" in window) {
    trackerSyncChannel = new BroadcastChannel(TRACKER_SYNC_CHANNEL);
    trackerSyncChannel.addEventListener("message", (event) => {
      handleTrackerSync(event.data);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== TRACKER_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handleTrackerSync(JSON.parse(event.newValue));
    } catch { }
  });
}

function broadcastTrackerSync(reason) {
  const message = {
    source: TAB_ID,
    reason,
    at: Date.now()
  };

  trackerSyncChannel?.postMessage(message);

  try {
    localStorage.setItem(TRACKER_SYNC_STORAGE_KEY, JSON.stringify(message));
  } catch { }
}

function handleTrackerSync(message) {
  if (!message || message.source === TAB_ID) {
    return;
  }

  refreshTrackerFromServer(message.reason ?? "sync").catch((error) => {
    showTrackerError("Tracker sync failed", error);
  });
}

async function refreshTrackerFromServer(reason = "refresh") {
  if (hasLocalTrackerWorkInProgress()) {
    state.deferredTrackerSync = true;
    return;
  }

  state.tracker = await fetchJson("/api/tracker");
  state.deferredTrackerSync = false;
  renderTracker();
  renderResults();
}

function hasLocalTrackerWorkInProgress() {
  return Boolean(
    state.pendingTrackerMutations.size ||
    resumeSaveInFlight.size ||
    resumeSavePending.size ||
    resumeSaveTimers.size ||
    document.activeElement?.closest?.(
      "[data-resume-source], [data-tracker-resume-notes], [data-tracker-resume-draft], [data-tracker-job-description]"
    )
  );
}

function flushDeferredTrackerSync() {
  if (!state.deferredTrackerSync || hasLocalTrackerWorkInProgress()) {
    return;
  }

  refreshTrackerFromServer("deferred").catch((error) => {
    showTrackerError("Tracker sync failed", error);
  });
}

async function refreshAll() {
  const [configResponse, resultsResponse, statusResponse, trackerResponse] = await Promise.all([
    fetchJson("/api/config"),
    fetchJson("/api/results"),
    fetchJson("/api/status"),
    fetchJson("/api/tracker")
  ]);

  state.config = configResponse;
  state.results = resultsResponse;
  state.status = statusResponse;
  state.tracker = trackerResponse ?? [];
  state.resumeSource = loadResumeSource();
  state.quickSetup = loadQuickSetup(configResponse);
  state.lastSeenRunAt = resultsResponse?.generatedAt ?? null;
}

async function pollStatus() {
  let resultsResponse;
  let statusResponse;

  try {
    [resultsResponse, statusResponse] = await Promise.all([
      fetchJson("/api/results"),
      fetchJson("/api/status")
    ]);
  } catch (error) {
    showStatusMessage(`Refresh failed: ${formatErrorMessage(error)}`, "error");
    return;
  }

  state.status = statusResponse;

  if (resultsResponse?.generatedAt && resultsResponse.generatedAt !== state.lastSeenRunAt) {
    state.results = resultsResponse;
    state.lastSeenRunAt = resultsResponse.generatedAt;
    renderAll();
    notifyBrowserAlerts(resultsResponse.alerts ?? []);
    return;
  }

  if (statusResponse?.runtime?.running) {
    setRunButtonBusy(true, "running");
  } else if (elements.runButton.getAttribute("aria-busy") === "true") {
    setRunButtonBusy(false);
  }

  renderStatus();
  renderReadinessCard();
}
window.pollStatus = pollStatus;

function renderAll() {
  renderStatus();
  renderStepRail();
  renderReadinessCard();
  renderCurrentStep();
  renderResults();
  renderTracker();
}

function renderStatus() {
  const runtime = state.status?.runtime;
  elements.lastRunMetric.textContent = runtime?.running
    ? "In progress…"
    : formatDateTime(runtime?.lastRunAt);
  elements.nextRunMetric.textContent = runtime?.running
    ? "Waiting for current run"
    : runtime?.nextRunAt
      ? formatDateTime(runtime.nextRunAt)
      : "Disabled";
  elements.listingCountMetric.textContent = String(state.results?.summary?.uniqueListings ?? 0);
  elements.alertCountMetric.textContent = String(state.results?.summary?.alertMatches ?? 0);

  if (elements.runButton.getAttribute("aria-busy") === "true" && runtime?.running) {
    setRunButtonBusy(true, runtime?.running ? "running" : "saving");
  }
}

function renderStepRail() {
  const completion = getStepCompletion();

  elements.stepRail.innerHTML = steps
    .map((step, index) => {
      const stateClass = index === state.currentStep ? "active" : completion[index] ? "complete" : "";
      const current = index === state.currentStep ? ' aria-current="step"' : "";
      return `
        <button class="step-chip ${stateClass}" data-step-index="${index}"${current}>
          <span class="step-chip-number">${index + 1}</span>
          <span class="step-chip-title">${step.title}</span>
          <span class="step-chip-subtitle">${step.subtitle}</span>
        </button>
      `;
    })
    .join("");
}

function renderReadinessCard() {
  const readiness = state.status?.providerReadiness ?? {};
  const sourceCount = state.config.searches.length + state.config.boards.length;
  const alertCount = state.config.alerts.length;
  const configuredSearchApis = ["adzuna", "jooble"].filter(
    (provider) => readiness[provider]?.configured
  ).length;

  elements.readinessCard.innerHTML = `
    <div>
      <h3>Setup snapshot</h3>
      <p class="panel-muted">
        This is the fastest way to tell whether you are ready to run or still missing inputs.
      </p>
    </div>
    <div class="readiness-row">
      <span class="state-pill ok">${sourceCount} source${sourceCount === 1 ? "" : "s"}</span>
      <span class="state-pill ${alertCount > 0 ? "ok" : "warn"}">${alertCount} alert${alertCount === 1 ? "" : "s"}</span>
      <span class="state-pill ${configuredSearchApis > 0 ? "ok" : "warn"}">${configuredSearchApis} search API credential set${configuredSearchApis === 1 ? "" : "s"}</span>
    </div>
    <div class="section-stack">
      ${renderProviderReadinessItem("Adzuna", readiness.adzuna, "Broad search API. Requires env vars.")} 
      ${renderProviderReadinessItem("Jooble", readiness.jooble, "Broad search API. Requires env vars.")}
      ${renderProviderReadinessItem("Greenhouse", readiness.greenhouse, "Use the board token from the Greenhouse URL.")}
      ${renderProviderReadinessItem("Lever", readiness.lever, "Use the Lever site slug.")}
      ${renderProviderReadinessItem("Ashby", readiness.ashby, "Use the job board name shown in the Ashby URL.")}
      ${renderProviderReadinessItem("Workable", readiness.workable, "Use the company subdomain on Workable.")}
      ${renderProviderReadinessItem("Workday", readiness.workday, "Use a myworkdayjobs URL or host/tenant/board source.")}
      ${renderProviderReadinessItem("SmartRecruiters", readiness.smartrecruiters, "Use the company identifier from careers.smartrecruiters.com.")}
      ${renderProviderReadinessItem("Recruitee", readiness.recruitee, "Use the company subdomain on Recruitee.")}
      ${renderProviderReadinessItem("Personio", readiness.personio, "Use the Personio jobs host or account slug.")}
      ${renderProviderReadinessItem("BambooHR", readiness.bamboohr, "Use the BambooHR company subdomain.")}
      ${renderProviderReadinessItem("iCIMS Jibe", readiness["icims-jibe"], "Use the modern iCIMS/Jibe careers host.")}
      ${renderProviderReadinessItem("iCIMS Classic", readiness["icims-classic"], "Use the classic iCIMS careers host.")}
      ${renderProviderReadinessItem("Oracle CE", readiness["oracle-ce"], "Use the Oracle Candidate Experience host/site.")}
      ${renderProviderReadinessItem("Taleo", readiness.taleo, "Use the Taleo host and career section.")}
    </div>
  `;
}

function renderProviderReadinessItem(label, providerState, description) {
  if (!providerState) {
    return "";
  }

  const needsLine = providerState.needs?.length
    ? `<span class="panel-muted">Need: ${providerState.needs.join(", ")}</span>`
    : "";

  return `
    <div class="provider-state">
      <span class="state-pill ${providerState.configured ? "ok" : "warn"}">${providerState.configured ? "Ready" : "Needs setup"}</span>
      <strong>${label}</strong>
      <span class="panel-muted">${description}</span>
      ${needsLine}
    </div>
  `;
}

function renderCurrentStep() {
  const step = steps[state.currentStep];
  elements.stepEyebrow.textContent = `Step ${state.currentStep + 1}`;
  elements.stepTitle.textContent = step.title;
  elements.stepDescription.textContent = step.description;
  elements.stepProgressLabel.textContent = `Step ${state.currentStep + 1} of ${steps.length}`;
  elements.backButton.disabled = state.currentStep === 0;
  elements.nextButton.disabled = state.currentStep === steps.length - 1;
  elements.nextButton.textContent =
    state.currentStep === steps.length - 2 ? "Go To Review" : "Next Step";

  const renderers = {
    "quick-setup": renderQuickSetupStep,
    "search-apis": renderSearchApisStep,
    "company-boards": renderCompanyBoardsStep,
    filters: renderFiltersStep,
    ranking: renderRankingStep,
    alerts: renderAlertsStep,
    review: renderReviewStep
  };

  elements.stepContent.innerHTML = renderers[step.id]();
}

function renderQuickSetupStep() {
  const quickSetup = state.quickSetup;
  const readiness = state.status?.providerReadiness ?? {};
  return `
    <div class="helper-grid">
      <article class="helper-card">
        <h3>Fastest path</h3>
        <p class="helper-copy">
          Fill these simple questions and click <strong>Generate Recommended Setup</strong>.
          You can still fine-tune every detail in later steps.
        </p>
      </article>
      <article class="helper-card">
        <h3>Company board URLs</h3>
        <p class="helper-copy">
          Paste direct board URLs if you have them. The workbench can extract common ATS identifiers automatically.
        </p>
      </article>
      <article class="helper-card">
        <h3>Search API credentials</h3>
        <p class="helper-copy">
          ${readiness.adzuna?.configured ? "Adzuna is ready." : "Adzuna needs env vars."}
          ${readiness.jooble?.configured ? " Jooble is ready." : " Jooble needs an API key."}
          If those are missing, the generator will still set up company boards and local rules.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Tell me what you want</h3>
          <p class="panel-muted">
            Answer these in normal language. The app will turn them into sources, filters, ranking, and alert defaults.
          </p>
        </div>
        <div class="inline-actions">
          <button id="generateSetupButton" class="primary-button">Generate Recommended Setup</button>
        </div>
      </div>
      <div class="form-grid">
        ${field(
    "Target roles",
    `<textarea data-quick-target-roles placeholder="backend engineer, platform engineer, software engineer">${escapeHtml(quickSetup.targetRoles)}</textarea>`,
    "The generator uses these as search phrases and title boosts.",
    true
  )}
        ${field(
    "Skills or topics you care about",
    `<textarea data-quick-skills placeholder="TypeScript, Node.js, distributed systems">${escapeHtml(quickSetup.skillKeywords)}</textarea>`,
    "These become ranking keywords and helpful include terms.",
    true
  )}
        ${field(
    "Preferred locations",
    `<input data-quick-locations value="${escapeHtml(quickSetup.locations)}" placeholder="remote, United States, Phoenix" />`,
    "Use comma-separated values. Leave blank if you want very wide coverage."
  )}
        ${field(
    "Search style",
    `
            <select data-quick-search-style>
              ${quickSelectOption("balanced", quickSetup.searchStyle, "Balanced: company boards plus broad discovery")}
              ${quickSelectOption("companies-only", quickSetup.searchStyle, "Companies only: direct company boards")}
              ${quickSelectOption("broad", quickSetup.searchStyle, "Broad discovery: search APIs plus any board URLs you paste")}
            </select>
          `,
    "Choose whether to favor direct company boards, wide discovery, or both."
  )}
        ${field(
    "Remote only",
    `<label class="checkbox-line"><input type="checkbox" data-quick-remote-only ${quickSetup.remoteOnly ? "checked" : ""} />Only keep remote-capable jobs</label>`,
    "Recommended if you know you only want remote roles."
  )}
        ${field(
    "Should alerts be created automatically?",
    `<label class="checkbox-line"><input type="checkbox" data-quick-enable-alerts ${quickSetup.enableAlerts ? "checked" : ""} />Create a starter alert rule for me</label>`,
    "This creates a high-score alert using your goals and keywords."
  )}
        ${field(
    "How often should it run?",
    `
            <select data-quick-interval>
              ${quickSelectOption("manual", quickSetup.interval, "Manual only")}
              ${quickSelectOption("60", quickSetup.interval, "Every hour")}
              ${quickSelectOption("180", quickSetup.interval, "Every 3 hours")}
              ${quickSelectOption("360", quickSetup.interval, "Twice a day")}
            </select>
          `,
    "You can always change this later in the alerts step."
  )}
        ${field(
    "Company board URLs or company names",
    `<textarea data-quick-company-input placeholder="https://job-boards.greenhouse.io/company\nhttps://jobs.lever.co/company\nStripe">${escapeHtml(quickSetup.companyInput)}</textarea>`,
    "Paste one per line. Board URLs are best because the app can extract identifiers automatically.",
    true
  )}
      </div>
    </section>
    <div class="summary-grid">
      <article class="summary-card">
        <h3>What the generator will create</h3>
        <div class="summary-list">
          <span>Starter search sources based on your target role.</span>
          <span>Company board entries from recognizable URLs.</span>
          <span>Reasonable filters, ranking boosts, and alert defaults.</span>
        </div>
      </article>
      <article class="summary-card">
        <h3>If you do nothing else</h3>
        <div class="summary-list">
          <span>Use this step, click generate, then jump straight to review.</span>
          <span>Later steps are mainly for advanced edits and fine-tuning.</span>
        </div>
      </article>
    </div>
  `;
}

function renderSearchApisStep() {
  const readiness = state.status?.providerReadiness ?? {};

  return `
    <div class="helper-grid">
      <article class="helper-card">
        <h3>When to use search APIs</h3>
        <p class="helper-copy">
          Use these when you want broad coverage and discovery. They are good for finding
          opportunities you did not already know to track.
        </p>
      </article>
      <article class="helper-card">
        <h3>Skip this if needed</h3>
        <p class="helper-copy">
          If quick setup already created the sources you want, you can leave this step alone and move on.
        </p>
      </article>
      <article class="helper-card">
        <h3>Adzuna setup</h3>
        <p class="helper-copy">
          Status: ${readiness.adzuna?.configured ? "ready" : "missing credentials"}.
          Add <code>ADZUNA_APP_ID</code> and <code>ADZUNA_APP_KEY</code> to <code>.env</code>.
        </p>
      </article>
      <article class="helper-card">
        <h3>Jooble setup</h3>
        <p class="helper-copy">
          Status: ${readiness.jooble?.configured ? "ready" : "missing credentials"}.
          Add <code>JOOBLE_API_KEY</code> to <code>.env</code>.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Configured search sources</h3>
          <p class="panel-muted">
            Keywords define what to search for. Location narrows the feed before your local filters run.
          </p>
        </div>
        <div class="inline-actions">
          <button id="addSearchButtonInline" class="ghost-button">Add Search API</button>
        </div>
      </div>
      <div class="card-stack">
        ${renderSearchSources()}
      </div>
    </section>
  `;
}

function renderCompanyBoardsStep() {
  const preview = state.careersImport.preview;
  return `
    <section class="section-stack careers-import-panel">
      <div class="section-header">
        <div>
          <h3>Import from careers URLs</h3>
          <p class="panel-muted">
            Paste one or more company careers links. The workbench detects supported ATS providers and adds new boards without duplicating existing ones.
          </p>
        </div>
      </div>
      <div class="careers-import-body">
        ${field(
    "Careers URLs",
    `<textarea data-careers-url-input rows="5" placeholder="https://jobs.ashbyhq.com/openai&#10;https://jobs.lever.co/vercel">${escapeHtml(state.careersImport.input)}</textarea>`,
    "One URL per line. Unsupported or duplicate links are shown in the preview before anything is added.",
    true
  )}
        <div class="inline-actions careers-import-actions">
          <button class="ghost-button" data-careers-preview ${state.careersImport.busy ? "disabled" : ""}>Preview boards</button>
          <button class="primary-button" data-careers-add ${!preview?.detected?.length || state.careersImport.busy ? "disabled" : ""}>
            Add ${preview?.detected?.length ? `${preview.detected.length} board${preview.detected.length === 1 ? "" : "s"}` : "detected boards"}
          </button>
        </div>
        ${renderCareersImportPreview(preview)}
      </div>
    </section>
    <div class="helper-grid">
      <article class="helper-card">
        <h3>Greenhouse token</h3>
        <p class="helper-copy">
          If the job board URL looks like <code>job-boards.greenhouse.io/company</code>,
          the token is usually <code>company</code>.
        </p>
      </article>
      <article class="helper-card">
        <h3>Lever slug</h3>
        <p class="helper-copy">
          If the job board URL looks like <code>jobs.lever.co/company</code>,
          the slug is usually <code>company</code>.
        </p>
      </article>
      <article class="helper-card">
        <h3>More direct ATS feeds</h3>
        <p class="helper-copy">
          Ashby, Workable, Workday, SmartRecruiters, Recruitee, Personio, BambooHR, iCIMS, Oracle CE, and Taleo can usually run without credentials.
        </p>
      </article>
      <article class="helper-card">
        <h3>Easiest input</h3>
        <p class="helper-copy">
          If this still feels technical, go back to Quick Setup and paste the board URLs there instead of typing identifiers manually.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Configured company boards</h3>
          <p class="panel-muted">
            These are usually the highest-quality sources because they come directly from a company career site.
          </p>
        </div>
        <div class="inline-actions">
          <button id="addBoardButtonInline" class="ghost-button">Add Company Board</button>
        </div>
      </div>
      <div class="card-stack">
        ${renderBoardSources()}
      </div>
    </section>
  `;
}

function renderFiltersStep() {
  const filters = state.config.filters;
  return `
    <div class="helper-grid">
      <article class="helper-card">
        <h3>Include vs exclude keywords</h3>
        <p class="helper-copy">
          Include keywords keep jobs that mention those terms. Exclude keywords remove jobs that mention them anywhere in the searchable text.
        </p>
      </article>
      <article class="helper-card">
        <h3>Provider preference</h3>
        <p class="helper-copy">
          Preferred providers act like a hard gate right now. Use this only if you want to limit the search strictly to certain sources.
        </p>
      </article>
      <article class="helper-card">
        <h3>Compensation and freshness</h3>
        <p class="helper-copy">
          Salary filters only apply when compensation is present. Max age uses the job posting timestamp when the source exposes it.
        </p>
      </article>
      <article class="helper-card">
        <h3>Use only what you need</h3>
        <p class="helper-copy">
          You do not need to fill every field. Most users only need include keywords, location, and remote-only.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Filtering rules</h3>
          <p class="panel-muted">
            Use these controls to remove obvious misses before ranking begins.
          </p>
        </div>
      </div>
      <div class="form-grid">
        ${field(
    "Include keywords",
    `<textarea data-filter-include-keywords placeholder="distributed systems, security, platform">${escapeHtml(csv(filters.includeKeywords))}</textarea>`,
    "Keep jobs only if they mention at least one of these terms.",
    true
  )}
        ${field(
    "Exclude keywords",
    `<textarea data-filter-exclude-keywords placeholder="intern, principal, sales">${escapeHtml(csv(filters.excludeKeywords))}</textarea>`,
    "Remove jobs that mention any of these terms.",
    true
  )}
        ${field(
    "Include companies",
    `<textarea data-filter-include-companies placeholder="Stripe, Datadog">${escapeHtml(csv(filters.includeCompanies))}</textarea>`,
    "Optional allow-list. Leave blank to include all companies.",
    true
  )}
        ${field(
    "Exclude companies",
    `<textarea data-filter-exclude-companies placeholder="Staffing agency">${escapeHtml(csv(filters.excludeCompanies))}</textarea>`,
    "Remove any company whose name matches one of these terms.",
    true
  )}
        ${field(
    "Include locations",
    `<textarea data-filter-include-locations placeholder="Remote, Arizona">${escapeHtml(csv(filters.includeLocations))}</textarea>`,
    "Keep listings only if location or workplace type matches one of these values.",
    true
  )}
        ${field(
    "Exclude locations",
    `<textarea data-filter-exclude-locations placeholder="San Francisco">${escapeHtml(csv(filters.excludeLocations))}</textarea>`,
    "Remove jobs in places you do not want.",
    true
  )}
        ${field(
    "Remote only",
    `<label class="checkbox-line"><input type="checkbox" data-filter-remote-only ${filters.remoteOnly ? "checked" : ""} />Only keep remote-capable roles</label>`,
    "Uses explicit remote flags, workplace type, and remote-like location text."
  )}
        ${field(
    "Only roles with apply link",
    `<label class="checkbox-line"><input type="checkbox" data-filter-apply-only ${filters.onlyWithApplyUrl ? "checked" : ""} />Require direct apply URL</label>`,
    "Useful if you only want listings that are immediately actionable."
  )}
        ${field(
    "Workplace types",
    `<input data-filter-workplace-types value="${escapeHtml(csv(filters.workplaceTypes))}" placeholder="remote, hybrid, onsite" />`,
    "Optional matching on workplace style."
  )}
        ${field(
    "Employment types",
    `<input data-filter-employment-types value="${escapeHtml(csv(filters.employmentTypes))}" placeholder="fulltime, contract" />`,
    "Optional matching on employment type."
  )}
        ${field(
    "Minimum salary",
    `<input type="number" min="0" data-filter-min-salary value="${filters.minSalary ?? ""}" placeholder="120000" />`,
    "Drop jobs whose published compensation range tops out below this number."
  )}
        ${field(
    "Maximum salary",
    `<input type="number" min="0" data-filter-max-salary value="${filters.maxSalary ?? ""}" placeholder="250000" />`,
    "Drop jobs whose published compensation range starts above this number."
  )}
        ${field(
    "Max age (days)",
    `<input type="number" min="1" data-filter-max-age-days value="${filters.maxAgeDays ?? ""}" placeholder="14" />`,
    "Keep only recently posted jobs."
  )}
        ${field(
    "Preferred providers",
    `<input data-filter-preferred-providers value="${escapeHtml(csv(filters.preferredProviders))}" placeholder="greenhouse, ashby" />`,
    `Hard limit the search to these providers if set. ${KNOWN_PROVIDER_HINT}`
  )}
      </div>
    </section>
  `;
}

function renderRankingStep() {
  const ranking = state.config.ranking;
  return `
    <div class="helper-grid">
      <article class="helper-card">
        <h3>How scoring works</h3>
        <p class="helper-copy">
          Every listing starts with a base score, then gets boosted for signals like freshness,
          remote friendliness, compensation, and keyword overlap.
        </p>
      </article>
      <article class="helper-card">
        <h3>Title, company, and location boosts</h3>
        <p class="helper-copy">
          These are positive nudges. They do not exclude jobs; they simply push stronger fits toward the top.
        </p>
      </article>
      <article class="helper-card">
        <h3>Skill keywords</h3>
        <p class="helper-copy">
          Add technologies or domain terms you care about. Matching jobs score higher during ranking.
        </p>
      </article>
      <article class="helper-card">
        <h3>Simple approach</h3>
        <p class="helper-copy">
          If you want the easiest setup, leave the numeric boosts alone and only add title boosts and skill keywords.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Ranking controls</h3>
          <p class="panel-muted">
            These settings change the order of jobs after filtering, not whether a job is included.
          </p>
        </div>
      </div>
      <div class="form-grid">
        ${field(
    "Prefer canonical company boards",
    `<label class="checkbox-line"><input type="checkbox" data-ranking-prefer-company-boards ${ranking.preferCompanyBoards ? "checked" : ""} />Prefer company-hosted listings during dedupe and ranking</label>`,
    "Recommended. This helps direct company pages win when the same role appears in multiple places."
  )}
        ${field(
    "Remote boost",
    `<input type="number" min="0" max="30" data-ranking-remote-boost value="${ranking.remoteBoost}" />`,
    "How much remote-friendly jobs should rise in the list."
  )}
        ${field(
    "Freshness boost",
    `<input type="number" min="0" max="30" data-ranking-freshness-boost value="${ranking.freshnessBoost}" />`,
    "How strongly newer jobs should be favored."
  )}
        ${field(
    "Compensation boost",
    `<input type="number" min="0" max="30" data-ranking-compensation-boost value="${ranking.compensationBoost}" />`,
    "How much published compensation should matter."
  )}
        ${field(
    "Keyword boost",
    `<input type="number" min="0" max="30" data-ranking-keyword-boost value="${ranking.keywordBoost}" />`,
    "How strongly keyword overlap should affect the score."
  )}
        ${field(
    "Title boosts",
    `<textarea data-ranking-title-boosts placeholder="backend, platform, security">${escapeHtml(csv(ranking.titleBoosts))}</textarea>`,
    "Positive title fragments that should move jobs upward.",
    true
  )}
        ${field(
    "Company boosts",
    `<textarea data-ranking-company-boosts placeholder="Anthropic, Datadog">${escapeHtml(csv(ranking.companyBoosts))}</textarea>`,
    "Companies you want the system to favor.",
    true
  )}
        ${field(
    "Location boosts",
    `<textarea data-ranking-location-boosts placeholder="Remote, Phoenix">${escapeHtml(csv(ranking.locationBoosts))}</textarea>`,
    "Locations that should get a ranking advantage.",
    true
  )}
        ${field(
    "Skill keywords",
    `<textarea data-ranking-skill-keywords placeholder="Node.js, TypeScript, Kubernetes">${escapeHtml(csv(ranking.skillKeywords))}</textarea>`,
    "Technologies or domain terms that should count as a strong fit.",
    true
  )}
      </div>
    </section>
  `;
}

function renderAlertsStep() {
  const schedule = state.config.schedule;
  return `
    <div class="helper-grid">
      <article class="helper-card">
        <h3>Alert rules</h3>
        <p class="helper-copy">
          Alerts trigger only after the search runs. Each rule checks score, freshness, providers, companies, and keywords.
        </p>
      </article>
      <article class="helper-card">
        <h3>Browser notifications</h3>
        <p class="helper-copy">
          Best for personal use on this machine. Click “Enable Browser Alerts” in the header once and allow notifications.
        </p>
      </article>
      <article class="helper-card">
        <h3>Recurring runs</h3>
        <p class="helper-copy">
          Scheduling works while the local workbench server is running. Quiet hours suppress scheduled runs during the time window you choose.
        </p>
      </article>
      <article class="helper-card">
        <h3>Easy default</h3>
        <p class="helper-copy">
          One alert rule plus an hourly schedule is a good starting point for most people.
        </p>
      </article>
    </div>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Alert rules</h3>
          <p class="panel-muted">
            Create separate rules for different job types, companies, or urgency levels.
          </p>
        </div>
        <div class="inline-actions">
          <button id="addAlertButtonInline" class="ghost-button">Add Alert Rule</button>
        </div>
      </div>
      <div class="card-stack">
        ${renderAlerts()}
      </div>
    </section>
    <section class="section-stack">
      <div class="section-header">
        <div>
          <h3>Schedule</h3>
          <p class="panel-muted">
            Choose whether the workbench should rerun automatically.
          </p>
        </div>
      </div>
      <div class="form-grid">
        ${field(
    "Enable periodic runs",
    `<label class="checkbox-line"><input type="checkbox" data-schedule-enabled ${schedule.enabled ? "checked" : ""} />Run automatically while the workbench server is open</label>`,
    "Turn this on only if you want the local server to keep checking on an interval."
  )}
        ${field(
    "Interval minutes",
    `<input type="number" min="5" max="10080" data-schedule-interval value="${schedule.intervalMinutes}" />`,
    "How often the workbench should search again."
  )}
        ${field(
    "Timezone",
    `<input data-schedule-timezone value="${escapeHtml(schedule.timezone)}" placeholder="America/Phoenix" />`,
    "Used to interpret quiet hours. Invalid timezone names fall back to the previous setting on save."
  )}
        ${field(
    "Quiet hours start",
    `<input type="time" data-schedule-quiet-start value="${escapeHtml(schedule.quietHoursStart ?? "")}" placeholder="23:00" />`,
    "Optional. Use 24-hour time. Invalid entries are ignored on save."
  )}
        ${field(
    "Quiet hours end",
    `<input type="time" data-schedule-quiet-end value="${escapeHtml(schedule.quietHoursEnd ?? "")}" placeholder="07:00" />`,
    "Optional. Scheduled runs resume at this time."
  )}
      </div>
    </section>
  `;
}

function renderReviewStep() {
  const summary = buildSummary();
  const errors = state.results?.errors ?? [];

  return `
    <div class="summary-grid">
      <article class="summary-card">
        <h3>Sources configured</h3>
        <div class="summary-list">
          <span><strong>${summary.searchCount}</strong> search API source${summary.searchCount === 1 ? "" : "s"}</span>
          <span><strong>${summary.boardCount}</strong> company board source${summary.boardCount === 1 ? "" : "s"}</span>
        </div>
      </article>
      <article class="summary-card">
        <h3>Filtering profile</h3>
        <div class="summary-list">
          <span><strong>${summary.includeKeywordCount}</strong> include keywords</span>
          <span><strong>${summary.excludeKeywordCount}</strong> exclude keywords</span>
          <span>${state.config.filters.remoteOnly ? "Remote-only is enabled." : "Remote-only is disabled."}</span>
        </div>
      </article>
      <article class="summary-card">
        <h3>Alerts and automation</h3>
        <div class="summary-list">
          <span><strong>${summary.alertCount}</strong> alert rule${summary.alertCount === 1 ? "" : "s"}</span>
          <span>${state.config.schedule.enabled ? `Runs every ${state.config.schedule.intervalMinutes} minutes.` : "No schedule enabled."}</span>
        </div>
      </article>
    </div>
    <div class="review-grid">
      <article class="review-card">
        <div class="review-card-header">
          <div>
            <h3>What will happen when you run</h3>
          </div>
        </div>
        <div class="helper-list">
          <span>The workbench will fetch jobs from every configured source.</span>
          <span>Filters will remove obvious mismatches.</span>
          <span>Ranking will score the remaining jobs.</span>
          <span>Alert rules will fire on jobs that match your conditions.</span>
        </div>
      </article>
      <article class="review-card">
        <div class="review-card-header">
          <div>
            <h3>Potential blockers</h3>
          </div>
        </div>
        <div class="helper-list">
          <span>${state.status?.providerReadiness?.adzuna?.configured ? "Adzuna is ready." : "Adzuna will fail until its env vars are set."}</span>
          <span>${state.status?.providerReadiness?.jooble?.configured ? "Jooble is ready." : "Jooble will fail until its API key is set."}</span>
          <span>Placeholder board identifiers will return 404 until replaced with real values.</span>
        </div>
      </article>
      <article class="review-card">
        <div class="review-card-header">
          <div>
            <h3>Last run status</h3>
          </div>
        </div>
        <div class="helper-list">
          <span>Last run: ${formatDateTime(state.status?.runtime?.lastRunAt)}</span>
          <span>Last known error: ${escapeHtml(state.status?.runtime?.lastError ?? "none")}</span>
        </div>
      </article>
    </div>
    ${errors.length > 0
      ? `
        <section class="section-stack">
          <div class="section-header">
            <div>
              <h3>Latest provider errors</h3>
              <p class="panel-muted">
                These are the most recent provider-level issues returned by the search engine.
              </p>
            </div>
          </div>
          <div class="card-stack">
            ${errors
        .slice(0, 6)
        .map(
          (error) => `
                  <article class="review-card">
                    <h3>${escapeHtml(error.provider)}: ${escapeHtml(error.source)}</h3>
                    <p class="helper-copy">${escapeHtml(error.message)}</p>
                  </article>
                `
        )
        .join("")}
          </div>
        </section>
      `
      : ""
    }
  `;
}

function renderSearchSources() {
  if (state.config.searches.length === 0) {
    return '<div class="empty-state empty-card source-card">No search API sources configured yet.</div>';
  }

  return state.config.searches
    .map(
      (search, index) => `
        <article class="source-card">
          <div class="source-card-header">
            <div>
              <span class="small-pill">Search API</span>
              <h3>${capitalize(search.provider)}</h3>
            </div>
            ${renderSettingsRemoveControl("search", index, `${capitalize(search.provider)} search source`)}
          </div>
          <div class="card-grid">
            ${field(
        "Provider",
        providerSelect(search.provider, ["adzuna", "jooble"], `data-search-provider="${index}"`),
        "Choose which search API should run."
      )}
            ${field(
        "Keywords",
        `<input data-search-query="${index}" value="${escapeHtml(search.query ?? "")}" placeholder="backend engineer, platform, remote" />`,
        "The main search phrase sent to that provider."
      )}
            ${field(
        "Location",
        `<input data-search-location="${index}" value="${escapeHtml(search.location ?? "")}" placeholder="remote, United States, Atlanta" />`,
        "Provider-side location filter. Leave blank for wider coverage."
      )}
            ${field(
        "Page",
        `<input type="number" min="1" data-search-page="${index}" value="${search.page ?? 1}" />`,
        "Which results page to query."
      )}
            ${field(
        "Limit",
        `<input type="number" min="1" max="100" data-search-limit="${index}" value="${search.limit ?? 25}" />`,
        "How many results to request from that provider."
      )}
          </div>
        </article>
      `
    )
    .join("");
}

function renderBoardSources() {
  if (state.config.boards.length === 0) {
    return '<div class="empty-state empty-card source-card">No company board sources configured yet.</div>';
  }

  return state.config.boards
    .map((board, index) => {
      const providerFields = renderBoardProviderFields(board, index);

      return `
        <article class="source-card">
          <div class="source-card-header">
            <div>
              <span class="small-pill">Company board</span>
              <h3>${capitalize(board.provider)}</h3>
            </div>
            ${renderSettingsRemoveControl("board", index, `${capitalize(board.provider)} company board`)}
          </div>
          <div class="card-grid">
            ${field(
        "Provider",
        providerSelect(
          board.provider,
          BOARD_PROVIDERS,
          `data-board-provider="${index}"`
        ),
        "Choose the kind of company-hosted board you want to connect."
      )}
            ${field(
        "Identifier",
        `<input data-board-source="${index}" value="${escapeHtml(board.source ?? "")}" placeholder="${escapeAttribute(getBoardSourcePlaceholder(board.provider))}" />`,
        getBoardSourceHint(board.provider)
      )}
            ${field(
        "Display company name",
        `<input data-board-company-name="${index}" value="${escapeHtml(board.companyName ?? "")}" placeholder="Anthropic, Intel, Zapier" />`,
        "Optional label used when the board API only returns a slug or host name. Provider-supplied names still win when they look real."
      )}
            ${field(
        "Include descriptions",
        `<label class="checkbox-line"><input type="checkbox" data-board-description="${index}" ${board.includeDescription ? "checked" : ""} />Pull long-form descriptions</label>`,
        "Turn this on if you want full descriptions available in the output."
      )}
            ${providerFields}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBoardProviderFields(board, index) {
  if (board.provider === "lever") {
    return `
            ${field(
            "Team",
            `<input data-board-team="${index}" value="${escapeHtml(board.team ?? "")}" placeholder="Engineering, Product" />`,
            "Optional Lever-only team filter."
          )}
            ${field(
            "Location filter",
            `<input data-board-location="${index}" value="${escapeHtml(board.location ?? "")}" placeholder="Remote, New York" />`,
            "Optional Lever-only location filter."
          )}
            ${field(
            "Limit",
            `<input type="number" min="1" max="100" data-board-limit="${index}" value="${board.limit ?? 50}" />`,
            "Optional Lever-only cap on results."
          )}
          `;
  }

  if (board.provider === "workday") {
    return `
            ${field(
      "Search text",
      `<input data-board-search-text="${index}" value="${escapeHtml(board.searchText ?? "")}" placeholder="software, security, platform" />`,
      "Optional Workday server-side search phrase. Leave blank for all public postings."
    )}
            ${field(
      "Page size",
      `<input type="number" min="1" max="100" data-board-limit="${index}" value="${board.limit ?? 50}" />`,
      "How many Workday postings to request per page."
    )}
            ${field(
      "Max pages",
      `<input type="number" min="1" max="20" data-board-max-pages="${index}" value="${board.maxPages ?? 5}" />`,
      "Caps Workday pagination so searches stay conservative."
    )}
          `;
  }

  if (board.provider === "smartrecruiters") {
    return `
            ${field(
      "Page size",
      `<input type="number" min="1" max="100" data-board-limit="${index}" value="${board.limit ?? 100}" />`,
      "How many SmartRecruiters postings to request per page."
    )}
            ${field(
      "Max pages",
      `<input type="number" min="1" max="20" data-board-max-pages="${index}" value="${board.maxPages ?? 3}" />`,
      "Caps pagination so searches stay conservative."
    )}
          `;
  }

  if (board.provider === "personio") {
    return field(
      "Language",
      `<input data-board-language="${index}" value="${escapeHtml(board.language ?? "en")}" placeholder="en" />`,
      "Optional Personio XML feed language code."
    );
  }

  if (board.provider === "icims-jibe") {
    return field(
      "Limit",
      `<input type="number" min="1" max="100" data-board-limit="${index}" value="${board.limit ?? 25}" />`,
      "Caps the first page of public postings for this source."
    );
  }

  if (["icims-classic", "oracle-ce", "taleo"].includes(board.provider)) {
    return `
            ${field(
      "Keyword",
      `<input data-board-keyword="${index}" value="${escapeHtml(board.keyword ?? "")}" placeholder="software, security, platform" />`,
      "Optional provider-side keyword search."
    )}
            ${board.provider === "oracle-ce"
      ? field(
        "Limit",
        `<input type="number" min="1" max="100" data-board-limit="${index}" value="${board.limit ?? 25}" />`,
        "Caps the first page of public postings for this source."
      )
      : ""}
            ${board.provider === "taleo"
      ? field(
        "Language",
        `<input data-board-language="${index}" value="${escapeHtml(board.lang ?? "en")}" placeholder="en" />`,
        "Optional Taleo language code."
      )
      : ""}
          `;
  }

  return "";
}

function getBoardSourcePlaceholder(provider) {
  const placeholders = {
    greenhouse: "ramp",
    lever: "vercel",
    ashby: "openai",
    workable: "company",
    workday: "intel.wd1.myworkdayjobs.com/intel/External",
    smartrecruiters: "smartrecruiters",
    recruitee: "bunq",
    personio: "personio.jobs.personio.de",
    bamboohr: "zapier",
    "icims-jibe": "careers.example.icims.com",
    "icims-classic": "careers-example.icims.com",
    "oracle-ce": "eeho.fa.us2.oraclecloud.com/jobsearch",
    taleo: "unifirst.taleo.net/unf_external"
  };
  return placeholders[provider] ?? "board token, site slug, or subdomain";
}

function getBoardSourceHint(provider) {
  const hints = {
    workday: "Use a myworkdayjobs URL, CXS jobs endpoint, or host/tenant/board.",
    smartrecruiters: "Use the identifier from careers.smartrecruiters.com/company.",
    recruitee: "Use the subdomain from company.recruitee.com.",
    personio: "Use the jobs.personio host or account slug.",
    bamboohr: "Use the subdomain from company.bamboohr.com.",
    "icims-jibe": "Use a modern iCIMS/Jibe careers host that exposes /api/jobs.",
    "icims-classic": "Use a classic iCIMS careers host with /jobs/search pages.",
    "oracle-ce": "Use Oracle Candidate Experience as host/site.",
    taleo: "Use Taleo as host/career-section."
  };
  return hints[provider] ?? "This is the board token, slug, board name, or subdomain depending on the provider.";
}

function renderAlerts() {
  if (state.config.alerts.length === 0) {
    return '<div class="empty-state empty-card alert-card">No alert rules configured yet.</div>';
  }

  return state.config.alerts
    .map(
      (alert, index) => `
        <article class="alert-card">
          <div class="alert-card-header">
            <div>
              <span class="small-pill">Alert rule</span>
              <h3>${escapeHtml(alert.name)}</h3>
            </div>
            ${renderSettingsRemoveControl("alert", index, `${alert.name} alert rule`)}
          </div>
          <div class="card-grid">
            ${field(
        "Rule name",
        `<input data-alert-name="${index}" value="${escapeHtml(alert.name)}" />`,
        "Human-readable label so you know what this alert is for."
      )}
            ${field(
        "Rule id",
        `<input data-alert-id="${index}" value="${escapeHtml(alert.id)}" />`,
        "Stable identifier used in output and webhook payloads."
      )}
            ${field(
        "Enabled",
        `<label class="checkbox-line"><input type="checkbox" data-alert-enabled="${index}" ${alert.enabled ? "checked" : ""} />Rule active</label>`,
        "Disable without deleting if you want to keep the rule for later."
      )}
            ${field(
        "New results only",
        `<label class="checkbox-line"><input type="checkbox" data-alert-new-only="${index}" ${alert.newOnly ? "checked" : ""} />Notify only on new listings</label>`,
        "Recommended to avoid repeated alerts for the same jobs."
      )}
            ${field(
        "Minimum score",
        `<input type="number" min="0" max="100" data-alert-min-score="${index}" value="${alert.minScore}" />`,
        "Only jobs at or above this score count as matches."
      )}
            ${field(
        "Browser notification",
        `<label class="checkbox-line"><input type="checkbox" data-alert-browser="${index}" ${alert.browser ? "checked" : ""} />Show browser notifications</label>`,
        "Shows a local browser notification on this machine."
      )}
            ${field(
        "Webhook URL",
        `<input type="url" data-alert-webhook="${index}" value="${escapeHtml(alert.webhookUrl ?? "")}" placeholder="https://hooks.slack.com/..." />`,
        "Optional public HTTP(S) endpoint for Slack, Discord, or your own automation. Unsupported schemes and private/local hosts are ignored on save.",
        true
      )}
            ${field(
        "Keywords",
        `<textarea data-alert-keywords="${index}" placeholder="security, infra">${escapeHtml(csv(alert.keywords))}</textarea>`,
        "Optional extra keyword gate for this alert only.",
        true
      )}
            ${field(
        "Providers",
        `<input data-alert-providers="${index}" value="${escapeHtml(csv(alert.providers))}" placeholder="greenhouse, jooble" />`,
        `Optional provider allow-list for this alert. ${KNOWN_PROVIDER_HINT}`
      )}
            ${field(
        "Companies",
        `<input data-alert-companies="${index}" value="${escapeHtml(csv(alert.companies))}" placeholder="Datadog, Stripe" />`,
        "Optional company allow-list for this alert."
      )}
          </div>
        </article>
      `
    )
    .join("");
}

function renderSettingsRemoveControl(type, index, label) {
  const pending =
    state.pendingSettingsRemove?.type === type &&
    state.pendingSettingsRemove?.index === index;

  if (!pending) {
    return `<button class="remove-button" data-settings-remove="${type}" data-settings-remove-index="${index}">Remove</button>`;
  }

  return `
    <div class="remove-confirmation" role="group" aria-label="Confirm removal of ${escapeAttribute(label)}">
      <button class="remove-button remove-button-danger" data-settings-confirm-remove="${type}" data-settings-remove-index="${index}">Confirm remove</button>
      <button class="ghost-button compact-button" data-settings-cancel-remove="${type}" data-settings-remove-index="${index}">Cancel</button>
    </div>
  `;
}

function renderResults() {
  const results = state.results;
  const hasRun = !!state.status?.runtime?.lastRunAt;
  const readiness = state.status?.providerReadiness ?? {};
  const hasCredentials = readiness.adzuna?.configured || readiness.jooble?.configured;
  const hasSources = (state.config?.searches?.length ?? 0) + (state.config?.boards?.length ?? 0) > 0;
  const providerErrors = results?.errors ?? [];

  if (!results?.listings?.length) {
    elements.resultsList.className = "results-list empty-state";
    if (!hasRun) {
      elements.resultsList.innerHTML = `
        <div class="empty-state-guide">
          <div class="empty-state-icon text-icon" aria-hidden="true">Jobs</div>
          <h3>No listings yet</h3>
          <p>Use <strong>Run Search</strong> in the header to fetch your first batch of job listings.</p>
          ${!hasSources ? '<p class="empty-state-hint">You may want to add search sources or company boards in <button class="link-button" data-view-shortcut="settings">Settings</button> first.</p>' : ''}
          ${!hasCredentials && hasSources ? '<p class="empty-state-hint">API keys for Adzuna/Jooble are not configured. Company boards will still work. Add keys to your <code>.env</code> file for broader results.</p>' : ''}
        </div>
      `;
    } else {
      elements.resultsList.innerHTML = `
        <div class="empty-state-guide">
          <div class="empty-state-icon text-icon" aria-hidden="true">None</div>
          <h3>No results found</h3>
          ${providerErrors.length > 0
            ? `
              <div class="empty-state-errors" role="alert">
                <h4>Provider issues</h4>
                ${providerErrors
              .slice(0, 4)
              .map(
                (error) => `
                    <p>
                      <strong>${escapeHtml(error.provider)}${error.source ? `: ${escapeHtml(error.source)}` : ""}</strong>
                      <span>${escapeHtml(error.message)}</span>
                    </p>
                  `
              )
              .join("")}
              </div>
            `
            : ""
          }
          <p>The last search didn't return any listings. Try:</p>
          <ul class="empty-state-tips">
            ${!hasCredentials ? '<li>Adding API keys for Adzuna or Jooble to your <code>.env</code> file</li>' : ''}
            <li>Adding more company boards in <button class="link-button" data-view-shortcut="settings">Settings</button></li>
            <li>Broadening your search terms or filters</li>
          </ul>
        </div>
      `;
    }
  } else {
    syncListingVisibleLimit();
    const matchingListings = getVisibleListings(results.listings, Infinity);
    const visibleListings = matchingListings.slice(0, state.listingVisibleLimit);
    const listingQuery = state.listingFilters.query ?? "";
    const listingSort = state.listingFilters.sort ?? "score";
    const listingSource = state.listingFilters.source ?? "all";
    const listingFiltersActive = hasActiveListingFilters();
    const sourceFilterOptions = renderListingSourceFilterOptions(results.listings, listingSource);
    const remainingListings = matchingListings.length - visibleListings.length;
    const shownLabel =
      matchingListings.length > visibleListings.length
        ? `${visibleListings.length} shown of ${matchingListings.length}`
        : `${visibleListings.length} shown`;
    elements.resultsList.className = "results-list";
    elements.resultsList.innerHTML = `
      ${renderAggregationSummary(results)}
      <p class="panel-muted listing-stability-note">Listings are ranked by score and posting date, then shown in that stable order. Dashboard paging keeps the same ranking between repeated searches.</p>
      <div class="listing-toolbar">
        <label class="listing-search">
          <span>Search listings</span>
          <input type="search" data-listing-filter-query value="${escapeAttribute(listingQuery)}" placeholder="Title, company, location, provider..." />
        </label>
        <label class="listing-filter listing-source-filter">
          <span>Source</span>
          <select data-listing-source-filter>
            ${sourceFilterOptions}
          </select>
        </label>
        <label class="listing-filter">
          <span>Sort by</span>
          <select data-listing-sort>
            <option value="score" ${listingSort === "score" ? "selected" : ""}>Score</option>
            <option value="newest" ${listingSort === "newest" ? "selected" : ""}>Newest</option>
            <option value="company" ${listingSort === "company" ? "selected" : ""}>Company</option>
            <option value="title" ${listingSort === "title" ? "selected" : ""}>Title</option>
          </select>
        </label>
        <label class="checkbox-line listing-new-filter">
          <input type="checkbox" data-listing-new-only ${state.listingFilters.newOnly ? "checked" : ""} />
          New only
        </label>
        <button class="ghost-button filter-clear-button" data-clear-listing-filters ${listingFiltersActive ? "" : "disabled"}>Clear filters</button>
        <span class="state-pill">${shownLabel}</span>
      </div>
      ${visibleListings.length
        ? visibleListings
      .map(
        ({ listing, index }) => {
          const trackedJob = findTrackedJobForListing(listing);
          return `
          <article class="listing-card ${trackedJob ? "listing-card--tracked" : ""} ${trackedJob?.applied ? "listing-card--applied" : ""}">
            <div class="listing-card-header">
              <div>
                <div class="listing-meta">
                  <span class="small-pill">${escapeHtml(listing.provider)}</span>
                  ${listing.isNew ? '<span class="small-pill new-pill">New</span>' : ""}
                  ${renderListingTrackerBadges(trackedJob)}
                </div>
                <h3>${escapeHtml(listing.title)}</h3>
                ${renderListingDetailMeta(listing)}
              </div>
              ${renderListingScore(listing)}
            </div>
            <div class="listing-reasons">
              ${(listing.reasons ?? [])
            .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
            .join("")}
            </div>
            <div class="listing-links">
              ${renderListingActionLink(listing, "Open listing", index, "open-listing")}
              ${listing.applyUrl ? renderListingActionLink(listing, "Apply", index, "apply") : ""}
              ${renderTrackOnlyAction(listing, index, trackedJob)}
              ${renderDirectSourceAction(listing, index)}
            </div>
          </article>
        `;
        }
      )
      .join("")
        : `
          <div class="empty-state-guide listing-filter-empty">
            <div class="empty-state-icon text-icon" aria-hidden="true">Filter</div>
            <h3>No listings match</h3>
            <p>Adjust the dashboard search, sort, or new-only filter to widen the result set.</p>
          </div>
        `}
      ${remainingListings > 0
        ? `
          <div class="listing-load-more">
            <button class="ghost-button" data-listing-load-more>
              Show ${Math.min(remainingListings, LISTING_PAGE_SIZE)} more (${remainingListings} remaining)
            </button>
          </div>
        `
        : ""}
    `;
  }

  if (!results?.alerts?.length) {
    elements.alertMatches.className = "alert-match-list empty-state";
    if (!hasRun) {
      elements.alertMatches.innerHTML = `
        <div class="empty-state-guide">
          <div class="empty-state-icon text-icon" aria-hidden="true">Alerts</div>
          <h3>No alerts yet</h3>
          <p>Alerts fire when search results match your criteria. Run a search to start.</p>
        </div>
      `;
    } else {
      elements.alertMatches.innerHTML = `
        <div class="empty-state-guide">
          <div class="empty-state-icon text-icon" aria-hidden="true">None</div>
          <h3>No alert matches</h3>
          ${renderNoAlertMatchesSummary()}
        </div>
      `;
    }
  } else {
    elements.alertMatches.className = "alert-match-list";
    elements.alertMatches.innerHTML = results.alerts
    .map(
      (alert) => `
        <article class="alert-hit">
          <div class="alert-hit-header">
            <div>
              <span class="small-pill">${alert.count} matches</span>
              <h3>${escapeHtml(alert.name)}</h3>
            </div>
            <span class="small-pill ${alert.webhookUrl ? "" : "small-danger"}">${alert.webhookUrl ? "Webhook ready" : "Browser only"
        }</span>
          </div>
          <div class="alert-hit-meta">
            ${alert.listings
          .slice(0, 3)
          .map((listing) => `<span>${escapeHtml(listing.title)} at ${escapeHtml(listing.company)}</span>`)
          .join("")}
          </div>
        </article>
      `
      )
      .join("");
  }

  updateDashboardResultsLayout(results);
}

function updateDashboardResultsLayout(results) {
  const grid = elements.resultsGrid;
  if (!grid) {
    return;
  }

  const hasListings = Boolean(results?.listings?.length);
  const hasAlerts = Boolean(results?.alerts?.length);

  grid.classList.toggle("results-grid--listings-populated", hasListings);
  grid.classList.toggle("results-grid--alerts-populated", hasAlerts);
  grid.classList.toggle("results-grid--alerts-empty", !hasAlerts);
  grid.classList.toggle("results-grid--both-empty", !hasListings && !hasAlerts);

  const alertsSection = elements.alertMatches?.closest(".workbench-section");
  const listingsSection = elements.resultsList?.closest(".workbench-section");
  alertsSection?.classList.toggle("dashboard-panel--populated", hasAlerts);
  alertsSection?.classList.toggle("dashboard-panel--empty", !hasAlerts);
  listingsSection?.classList.toggle("dashboard-panel--populated", hasListings);
  listingsSection?.classList.toggle("dashboard-panel--empty", !hasListings);
}

function renderListingDetailMeta(listing) {
  const parts = [
    listing.company,
    listing.location ?? "Location not provided",
    listing.employmentType ?? "Type not provided",
    formatDate(listing.postedAt)
  ];

  return `<div class="listing-meta listing-meta--details">${parts
    .map((part) => `<span class="listing-meta-part">${escapeHtml(String(part))}</span>`)
    .join("")}</div>`;
}

function renderListingTrackerBadges(trackedJob) {
  if (!trackedJob) {
    return "";
  }

  const statusLabel = trackedJob.applied
    ? "Applied"
    : trackedJob.status
      ? capitalize(trackedJob.status)
      : "Tracked";

  return `<span class="small-pill tracked-pill">${escapeHtml(statusLabel)}</span>`;
}

function renderListingScore(listing) {
  const reasons = listing.reasons ?? [];
  if (!reasons.length) {
    return `<div class="listing-score" aria-label="Score ${escapeAttribute(listing.score)}">${escapeHtml(listing.score)}</div>`;
  }

  return `
    <details class="listing-score-details">
      <summary class="listing-score" aria-label="Score ${escapeAttribute(listing.score)}. Show ranking reasons">${escapeHtml(listing.score)}</summary>
      <div class="score-breakdown">
        <strong>Why this ranks here</strong>
        <ul>
          ${reasons.slice(0, 6).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          ${reasons.length > 6 ? `<li>${reasons.length - 6} more signal${reasons.length === 7 ? "" : "s"}</li>` : ""}
        </ul>
      </div>
    </details>
  `;
}

function findTrackedJobForListing(listing) {
  const listingUrl = safeExternalUrl(listing.listingUrl);
  const applyUrl = safeExternalUrl(listing.applyUrl);
  const normalizedTitle = normalizeTrackerMatchPart(listing.title);
  const normalizedCompany = normalizeTrackerMatchPart(listing.company);

  return (state.tracker ?? []).find((job) => {
    const jobListingUrl = safeExternalUrl(job.listingUrl);
    const jobApplyUrl = safeExternalUrl(job.applyUrl);
    const urlMatches =
      (listingUrl !== "#" && jobListingUrl === listingUrl) ||
      (applyUrl !== "#" && jobApplyUrl === applyUrl);

    if (urlMatches) {
      return true;
    }

    return (
      normalizedTitle &&
      normalizedCompany &&
      normalizeTrackerMatchPart(job.title) === normalizedTitle &&
      normalizeTrackerMatchPart(job.company) === normalizedCompany
    );
  });
}

function normalizeTrackerMatchPart(value) {
  return String(value ?? "").trim().toLowerCase();
}

function listingFilterFingerprint() {
  return JSON.stringify({
    query: (state.listingFilters.query ?? "").trim(),
    sort: state.listingFilters.sort ?? "score",
    newOnly: Boolean(state.listingFilters.newOnly),
    source: state.listingFilters.source ?? "all"
  });
}

function syncListingVisibleLimit() {
  const resultsAt = state.results?.generatedAt ?? "";
  const filterFingerprint = listingFilterFingerprint();
  const context = state.listingVisibleContext;

  if (context.resultsAt !== resultsAt || context.filterFingerprint !== filterFingerprint) {
    state.listingVisibleLimit = LISTING_PAGE_SIZE;
    state.listingVisibleContext = { resultsAt, filterFingerprint };
  }
}

function renderAggregationSummary(results) {
  const providers = results?.providers ?? [];
  const errors = results?.errors ?? [];
  const summary = results?.summary;

  if (!providers.length && !errors.length && !summary) {
    return "";
  }

  const totalsByProvider = new Map();
  for (const entry of providers) {
    const current = totalsByProvider.get(entry.provider) ?? {
      provider: entry.provider,
      count: 0,
      sources: 0,
      modes: new Set()
    };
    current.count += Number(entry.count ?? 0);
    current.sources += 1;
    current.modes.add(entry.mode);
    current.entries = current.entries ?? [];
    current.entries.push(entry);
    totalsByProvider.set(entry.provider, current);
  }

  const providerRows = [...totalsByProvider.values()].sort((left, right) => right.count - left.count);
  const fetchedTotal = providerRows.reduce((total, row) => total + row.count, 0);

  return `
    <section class="aggregation-summary" aria-label="Search aggregation by source">
      <div class="aggregation-summary-header">
        <div>
          <p class="eyebrow">Source health</p>
          <h3>Aggregation breakdown</h3>
        </div>
        ${summary
      ? `<span class="state-pill">${summary.uniqueListings ?? 0} ranked · ${summary.fetchedListings ?? fetchedTotal} fetched</span>`
      : `<span class="state-pill">${fetchedTotal} fetched</span>`}
      </div>
      ${providerRows.length
      ? `
        <div class="aggregation-provider-grid">
          ${providerRows
        .map(
          (row) => renderAggregationProviderCard(row)
        )
        .join("")}
        </div>
      `
      : `
        <p class="panel-muted">No provider summaries were returned for this run.</p>
      `}
      ${errors.length
      ? `
        <div class="aggregation-errors" role="alert">
          <h4>Provider errors (${errors.length})</h4>
          ${errors
        .slice(0, 5)
        .map(
          (error) => `
                <p class="aggregation-error-line">
                  <strong>${escapeHtml(error.provider)}${error.source ? `: ${escapeHtml(error.source)}` : ""}</strong>
                  <span>${escapeHtml(error.message)}</span>
                </p>
              `
        )
        .join("")}
          ${errors.length > 5 ? `<p class="panel-muted">${errors.length - 5} more provider errors not shown.</p>` : ""}
        </div>
      `
      : `<p class="aggregation-ok">All configured sources responded for the latest run.</p>`}
    </section>
  `;
}

function renderAggregationProviderCard(row) {
  const sourceEntries = [...(row.entries ?? [])].sort((left, right) => Number(right.count ?? 0) - Number(left.count ?? 0));
  const visibleEntries = sourceEntries.slice(0, 8);
  const hiddenCount = Math.max(0, sourceEntries.length - visibleEntries.length);

  return `
    <details class="aggregation-provider-card">
      <summary class="aggregation-provider-summary">
        <span class="aggregation-provider-top">
          <span class="small-pill">${escapeHtml(row.provider)}</span>
          <strong>${row.count}</strong>
        </span>
        <span class="aggregation-provider-meta">
          ${row.sources} source${row.sources === 1 ? "" : "s"}
          · ${[...row.modes].map((mode) => (mode === "board" ? "company board" : "search API")).join(", ")}
        </span>
      </summary>
      ${visibleEntries.length
      ? `
        <ul class="aggregation-source-list">
          ${visibleEntries
        .map(
          (entry) => `
            <li>
              <code>${escapeHtml(entry.source ?? "default")}</code>
              <span>${Number(entry.count ?? 0)}</span>
            </li>
          `
        )
        .join("")}
          ${hiddenCount ? `<li class="aggregation-source-more">${hiddenCount} more source${hiddenCount === 1 ? "" : "s"}</li>` : ""}
        </ul>
      `
      : ""}
    </details>
  `;
}

function renderNoAlertMatchesSummary() {
  const enabledAlerts = (state.config?.alerts ?? []).filter((alert) => alert.enabled !== false);

  if (!enabledAlerts.length) {
    return "<p>No alert rules are enabled. Add one in Settings or run another search after changing your criteria.</p>";
  }

  return `
    <p>The latest run did not trigger ${enabledAlerts.length === 1 ? "the active alert rule" : `${enabledAlerts.length} active alert rules`}.</p>
    <ul class="empty-state-tips alert-rule-summary">
      ${enabledAlerts
    .slice(0, 3)
    .map((alert) => `<li>${escapeHtml(describeAlertRule(alert))}</li>`)
    .join("")}
      ${enabledAlerts.length > 3 ? `<li>${enabledAlerts.length - 3} more alert rule${enabledAlerts.length === 4 ? "" : "s"} not shown.</li>` : ""}
    </ul>
    <p class="empty-state-hint">Adjust alert criteria in Settings or run another search.</p>
  `;
}

function describeAlertRule(alert) {
  const parts = [];
  if (Number.isFinite(Number(alert.minScore))) {
    parts.push(`score >= ${Number(alert.minScore)}`);
  }
  if (alert.newOnly) {
    parts.push("new only");
  }
  if (Array.isArray(alert.keywords) && alert.keywords.length) {
    parts.push(`keywords: ${alert.keywords.slice(0, 3).join(", ")}${alert.keywords.length > 3 ? ", ..." : ""}`);
  }
  if (Array.isArray(alert.providers) && alert.providers.length) {
    parts.push(`providers: ${alert.providers.slice(0, 3).join(", ")}${alert.providers.length > 3 ? ", ..." : ""}`);
  }

  return `${alert.name || "Untitled alert"}${parts.length ? ` (${parts.join("; ")})` : ""}`;
}

function renderListingSourceFilterOptions(listings, selectedValue) {
  const providerCounts = new Map();
  const sourceCounts = new Map();

  for (const listing of listings ?? []) {
    const provider = normalizeListingFilterPart(listing.provider);
    if (!provider) {
      continue;
    }

    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);

    const source = normalizeListingFilterPart(listing.source ?? listing.company);
    if (source) {
      const token = makeSourceFilterToken("source", provider, source);
      const current = sourceCounts.get(token) ?? { provider, source, count: 0 };
      current.count += 1;
      sourceCounts.set(token, current);
    }
  }

  const providerOptions = [...providerCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([provider, count]) => {
      const value = makeSourceFilterToken("provider", provider);
      return `<option value="${escapeAttribute(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(capitalize(provider))} (${count})</option>`;
    })
    .join("");

  const topSources = [...sourceCounts.entries()].sort((left, right) => right[1].count - left[1].count);
  const selectedSource = topSources.find(([token]) => token === selectedValue);
  const visibleSources = topSources.slice(0, SOURCE_FILTER_TOP_LIMIT);
  if (selectedSource && !visibleSources.some(([token]) => token === selectedValue)) {
    visibleSources.push(selectedSource);
  }

  const sourceOptions = visibleSources
    .map(([value, row]) =>
      `<option value="${escapeAttribute(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(capitalize(row.provider))} · ${escapeHtml(row.source)} (${row.count})</option>`
    )
    .join("");

  return `
    <option value="all" ${selectedValue === "all" ? "selected" : ""}>All sources</option>
    ${providerOptions ? `<optgroup label="Providers">${providerOptions}</optgroup>` : ""}
    ${sourceOptions ? `<optgroup label="Top company boards">${sourceOptions}</optgroup>` : ""}
  `;
}

function makeSourceFilterToken(kind, provider, source = "") {
  return kind === "provider"
    ? `provider:${encodeURIComponent(provider)}`
    : `source:${encodeURIComponent(provider)}:${encodeURIComponent(source)}`;
}

function parseSourceFilterToken(value) {
  if (!value || value === "all") {
    return { kind: "all" };
  }

  const [kind, provider = "", source = ""] = value.split(":");
  if (kind === "provider") {
    return { kind, provider: decodeURIComponent(provider) };
  }
  if (kind === "source") {
    return { kind, provider: decodeURIComponent(provider), source: decodeURIComponent(source) };
  }

  return { kind: "all" };
}

function normalizeListingFilterPart(value) {
  return String(value ?? "").trim();
}

function renderCareersImportPreview(preview) {
  if (!preview) {
    return "";
  }

  const renderRows = (title, rows, tone) => {
    if (!rows.length) {
      return "";
    }

    return `
      <div class="careers-import-group careers-import-group--${tone}">
        <h4>${title} (${rows.length})</h4>
        <ul class="careers-import-list">
          ${rows
        .map(
          (row) => `
              <li>
                ${row.provider
              ? `<strong>${escapeHtml(capitalize(row.provider))}</strong> · <code>${escapeHtml(row.source)}</code>`
              : `<span>${escapeHtml(row.line)}</span>`}
                ${row.url && row.url !== row.line ? `<span class="careers-import-url">${escapeHtml(row.url)}</span>` : ""}
              </li>
            `
        )
        .join("")}
        </ul>
      </div>
    `;
  };

  return `
    <div class="careers-import-preview" role="region" aria-label="Careers URL import preview">
      ${renderRows("Ready to add", preview.detected, "ready")}
      ${renderRows("Already configured", preview.duplicate, "duplicate")}
      ${renderRows("Unsupported URLs", preview.unknown, "unknown")}
      ${!preview.detected.length && !preview.duplicate.length && !preview.unknown.length
      ? '<p class="panel-muted">No URLs were found in the pasted input.</p>'
      : ""}
    </div>
  `;
}

function getVisibleListings(listings, limit = LISTING_PAGE_SIZE) {
  const query = (state.listingFilters.query ?? "").trim().toLowerCase();
  const newOnly = Boolean(state.listingFilters.newOnly);
  const sort = state.listingFilters.sort ?? "score";
  const sourceFilter = parseSourceFilterToken(state.listingFilters.source ?? "all");

  const matchingListings = listings
    .map((listing, index) => ({ listing, index }))
    .filter(({ listing }) => {
      if (newOnly && !listing.isNew) {
        return false;
      }

      if (!listingMatchesSourceFilter(listing, sourceFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        listing.title,
        listing.company,
        listing.location,
        listing.employmentType,
        listing.provider,
        listing.source,
        ...(listing.reasons ?? [])
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((left, right) => {
      if (sort === "newest") {
        return listingTimestamp(right.listing.postedAt) - listingTimestamp(left.listing.postedAt);
      }

      if (sort === "company") {
        return String(left.listing.company ?? "").localeCompare(String(right.listing.company ?? ""));
      }

      if (sort === "title") {
        return String(left.listing.title ?? "").localeCompare(String(right.listing.title ?? ""));
      }

      return Number(right.listing.score ?? 0) - Number(left.listing.score ?? 0);
    });

  return Number.isFinite(limit) ? matchingListings.slice(0, limit) : matchingListings;
}

function listingMatchesSourceFilter(listing, sourceFilter) {
  if (sourceFilter.kind === "all") {
    return true;
  }

  const provider = normalizeListingFilterPart(listing.provider);
  if (sourceFilter.kind === "provider") {
    return provider === sourceFilter.provider;
  }

  const source = normalizeListingFilterPart(listing.source ?? listing.company);
  return provider === sourceFilter.provider && source === sourceFilter.source;
}

function listingTimestamp(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function hasActiveListingFilters() {
  return Boolean(
    (state.listingFilters.query ?? "").trim() ||
    state.listingFilters.newOnly ||
    (state.listingFilters.sort ?? "score") !== "score" ||
    (state.listingFilters.source ?? "all") !== "all"
  );
}

function handleListingFilterInput(event) {
  const query = event.target.closest("[data-listing-filter-query]");
  if (!query) {
    return;
  }

  const cursor = query.selectionStart ?? query.value.length;
  state.listingFilters.query = query.value;
  renderResults();
  restoreInputFocus("[data-listing-filter-query]", cursor);
}

function handleListingFilterChange(event) {
  const sort = event.target.closest("[data-listing-sort]");
  if (sort) {
    state.listingFilters.sort = sort.value;
    renderResults();
    return;
  }

  const source = event.target.closest("[data-listing-source-filter]");
  if (source) {
    state.listingFilters.source = source.value;
    renderResults();
    return;
  }

  const newOnly = event.target.closest("[data-listing-new-only]");
  if (newOnly) {
    state.listingFilters.newOnly = newOnly.checked;
    renderResults();
  }
}

function renderTracker() {
  const jobs = state.tracker ?? [];
  const resumeSource = state.resumeSource ?? "";
  const filteredJobs = getFilteredTrackerJobs(jobs);
  const resumeWorkbench = `
    <article class="resume-workbench">
      <div>
        <p class="eyebrow">Resume source</p>
        <h3>ATS Tailoring Workspace</h3>
        <p class="panel-muted">Paste your current resume text once. Each tracked job can generate a truthful AI prompt from this resume and the saved job description.</p>
      </div>
      <textarea data-resume-source aria-label="Resume source" rows="8" maxlength="${RESUME_TEXT_MAX_LENGTH}" placeholder="Paste your current resume text here. This stays in this browser's local storage.">${escapeHtml(resumeSource)}</textarea>
    </article>
  `;

  if (!jobs.length) {
    elements.trackerList.className = "tracker-list empty-state";
    elements.trackerList.innerHTML = `
      ${resumeWorkbench}
      <div class="empty-state-guide tracker-empty-guide">
        <div class="empty-state-icon text-icon" aria-hidden="true">Track</div>
        <h3>No tracked jobs yet</h3>
        <p>Click <strong>Open listing</strong> or <strong>Apply</strong> on a job. It will be saved here automatically.</p>
      </div>
    `;
    return;
  }

  const appliedCount = jobs.filter((job) => job.applied).length;
  const filterStatus = state.trackerFilters.status ?? "all";
  const filterQuery = state.trackerFilters.query ?? "";
  const trackerFiltersActive = hasActiveTrackerFilters();
  elements.trackerList.className = "tracker-list";
  elements.trackerList.innerHTML = `
    ${resumeWorkbench}
    <div class="tracker-summary">
      <span class="state-pill ok">${jobs.length} tracked</span>
      <span class="state-pill ${appliedCount > 0 ? "ok" : "warn"}">${appliedCount} applied</span>
      <span class="state-pill warn">${jobs.length - appliedCount} pending</span>
      <span class="state-pill">${filteredJobs.length} shown</span>
    </div>
    <div class="tracker-toolbar">
      <label class="tracker-search">
        <span>Search tracked jobs</span>
        <input type="search" data-tracker-filter-query value="${escapeAttribute(filterQuery)}" placeholder="Company, title, location, provider..." />
      </label>
      <label class="tracker-filter">
        <span>Status filter</span>
        <select data-tracker-filter-status>
          <option value="all" ${filterStatus === "all" ? "selected" : ""}>All jobs</option>
          <option value="applied" ${filterStatus === "applied" ? "selected" : ""}>Applied</option>
          <option value="not-applied" ${filterStatus === "not-applied" ? "selected" : ""}>Not applied</option>
          <option value="status:submitted - email verified" ${filterStatus === "status:submitted - email verified" ? "selected" : ""}>Email verified</option>
          <option value="status:submitted - portal verified" ${filterStatus === "status:submitted - portal verified" ? "selected" : ""}>Portal verified</option>
          <option value="status:submitted - pending email verification" ${filterStatus === "status:submitted - pending email verification" ? "selected" : ""}>Pending email verification</option>
          <option value="status:submitted" ${filterStatus === "status:submitted" ? "selected" : ""}>Submitted (legacy)</option>
          <option value="status:not submitted" ${filterStatus === "status:not submitted" ? "selected" : ""}>Not submitted</option>
          <option value="status:not completed" ${filterStatus === "status:not completed" ? "selected" : ""}>Not completed</option>
          <option value="status:manual submit needed" ${filterStatus === "status:manual submit needed" ? "selected" : ""}>Manual submit needed</option>
          <option value="status:interview" ${filterStatus === "status:interview" ? "selected" : ""}>Interview</option>
          <option value="status:accepted" ${filterStatus === "status:accepted" ? "selected" : ""}>Accepted</option>
          <option value="status:rejected" ${filterStatus === "status:rejected" ? "selected" : ""}>Rejected</option>
        </select>
      </label>
      <button class="ghost-button filter-clear-button" data-clear-tracker-filters ${trackerFiltersActive ? "" : "disabled"}>Clear filters</button>
      <a class="download-button" href="/api/tracker/export" download="applied-jobs.xls">Export Applied Jobs</a>
    </div>
    ${filteredJobs.length
      ? filteredJobs
      .map((job) => {
        const description = summarizeDescription(getPromptJobDescription(job));
        const appliedPending = isTrackerMutationPending("applied", job.id);
        const statusPending = isTrackerMutationPending("status", job.id);
        const removePending = isTrackerMutationPending("remove", job.id);
        return `
          <article class="tracker-card ${job.applied ? "applied" : ""}">
            <div class="tracker-card-main">
              <div class="tracker-controls">
                <label class="tracker-check">
                  <input type="checkbox" data-tracker-applied="${escapeAttribute(job.id)}" ${job.applied ? "checked" : ""} ${appliedPending ? 'disabled aria-busy="true"' : ""} />
                  <span>Applied</span>
                </label>
                <label class="tracker-status">
                  <span>Status</span>
                  <select data-tracker-status="${escapeAttribute(job.id)}" ${statusPending ? 'disabled aria-busy="true"' : ""}>
                    <option value="" ${!job.status ? "selected" : ""}>Not set</option>
                    <option value="submitted - email verified" ${job.status === "submitted - email verified" ? "selected" : ""}>Submitted - email verified</option>
                    <option value="submitted - portal verified" ${job.status === "submitted - portal verified" ? "selected" : ""}>Submitted - portal verified</option>
                    <option value="submitted - pending email verification" ${job.status === "submitted - pending email verification" ? "selected" : ""}>Submitted - pending email verification</option>
                    <option value="submitted" ${job.status === "submitted" ? "selected" : ""}>Submitted (legacy)</option>
                    <option value="not submitted" ${job.status === "not submitted" ? "selected" : ""}>Not submitted</option>
                    <option value="not completed" ${job.status === "not completed" ? "selected" : ""}>Not completed</option>
                    <option value="manual submit needed" ${job.status === "manual submit needed" ? "selected" : ""}>Manual submit needed</option>
                    <option value="rejected" ${job.status === "rejected" ? "selected" : ""}>Rejected</option>
                    <option value="interview" ${job.status === "interview" ? "selected" : ""}>Interview</option>
                    <option value="accepted" ${job.status === "accepted" ? "selected" : ""}>Accepted</option>
                  </select>
                </label>
                ${state.pendingTrackerRemoveId === job.id
                  ? `
                    <div class="remove-confirmation" role="group" aria-label="Confirm removal of ${escapeAttribute(job.title)} at ${escapeAttribute(job.company)}">
                      <button class="remove-button remove-button-danger" data-tracker-confirm-remove="${escapeAttribute(job.id)}" ${removePending ? 'disabled aria-busy="true"' : ""}>${removePending ? "Removing..." : "Confirm remove"}</button>
                      <button class="ghost-button compact-button" data-tracker-cancel-remove="${escapeAttribute(job.id)}" ${removePending ? "disabled" : ""}>Cancel</button>
                    </div>
                  `
                  : `<button class="remove-button" data-tracker-remove="${escapeAttribute(job.id)}" ${removePending ? "disabled" : ""}>Remove</button>`
                }
              </div>
              <div>
                <div class="listing-meta">
                  <span class="small-pill">${escapeHtml(job.provider)}</span>
                  <span>${escapeHtml(job.company)}</span>
                  <span>${escapeHtml(job.location ?? "Location not provided")}</span>
                </div>
                <h3>${escapeHtml(job.title)}</h3>
                <p class="tracker-description">${description || "No description was provided by this source."}</p>
                <div class="listing-meta">
                  <span>Visited ${job.visitCount} time${job.visitCount === 1 ? "" : "s"}</span>
                  <span>Last visit ${formatDateTime(job.lastVisitedAt)}</span>
                  ${job.status ? `<span>Status ${escapeHtml(capitalize(job.status))}</span>` : ""}
                  ${job.appliedAt ? `<span>Applied ${formatDateTime(job.appliedAt)}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="listing-links">
              ${renderSafeExternalLink(job.listingUrl, "Open listing")}
              ${job.applyUrl ? renderSafeExternalLink(job.applyUrl, "Apply") : ""}
            </div>
            <details class="resume-tailor">
              <summary>Resume tailoring</summary>
              <div class="resume-tailor-grid">
                <div class="field span-2">
                  <label for="resumePrompt-${escapeAttribute(job.id)}">AI prompt for this job</label>
                  <textarea id="resumePrompt-${escapeAttribute(job.id)}" readonly rows="10" data-resume-prompt-preview="${escapeAttribute(job.id)}">${escapeHtml(buildResumePrompt(job))}</textarea>
                  <div class="inline-actions">
                    <button class="secondary-button" data-copy-resume-prompt="${escapeAttribute(job.id)}">Copy AI Prompt</button>
                  </div>
                </div>
                <div class="field">
                  <label>Full job description</label>
                  <textarea data-tracker-job-description="${escapeAttribute(job.id)}" aria-label="Full job description for ${escapeAttribute(job.title)} at ${escapeAttribute(job.company)}" rows="8" maxlength="${RESUME_TEXT_MAX_LENGTH}" placeholder="Paste the full job description here if the source only provided a short snippet. This text is used in the AI prompt.">${escapeHtml(job.jobDescriptionOverride ?? "")}</textarea>
                </div>
                <div class="field">
                  <label>Tailoring notes</label>
                  <textarea data-tracker-resume-notes="${escapeAttribute(job.id)}" aria-label="Tailoring notes for ${escapeAttribute(job.title)} at ${escapeAttribute(job.company)}" rows="8" maxlength="${RESUME_TEXT_MAX_LENGTH}" placeholder="Keywords to emphasize, projects to mention, gaps to address...">${escapeHtml(job.resumeNotes ?? "")}</textarea>
                </div>
                <div class="field span-2">
                  <label>Tailored resume draft</label>
                  <textarea data-tracker-resume-draft="${escapeAttribute(job.id)}" aria-label="Tailored resume draft for ${escapeAttribute(job.title)} at ${escapeAttribute(job.company)}" rows="8" maxlength="${RESUME_TEXT_MAX_LENGTH}" placeholder="Paste the revised resume draft or bullets here after using your AI tool.">${escapeHtml(job.resumeDraft ?? "")}</textarea>
                </div>
              </div>
              <p class="resume-save-status" data-resume-save-status="${escapeAttribute(job.id)}" aria-live="polite">Resume fields save automatically.</p>
            </details>
          </article>
        `;
      })
      .join("")
      : `
        <div class="empty-state-guide tracker-empty-guide tracker-filter-empty">
          <div class="empty-state-icon text-icon" aria-hidden="true">Filter</div>
          <h3>No tracked jobs match</h3>
          <p>Adjust the search text or status filter to widen the tracker view.</p>
        </div>
      `}
  `;
}

function getFilteredTrackerJobs(jobs) {
  const query = (state.trackerFilters.query ?? "").trim().toLowerCase();
  const status = state.trackerFilters.status ?? "all";

  return jobs.filter((job) => {
    const matchesQuery =
      !query ||
      [job.title, job.company, job.location, job.provider, job.employmentType, job.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

    if (!matchesQuery) {
      return false;
    }

    if (status === "applied") {
      return Boolean(job.applied);
    }

    if (status === "not-applied") {
      return !job.applied;
    }

    if (status.startsWith("status:")) {
      return job.status === status.slice("status:".length);
    }

    return true;
  });
}

function hasActiveTrackerFilters() {
  return Boolean(
    (state.trackerFilters.query ?? "").trim() ||
    (state.trackerFilters.status ?? "all") !== "all"
  );
}

async function handleListingNavigation(event) {
  const viewShortcut = event.target.closest("[data-view-shortcut]");
  if (viewShortcut) {
    const view = viewShortcut.getAttribute("data-view-shortcut");
    switchView(view);
    focusViewTab(view);
    return;
  }

  const loadMore = event.target.closest("[data-listing-load-more]");
  if (loadMore) {
    state.listingVisibleLimit += LISTING_PAGE_SIZE;
    renderResults();
    const newLoadMore = elements.resultsList.querySelector("[data-listing-load-more]");
    if (newLoadMore instanceof HTMLElement) {
      newLoadMore.focus();
    }
    return;
  }

  const clearFilters = event.target.closest("[data-clear-listing-filters]");
  if (clearFilters) {
    state.listingFilters = {
      query: "",
      sort: "score",
      newOnly: false,
      source: "all"
    };
    renderResults();
    return;
  }

  const link = event.target.closest("[data-track-listing]");
  if (!link) {
    return;
  }

  event.preventDefault();

  const index = Number(link.getAttribute("data-track-listing"));
  const requestedAction = link.getAttribute("data-track-action");
  const trackOnly = requestedAction === "track-only";
  const action = requestedAction === "apply" ? "apply" : "open-listing";
  const listing = state.results?.listings?.[index];
  const destination = trackOnly ? "#" : safeExternalUrl(link.href);

  if (!listing) {
    return;
  }

  if (!trackOnly && destination === "#") {
    return;
  }

  const pendingKey = listingVisitKey(listing, requestedAction ?? action);
  if (state.pendingListingVisits.has(pendingKey)) {
    return;
  }

  state.pendingListingVisits.add(pendingKey);
  renderResults();

  try {
    await fetchJson("/api/tracker/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        listing: {
          provider: listing.provider,
          title: listing.title,
          company: listing.company,
          location: listing.location,
          employmentType: listing.employmentType,
          listingUrl: listing.listingUrl,
          applyUrl: listing.applyUrl,
          description: listing.description,
          score: listing.score,
          sourceRunAt: state.results?.generatedAt ?? null
        }
      })
    });
  } catch (error) {
    showTrackerError("Tracker save failed", error);
    state.pendingListingVisits.delete(pendingKey);
    renderResults();
    return;
  }

  try {
    state.tracker = await fetchJson("/api/tracker");
    broadcastTrackerSync("visit");
    clearStatusMessage();
    renderTracker();
  } catch (error) {
    showTrackerError("Tracker saved, but refresh failed", error);
  } finally {
    state.pendingListingVisits.delete(pendingKey);
    renderResults();
  }

  if (!trackOnly) {
    window.open(destination, "_blank", "noopener,noreferrer");
  }
}

async function handleTrackerChange(event) {
  const filterStatus = event.target.closest("[data-tracker-filter-status]");
  const checkbox = event.target.closest("[data-tracker-applied]");
  const status = event.target.closest("[data-tracker-status]");

  if (filterStatus) {
    state.trackerFilters.status = filterStatus.value;
    state.pendingTrackerRemoveId = null;
    renderTracker();
    return;
  }

  if (checkbox) {
    const id = checkbox.getAttribute("data-tracker-applied");
    if (!beginTrackerMutation("applied", id)) {
      return;
    }

    try {
      state.tracker = await fetchJson("/api/tracker/applied", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          applied: checkbox.checked
        })
      });
      broadcastTrackerSync("applied");
      clearStatusMessage();
    } catch (error) {
      showTrackerError("Tracker update failed", error);
    } finally {
      endTrackerMutation("applied", id);
      renderTracker();
    }
    return;
  }

  if (status) {
    const id = status.getAttribute("data-tracker-status");
    if (!beginTrackerMutation("status", id)) {
      return;
    }

    try {
      state.tracker = await fetchJson("/api/tracker/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          status: status.value
        })
      });
      broadcastTrackerSync("status");
      clearStatusMessage();
    } catch (error) {
      showTrackerError("Tracker status update failed", error);
    } finally {
      endTrackerMutation("status", id);
      renderTracker();
    }
  }
}

async function handleTrackerClick(event) {
  const clearFilters = event.target.closest("[data-clear-tracker-filters]");
  if (clearFilters) {
    state.trackerFilters = {
      query: "",
      status: "all"
    };
    state.pendingTrackerRemoveId = null;
    renderTracker();
    return;
  }

  const removeButton = event.target.closest("[data-tracker-remove]");
  if (removeButton) {
    state.pendingTrackerRemoveId = removeButton.getAttribute("data-tracker-remove");
    renderTracker();
    focusTrackerRemoveConfirmation(state.pendingTrackerRemoveId);
    return;
  }

  const cancelRemoveButton = event.target.closest("[data-tracker-cancel-remove]");
  if (cancelRemoveButton) {
    state.pendingTrackerRemoveId = null;
    renderTracker();
    return;
  }

  const confirmRemoveButton = event.target.closest("[data-tracker-confirm-remove]");
  if (confirmRemoveButton) {
    const id = confirmRemoveButton.getAttribute("data-tracker-confirm-remove");
    if (!beginTrackerMutation("remove", id)) {
      return;
    }

    cancelResumeSave(id);
    try {
      state.tracker = await fetchJson("/api/tracker/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id
        })
      });
      state.pendingTrackerRemoveId = null;
      broadcastTrackerSync("remove");
      clearStatusMessage();
    } catch (error) {
      showTrackerError("Tracker remove failed", error);
    } finally {
      endTrackerMutation("remove", id);
      renderTracker();
    }
    return;
  }

  const button = event.target.closest("[data-copy-resume-prompt]");
  if (!button) {
    return;
  }

  const job = state.tracker.find((entry) => entry.id === button.getAttribute("data-copy-resume-prompt"));
  if (!job) {
    return;
  }

  try {
    await navigator.clipboard.writeText(buildResumePromptWithLiveInputs(job));
    button.textContent = "Copied";
    clearStatusMessage();
    setTimeout(() => {
      button.textContent = "Copy AI Prompt";
    }, 1400);
  } catch (error) {
    button.textContent = "Copy AI Prompt";
    showTrackerError("Copy prompt failed", error);
  }
}

function handleTrackerInput(event) {
  const filterQuery = event.target.closest("[data-tracker-filter-query]");
  if (filterQuery) {
    const cursor = filterQuery.selectionStart ?? filterQuery.value.length;
    state.trackerFilters.query = filterQuery.value;
    state.pendingTrackerRemoveId = null;
    renderTracker();
    restoreInputFocus("[data-tracker-filter-query]", cursor);
    return;
  }

  const resumeSource = event.target.closest("[data-resume-source]");
  if (resumeSource) {
    clampTextareaValue(resumeSource, RESUME_TEXT_MAX_LENGTH);
    state.resumeSource = resumeSource.value;
    if (saveResumeSource(state.resumeSource)) {
      clearStatusMessage();
    } else {
      showStatusMessage("Resume source was not saved in this browser.", "error");
    }
    refreshVisibleResumePrompts();
    return;
  }

  const notes = event.target.closest("[data-tracker-resume-notes]");
  const draft = event.target.closest("[data-tracker-resume-draft]");
  const description = event.target.closest("[data-tracker-job-description]");
  if (!notes && !draft && !description) {
    return;
  }

  const target = notes ?? draft ?? description;
  clampTextareaValue(target, RESUME_TEXT_MAX_LENGTH);
  const attribute = notes
    ? "data-tracker-resume-notes"
    : draft
      ? "data-tracker-resume-draft"
      : "data-tracker-job-description";
  const id = target.getAttribute(attribute);
  refreshResumePromptPreview(id);
  queueResumeSave(id);
}

function restoreInputFocus(selector, cursor) {
  const input = document.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  input.focus();
  input.setSelectionRange(cursor, cursor);
}

const resumeSaveTimers = new Map();
const resumeSaveInFlight = new Set();
const resumeSavePending = new Set();

function trackerMutationKey(type, id) {
  return `${type}:${id}`;
}

function isTrackerMutationPending(type, id) {
  return Boolean(id && state.pendingTrackerMutations.has(trackerMutationKey(type, id)));
}

function beginTrackerMutation(type, id) {
  if (!id || isTrackerMutationPending(type, id)) {
    renderTracker();
    return false;
  }

  state.pendingTrackerMutations.add(trackerMutationKey(type, id));
  renderTracker();
  return true;
}

function endTrackerMutation(type, id) {
  if (!id) {
    return;
  }

  state.pendingTrackerMutations.delete(trackerMutationKey(type, id));
}

function cancelResumeSave(id) {
  if (!id || !resumeSaveTimers.has(id)) {
    resumeSavePending.delete(id);
    return;
  }

  clearTimeout(resumeSaveTimers.get(id));
  resumeSaveTimers.delete(id);
  resumeSavePending.delete(id);
}

function queueResumeSave(id, delay = 600) {
  if (!id) {
    return;
  }

  if (resumeSaveInFlight.has(id)) {
    resumeSavePending.add(id);
    return;
  }

  if (resumeSaveTimers.has(id)) {
    clearTimeout(resumeSaveTimers.get(id));
  }

  resumeSaveTimers.set(
    id,
    setTimeout(async () => {
      if (resumeSaveInFlight.has(id)) {
        resumeSaveTimers.delete(id);
        resumeSavePending.add(id);
        return;
      }

      resumeSaveInFlight.add(id);
      const notes = clampText(document.querySelector(`[data-tracker-resume-notes="${cssEscape(id)}"]`)?.value ?? "", RESUME_TEXT_MAX_LENGTH);
      const draft = clampText(document.querySelector(`[data-tracker-resume-draft="${cssEscape(id)}"]`)?.value ?? "", RESUME_TEXT_MAX_LENGTH);
      const jobDescriptionOverride = clampText(document.querySelector(`[data-tracker-job-description="${cssEscape(id)}"]`)?.value ?? "", RESUME_TEXT_MAX_LENGTH);
      setResumeSaveStatus(id, "Saving resume fields...", "pending");
      try {
        state.tracker = await fetchJson("/api/tracker/resume", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id,
            resumeNotes: notes,
            resumeDraft: draft,
            jobDescriptionOverride
          })
        });
        broadcastTrackerSync("resume");
        setResumeSaveStatus(id, "Resume fields saved.", "ok");
        clearStatusMessage();
      } catch (error) {
        setResumeSaveStatus(id, "Resume fields were not saved.", "error");
        showTrackerError("Tracker resume save failed", error);
      } finally {
        resumeSaveInFlight.delete(id);
        resumeSaveTimers.delete(id);
        if (resumeSavePending.has(id) && document.querySelector(`[data-tracker-resume-notes="${cssEscape(id)}"]`)) {
          resumeSavePending.delete(id);
          queueResumeSave(id, 0);
        }
      }
    }, delay)
  );
}

function setResumeSaveStatus(id, message, tone = "pending") {
  const status = document.querySelector(`[data-resume-save-status="${cssEscape(id)}"]`);
  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = `resume-save-status ${tone}`;
}

function clampTextareaValue(textarea, maxLength) {
  if (!textarea || textarea.value.length <= maxLength) {
    return;
  }

  const selectionStart = Math.min(textarea.selectionStart ?? maxLength, maxLength);
  const selectionEnd = Math.min(textarea.selectionEnd ?? selectionStart, maxLength);
  textarea.value = clampText(textarea.value, maxLength);
  textarea.setSelectionRange(selectionStart, selectionEnd);
}

function showTrackerError(prefix, error) {
  showStatusMessage(`${prefix}: ${formatErrorMessage(error)}`, "error");
}

function focusTrackerRemoveConfirmation(id) {
  if (!id) {
    return;
  }

  document.querySelector(`[data-tracker-confirm-remove="${cssEscape(id)}"]`)?.focus();
}

function focusSettingsRemoveConfirmation(type, index) {
  if (!type || !Number.isInteger(index)) {
    return;
  }

  document
    .querySelector(`[data-settings-confirm-remove="${cssEscape(type)}"][data-settings-remove-index="${index}"]`)
    ?.focus();
}

function refreshVisibleResumePrompts() {
  document.querySelectorAll("[data-resume-prompt-preview]").forEach((preview) => {
    refreshResumePromptPreview(preview.getAttribute("data-resume-prompt-preview"));
  });
}

function refreshResumePromptPreview(id) {
  if (!id) {
    return;
  }

  const job = state.tracker.find((entry) => entry.id === id);
  const preview = document.querySelector(`[data-resume-prompt-preview="${cssEscape(id)}"]`);
  if (!job || !preview) {
    return;
  }

  preview.value = buildResumePromptWithLiveInputs(job);
}

function buildResumePromptWithLiveInputs(job) {
  return buildResumePrompt({
    ...job,
    jobDescriptionOverride:
      document.querySelector(`[data-tracker-job-description="${cssEscape(job.id)}"]`)?.value ??
      job.jobDescriptionOverride,
    resumeNotes:
      document.querySelector(`[data-tracker-resume-notes="${cssEscape(job.id)}"]`)?.value ??
      job.resumeNotes
  });
}

async function previewCareersImport() {
  if (!state.config) {
    showStatusMessage("Board import is unavailable until configuration loads.", "error");
    return;
  }

  syncCareersImportFromDom();
  const urls = parseMultiline(state.careersImport.input);
  if (!urls.length) {
    state.careersImport.preview = { detected: [], duplicate: [], unknown: [] };
    renderCurrentStep();
    return;
  }

  state.careersImport.busy = true;
  renderCurrentStep();

  try {
    state.careersImport.preview = await fetchJson("/api/discover-boards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        urls,
        boards: state.config.boards
      })
    });
    clearStatusMessage();
  } catch (error) {
    state.careersImport.preview = null;
    showStatusMessage(`Board preview failed: ${formatErrorMessage(error)}`, "error");
  } finally {
    state.careersImport.busy = false;
    renderCurrentStep();
  }
}

function addCareersImportBoards() {
  const preview = state.careersImport.preview;
  if (!state.config || !preview?.detected?.length) {
    return;
  }

  syncConfigFromDom();
  const additions = preview.detected.map((entry) => ({
    provider: entry.provider,
    source: entry.source,
    includeDescription: false
  }));
  state.config.boards = dedupeBy(
    [...state.config.boards, ...additions],
    (board) => `${board.provider}:${board.source}`
  );
  state.careersImport.preview = null;
  state.careersImport.input = "";
  renderCurrentStep();
  renderReadinessCard();
  showStatusMessage(
    `Added ${additions.length} company board${additions.length === 1 ? "" : "s"} from careers URLs.`,
    "info"
  );
}

function syncCareersImportFromDom() {
  state.careersImport.input = readValue("[data-careers-url-input]", state.careersImport.input);
}

function handleStepClick(event) {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  if (target.hasAttribute("data-careers-preview")) {
    previewCareersImport().catch(() => { });
    return;
  }

  if (target.hasAttribute("data-careers-add")) {
    addCareersImportBoards();
    return;
  }

  if (target.id === "generateSetupButton") {
    syncQuickSetupFromDom();
    applyQuickSetup();
    renderAll();
    return;
  }

  if (target.id === "addSearchButtonInline") {
    syncConfigFromDom();
    state.config.searches.push({
      provider: "adzuna",
      query: "software engineer",
      location: "remote",
      page: 1,
      limit: 25
    });
    renderCurrentStep();
    return;
  }

  if (target.id === "addBoardButtonInline") {
    syncConfigFromDom();
    state.config.boards.push({
      provider: "greenhouse",
      source: "",
      includeDescription: false
    });
    renderCurrentStep();
    return;
  }

  if (target.id === "addAlertButtonInline") {
    syncConfigFromDom();
    state.config.alerts.push({
      id: `alert-${crypto.randomUUID().slice(0, 8)}`,
      name: "New high-score roles",
      enabled: true,
      minScore: 75,
      newOnly: true,
      keywords: [],
      providers: [],
      companies: [],
      browser: true
    });
    renderCurrentStep();
    renderReadinessCard();
    return;
  }

  if (target.hasAttribute("data-settings-remove")) {
    syncConfigFromDom();
    state.pendingSettingsRemove = {
      type: target.getAttribute("data-settings-remove"),
      index: Number(target.getAttribute("data-settings-remove-index"))
    };
    renderCurrentStep();
    focusSettingsRemoveConfirmation(state.pendingSettingsRemove.type, state.pendingSettingsRemove.index);
    return;
  }

  if (target.hasAttribute("data-settings-cancel-remove")) {
    state.pendingSettingsRemove = null;
    renderCurrentStep();
    return;
  }

  if (target.hasAttribute("data-settings-confirm-remove")) {
    syncConfigFromDom();
    const type = target.getAttribute("data-settings-confirm-remove");
    const index = Number(target.getAttribute("data-settings-remove-index"));
    if (type === "search") {
      state.config.searches.splice(index, 1);
    } else if (type === "board") {
      state.config.boards.splice(index, 1);
    } else if (type === "alert") {
      state.config.alerts.splice(index, 1);
    }
    state.pendingSettingsRemove = null;
    renderCurrentStep();
    renderReadinessCard();
  }
}

function handleStepChange(event) {
  const target = event.target;
  if (state.pendingSettingsRemove) {
    syncConfigFromDom();
    state.pendingSettingsRemove = null;
    renderCurrentStep();
    renderReadinessCard();
    return;
  }

  if (target.hasAttribute("data-board-provider")) {
    syncConfigFromDom();
    renderCurrentStep();
    return;
  }

  if (target.hasAttribute("data-quick-search-style")) {
    syncQuickSetupFromDom();
    return;
  }
}

function moveStep(direction) {
  setCurrentStep(state.currentStep + direction);
}

function setCurrentStep(nextIndex) {
  const boundedIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
  syncConfigFromDom();
  syncQuickSetupFromDom();
  state.pendingSettingsRemove = null;
  state.currentStep = boundedIndex;
  renderAll();
}

async function saveConfig() {
  if (!state.config) {
    showStatusMessage("Save unavailable until configuration loads. Check the workbench server and refresh.", "error");
    return false;
  }

  setSaveButtonBusy(true);

  try {
    syncConfigFromDom();
    syncQuickSetupFromDom();
    state.config = await fetchJson("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(state.config)
    });
    state.status = await fetchJson("/api/status");
    clearStatusMessage();
    renderAll();
    return true;
  } catch (error) {
    showStatusMessage(`Save failed: ${formatErrorMessage(error)}`, "error");
    throw error;
  } finally {
    setSaveButtonBusy(false);
  }
}

async function runSearch() {
  setRunButtonBusy(true, "saving");
  let statusPollTimer = null;

  try {
    try {
      const saved = await saveConfig();
      if (!saved) {
        return;
      }
    } catch {
      return;
    }

    setRunButtonBusy(true, "running");
    statusPollTimer = window.setInterval(async () => {
      try {
        state.status = await fetchJson("/api/status");
        setRunButtonBusy(true, "running");
      } catch {
        // Keep the in-flight search UI stable if a background status poll fails.
      }
    }, 800);

    state.results = await fetchJson("/api/run-search", {
      method: "POST"
    });
    state.lastSeenRunAt = state.results?.generatedAt ?? null;
    let statusRefreshError = null;
    try {
      state.status = await fetchJson("/api/status");
    } catch (error) {
      statusRefreshError = error;
    }

    switchView("dashboard");
    renderAll();
    const uniqueListings = state.results?.summary?.uniqueListings ?? state.results?.listings?.length ?? 0;
    const alertMatches = state.results?.summary?.alertMatches ?? state.results?.alerts?.length ?? 0;
    const providerErrors = state.results?.errors?.length ?? 0;
    const completionMessage = providerErrors
      ? `Search finished with ${uniqueListings} ranked listings, ${alertMatches} alert matches, and ${providerErrors} provider error${providerErrors === 1 ? "" : "s"}.`
      : `Search finished with ${uniqueListings} ranked listings and ${alertMatches} alert match${alertMatches === 1 ? "" : "es"}.`;

    if (statusRefreshError) {
      showStatusMessage(
        `Search completed, but status refresh failed: ${formatErrorMessage(statusRefreshError)} ${completionMessage}`,
        "error"
      );
    } else {
      showStatusMessage(completionMessage, "info");
    }
    notifyBrowserAlerts(state.results?.alerts ?? []);
  } catch (error) {
    const message = formatErrorMessage(error);
    if (/already in progress/i.test(message)) {
      showStatusMessage("A search is already running. Wait for it to finish, then try again.", "error");
    } else {
      showStatusMessage(`Search failed: ${message}`, "error");
    }
  } finally {
    if (statusPollTimer !== null) {
      window.clearInterval(statusPollTimer);
    }
    setRunButtonBusy(false);
  }
}

function showStatusMessage(message, tone = "info") {
  state.statusMessage = { message, tone };
  elements.appStatus.className = `app-status ${tone}`;
  elements.appStatus.setAttribute("role", tone === "error" ? "alert" : "status");
  elements.appStatus.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
  elements.appStatus.setAttribute("aria-atomic", "true");
  elements.appStatus.hidden = false;
  elements.appStatus.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="status-dismiss" type="button" data-dismiss-status aria-label="Dismiss status message">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </button>
  `;
}

function clearStatusMessage() {
  state.statusMessage = null;
  elements.appStatus.innerHTML = "";
  elements.appStatus.hidden = true;
  elements.appStatus.className = "app-status";
  elements.appStatus.setAttribute("role", "status");
  elements.appStatus.setAttribute("aria-live", "polite");
  elements.appStatus.setAttribute("aria-atomic", "true");
}

function setRunButtonBusy(running, phase = "idle") {
  elements.runButton.disabled = running;
  elements.runButton.setAttribute("aria-busy", String(running));

  const label = running
    ? phase === "saving"
      ? "Saving config…"
      : "Running search…"
    : "Run Search";
  const title = running
    ? phase === "saving"
      ? "Saving configuration before the search starts."
      : "Fetching listings from configured search APIs and company boards."
    : "Save configuration and run a fresh search.";

  elements.runButton.title = title;
  elements.runButton.setAttribute("aria-label", label);
  elements.runButton.innerHTML = running
    ? `
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2.5a6.5 6.5 0 1 1-5.63 9.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
        ${escapeHtml(label)}
      `
    : `
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M6.5 4.5L13 9L6.5 13.5V4.5Z" fill="currentColor" />
        </svg>
        Run Search
      `;
}

function setSaveButtonBusy(running) {
  elements.saveButton.disabled = running;
  elements.saveButton.setAttribute("aria-busy", String(running));
  elements.saveButton.innerHTML = running
    ? `
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2.5a6.5 6.5 0 1 1-5.63 9.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        </svg>
        Saving
      `
    : `
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4 2.75h8.25L15.25 5.75V15.25H4V2.75Z" stroke="currentColor" stroke-width="1.5"
            stroke-linejoin="round" />
          <path d="M6.25 2.75V7h5.5V2.75M6.25 15.25v-4.5h5.5v4.5" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round" />
        </svg>
        Save
      `;
}

function syncConfigFromDom() {
  if (!state.config) {
    return;
  }

  state.config.searches = state.config.searches.map((entry, index) => ({
    provider: readValue(`[data-search-provider="${index}"]`, entry.provider) || "adzuna",
    query: readValue(`[data-search-query="${index}"]`, entry.query) || "software engineer",
    location: readOptional(`[data-search-location="${index}"]`, entry.location),
    page: readInteger(`[data-search-page="${index}"]`, entry.page ?? 1, 1),
    limit: readInteger(`[data-search-limit="${index}"]`, entry.limit ?? 25, 1, 100)
  }));

  state.config.boards = state.config.boards.map((entry, index) => {
    const provider = readValue(`[data-board-provider="${index}"]`, entry.provider) || entry.provider;
    const base = {
      provider,
      source: readValue(`[data-board-source="${index}"]`, entry.source) || "",
      companyName: readOptional(`[data-board-company-name="${index}"]`, entry.companyName),
      includeDescription: readChecked(
        `[data-board-description="${index}"]`,
        entry.includeDescription ?? false
      )
    };

    if (provider === "lever") {
      return {
        ...base,
        provider: "lever",
        team: readOptional(`[data-board-team="${index}"]`, entry.team),
        location: readOptional(`[data-board-location="${index}"]`, entry.location),
        limit: readInteger(`[data-board-limit="${index}"]`, entry.limit ?? 50, 1, 100)
      };
    }

    if (provider === "workday") {
      return {
        ...base,
        provider: "workday",
        searchText: readOptional(`[data-board-search-text="${index}"]`, entry.searchText),
        limit: readInteger(`[data-board-limit="${index}"]`, entry.limit ?? 50, 1, 100),
        maxPages: readInteger(`[data-board-max-pages="${index}"]`, entry.maxPages ?? 5, 1, 20)
      };
    }

    if (provider === "smartrecruiters") {
      return {
        ...base,
        provider: "smartrecruiters",
        limit: readInteger(`[data-board-limit="${index}"]`, entry.limit ?? 100, 1, 100),
        maxPages: readInteger(`[data-board-max-pages="${index}"]`, entry.maxPages ?? 3, 1, 20)
      };
    }

    if (provider === "personio") {
      return {
        ...base,
        provider: "personio",
        language: readOptional(`[data-board-language="${index}"]`, entry.language ?? "en")
      };
    }

    if (provider === "icims-jibe") {
      return {
        ...base,
        provider: "icims-jibe",
        limit: readInteger(`[data-board-limit="${index}"]`, entry.limit ?? 25, 1, 100)
      };
    }

    if (provider === "icims-classic") {
      return {
        ...base,
        provider: "icims-classic",
        keyword: readOptional(`[data-board-keyword="${index}"]`, entry.keyword)
      };
    }

    if (provider === "oracle-ce") {
      return {
        ...base,
        provider: "oracle-ce",
        keyword: readOptional(`[data-board-keyword="${index}"]`, entry.keyword),
        limit: readInteger(`[data-board-limit="${index}"]`, entry.limit ?? 25, 1, 100)
      };
    }

    if (provider === "taleo") {
      return {
        ...base,
        provider: "taleo",
        keyword: readOptional(`[data-board-keyword="${index}"]`, entry.keyword),
        lang: readOptional(`[data-board-language="${index}"]`, entry.lang ?? "en")
      };
    }

    return base;
  });

  state.config.filters = {
    includeKeywords: parseCsv(
      readValue("[data-filter-include-keywords]", csv(state.config.filters.includeKeywords))
    ),
    excludeKeywords: parseCsv(
      readValue("[data-filter-exclude-keywords]", csv(state.config.filters.excludeKeywords))
    ),
    includeCompanies: parseCsv(
      readValue("[data-filter-include-companies]", csv(state.config.filters.includeCompanies))
    ),
    excludeCompanies: parseCsv(
      readValue("[data-filter-exclude-companies]", csv(state.config.filters.excludeCompanies))
    ),
    includeLocations: parseCsv(
      readValue("[data-filter-include-locations]", csv(state.config.filters.includeLocations))
    ),
    excludeLocations: parseCsv(
      readValue("[data-filter-exclude-locations]", csv(state.config.filters.excludeLocations))
    ),
    remoteOnly: readChecked("[data-filter-remote-only]", state.config.filters.remoteOnly),
    workplaceTypes: parseCsv(
      readValue("[data-filter-workplace-types]", csv(state.config.filters.workplaceTypes))
    ),
    employmentTypes: parseCsv(
      readValue("[data-filter-employment-types]", csv(state.config.filters.employmentTypes))
    ),
    minSalary: readOptionalNumber("[data-filter-min-salary]", state.config.filters.minSalary),
    maxSalary: readOptionalNumber("[data-filter-max-salary]", state.config.filters.maxSalary),
    maxAgeDays: readOptionalNumber(
      "[data-filter-max-age-days]",
      state.config.filters.maxAgeDays
    ),
    onlyWithApplyUrl: readChecked(
      "[data-filter-apply-only]",
      state.config.filters.onlyWithApplyUrl
    ),
    preferredProviders: parseProviderCsv(
      readValue(
        "[data-filter-preferred-providers]",
        csv(state.config.filters.preferredProviders)
      )
    )
  };

  state.config.ranking = {
    preferCompanyBoards: readChecked(
      "[data-ranking-prefer-company-boards]",
      state.config.ranking.preferCompanyBoards
    ),
    remoteBoost: readInteger("[data-ranking-remote-boost]", state.config.ranking.remoteBoost, 0, 30),
    freshnessBoost: readInteger(
      "[data-ranking-freshness-boost]",
      state.config.ranking.freshnessBoost,
      0,
      30
    ),
    compensationBoost: readInteger(
      "[data-ranking-compensation-boost]",
      state.config.ranking.compensationBoost,
      0,
      30
    ),
    keywordBoost: readInteger("[data-ranking-keyword-boost]", state.config.ranking.keywordBoost, 0, 30),
    titleBoosts: parseCsv(
      readValue("[data-ranking-title-boosts]", csv(state.config.ranking.titleBoosts))
    ),
    companyBoosts: parseCsv(
      readValue("[data-ranking-company-boosts]", csv(state.config.ranking.companyBoosts))
    ),
    locationBoosts: parseCsv(
      readValue("[data-ranking-location-boosts]", csv(state.config.ranking.locationBoosts))
    ),
    skillKeywords: parseCsv(
      readValue("[data-ranking-skill-keywords]", csv(state.config.ranking.skillKeywords))
    )
  };

  state.config.alerts = state.config.alerts.map((alert, index) => ({
    id: readValue(`[data-alert-id="${index}"]`, alert.id) || `alert-${index + 1}`,
    name: readValue(`[data-alert-name="${index}"]`, alert.name) || `Alert ${index + 1}`,
    enabled: readChecked(`[data-alert-enabled="${index}"]`, alert.enabled),
    minScore: readInteger(`[data-alert-min-score="${index}"]`, alert.minScore, 0, 100),
    newOnly: readChecked(`[data-alert-new-only="${index}"]`, alert.newOnly),
    keywords: parseCsv(readValue(`[data-alert-keywords="${index}"]`, csv(alert.keywords))),
    providers: parseProviderCsv(
      readValue(`[data-alert-providers="${index}"]`, csv(alert.providers))
    ),
    companies: parseCsv(
      readValue(`[data-alert-companies="${index}"]`, csv(alert.companies))
    ),
    browser: readChecked(`[data-alert-browser="${index}"]`, alert.browser),
    webhookUrl: readOptionalHttpUrl(`[data-alert-webhook="${index}"]`, alert.webhookUrl)
  }));

  state.config.schedule = {
    enabled: readChecked("[data-schedule-enabled]", state.config.schedule.enabled),
    intervalMinutes: readInteger(
      "[data-schedule-interval]",
      state.config.schedule.intervalMinutes,
      5,
      7 * 24 * 60
    ),
    timezone: readTimezone("[data-schedule-timezone]", state.config.schedule.timezone),
    quietHoursStart: readOptionalTime(
      "[data-schedule-quiet-start]",
      state.config.schedule.quietHoursStart
    ),
    quietHoursEnd: readOptionalTime(
      "[data-schedule-quiet-end]",
      state.config.schedule.quietHoursEnd
    )
  };
}

function syncQuickSetupFromDom() {
  if (!state.quickSetup) {
    return;
  }

  state.quickSetup = {
    targetRoles: readValue("[data-quick-target-roles]", state.quickSetup.targetRoles),
    skillKeywords: readValue("[data-quick-skills]", state.quickSetup.skillKeywords),
    locations: readValue("[data-quick-locations]", state.quickSetup.locations),
    searchStyle: readValue("[data-quick-search-style]", state.quickSetup.searchStyle),
    remoteOnly: readChecked("[data-quick-remote-only]", state.quickSetup.remoteOnly),
    enableAlerts: readChecked(
      "[data-quick-enable-alerts]",
      state.quickSetup.enableAlerts
    ),
    interval: readValue("[data-quick-interval]", state.quickSetup.interval),
    companyInput: readValue("[data-quick-company-input]", state.quickSetup.companyInput)
  };

  saveQuickSetup(state.quickSetup);
}

function applyQuickSetup() {
  const quick = state.quickSetup;
  const roleTerms = parseLinesOrCsv(quick.targetRoles);
  const skills = parseLinesOrCsv(quick.skillKeywords);
  const locations = parseLinesOrCsv(quick.locations);
  const companyLines = parseMultiline(quick.companyInput);
  const parsedBoards = companyLines
    .map(parseCompanyInputLine)
    .filter(Boolean);
  const unresolvedCompanies = companyLines.filter((line) => !looksLikeUrl(line));
  const primaryRole = roleTerms[0] ?? "software engineer";

  const searches = [];
  if (quick.searchStyle === "balanced" || quick.searchStyle === "broad") {
    searches.push({
      provider: "adzuna",
      query: primaryRole,
      location: quick.remoteOnly ? "remote" : locations[0] ?? "United States",
      page: 1,
      limit: 25
    });
    searches.push({
      provider: "jooble",
      query: primaryRole,
      location: quick.remoteOnly ? "remote" : locations[0] ?? "United States",
      page: 1,
      limit: 25
    });
  }

  const boards = dedupeBy(
    parsedBoards.map((board) => ({
      ...board,
      includeDescription: false
    })),
    (item) => `${item.provider}:${item.source}`
  );

  state.config.searches = searches;
  state.config.boards = boards;
  state.config.filters = {
    ...state.config.filters,
    includeKeywords: dedupeArray([...roleTerms, ...skills.slice(0, 4)]),
    excludeKeywords: dedupeArray(["intern"]),
    includeCompanies: dedupeArray(unresolvedCompanies),
    excludeCompanies: [],
    includeLocations: locations,
    excludeLocations: [],
    remoteOnly: quick.remoteOnly,
    workplaceTypes: quick.remoteOnly ? ["remote"] : [],
    employmentTypes: ["fulltime"],
    minSalary: state.config.filters.minSalary,
    maxSalary: state.config.filters.maxSalary,
    maxAgeDays: 21,
    onlyWithApplyUrl: true,
    preferredProviders:
      quick.searchStyle === "companies-only"
        ? BOARD_PROVIDERS
        : []
  };
  state.config.ranking = {
    ...state.config.ranking,
    preferCompanyBoards: true,
    remoteBoost: quick.remoteOnly ? 14 : 8,
    freshnessBoost: 12,
    compensationBoost: 8,
    keywordBoost: 14,
    titleBoosts: dedupeArray(roleTerms),
    companyBoosts: dedupeArray(unresolvedCompanies),
    locationBoosts: dedupeArray(locations),
    skillKeywords: dedupeArray(skills)
  };
  state.config.alerts = quick.enableAlerts
    ? [
      {
        id: "recommended-alert",
        name: `${capitalizeWords(primaryRole)} matches`,
        enabled: true,
        minScore: 75,
        newOnly: true,
        keywords: dedupeArray([...roleTerms.slice(0, 2), ...skills.slice(0, 2)]),
        providers: [],
        companies: dedupeArray(unresolvedCompanies),
        browser: true
      }
    ]
    : [];
  state.config.schedule = {
    ...state.config.schedule,
    enabled: quick.interval !== "manual",
    intervalMinutes: quick.interval === "manual" ? 60 : Number(quick.interval),
    timezone: state.config.schedule.timezone || "America/Phoenix",
    quietHoursStart: state.config.schedule.quietHoursStart,
    quietHoursEnd: state.config.schedule.quietHoursEnd
  };
}

function getStepCompletion() {
  const filters = state.config.filters;
  const ranking = state.config.ranking;

  return [
    Boolean(parseLinesOrCsv(state.quickSetup?.targetRoles ?? "").length),
    state.config.searches.length > 0,
    state.config.boards.length > 0,
    Boolean(
      filters.remoteOnly ||
      filters.includeKeywords.length ||
      filters.excludeKeywords.length ||
      filters.includeLocations.length ||
      filters.excludeLocations.length
    ),
    Boolean(
      ranking.titleBoosts.length ||
      ranking.companyBoosts.length ||
      ranking.locationBoosts.length ||
      ranking.skillKeywords.length
    ),
    Boolean(state.config.alerts.length || state.config.schedule.enabled),
    Boolean(state.results?.generatedAt)
  ];
}

function buildSummary() {
  return {
    searchCount: state.config.searches.length,
    boardCount: state.config.boards.length,
    alertCount: state.config.alerts.length,
    includeKeywordCount: state.config.filters.includeKeywords.length,
    excludeKeywordCount: state.config.filters.excludeKeywords.length
  };
}

async function requestNotificationPermission() {
  if (typeof window.Notification !== "function") {
    showStatusMessage("Browser alerts are not supported in this browser.", "error");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    renderNotificationPermissionButton(permission);
    showStatusMessage(
      permission === "granted" ? "Browser alerts enabled." : "Browser alert permission was not granted.",
      permission === "granted" ? "info" : "error"
    );
  } catch (error) {
    showStatusMessage(`Browser alert permission failed: ${formatErrorMessage(error)}`, "error");
  }
}

function renderNotificationPermissionButton(permission = getNotificationPermission()) {
  const label = permission === "granted" ? "Browser Alerts Enabled" : "Enable Browser Alerts";
  elements.notifyPermissionButton.innerHTML = `
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M5 7.5a4 4 0 0 1 8 0v3l1.25 2H3.75L5 10.5v-3Z" stroke="currentColor" stroke-width="1.5"
        stroke-linejoin="round" />
      <path d="M7.5 14.25a1.75 1.75 0 0 0 3 0" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" />
    </svg>
    ${label}
  `;
}

function getNotificationPermission() {
  return typeof window.Notification === "function" ? Notification.permission : "unsupported";
}

function notifyBrowserAlerts(alerts) {
  if (typeof window.Notification !== "function" || Notification.permission !== "granted") {
    return;
  }

  alerts.filter((alert) => alert.browser).forEach((alert) => {
    const firstMatch = alert.listings?.[0];
    try {
      new Notification(alert.name, {
        body: firstMatch
          ? `${firstMatch.title} at ${firstMatch.company} scored ${firstMatch.score}`
          : `${alert.count} listings matched`
      });
    } catch (error) {
      showStatusMessage(`Browser alert failed: ${formatErrorMessage(error)}`, "error");
    }
  });
}

function field(label, control, hint = "", span2 = false) {
  return `
    <div class="field ${span2 ? "span-2" : ""}">
      <label>${label}</label>
      ${labelFirstControl(label, control)}
      ${hint ? `<p class="field-hint">${hint}</p>` : ""}
    </div>
  `;
}

function labelFirstControl(label, control) {
  const openingControl = /<(input|select|textarea)\b(?![^>]*\baria-label=)(?![^>]*\baria-labelledby=)/i;
  return control.replace(openingControl, `<$1 aria-label="${escapeAttribute(label)}"`);
}

function providerSelect(selected, values, attributes = "") {
  return `
    <select ${attributes}>
      ${values
      .map(
        (value) =>
          `<option value="${value}" ${selected === value ? "selected" : ""}>${capitalize(value)}</option>`
      )
      .join("")}
    </select>
  `;
}

function quickSelectOption(value, selected, label) {
  return `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`;
}

function readValue(selector, fallback = "") {
  const element = document.querySelector(selector);
  return element ? element.value.trim() : fallback ?? "";
}

function readOptional(selector, fallback) {
  const value = readValue(selector, fallback ?? "");
  return value || undefined;
}

function readOptionalTime(selector, fallback) {
  const value = readValue(selector, fallback ?? "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

function readOptionalHttpUrl(selector, fallback) {
  const value = readValue(selector, fallback ?? "");
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !isLocalOrPrivateHost(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function isLocalOrPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  const ipv4 = parseIpv4Address(host);
  if (ipv4) {
    return isPrivateIpv4Address(ipv4);
  }

  return isPrivateIpv6Address(host);
}

function parseIpv4Address(host) {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  return octets.every(
    (octet, index) =>
      Number.isInteger(octet) &&
      octet >= 0 &&
      octet <= 255 &&
      String(octet) === parts[index]
  )
    ? octets
    : null;
}

function isPrivateIpv4Address([first, second]) {
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIpv6Address(host) {
  if (!host.includes(":")) {
    return false;
  }

  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  );
}

function readTimezone(selector, fallback = "America/Phoenix") {
  const value = readValue(selector, fallback).trim();
  if (!value) {
    return fallback;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}

function readInteger(selector, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
  const element = document.querySelector(selector);
  if (!element) {
    return fallback;
  }

  const value = Number(element.value.trim());
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function readOptionalNumber(selector, fallback) {
  const element = document.querySelector(selector);
  if (!element) {
    return fallback;
  }

  const value = Number(element.value.trim());
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readChecked(selector, fallback = false) {
  const element = document.querySelector(selector);
  return element ? Boolean(element.checked) : fallback;
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseProviderCsv(value) {
  return dedupeArray(
    parseCsv(value)
      .map((item) => item.toLowerCase())
      .filter((item) => KNOWN_PROVIDER_SET.has(item))
  );
}

function parseMultiline(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLinesOrCsv(value) {
  return dedupeArray(
    value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function csv(values = []) {
  return values.join(", ");
}

function dedupeArray(values) {
  return [...new Set(values)];
}

function dedupeBy(values, keyFn) {
  const seen = new Map();
  values.forEach((value) => {
    seen.set(keyFn(value), value);
  });
  return [...seen.values()];
}

function loadQuickSetup(config) {
  try {
    const saved = JSON.parse(localStorage.getItem("jobWorkbenchQuickSetup") ?? "null");
    if (saved) {
      return saved;
    }
  } catch { }

  return {
    targetRoles: csv(config?.ranking?.titleBoosts?.length ? config.ranking.titleBoosts : config?.filters?.includeKeywords?.slice(0, 3) ?? []),
    skillKeywords: csv(config?.ranking?.skillKeywords ?? []),
    locations: csv(config?.filters?.includeLocations ?? []),
    searchStyle: config?.searches?.length && config?.boards?.length
      ? "balanced"
      : config?.boards?.length
        ? "companies-only"
        : "broad",
    remoteOnly: Boolean(config?.filters?.remoteOnly),
    enableAlerts: Boolean(config?.alerts?.length),
    interval: config?.schedule?.enabled ? String(config.schedule.intervalMinutes) : "manual",
    companyInput: ""
  };
}

function saveQuickSetup(quickSetup) {
  try {
    localStorage.setItem("jobWorkbenchQuickSetup", JSON.stringify(quickSetup));
  } catch { }
}

function loadResumeSource() {
  try {
    return localStorage.getItem(RESUME_SOURCE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveResumeSource(value) {
  try {
    localStorage.setItem(RESUME_SOURCE_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function parseCompanyInputLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  if (!looksLikeUrl(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);

    if (host.includes("greenhouse.io")) {
      const source = parts[0];
      return source ? { provider: "greenhouse", source } : null;
    }

    if (host === "jobs.lever.co" || host.includes("lever.co")) {
      const source = parts[0];
      return source ? { provider: "lever", source } : null;
    }

    if (host.includes("ashbyhq.com")) {
      const source = parts[0];
      return source ? { provider: "ashby", source } : null;
    }

    if (host === "apply.workable.com") {
      const source = parts[0];
      return source ? { provider: "workable", source } : null;
    }

    if (host.endsWith(".workable.com")) {
      const source = host.split(".")[0];
      return source ? { provider: "workable", source } : null;
    }

    if (host.endsWith(".myworkdayjobs.com")) {
      const source = parseWorkdaySourceFromUrl(url);
      return source ? { provider: "workday", source } : null;
    }

    if (host === "careers.smartrecruiters.com") {
      const source = parts[0];
      return source ? { provider: "smartrecruiters", source } : null;
    }

    if (host.endsWith(".recruitee.com")) {
      const source = host.split(".")[0];
      return source ? { provider: "recruitee", source } : null;
    }

    if (/\.jobs\.personio\.[a-z.]+$/i.test(host)) {
      return { provider: "personio", source: host };
    }

    if (host.endsWith(".bamboohr.com")) {
      const source = host.split(".")[0];
      return source ? { provider: "bamboohr", source } : null;
    }

    if (host.includes("icims.com")) {
      return {
        provider: url.pathname.includes("/jobs/search") || /\/jobs\/\d+\//.test(url.pathname)
          ? "icims-classic"
          : "icims-jibe",
        source: host
      };
    }

    if (url.pathname.includes("/hcmUI/CandidateExperience/") || host.includes("oraclecloud.com")) {
      const siteIndex = parts.findIndex((part) => part === "sites");
      const site = siteIndex >= 0 && parts[siteIndex + 1] ? parts[siteIndex + 1] : parts[0] ?? "jobsearch";
      return { provider: "oracle-ce", source: `${host}/${site}` };
    }

    if (host.endsWith(".taleo.net") || url.pathname.includes("/careersection/")) {
      const sectionIndex = parts.findIndex((part) => part === "careersection");
      const source = sectionIndex >= 0 && parts[sectionIndex + 1]
        ? `${host}/${parts[sectionIndex + 1]}`
        : parts[0]
          ? `${host}/${parts[0]}`
          : null;
      return source ? { provider: "taleo", source } : null;
    }
  } catch {
    return null;
  }

  return null;
}

function parseWorkdaySourceFromUrl(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const cxsIndex = parts.findIndex((part) => part === "cxs");
  if (cxsIndex >= 0 && parts[cxsIndex + 1] && parts[cxsIndex + 2]) {
    return `${url.hostname}/${parts[cxsIndex + 1]}/${parts[cxsIndex + 2]}`;
  }

  const localeIndex = parts.findIndex((part) => /^[a-z]{2}-[A-Z]{2}$/.test(part));
  const board = localeIndex >= 0 ? parts[localeIndex + 1] : parts[0];
  return board ? `${url.hostname}/${url.hostname.split(".")[0]}/${board}` : null;
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value);
}

function capitalizeWords(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "Date unknown";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unknown" : date.toLocaleDateString();
}

function summarizeDescription(value) {
  if (!value) {
    return "";
  }

  const text = cleanJobDescription(value);
  const summary = text.length > 520 ? `${text.slice(0, 520).trim()}...` : text;
  return escapeHtml(summary);
}

function buildResumePrompt(job) {
  const resumeText = (state.resumeSource || "").trim() || "[Paste my current resume here before editing.]";
  const description = getPromptJobDescription(job) || "[No job description was captured. Use the title, company, and listing URL.]";
  const notes = (job.resumeNotes || "").trim() || "[No additional notes yet.]";

  return `You are an expert resume editor optimizing for ATS matching and recruiter readability.

Goal:
Tailor my resume for this job while staying strictly truthful. Do not invent employers, dates, degrees, tools, metrics, clearances, citizenship, sponsorship status, publications, or project outcomes.

Candidate background to preserve:
- Master's student at Arizona State University in Robotics and Autonomous Systems with an AI concentration.
- Completed undergraduate degree in Computer Science at ASU.
- Strong software background.
- Targeting robotics software, robotics systems, autonomous systems, automation, controls, PLC programming, industrial automation, and robotics integration.
- International student prioritizing OPT/STEM OPT compatible roles and employers open to sponsorship or E-Verify.

Target job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not provided"}
- URL: ${job.listingUrl}

Job description:
${description}

Current resume:
${resumeText}

My tailoring notes:
${notes}

Instructions:
1. Identify the highest-value keywords and requirements from the job description.
2. Compare them with my resume and list missing or weakly represented keywords.
3. Rewrite the resume for this role with stronger ATS alignment, especially around robotics, autonomy, ROS/ROS2, Python, C++, Linux, controls, PLC, industrial automation, computer vision, SLAM, localization, motion planning, sensors, actuators, and PID control when relevant.
4. Keep the resume concise, truthful, and accomplishment-oriented.
5. Preserve facts and avoid overclaiming PLC depth. Phrase basic PLC experience honestly.
6. Return:
   - ATS keyword gap analysis
   - tailored professional summary
   - revised skills section
   - revised project/experience bullets
   - final tailored resume draft
   - a short list of edits I should verify manually before applying`;
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function clampText(value, maxLength) {
  return String(value ?? "").slice(0, maxLength);
}

function getPromptJobDescription(job) {
  return cleanJobDescription(job.jobDescriptionOverride || job.description || "");
}

function cleanJobDescription(value) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\.\.\.\s*/g, "\n...\n")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value);
  return textarea.value;
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "#";
  } catch {
    return "#";
  }
}

function isSafeExternalUrl(value) {
  return safeExternalUrl(value) !== "#";
}

function renderSafeExternalLink(url, label) {
  if (!isSafeExternalUrl(url) || isBlockedJobActionUrl(url)) {
    return "";
  }

  return `<a href="${escapeAttribute(safeExternalUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderListingActionLink(listing, label, index, action) {
  const url = action === "apply" ? listing.applyUrl : listing.listingUrl;
  if (!isSafeExternalUrl(url) || isBlockedListingAction(listing, url)) {
    return "";
  }

  const pending = state.pendingListingVisits.has(listingVisitKey(listing, action));
  const actionClass =
    action === "apply" ? "listing-action listing-action--primary" : "listing-action";
  const pendingAttributes = pending
    ? ' aria-disabled="true" aria-busy="true" tabindex="-1"'
    : "";
  return `<a class="${actionClass}${pending ? " is-busy" : ""}" href="${escapeAttribute(safeExternalUrl(url))}" target="_blank" rel="noopener noreferrer" data-track-listing="${index}" data-track-action="${action}"${pendingAttributes}>${pending ? "Saving..." : label}</a>`;
}

function renderTrackOnlyAction(listing, index, trackedJob) {
  if (!isJoobleListing(listing)) {
    return "";
  }

  if (trackedJob) {
    return `<button class="listing-action" type="button" disabled aria-disabled="true">In tracker</button>`;
  }

  const pending = state.pendingListingVisits.has(listingVisitKey(listing, "track-only"));
  const pendingAttributes = pending ? ' disabled aria-disabled="true" aria-busy="true"' : "";
  return `<button class="listing-action${pending ? " is-busy" : ""}" type="button" data-track-listing="${index}" data-track-action="track-only"${pendingAttributes}>${pending ? "Saving..." : "Add to tracker"}</button>`;
}

function renderDirectSourceAction(listing, index) {
  if (!isJoobleListing(listing)) {
    return "";
  }

  const match = findDirectSourceMatch(listing, index);
  if (match) {
    const action = match.listing.applyUrl ? "apply" : "open-listing";
    const label = match.listing.applyUrl ? "Apply direct match" : "Open direct match";
    return renderListingActionLink(match.listing, label, match.index, action);
  }

  return `<a class="listing-action" href="${escapeAttribute(buildDirectSourceSearchUrl(listing))}" target="_blank" rel="noopener noreferrer">Find direct source</a>`;
}

function findDirectSourceMatch(listing, listingIndex) {
  const company = normalizeDirectSourceText(listing.company);
  const title = normalizeDirectSourceText(listing.title);
  if (!company || !title) {
    return null;
  }

  return (state.results?.listings ?? [])
    .map((candidate, index) => ({ listing: candidate, index }))
    .filter((candidate) => candidate.index !== listingIndex)
    .filter((candidate) => !isJoobleListing(candidate.listing))
    .filter((candidate) => isSafeDirectSourceListing(candidate.listing))
    .filter((candidate) =>
      normalizeDirectSourceText(candidate.listing.company) === company &&
      titlesAreCompatible(title, normalizeDirectSourceText(candidate.listing.title))
    )
    .sort((left, right) => directSourceScore(right.listing) - directSourceScore(left.listing))[0] ?? null;
}

function isSafeDirectSourceListing(listing) {
  const url = listing.applyUrl || listing.listingUrl;
  return isSafeExternalUrl(url) && !isBlockedJobActionUrl(url);
}

function directSourceScore(listing) {
  return [
    listing.providerKind === "company-board" ? 4 : 0,
    listing.provider !== "adzuna" ? 2 : 0,
    listing.applyUrl ? 1 : 0
  ].reduce((total, value) => total + value, 0);
}

function buildDirectSourceSearchUrl(listing) {
  const query = [listing.company, listing.title, "careers application"]
    .filter(Boolean)
    .map(stripBlockedSearchTerms)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query || "company careers application")}`;
}

function stripBlockedSearchTerms(value) {
  return String(value).replace(/\b(?:jooble|jobleads)\b/gi, "").trim();
}

function normalizeDirectSourceText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(?:senior|sr|junior|jr|i|ii|iii|iv)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titlesAreCompatible(left, right) {
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function listingVisitKey(listing, action) {
  const destination = action === "apply" ? listing.applyUrl : listing.listingUrl;
  return [action, listing.provider, listing.company, listing.title, destination ?? listing.listingUrl].join("::");
}

function isBlockedListingAction(listing, url) {
  return isJoobleListing(listing) || isBlockedJobActionUrl(url);
}

function isJoobleListing(listing) {
  return listing?.provider === "jooble" || listing?.source === "jooble-search";
}

function isBlockedJobActionUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(String(value));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "jobleads.com" ||
      hostname.endsWith(".jobleads.com") ||
      hostname === "jooble.org" ||
      hostname.endsWith(".jooble.org");
  } catch {
    return String(value).toLowerCase().includes("jobleads.com") ||
      String(value).toLowerCase().includes("jooble.org");
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseErrorBody(body) || `HTTP ${response.status}`);
  }

  return response.json();
}

function parseErrorBody(body) {
  if (!body) {
    return "";
  }

  try {
    const parsed = JSON.parse(body);
    return parsed?.error ? String(parsed.error) : body;
  } catch {
    return body;
  }
}

function formatErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

init().catch((error) => {
  showStatusMessage(`Workbench failed to load: ${formatErrorMessage(error)}`, "error");
});
