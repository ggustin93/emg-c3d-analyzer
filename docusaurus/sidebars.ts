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
      type: 'doc',
      id: 'architecture',
      label: '🏗️ Architecture',
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
      type: 'doc',
      id: 'devops/devops',
      label: '🚀 DevOps',
    },
    {
      type: 'doc',
      id: 'testing',
      label: '🧪 Testing',
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