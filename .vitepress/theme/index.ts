import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

/** Same space banners as Electros `assets/page-backgrounds/*.webp`. */
const PAGE_BACKGROUNDS: Record<string, string> = {
  '/': 'mission-control-overview.webp',
  '/user-guide/01-getting-started': 'mission-control-overview.webp',
  '/user-guide/02-dashboard': 'dashboard.webp',
  '/user-guide/03-my-clouds': 'active-connections.webp',
  '/user-guide/04-connections': 'connections.webp',
  '/user-guide/05-iaas-storage': 'storage.webp',
  '/user-guide/06-iaas-networking': 'networking.webp',
  '/user-guide/07-iaas-virtual-machines': 'virtual-machines.webp',
  '/user-guide/08-iaas-ephemeral-vms': 'spot-vms.webp',
  '/user-guide/09-paas-saas': 'kubernetes.webp',
  '/user-guide/10-account': 'account.webp',
  '/user-guide/11-settings': 'settings.webp',
}

function normalizePath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? path
  const noHtml = bare.replace(/\.html$/, '')
  if (noHtml.length > 1 && noHtml.endsWith('/')) {
    return noHtml.slice(0, -1)
  }
  return noHtml || '/'
}

function applyPageBackground(path: string) {
  if (typeof document === 'undefined') {
    return
  }
  const key = normalizePath(path)
  const file = PAGE_BACKGROUNDS[key] ?? 'cockpit-default.webp'
  document.documentElement.style.setProperty(
    '--docs-page-bg',
    `url(/page-backgrounds/${file})`,
  )
  document.documentElement.dataset.pageBg = file
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (!router) {
      return
    }
    const sync = () => applyPageBackground(router.route.path)
    sync()
    router.onAfterRouteChanged = (to) => {
      applyPageBackground(typeof to === 'string' ? to : router.route.path)
    }
  },
}

export default theme
