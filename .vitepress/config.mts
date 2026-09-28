import { defineConfig, type DefaultTheme } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ELECTROS_SITE = 'https://www.electros.cloud'
const DOWNLOAD = 'https://elemento.cloud/electros.html#download'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const guideDir = path.resolve(__dirname, '../user-guide')

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

function h2Sections(fileName: string): { text: string; slug: string }[] {
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

function pageWithSections(
  text: string,
  link: string,
  fileName: string,
  options: { collapsed?: boolean; skip?: string[] } = {},
): DefaultTheme.SidebarItem {
  const skip = new Set(
    (options.skip ?? ['What this page is for', 'Read the page']).map(slugify),
  )
  const sections = h2Sections(fileName).filter((s) => !skip.has(s.slug))
  if (sections.length === 0) {
    return { text, link }
  }
  return {
    text,
    collapsed: options.collapsed ?? true,
    items: [
      { text: 'Overview', link },
      ...sections.map((s) => ({
        text: s.text,
        link: `${link}#${s.slug}`,
      })),
    ],
  }
}

const guideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'User guide',
    items: [
      { text: 'Overview', link: '/' },
      pageWithSections('Getting started', '/user-guide/01-getting-started', '01-getting-started.md', {
        collapsed: false,
        skip: [],
      }),
      pageWithSections('Dashboard', '/user-guide/02-dashboard', '02-dashboard.md'),
      pageWithSections('Active Connections', '/user-guide/03-my-clouds', '03-my-clouds.md'),
      pageWithSections('Connections', '/user-guide/04-connections', '04-connections.md', {
        skip: ['What this page is for'],
      }),
      pageWithSections('IaaS Storage', '/user-guide/05-iaas-storage', '05-iaas-storage.md'),
      pageWithSections('IaaS Networking', '/user-guide/06-iaas-networking', '06-iaas-networking.md'),
      pageWithSections('Virtual Machines', '/user-guide/07-iaas-virtual-machines', '07-iaas-virtual-machines.md'),
      pageWithSections('Spot / Ephemeral VMs', '/user-guide/08-iaas-ephemeral-vms', '08-iaas-ephemeral-vms.md'),
      pageWithSections('PaaS & SaaS', '/user-guide/09-paas-saas', '09-paas-saas.md', {
        skip: [],
      }),
      pageWithSections('Account', '/user-guide/10-account', '10-account.md', { skip: [] }),
      pageWithSections('Settings', '/user-guide/11-settings', '11-settings.md', { skip: [] }),
    ],
  },
]

export default defineConfig({
  title: 'Electros Docs',
  description:
    'Electros user guide — the metacloud control plane for public, private, and sovereign clouds.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  srcExclude: ['README.md', '**/node_modules/**'],

  // Deployed as docs.electros.cloud (sibling of www.electros.cloud)
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

  themeConfig: {
    logo: { src: '/logo-mark.svg', alt: 'Electros' },
    siteTitle: 'Electros Docs',

    nav: [
      { text: 'Guide', link: '/' },
      {
        text: 'Website',
        link: ELECTROS_SITE,
        target: '_blank',
        rel: 'noopener',
      },
      {
        text: 'Download',
        link: DOWNLOAD,
        target: '_blank',
        rel: 'noopener',
      },
    ],

    sidebar: {
      '/': guideSidebar,
      '/user-guide/': guideSidebar,
    },

    outline: { level: [2, 3] },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/elemento-modular-cloud' },
    ],
    search: { provider: 'local' },
    footer: {
      message:
        'Electros — the metacloud control plane · <a href="https://www.electros.cloud">www.electros.cloud</a>',
      copyright:
        '© Elemento Srl · <a href="https://www.electros.cloud/privacy.html">Privacy</a> · <a href="https://www.electros.cloud/terms.html">Terms</a>',
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
  },

  markdown: {
    image: { lazyLoading: true },
  },

  vite: {
    server: { port: 5174 },
  },
})
