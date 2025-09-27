import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Ghostly+ Dashboard',
  tagline: 'Technical Documentation for GHOSTLY+ Rehabilitation Platform',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://ggustin93.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/emg-c3d-analyzer/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ggustin93', // Usually your GitHub org/user name.
  projectName: 'emg-c3d-analyzer', // Usually your repo name.

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/ggustin93/emg-c3d-analyzer/tree/main/docusaurus/docs/',
        },
        blog: false, // Disable blog plugin for technical documentation
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  // Add search plugin
  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        // Basic configuration options
        indexBlog: false, // Since blog is disabled
        indexDocs: true, // Index documentation pages
        indexPages: false, // Don't index standalone pages
        language: 'en', // Language for search
        // Disable search page to avoid SearchPage component issues
        searchResultLimits: 8,
        searchResultContextMaxLength: 50,
      },
    ],
  ],

  // Enable Mermaid diagrams
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],
  
  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Ghostly+ Dashboard',
      logo: {
        alt: 'Ghostly+ Dashboard Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '📚 Documentation',
        },
        {
          href: 'https://github.com/ggustin93/emg-c3d-analyzer',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture',
            },
            {
              label: 'Clinical',
              to: '/docs/clinical/metrics-definitions',
            },
            {
              label: 'Signal Processing',
              to: '/docs/signal-processing/overview',
            },
          ],
        },
        {
          title: 'Development',
          items: [
            {
              label: 'Backend',
              to: '/docs/backend',
            },
            {
              label: 'Frontend',
              to: '/docs/frontend/overview',
            },
            {
              label: 'Testing',
              to: '/docs/testing',
            },
            {
              label: 'DevOps',
              to: '/docs/devops/devops',
            },
            {
              label: 'Development',
              to: '/docs/development',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Roadmap',
              to: '/docs/roadmap/ghostly-dashboards-handover',
            },
            {
              label: 'Supabase',
              href: 'https://supabase.com',
            },
            {
              label: 'Coolify',
              href: 'https://coolify.io',
            },
            {
              label: 'Docker',
              href: 'https://docker.com',
            },
            {
              label: 'React',
              href: 'https://react.dev',
            },
            {
              label: 'FastAPI',
              href: 'https://fastapi.tiangolo.com',
            },
          ],
        },
        {
          title: 'Contact',
          items: [
            {
              label: 'hello@pwablo.be',
              href: 'mailto:hello@pwablo.be',
            },
            {
              label: 'LinkedIn',
              href: 'https://www.linkedin.com/in/guillaume-gustin?originalSubdomain=be',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Ghostly+ Dashboard. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
