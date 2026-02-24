using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Text.Json;

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
