FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["WorkflowService/WorkflowService.csproj", "WorkflowService/"]
COPY ["Shared/Shared.Messaging/Shared.Messaging.csproj", "Shared/Shared.Messaging/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "WorkflowService/WorkflowService.csproj"

COPY . .

WORKDIR "/src/WorkflowService"
RUN dotnet build "WorkflowService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "WorkflowService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WorkflowService.dll"]
