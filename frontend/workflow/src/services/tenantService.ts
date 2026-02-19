// Use API Gateway URL instead of direct Cloud Run URL to avoid CORS issues
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export interface TenantInfo {
  tenantId: string;
  displayName?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface TenantLookupResult {
  tenantId?: string | null;
  exists: boolean;
  displayName?: string;
  tenants?: TenantInfo[];
  multipleTenants?: boolean;
  error?: string;
}

export const fetchTenantIdByEmail = async (email: string): Promise<TenantLookupResult> => {
  if (API_BASE_URL) {
    try {
      // Call through API Gateway (which proxies to Cloud Run) to avoid CORS issues
      const encodedEmail = encodeURIComponent(email);
      const response = await fetch(`${API_BASE_URL}/api/auth/tenant/${encodedEmail}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store', // Prevent browser caching
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          errorData = { error: 'Unknown error', message: errorText };
        }

        if (response.status === 403 || errorData.error === 'Permission denied') {
          return {
            tenantId: null,
            exists: false,
            error: 'Service account permissions issue. Please check backend setup. You can enter tenant ID manually.',
          };
        }

        if (response.status === 404) {
          return {
            tenantId: null,
            exists: false,
            error: 'User not found. Please check your email address.',
          };
        }

        throw new Error(errorData.message || `Failed to fetch tenant ID: ${response.status}`);
      }

      const responseData = await response.json();

      // Handle the nested response structure: { success: true, data: { ... } }
      const apiData = responseData.data || responseData;

      // Check if user has tenant
      if (!apiData.hasTenant) {
        return {
          tenantId: null,
          exists: true,
          error: 'User found but does not belong to any tenant.',
        };
      }

      // Handle multiple organizations/tenants
      if (apiData.organizations && apiData.organizations.length > 1) {
        const tenants: TenantInfo[] = apiData.organizations.map((org: any) => ({
          tenantId: org.tenantId,
          displayName: org.organizationName,
          organizationId: org.organizationId,
          organizationName: org.organizationName,
        }));

        return {
          tenantId: null,
          exists: true,
          tenants: tenants,
          multipleTenants: true,
        };
      }

      // Single tenant/organization
      if (apiData.tenantId) {
        return {
          tenantId: apiData.tenantId,
          exists: true,
          displayName: apiData.organizationName,
        };
      }

      // If organizations array exists with single item
      if (apiData.organizations && apiData.organizations.length === 1) {
        const org = apiData.organizations[0];
        return {
          tenantId: org.tenantId,
          exists: true,
          displayName: org.organizationName,
        };
      }

      return {
        tenantId: null,
        exists: true,
        error: 'Tenant information not found in response.',
      };
    } catch (error: any) {
      return {
        tenantId: null,
        exists: false,
        error: error.message || 'Failed to fetch tenant ID. Please enter it manually.',
      };
    }
  }

  return {
    tenantId: null,
    exists: false,
    error: 'API Gateway not configured. Please enter tenant ID manually.',
  };
};
