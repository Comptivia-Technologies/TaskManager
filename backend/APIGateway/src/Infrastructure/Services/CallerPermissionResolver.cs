using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace APIGateway.Infrastructure.Services;

/// <summary>
/// Works out what the caller is allowed to do, so downstream services can enforce
/// it without each one needing to reach Product Hub.
///
/// Roles are defined in this application but assigned to users in Product Hub, so
/// resolving a caller means following their Product Hub role assignment back to the
/// local role that owns the permission codes — the same path the frontend takes.
/// Two calls per request would be wasteful, so results are cached briefly.
/// </summary>
public class CallerPermissionResolver
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(60);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<CallerPermissionResolver> _logger;

    public CallerPermissionResolver(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<CallerPermissionResolver> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// The caller's permission codes, or null when they could not be determined.
    /// Null is not "no permissions": it means the question was not answerable, and
    /// the caller is told apart from someone who genuinely holds none.
    /// </summary>
    public async Task<IReadOnlyList<string>?> ResolveAsync(string userId, string organizationId, string? authorizationHeader)
    {
        var cacheKey = $"perms:{organizationId}:{userId}";
        if (_cache.TryGetValue<IReadOnlyList<string>?>(cacheKey, out var cached))
            return cached;

        var productId = _configuration["AuthService:ProductId"];
        if (string.IsNullOrWhiteSpace(productId))
        {
            _logger.LogWarning(
                "AuthService:ProductId is not configured, so caller permissions cannot be resolved. " +
                "Endpoints that require a permission will refuse until it is set.");
            return null;
        }

        try
        {
            var roleId = await GetAssignedRoleAsync(productId, userId, organizationId, authorizationHeader);
            if (roleId == null)
                return null;

            var codes = await GetRolePermissionsAsync(roleId, organizationId, authorizationHeader);
            _cache.Set(cacheKey, codes, CacheFor);
            return codes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not resolve permissions for user {UserId}", userId);
            return null;
        }
    }

    /// <summary>The role this user is assigned in Product Hub, by id or by name.</summary>
    private async Task<string?> GetAssignedRoleAsync(
        string productId, string userId, string organizationId, string? authorizationHeader)
    {
        var baseUrl = _configuration["AuthService:BaseUrl"]?.TrimEnd('/')
            ?? throw new InvalidOperationException("AuthService:BaseUrl is required");

        var url = $"{baseUrl}/api/organizationuser" +
                  $"?product_id={Uri.EscapeDataString(productId)}" +
                  $"&organization_id={Uri.EscapeDataString(organizationId)}";

        using var response = await Send(HttpMethod.Get, url, authorizationHeader);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Product Hub returned {StatusCode} while resolving permissions", response.StatusCode);
            return null;
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        foreach (var user in FindUsers(document.RootElement))
        {
            var id = ReadString(user, "userId", "user_id", "id");
            if (!string.Equals(id, userId, StringComparison.OrdinalIgnoreCase))
                continue;

            return ReadString(user, "roleId", "role_id") ?? ReadString(user, "role");
        }

        _logger.LogWarning("Caller {UserId} was not found in organization {OrganizationId}", userId, organizationId);
        return null;
    }

    /// <summary>The permission codes on the local role the assignment points at.</summary>
    private async Task<IReadOnlyList<string>> GetRolePermissionsAsync(
        string roleIdOrName, string organizationId, string? authorizationHeader)
    {
        var baseUrl = _configuration["WorkflowManagementApi:BaseUrl"]?.TrimEnd('/')
            ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl is required");

        var url = $"{baseUrl}/roles/organization/{organizationId}";
        using var response = await Send(HttpMethod.Get, url, authorizationHeader, organizationId);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Could not read roles while resolving permissions: {StatusCode}", response.StatusCode);
            return Array.Empty<string>();
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        foreach (var role in FindRoles(document.RootElement))
        {
            // RoleReadDto renames these on the wire: RoleId is serialized as "id" and
            // PermissionCodes as "permissions".
            var id = ReadString(role, "id", "roleId");
            var name = ReadString(role, "name");
            var matches = string.Equals(id, roleIdOrName, StringComparison.OrdinalIgnoreCase)
                       || string.Equals(name, roleIdOrName, StringComparison.OrdinalIgnoreCase);
            if (!matches)
                continue;

            if (role.TryGetProperty("permissions", out var codes) && codes.ValueKind == JsonValueKind.Array)
                return codes.EnumerateArray()
                    .Select(c => c.GetString())
                    .Where(c => !string.IsNullOrEmpty(c))
                    .Cast<string>()
                    .ToList();

            return Array.Empty<string>();
        }

        return Array.Empty<string>();
    }

    private async Task<HttpResponseMessage> Send(
        HttpMethod method, string url, string? authorizationHeader, string? organizationId = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (!string.IsNullOrEmpty(authorizationHeader))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorizationHeader);
        if (!string.IsNullOrEmpty(organizationId))
            request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId);

        return await _httpClientFactory.CreateClient().SendAsync(request);
    }

    // Product Hub and this API both wrap collections in a few shapes, so the list is
    // located rather than assumed.
    private static IEnumerable<JsonElement> FindUsers(JsonElement root) => FindArray(root, "users");

    private static IEnumerable<JsonElement> FindRoles(JsonElement root) => FindArray(root, "roles");

    private static IEnumerable<JsonElement> FindArray(JsonElement root, string propertyName)
    {
        if (root.ValueKind == JsonValueKind.Array)
            return root.EnumerateArray();

        if (root.ValueKind != JsonValueKind.Object)
            return Array.Empty<JsonElement>();

        if (root.TryGetProperty(propertyName, out var direct) && direct.ValueKind == JsonValueKind.Array)
            return direct.EnumerateArray();

        if (root.TryGetProperty("data", out var data))
            return FindArray(data, propertyName);

        return Array.Empty<JsonElement>();
    }

    private static string? ReadString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
            {
                var text = value.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                    return text;
            }
        }
        return null;
    }
}
