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
        'getting-started/first-analysis',
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
      ],
    },
    {
      type: 'category',
      label: '🏗️ Architecture',
      collapsed: true,
      items: [
        'architecture/overview',
      ],
    },
    {
      type: 'category',
      label: '⚙️ Backend',
      collapsed: true,
      items: [
        'backend/api-design',
      ],
    },
    {
      type: 'category',
      label: '🎨 Frontend',
      collapsed: true,
      items: [
        'frontend/react-architecture',
      ],
    },
  ],
};

export default sidebars;