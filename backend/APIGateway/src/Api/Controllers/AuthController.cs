using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text.Json;
using APIGateway.Infrastructure.Middleware;

namespace APIGateway.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ILogger<AuthController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public AuthController(ILogger<AuthController> logger, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    private string GetAuthServiceBaseUrl() =>
        _configuration["AuthService:BaseUrl"] ?? "https://dev.api.product-hub.comptivia.com";

    private HttpRequestMessage CreateRequest(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && !string.IsNullOrEmpty(authHeader))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authHeader!);
        return request;
    }

    [HttpGet("tenant/{email}")]
    public async Task<IActionResult> LookupTenant(string email)
    {
        try
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new { error = "Email is required" });
            }

            _logger.LogInformation("Tenant lookup requested for email: {Email}", email);

            var baseUrl = GetAuthServiceBaseUrl();
            var encodedEmail = Uri.EscapeDataString(email);
            var requestUrl = $"{baseUrl}/api/auth/tenant/{encodedEmail}";

            _logger.LogInformation("Proxying tenant lookup to: {Url}", requestUrl);

            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.GetAsync(requestUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Tenant lookup failed with status: {Status}", response.StatusCode);
                
                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return NotFound(new { error = "User not found", exists = false });
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error = "Tenant lookup failed", message = errorContent });
            }

            var content = await response.Content.ReadAsStringAsync();
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);

            // Return the response as-is from Cloud Run
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error looking up tenant for email: {Email}", email);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpPost("organizationuser/create")]
    public async Task<IActionResult> CreateOrganizationUser([FromBody] JsonElement? body)
    {
        if (body is null)
            return BadRequest(new { error = "Request body is required" });
        var bodyValue = body.Value;
        if (bodyValue.ValueKind == JsonValueKind.Null || bodyValue.ValueKind == JsonValueKind.Undefined)
            return BadRequest(new { error = "Request body is required" });

        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/organizationuser/create";
            var request = CreateRequest(HttpMethod.Post, requestUrl);
            request.Content = new StringContent(
                JsonSerializer.Serialize(bodyValue),
                System.Text.Encoding.UTF8,
                "application/json");
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
            if (!response.IsSuccessStatusCode)
            {
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = content,
                    ContentType = contentType,
                };
            }
            if (string.IsNullOrEmpty(content))
                return Ok();
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying create organization user");
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpGet("organizationuser")]
    public async Task<IActionResult> GetOrganizationUsers([FromQuery] string product_id, [FromQuery] string? tenant_id)
    {
        if (string.IsNullOrEmpty(product_id))
            return BadRequest(new { error = "product_id is required" });

        var tenantId = HttpContext.Items[OrganizationAuthMiddleware.TenantIdItemKey]?.ToString()
            ?? (!string.IsNullOrWhiteSpace(tenant_id) ? tenant_id.Trim() : null);
        if (string.IsNullOrEmpty(tenantId))
            return BadRequest(new { error = "tenant_id could not be determined from token or query" });

        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/organizationuser?product_id={Uri.EscapeDataString(product_id)}&tenant_id={Uri.EscapeDataString(tenantId)}";
            var request = CreateRequest(HttpMethod.Get, requestUrl);
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, content);
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying organization users for product_id {ProductId}", product_id);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpPut("organizationuser/{userId}")]
    public async Task<IActionResult> UpdateOrganizationUser(string userId, [FromQuery] string product_id, [FromBody] JsonElement? body)
    {
        if (string.IsNullOrEmpty(userId))
            return BadRequest(new { error = "userId is required" });
        if (string.IsNullOrEmpty(product_id))
            return BadRequest(new { error = "product_id is required" });
        if (body is null)
            return BadRequest(new { error = "Request body is required" });
        var bodyValue = body.Value;
        if (bodyValue.ValueKind == JsonValueKind.Null || bodyValue.ValueKind == JsonValueKind.Undefined)
            return BadRequest(new { error = "Request body is required" });

        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/organizationuser/{Uri.EscapeDataString(userId)}?product_id={Uri.EscapeDataString(product_id)}";
            var request = CreateRequest(HttpMethod.Put, requestUrl);
            request.Content = new StringContent(
                JsonSerializer.Serialize(bodyValue),
                System.Text.Encoding.UTF8,
                "application/json");
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
            if (!response.IsSuccessStatusCode)
            {
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = content,
                    ContentType = contentType,
                };
            }
            if (string.IsNullOrEmpty(content))
                return Ok();
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying update organization user for userId {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        if (string.IsNullOrEmpty(userId))
            return BadRequest(new { error = "userId is required" });

        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/users/{Uri.EscapeDataString(userId)}";
            var request = CreateRequest(HttpMethod.Delete, requestUrl);
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, content);
            if (string.IsNullOrEmpty(content))
                return Ok();
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying delete user for userId {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpPatch("users/{userId}/status")]
    public async Task<IActionResult> UpdateUserStatus(string userId, [FromBody] JsonElement? body)
    {
        if (string.IsNullOrEmpty(userId))
            return BadRequest(new { error = "userId is required" });
        if (body is null)
            return BadRequest(new { error = "Request body is required" });
        var bodyValue = body.Value;
        if (bodyValue.ValueKind == JsonValueKind.Null || bodyValue.ValueKind == JsonValueKind.Undefined)
            return BadRequest(new { error = "Request body is required" });

        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/users/{Uri.EscapeDataString(userId)}/status";
            var request = CreateRequest(HttpMethod.Patch, requestUrl);
            request.Content = new StringContent(
                JsonSerializer.Serialize(bodyValue),
                System.Text.Encoding.UTF8,
                "application/json");
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
            if (!response.IsSuccessStatusCode)
            {
                return new ContentResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = content,
                    ContentType = contentType,
                };
            }
            if (string.IsNullOrEmpty(content))
                return Ok();
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying update user status for userId {UserId}", userId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpGet("users/organization/{organizationId}")]
    public async Task<IActionResult> GetUsersByOrganization(string organizationId, [FromQuery] string status = "active")
    {
        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/users/organization/{Uri.EscapeDataString(organizationId)}?status={Uri.EscapeDataString(status)}";
            var request = CreateRequest(HttpMethod.Get, requestUrl);
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, content);
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying users for organization {OrganizationId}", organizationId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }

    [HttpGet("invitations/organization/{organizationId}")]
    public async Task<IActionResult> GetInvitationsByOrganization(string organizationId, [FromQuery] string status = "pending")
    {
        try
        {
            var baseUrl = GetAuthServiceBaseUrl();
            var requestUrl = $"{baseUrl}/api/invitations/organization/{Uri.EscapeDataString(organizationId)}?status={Uri.EscapeDataString(status)}";
            var request = CreateRequest(HttpMethod.Get, requestUrl);
            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, content);
            var jsonData = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(jsonData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying invitations for organization {OrganizationId}", organizationId);
            return StatusCode(500, new { error = "Internal server error", message = ex.Message });
        }
    }
}
