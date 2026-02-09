FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["SLAManagerService/SLAManagerService.csproj", "SLAManagerService/"]
COPY ["Shared/Shared.Messaging/Shared.Messaging.csproj", "Shared/Shared.Messaging/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "SLAManagerService/SLAManagerService.csproj"

COPY . .

WORKDIR "/src/SLAManagerService"
RUN dotnet build "SLAManagerService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SLAManagerService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SLAManagerService.dll"]
