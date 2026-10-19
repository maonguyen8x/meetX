export const PLATFORM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;
export const ORGANIZATION_ROLES = ['ORG_ADMIN', 'ORG_MEMBER'] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
