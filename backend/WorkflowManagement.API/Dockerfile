FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

COPY ["WorkflowManagement.API/WorkflowManagement.API.csproj", "WorkflowManagement.API/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

RUN dotnet restore "WorkflowManagement.API/WorkflowManagement.API.csproj"

COPY . .

WORKDIR "/src/WorkflowManagement.API"
RUN dotnet build "WorkflowManagement.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "WorkflowManagement.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WorkflowManagement.API.dll"]
