namespace TaskService.Application.Gmail;

public static class GmailEnquiryParser
{
    public static Dictionary<string, object> ToTaskData(string? plainBody, string? fromHeader, string? subject, DateTime receivedOn, string messageId)
    {
        var labels = ParseLabels(plainBody);
        var (fromName, fromEmail) = SplitFrom(fromHeader);

        var enquiryNumber = Label(labels, "enquiry number");
        if (string.IsNullOrWhiteSpace(enquiryNumber))
        {
            var tail = messageId.Length <= 8 ? messageId : messageId[^8..];
            enquiryNumber = $"ENQ-{tail}";
        }

        var client = Label(labels, "client");
        if (string.IsNullOrWhiteSpace(client))
            client = string.IsNullOrWhiteSpace(fromName) ? fromEmail : fromName;

        var project = Label(labels, "project");
        if (string.IsNullOrWhiteSpace(project))
            project = subject?.Trim() ?? string.Empty;

        var received = Label(labels, "received on");
        if (string.IsNullOrWhiteSpace(received) || !DateTime.TryParse(received, out _))
            received = receivedOn.ToString("yyyy-MM-dd");

        var scope = Label(labels, "scope summary");
        if (string.IsNullOrWhiteSpace(scope))
            scope = (plainBody ?? string.Empty).Trim();

        var data = new Dictionary<string, object>
        {
            ["enquiryNumber"] = enquiryNumber,
            ["client"] = client,
            ["project"] = project,
            ["receivedOn"] = received,
            ["scopeSummary"] = scope
        };

        var contact = Label(labels, "client contact");
        if (string.IsNullOrWhiteSpace(contact))
            contact = fromEmail;
        if (!string.IsNullOrWhiteSpace(contact))
            data["contact"] = contact;

        var submission = Label(labels, "requested submission date");
        if (!string.IsNullOrWhiteSpace(submission))
            data["requestedSubmission"] = submission;

        return data;
    }

    private static string Label(Dictionary<string, string> labels, string key) =>
        labels.TryGetValue(key, out var value) ? value : string.Empty;

    private static Dictionary<string, string> ParseLabels(string? body)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(body))
            return result;

        string? currentKey = null;
        var current = new List<string>();
        foreach (var rawLine in body.Replace("\r\n", "\n").Split('\n'))
        {
            var line = rawLine.Trim();
            var split = line.IndexOf(':');
            if (split > 0 && split < 40 && !line.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            {
                var key = line[..split].Trim().ToLowerInvariant();
                if (IsKnownLabel(key))
                {
                    if (currentKey != null)
                        result[currentKey] = string.Join("\n", current).Trim();
                    currentKey = key;
                    current = new List<string> { line[(split + 1)..].Trim() };
                    continue;
                }
            }

            if (currentKey != null)
                current.Add(line);
        }

        if (currentKey != null)
            result[currentKey] = string.Join("\n", current).Trim();

        return result;
    }

    private static bool IsKnownLabel(string key) => key is
        "enquiry number" or "client" or "project" or "client contact" or
        "received on" or "requested submission date" or "scope summary";

    private static (string Name, string Email) SplitFrom(string? from)
    {
        if (string.IsNullOrWhiteSpace(from))
            return (string.Empty, string.Empty);

        var start = from.IndexOf('<');
        var end = from.IndexOf('>');
        if (start >= 0 && end > start)
        {
            var email = from[(start + 1)..end].Trim();
            var name = from[..start].Trim().Trim('"');
            return (name, email);
        }

        return (string.Empty, from.Trim());
    }
}
