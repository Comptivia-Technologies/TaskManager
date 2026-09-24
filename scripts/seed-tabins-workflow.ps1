# Seeds the TABINS Quotation Preparation workflow: 7 teams, an 11-stage workflow,
# and the SLA configuration the assignment chain depends on.
#
# Usage: .\scripts\seed-tabins-workflow.ps1 -OrganizationId <guid>
#
# Talks to the services directly rather than through the gateway, so the
# organization is supplied by header instead of being derived from a token.
# Re-running is safe: anything already present is reused, not duplicated.

param(
    [Parameter(Mandatory = $true)]
    [string]$OrganizationId,

    [string]$WorkflowApiUrl = "http://localhost:5000/api",
    [string]$SlaApiUrl = "http://localhost:5002/api"
)

$ErrorActionPreference = "Stop"

if (-not [guid]::TryParse($OrganizationId, [ref][guid]::Empty)) {
    Write-Host "ERROR: OrganizationId must be a GUID." -ForegroundColor Red
    exit 1
}

$headers = @{
    "X-Organization-Id" = $OrganizationId
    "Content-Type"      = "application/json"
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Uri,
        $Body
    )
    $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 10 } else { $null }
    try {
        if ($null -ne $json) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body $json
        }
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
    }
    catch {
        Write-Host "ERROR calling $Method $Uri" -ForegroundColor Red
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor Red }
        else { Write-Host $_.Exception.Message -ForegroundColor Red }
        throw
    }
}

# Each TABINS role becomes a team, because a stage is bound to exactly one team.
# Management and Senior Management are meant to hold a single member each, so the
# workload engine always picks the same named approver.
$teamDefinitions = @(
    @{ Name = "Administration";     Description = "Enquiry recipient / administrator" },
    @{ Name = "Team Lead";          Description = "Concerned team lead" },
    @{ Name = "Site Personnel";     Description = "Assigned site visit personnel" },
    @{ Name = "Engineering";        Description = "Engineer / estimator" },
    @{ Name = "Procurement";        Description = "Supplier and subcontractor pricing" },
    @{ Name = "Management";         Description = "Manager approval (keep to one member)" },
    @{ Name = "Senior Management";  Description = "Final approval before issue (keep to one member)" }
)

# Stage names must match the schema keys in
# frontend/workflow/src/utils/stageFormRegistry.ts, which is how a stage finds its form.
$stageDefinitions = @(
    @{ Order = 1;  Name = "Receive & Register Enquiry";   Team = "Administration" },
    @{ Order = 2;  Name = "Assign Team";                  Team = "Team Lead" },
    @{ Order = 3;  Name = "Site Visit & Scope Capture";   Team = "Site Personnel" },
    @{ Order = 4;  Name = "Verify Site Information";      Team = "Engineering" },
    @{ Order = 5;  Name = "Obtain Supplier Prices";       Team = "Procurement" },
    @{ Order = 6;  Name = "Prepare & Check BOQ";          Team = "Engineering" },
    @{ Order = 7;  Name = "Manager Approval";             Team = "Management" },
    @{ Order = 8;  Name = "Draft Quotation";              Team = "Administration" },
    @{ Order = 9;  Name = "Engineer Verification";        Team = "Engineering" },
    @{ Order = 10; Name = "Senior Management Approval";   Team = "Senior Management" },
    @{ Order = 11; Name = "Issue to Client & Close";      Team = "Administration" }
)

$workflowName = "Quotation Preparation"

Write-Host "== Teams ==" -ForegroundColor Cyan
$existingTeams = @(Invoke-Api -Method GET -Uri "$WorkflowApiUrl/teams")
$teamIds = @{}

foreach ($team in $teamDefinitions) {
    $match = $existingTeams | Where-Object { $_.teamName -eq $team.Name } | Select-Object -First 1
    if ($match) {
        Write-Host "  exists: $($team.Name)" -ForegroundColor DarkGray
        $teamIds[$team.Name] = $match.teamId
    }
    else {
        $created = Invoke-Api -Method POST -Uri "$WorkflowApiUrl/teams" -Body @{
            teamName    = $team.Name
            description = $team.Description
        }
        Write-Host "  created: $($team.Name)" -ForegroundColor Green
        $teamIds[$team.Name] = $created.teamId
    }
}

Write-Host ""
Write-Host "== Workflow ==" -ForegroundColor Cyan
$existingWorkflows = @(Invoke-Api -Method GET -Uri "$WorkflowApiUrl/workflows")
$workflow = $existingWorkflows | Where-Object { $_.workflowName -eq $workflowName } | Select-Object -First 1

if ($workflow) {
    Write-Host "  exists: $workflowName" -ForegroundColor DarkGray
}
else {
    # TeamId is deliberately left unset: with no workflow team, the workload engine
    # assigns from the FIRST STAGE's team, which is what routes a new enquiry to
    # Administration rather than pinning every assignment to one team.
    $workflow = Invoke-Api -Method POST -Uri "$WorkflowApiUrl/workflows" -Body @{
        workflowName = $workflowName
        description  = "TABINS quotation preparation, from enquiry receipt to issue."
    }
    Write-Host "  created: $workflowName" -ForegroundColor Green
}
$workflowId = $workflow.workflowId

Write-Host ""
Write-Host "== Stages ==" -ForegroundColor Cyan
$existingStages = @(Invoke-Api -Method GET -Uri "$WorkflowApiUrl/workflows/$workflowId/stages")

foreach ($stage in $stageDefinitions) {
    $match = $existingStages | Where-Object { $_.stageName -eq $stage.Name } | Select-Object -First 1
    if ($match) {
        Write-Host "  exists: $($stage.Order). $($stage.Name)" -ForegroundColor DarkGray
        continue
    }

    # A stage already at this position under a different name is renamed rather than
    # duplicated. Stage names are the key that finds each stage's form, so a stale
    # name silently falls back to a generic notes box.
    $atPosition = $existingStages | Where-Object { $_.stageOrder -eq $stage.Order } | Select-Object -First 1
    if ($atPosition) {
        Invoke-Api -Method PUT -Uri "$WorkflowApiUrl/stages/$($atPosition.stageId)" -Body @{
            stageName  = $stage.Name
            stageOrder = $stage.Order
            teamId     = $teamIds[$stage.Team]
        } | Out-Null
        Write-Host "  renamed: $($stage.Order). $($atPosition.stageName) -> $($stage.Name)" -ForegroundColor Yellow
        continue
    }
    Invoke-Api -Method POST -Uri "$WorkflowApiUrl/stages" -Body @{
        stageName  = $stage.Name
        stageOrder = $stage.Order
        workflowId = $workflowId
        teamId     = $teamIds[$stage.Team]
    } | Out-Null
    Write-Host "  created: $($stage.Order). $($stage.Name) -> $($stage.Team)" -ForegroundColor Green
}

Write-Host ""
Write-Host "== SLA configuration ==" -ForegroundColor Cyan
# Without this the chain stops after priority assignment and no task is ever
# assigned to a member, so the workflow would look broken rather than empty.
$existingSla = $null
try {
    $existingSla = Invoke-RestMethod -Method GET -Uri "$SlaApiUrl/sla-configurations/workflow/$workflowId" -Headers $headers
}
catch {
    $existingSla = $null
}

if ($existingSla) {
    Write-Host "  exists for this workflow" -ForegroundColor DarkGray
}
else {
    Invoke-Api -Method POST -Uri "$SlaApiUrl/sla-configurations" -Body @{
        workflowId     = $workflowId
        priorityLevels = @{
            Critical = @{ responseTime = 1440 }   # 1 day
            High     = @{ responseTime = 4320 }   # 3 days
            Medium   = @{ responseTime = 7200 }   # 5 days
            Low      = @{ responseTime = 14400 }  # 10 days
        }
    } | Out-Null
    Write-Host "  created (Critical 1d, High 3d, Medium 5d, Low 10d)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Workflow id: $workflowId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: add a Member to each team on the Members page and link each one to a" -ForegroundColor Yellow
Write-Host "login, otherwise assigned work cannot be seen by anyone." -ForegroundColor Yellow
