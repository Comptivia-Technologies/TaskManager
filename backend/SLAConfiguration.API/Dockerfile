FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["SLAConfiguration.API/SLAConfiguration.API.csproj", "SLAConfiguration.API/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "SLAConfiguration.API/SLAConfiguration.API.csproj"

COPY . .

WORKDIR "/src/SLAConfiguration.API"
RUN dotnet build "SLAConfiguration.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SLAConfiguration.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SLAConfiguration.API.dll"]
