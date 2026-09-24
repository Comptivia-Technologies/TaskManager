using TaskService.Application.Interfaces;

namespace TaskService.Infrastructure.Storage;

/// <summary>
/// Keeps uploads on the local filesystem. Suitable for development only: on Cloud
/// Run the container filesystem is in-memory and per-instance, so files written
/// here do not survive a revision or reach another instance. Swap the registration
/// for an object-store implementation before deploying.
/// </summary>
public class LocalFileStorage : IFileStorage
{
    private readonly string _root;
    private readonly ILogger<LocalFileStorage> _logger;

    public LocalFileStorage(IConfiguration configuration, ILogger<LocalFileStorage> logger)
    {
        _logger = logger;
        var configured = configuration["FileStorage:LocalRoot"];
        _root = Path.GetFullPath(string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "uploads")
            : configured);
        Directory.CreateDirectory(_root);
        _logger.LogInformation("Local file storage rooted at {Root}", _root);
    }

    public async System.Threading.Tasks.Task SaveAsync(string storageKey, Stream content, CancellationToken cancellationToken = default)
    {
        var path = ResolveWithinRoot(storageKey);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        await using var file = File.Create(path);
        await content.CopyToAsync(file, cancellationToken);
    }

    public System.Threading.Tasks.Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var path = ResolveWithinRoot(storageKey);
        if (!File.Exists(path))
            return System.Threading.Tasks.Task.FromResult<Stream?>(null);

        return System.Threading.Tasks.Task.FromResult<Stream?>(File.OpenRead(path));
    }

    public System.Threading.Tasks.Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        var path = ResolveWithinRoot(storageKey);
        if (File.Exists(path))
            File.Delete(path);

        return System.Threading.Tasks.Task.CompletedTask;
    }

    // Keys are generated rather than user-supplied, but a key that escaped the root
    // would expose the whole filesystem, so the resolved path is checked regardless.
    private string ResolveWithinRoot(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key is required", nameof(storageKey));

        var combined = Path.GetFullPath(Path.Combine(_root, storageKey));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;

        if (!combined.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Resolved storage path escapes the storage root.");

        return combined;
    }
}
