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
      label: '📍 Roadmap',
      collapsed: false,
      items: [
        'roadmap/work-in-progress',
      ],
    },
    {
      type: 'category',
      label: '🏗️ Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
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
      type: 'doc',
      id: 'signal-processing/overview',
      label: '📊 Signal Processing',
    },
    {
      type: 'doc',
      id: 'backend',
      label: '⚙️ Backend',
    },
    {
      type: 'doc',
      id: 'frontend/overview',
      label: '🎨 Frontend',
    },
    {
      type: 'category',
      label: '🚀 DevOps',
      collapsed: true,
      items: [
        'devops/overview',
        'devops/deployment',
        'devops/ci-cd',
        'devops/docker',
        'devops/coolify',
      ],
    },
    {
      type: 'category',
      label: '🧪 Testing',
      collapsed: true,
      items: [
        'testing/overview',
        'testing/backend-testing',
      ],
    },
    {
      type: 'category',
      label: '🛠️ Development',
      collapsed: true,
      items: [
        'development/infrastructure',
        'development/scripts',
        'development/agentic-development',
      ],
    },
  ],
};

export default sidebars;