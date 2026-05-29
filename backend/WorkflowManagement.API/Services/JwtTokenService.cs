using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Services;

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAt) CreateToken(AppUser user, IReadOnlyList<string> permissionCodes);
}

public class JwtTokenService : IJwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime ExpiresAt) CreateToken(AppUser user, IReadOnlyList<string> permissionCodes)
    {
        var secret = _configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is required");
        var issuer = _configuration["Jwt:Issuer"] ?? "WorkflowManagement";
        var audience = _configuration["Jwt:Audience"] ?? "WorkflowManagement";
        var expiryMinutes = int.TryParse(_configuration["Jwt:ExpiryMinutes"], out var m) ? m : 480;

        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.FullName),
            new("roleId", user.RoleId.ToString()),
            new("roleName", user.Role?.Name ?? string.Empty),
        };

        foreach (var code in permissionCodes.Distinct())
            claims.Add(new Claim("permission", code));

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
