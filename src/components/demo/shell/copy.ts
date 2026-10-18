// Copy of the /demo shell and frame (plan §6.2, §6.5): the site bar, the sidebar, the header, the
// live region, the view frame and the shared service page frame. Plain words only (W1, W5);
// scripts/check-copy.mjs scans every literal here. The engine's shared copy (cast, services,
// verdict, layer pages, route titles) stays in copy/core.ts; this file holds what only the shell says.
// Mirrors the real dashboard's wording (os/40-interface/ui/src/app/*, views/services/index.tsx).

export const SHELL_COPY = {
  /** The page <title> part (the root layout's template appends " · 111 Network"). */
  pageTitle: "Live demo",
  /** Meta description and share text (plan §6.7 band line). */
  pageDescription: "An interactive copy of the node dashboard, with every layer in it. Sample data, and nothing leaves the page.",
  noscript: "This live demo needs script to run. The rest of the site works without it.",

  site: {
    logo: "111.network",
    logoLabel: "111.network, back to the home page",
    install: "INSTALL",
    github: "111 Network on GitHub",
  },

  skip: "Skip to content",

  /** Inside the Layer 4 window on the home page: the shell is a region of that page, not a page. */
  embedded: {
    region: "Dashboard demo",
  },

  /** Sidebar (real app/Sidebar.tsx). */
  nav: {
    landmark: "Main",
    /** The sidebar's nav label inside the L4 window (the home page already has its own main navigation). */
    landmarkEmbedded: "Dashboard",
    pages: "Pages",
    services: "services",
    servicesList: "Services",
    unavailable: (n: number): string => `Not available on this device (${n})`,
    unavailableList: "Not available on this device",
    settings: "Settings",
    /** The Messages row's count: unread messages + open requests. */
    newMessages: (n: number): string => (n === 1 ? "1 new" : `${n} new`),
    more: "v more",
    moreRail: "v",
  },
  drawer: {
    label: "Menu",
    caption: "menu",
    close: "CLOSE",
    open: "MENU",
  },
  node: {
    caption: "controlling this node",
    railTitle: (name: string, state: string): string => `${name}: ${state}, controlling this node`,
    health: (name: string): string => `${name} health`,
  },
  mode: {
    group: "Interface mode",
    simple: "SIMPLE",
    advanced: "ADVANCED",
    badge: "ADV",
    railSimple: "SIM",
    railLabel: "Advanced mode",
    railOn: "Advanced mode on. Switch to simple.",
    railOff: "Simple mode. Switch to advanced.",
  },
  rail: {
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    collapseWord: "collapse",
  },

  /** Main area (real routes.tsx). */
  view: {
    loading: "Loading view",
    notFound: {
      kicker: "404",
      title: "No such view",
      body: "This address does not match any page of the dashboard.",
      action: "Go to Overview",
    },
    failed: {
      kicker: "ERROR",
      title: "This view could not open",
      body: "Something went wrong while opening it. The rest of the dashboard still works.",
      action: "Go to Overview",
    },
    placeholder: "This view is still being filled in.",
  },

  /** The one polite live region (real app/LiveRegion.tsx). */
  announce: {
    view: (title: string): string => `Opened ${title}.`,
  },

  /** The shared service page frame (real views/services/index.tsx + model.ts). */
  service: {
    kicker: "service",
    layerTag: (title: string): string => `Open the settings page of ${title}`,
    setup: "setup",
    setupHeading: "Setup",
    needs: "Needs",
    handoffNote: "This opens the agent with a prepared message. Nothing is sent until you send it.",
    noSetup: "There is no setup step for this one. It turns live by itself once the condition above is met.",
    starting: "It was started a moment ago and is not answering its health check yet.",
    recipe: "Read the recipe",
    unavailable: {
      kicker: "not available on this device",
      title: "This device cannot run it",
      needs: (requires: string): string => `It needs: ${requires}`,
      fallback: "It needs hardware or software this device does not have.",
    },
    /** The prepared prompts (real lib/prompts.ts goalSentence "setup" / "fix"). */
    setupPrompt: (noun: string): string => `Set up the ${noun} on this node and test it.`,
    fixPrompt: (noun: string): string => `Fix the ${noun} on this node.`,
    noSuch: {
      kicker: "404",
      title: "No such service",
      body: (id: string): string => `This node does not have a service called “${id}”.`,
      action: "Back to Overview",
    },
  },
} as const
