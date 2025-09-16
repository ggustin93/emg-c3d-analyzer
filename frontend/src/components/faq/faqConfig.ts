/**
 * FAQ Configuration Constants
 * Centralized configuration for FAQ content to avoid hardcoded values
 */

export const FAQ_CONFIG = {
  // System Requirements
  browsers: {
    chrome: { name: 'Chrome', minVersion: 90 },
    firefox: { name: 'Firefox', minVersion: 88 },
    safari: { name: 'Safari', minVersion: 14 },
    edge: { name: 'Edge', minVersion: 90 }
  },
  
  // Display Requirements
  minScreenResolution: {
    width: 1366,
    height: 768
  },
  
  // EMG System Capabilities
  emg: {
    maxChannels: 16,
    metrics: ['RMS', 'MAV', 'MPF', 'MDF'],
    additionalMetrics: ['Contraction Duration', 'Fatigue Index', 'Compliance Score']
  },
  
  // User Roles
  userRoles: {
    therapist: {
      name: 'Therapist',
      description: 'Full access to patient management and session analysis'
    },
    researcher: {
      name: 'Researcher', 
      description: 'Access to anonymized session data for research'
    },
    admin: {
      name: 'Admin',
      description: 'System administration and user management'
    }
  },
  
  // Security & Compliance
  security: {
    encryption: 'AES-256',
    compliance: ['GDPR', 'HIPAA Ready'],
    backupFrequency: 'Daily'
  },
  
  // Export Formats
  exportFormats: {
    csvDetailed: 'CSV (Detailed)',
    csvSummary: 'CSV (Summary)'
  },
  
  // Default Update Date
  defaultUpdateDate: new Date().toISOString().split('T')[0]
}

// Helper function to format browser requirements
export function getBrowserRequirements(): string {
  const { chrome, firefox, safari, edge } = FAQ_CONFIG.browsers
  return `Recommended browsers:
- **${chrome.name}** (version ${chrome.minVersion}+)
- **${firefox.name}** (version ${firefox.minVersion}+)
- **${safari.name}** (version ${safari.minVersion}+)
- **${edge.name}** (version ${edge.minVersion}+)`
}

// Helper function to format screen resolution
export function getScreenResolution(): string {
  const { width, height } = FAQ_CONFIG.minScreenResolution
  return `${width}×${height}`
}

// Helper function to format EMG metrics
export function getEMGMetrics(): string {
  const allMetrics = [...FAQ_CONFIG.emg.metrics, ...FAQ_CONFIG.emg.additionalMetrics]
  return allMetrics.map(metric => `- **${metric}**`).join('\n')
}

// Helper function to format user roles
export function getUserRolesDescription(): string {
  const { therapist, researcher, admin } = FAQ_CONFIG.userRoles
  return `User Roles:
- **${therapist.name}**: ${therapist.description}
- **${researcher.name}**: ${researcher.description}
- **${admin.name}**: ${admin.description}`
}

// Helper function to format security features
export function getSecurityFeatures(): string {
  const { compliance, backupFrequency } = FAQ_CONFIG.security
  return `Security measures include:
- All data is encrypted in transit and at rest
- Role-based access control (RBAC)
- ${compliance.join(' compliant, ')}
- ${backupFrequency} automatic backups`
}