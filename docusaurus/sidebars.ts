import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.
 */
const sidebars: SidebarsConfig = {
  // Main documentation sidebar
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '🚀 Getting Started',
      collapsed: false,
      items: [
        'getting-started/quick-start',
        'getting-started/installation',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: '🏗️ Architecture',
      collapsed: false,
      items: [
        'architecture/index',
        'architecture/overview',
        'architecture/enhanced-architecture',
        'architecture/critical-files',
      ],
    },
    {
      type: 'category',
      label: '🏥 Clinical',
      collapsed: true,
      items: [
        'clinical/metrics-definitions',
      ],
    },
    {
      type: 'category',
      label: '📊 Signal Processing',
      collapsed: true,
      items: [
        'signal-processing/overview',
        'signal-processing/butterworth-filtering',
        'signal-processing/envelope-detection',
        'signal-processing/contraction-detection',
        'signal-processing/parameters',
      ],
    },
    {
      type: 'category',
      label: '⚙️ Backend',
      collapsed: true,
      items: [
        'backend/overview',
        'backend/api-design',
        'backend/database-integration',
        'backend/testing-strategy',
        'backend/caching-redis',
        'backend/webhooks-processing',
        'backend/deployment',
      ],
    },
    {
      type: 'category',
      label: '🎨 Frontend',
      collapsed: true,
      items: [
        'frontend/overview',
      ],
    },
    {
      type: 'category',
      label: '🗄️ Supabase',
      collapsed: true,
      items: [
        'supabase/overview',
        {
          type: 'category',
          label: '🔐 Authentication',
          collapsed: true,
          items: [
            'supabase/auth/overview',
          ],
        },
        {
          type: 'category',
          label: '💾 Database',
          collapsed: true,
          items: [
            'supabase/database/overview',
          ],
        },
        {
          type: 'category',
          label: '🔒 Row Level Security',
          collapsed: true,
          items: [
            'supabase/rls/overview',
          ],
        },
        {
          type: 'category',
          label: '📦 Storage',
          collapsed: true,
          items: [
            'supabase/storage/overview',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '🚀 DevOps',
      collapsed: true,
      items: [
        'devops/overview',
        {
          type: 'category',
          label: '🔄 CI/CD',
          collapsed: true,
          items: [
            'devops/ci-cd/overview',
          ],
        },
        {
          type: 'category',
          label: '🐳 Docker',
          collapsed: true,
          items: [
            'devops/docker/overview',
          ],
        },
        {
          type: 'category',
          label: '⚡ Coolify',
          collapsed: true,
          items: [
            'devops/coolify/overview',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '🧪 Testing',
      collapsed: true,
      items: [
        'testing/overview',
      ],
    },
    {
      type: 'category',
      label: '🛠️ Development',
      collapsed: true,
      items: [
        'development/infrastructure',
      ],
    },
    {
      type: 'category',
      label: '🤖 Agentic Development',
      collapsed: true,
      items: [
        'agentic-development/overview',
        {
          type: 'category',
          label: '🧠 Claude Code',
          collapsed: true,
          items: [
            'agentic-development/claude-code/overview',
          ],
        },
      ],
    },
  ],
};

export default sidebars;