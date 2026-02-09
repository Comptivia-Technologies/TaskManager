FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["Workload.API/Workload.API.csproj", "Workload.API/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "Workload.API/Workload.API.csproj"

COPY . .

WORKDIR "/src/Workload.API"
RUN dotnet build "Workload.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Workload.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Workload.API.dll"]
