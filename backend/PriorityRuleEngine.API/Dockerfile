FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["PriorityRuleEngine.API/PriorityRuleEngine.API.csproj", "PriorityRuleEngine.API/"]
COPY ["Shared/Shared.Messaging/Shared.Messaging.csproj", "Shared/Shared.Messaging/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "PriorityRuleEngine.API/PriorityRuleEngine.API.csproj"

COPY . .

WORKDIR "/src/PriorityRuleEngine.API"
RUN dotnet build "PriorityRuleEngine.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PriorityRuleEngine.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "PriorityRuleEngine.API.dll"]
