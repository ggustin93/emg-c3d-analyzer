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
      type: 'doc',
      id: 'getting-started',
      label: '🚀 Getting Started',
    },
    {
      type: 'doc',
      id: 'architecture',
      label: '🏗️ Architecture',
    },
    {
      type: 'doc',
      id: 'clinical/metrics-definitions',
      label: '🏥 Clinical Metrics',
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
      label: '🔧 DevOps',
    },
    {
      type: 'doc',
      id: 'testing',
      label: '🧪 Testing',
    },
    {
      type: 'doc',
      id: 'development',
      label: '🛠️ Development',
    },
    {
      type: 'doc',
      id: 'roadmap/ghostly-dashboards-handover',
      label: '📍 Roadmap',
    },
  ],
};

export default sidebars;