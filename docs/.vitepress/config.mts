import { defineConfig, type DefaultTheme } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ELECTROS_SITE = 'https://www.electros.cloud'
const DOWNLOAD = 'https://elemento.cloud/electros.html#download'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.resolve(__dirname, '..')

/** Match VitePress / markdown-it-anchor default heading ids. */
function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function h2Sections(guideDir: string, fileName: string): { text: string; slug: string }[] {
  const filePath = path.join(guideDir, fileName)
  if (!fs.existsSync(filePath)) {
    return []
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const sections: { text: string; slug: string }[] = []
  for (const line of lines) {
    const match = /^##\s+(.+)$/.exec(line)
    if (!match) {
      continue
    }
    const text = match[1].trim()
    sections.push({ text, slug: slugify(text) })
  }
  return sections
}

type LocaleUi = {
  overview: string
  userGuide: string
  skipDefault: string[]
  pages: {
    gettingStarted: string
    dashboard: string
    activeConnections: string
    connections: string
    storage: string
    networking: string
    virtualMachines: string
    spotVms: string
    paasSaas: string
    account: string
    settings: string
  }
  navGuide: string
  navWebsite: string
  navDownload: string
  footerMessage: string
  footerCopyright: string
  prev: string
  next: string
  description: string
}

function buildGuideSidebar(
  linkPrefix: string,
  guideRelDir: string,
  ui: LocaleUi,
): DefaultTheme.SidebarItem[] {
  const guideDir = path.join(docsRoot, guideRelDir)
  const prefix = linkPrefix === '/' ? '' : linkPrefix.replace(/\/$/, '')

  function pageWithSections(
    text: string,
    linkSuffix: string,
    fileName: string,
    options: { collapsed?: boolean; skip?: string[] } = {},
  ): DefaultTheme.SidebarItem {
    const link = `${prefix}${linkSuffix}`
    const skip = new Set((options.skip ?? ui.skipDefault).map(slugify))
    const sections = h2Sections(guideDir, fileName).filter((s) => !skip.has(s.slug))
    if (sections.length === 0) {
      return { text, link }
    }
    return {
      text,
      collapsed: options.collapsed ?? true,
      items: [
        { text: ui.overview, link },
        ...sections.map((s) => ({
          text: s.text,
          link: `${link}#${s.slug}`,
        })),
      ],
    }
  }

  return [
    {
      text: ui.userGuide,
      items: [
        { text: ui.overview, link: prefix || '/' },
        pageWithSections(ui.pages.gettingStarted, '/user-guide/01-getting-started', '01-getting-started.md', {
          collapsed: false,
          skip: [],
        }),
        pageWithSections(ui.pages.dashboard, '/user-guide/02-dashboard', '02-dashboard.md'),
        pageWithSections(ui.pages.activeConnections, '/user-guide/03-my-clouds', '03-my-clouds.md'),
        pageWithSections(ui.pages.connections, '/user-guide/04-connections', '04-connections.md', {
          skip: ui.skipDefault.slice(0, 1),
        }),
        pageWithSections(ui.pages.storage, '/user-guide/05-iaas-storage', '05-iaas-storage.md'),
        pageWithSections(ui.pages.networking, '/user-guide/06-iaas-networking', '06-iaas-networking.md'),
        pageWithSections(ui.pages.virtualMachines, '/user-guide/07-iaas-virtual-machines', '07-iaas-virtual-machines.md'),
        pageWithSections(ui.pages.spotVms, '/user-guide/08-iaas-ephemeral-vms', '08-iaas-ephemeral-vms.md'),
        pageWithSections(ui.pages.paasSaas, '/user-guide/09-paas-saas', '09-paas-saas.md', {
          skip: [],
        }),
        pageWithSections(ui.pages.account, '/user-guide/10-account', '10-account.md', { skip: [] }),
        pageWithSections(ui.pages.settings, '/user-guide/11-settings', '11-settings.md', { skip: [] }),
      ],
    },
  ]
}

function localeTheme(linkPrefix: string, guideRelDir: string, ui: LocaleUi): DefaultTheme.Config {
  const sidebar = buildGuideSidebar(linkPrefix, guideRelDir, ui)
  const home = linkPrefix === '/' ? '/' : `${linkPrefix.replace(/\/$/, '')}/`
  return {
    logo: { src: '/logo-mark.svg', alt: 'Electros' },
    siteTitle: 'Electros Docs',
    nav: [
      { text: ui.navGuide, link: home },
      {
        text: ui.navWebsite,
        link: ELECTROS_SITE,
        target: '_blank',
        rel: 'noopener',
      },
      {
        text: ui.navDownload,
        link: DOWNLOAD,
        target: '_blank',
        rel: 'noopener',
      },
    ],
    sidebar:
      linkPrefix === '/'
        ? { '/': sidebar, '/user-guide/': sidebar }
        : {
            [`${linkPrefix}`]: sidebar,
            [`${linkPrefix}user-guide/`]: sidebar,
          },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/elemento-modular-cloud' }],
    search: { provider: 'local' },
    footer: {
      message: ui.footerMessage,
      copyright: ui.footerCopyright,
    },
    docFooter: {
      prev: ui.prev,
      next: ui.next,
    },
  }
}

const enUi: LocaleUi = {
  overview: 'Overview',
  userGuide: 'User guide',
  skipDefault: ['What this page is for', 'Read the page'],
  pages: {
    gettingStarted: 'Getting started',
    dashboard: 'Dashboard',
    activeConnections: 'Active Connections',
    connections: 'Connections',
    storage: 'IaaS Storage',
    networking: 'IaaS Networking',
    virtualMachines: 'Virtual Machines',
    spotVms: 'Spot / Ephemeral VMs',
    paasSaas: 'PaaS & SaaS',
    account: 'Account',
    settings: 'Settings',
  },
  navGuide: 'Guide',
  navWebsite: 'Website',
  navDownload: 'Download',
  footerMessage:
    'Electros — the metacloud control plane · <a href="https://www.electros.cloud">www.electros.cloud</a>',
  footerCopyright:
    '© Elemento Srl · <a href="https://www.electros.cloud/privacy.html">Privacy</a> · <a href="https://www.electros.cloud/terms.html">Terms</a>',
  prev: 'Previous',
  next: 'Next',
  description:
    'Electros user guide — the metacloud control plane for public, private, and sovereign clouds.',
}

const itUi: LocaleUi = {
  overview: 'Panoramica',
  userGuide: 'Guida utente',
  skipDefault: ['A cosa serve questa pagina', 'Leggi la pagina'],
  pages: {
    gettingStarted: 'Per iniziare',
    dashboard: 'Dashboard',
    activeConnections: 'Connessioni attive',
    connections: 'Connessioni',
    storage: 'Storage IaaS',
    networking: 'Networking IaaS',
    virtualMachines: 'Macchine virtuali',
    spotVms: 'VM Spot / effimere',
    paasSaas: 'PaaS e SaaS',
    account: 'Account',
    settings: 'Impostazioni',
  },
  navGuide: 'Guida',
  navWebsite: 'Sito web',
  navDownload: 'Download',
  footerMessage:
    'Electros — il control plane metacloud · <a href="https://www.electros.cloud">www.electros.cloud</a>',
  footerCopyright:
    '© Elemento Srl · <a href="https://www.electros.cloud/privacy.html">Privacy</a> · <a href="https://www.electros.cloud/terms.html">Termini</a>',
  prev: 'Precedente',
  next: 'Successivo',
  description:
    'Guida utente Electros — il control plane metacloud per cloud pubblici, privati e sovrani.',
}

const frUi: LocaleUi = {
  overview: 'Aperçu',
  userGuide: 'Guide utilisateur',
  skipDefault: ['À quoi sert cette page', 'Lire la page'],
  pages: {
    gettingStarted: 'Premiers pas',
    dashboard: 'Tableau de bord',
    activeConnections: 'Connexions actives',
    connections: 'Connexions',
    storage: 'Stockage IaaS',
    networking: 'Réseau IaaS',
    virtualMachines: 'Machines virtuelles',
    spotVms: 'VM Spot / éphémères',
    paasSaas: 'PaaS et SaaS',
    account: 'Compte',
    settings: 'Paramètres',
  },
  navGuide: 'Guide',
  navWebsite: 'Site web',
  navDownload: 'Télécharger',
  footerMessage:
    'Electros — le plan de contrôle métacloud · <a href="https://www.electros.cloud">www.electros.cloud</a>',
  footerCopyright:
    '© Elemento Srl · <a href="https://www.electros.cloud/privacy.html">Confidentialité</a> · <a href="https://www.electros.cloud/terms.html">Conditions</a>',
  prev: 'Précédent',
  next: 'Suivant',
  description:
    'Guide utilisateur Electros — le plan de contrôle métacloud pour clouds publics, privés et souverains.',
}

export default defineConfig({
  title: 'Electros Docs',
  description: enUi.description,
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  srcExclude: ['README.md', '**/node_modules/**'],

  sitemap: {
    hostname: 'https://docs.electros.cloud',
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#ffa600' }],
    ['meta', { property: 'og:site_name', content: 'Electros Docs' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Red+Hat+Display:wght@500;600;700;800&display=swap',
      },
    ],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      description: enUi.description,
      themeConfig: localeTheme('/', 'user-guide', enUi),
    },
    it: {
      label: 'Italiano',
      lang: 'it',
      description: itUi.description,
      themeConfig: localeTheme('/it/', 'it/user-guide', itUi),
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      description: frUi.description,
      themeConfig: localeTheme('/fr/', 'fr/user-guide', frUi),
    },
  },

  markdown: {
    image: { lazyLoading: true },
  },

  vite: {
    server: { port: 5174 },
  },
})
