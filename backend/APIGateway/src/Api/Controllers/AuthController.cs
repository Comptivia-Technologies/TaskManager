using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Text.Json;

namespace APIGateway.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ILogger<AuthController> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public AuthController(ILogger<AuthController> logger, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
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

            // Get the Cloud Run service URL from configuration
            var cloudRunUrl = _configuration["AuthService:BaseUrl"] 
                ?? "https://api-1008640724491.us-central1.run.app";

            // Proxy the request to Cloud Run service
            var encodedEmail = Uri.EscapeDataString(email);
            var requestUrl = $"{cloudRunUrl}/api/auth/tenant/{encodedEmail}";

            _logger.LogInformation("Proxying tenant lookup to: {Url}", requestUrl);

            var response = await _httpClient.GetAsync(requestUrl);

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
}
