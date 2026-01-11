# Enable RabbitMQ Delayed Message Exchange Plugin (Docker)

Since RabbitMQ is running in Docker, you need to install the plugin inside the container.

## Option 1: Manual Installation (Recommended)

### Step 1: Download the Plugin

Download the plugin file manually:
- Go to: https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases
- Download: `rabbitmq_delayed_message_exchange-3.13.0.ez` (for RabbitMQ 3.13.7)
- Save it to: `C:\temp\rabbitmq_delayed_message_exchange-3.13.0.ez`

### Step 2: Copy to Container

```powershell
docker cp C:\temp\rabbitmq_delayed_message_exchange-3.13.0.ez rabbitmq:/opt/rabbitmq/plugins/
```

### Step 3: Enable Plugin

```powershell
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

### Step 4: Restart Container

```powershell
docker restart rabbitmq
```

### Step 5: Verify

```powershell
docker exec rabbitmq rabbitmq-plugins list | findstr delayed
```

You should see `[E*] rabbitmq_delayed_message_exchange` in the list.

---

## Option 2: Use Pre-built Docker Image with Plugin

If manual installation doesn't work, you can use a Docker image that already includes the plugin:

### Step 1: Stop Current Container

```powershell
docker stop rabbitmq
docker rm rabbitmq
```

### Step 2: Run New Container with Plugin

```powershell
docker run -d --name rabbitmq `
  -p 5672:5672 `
  -p 15672:15672 `
  -e RABBITMQ_DEFAULT_USER=guest `
  -e RABBITMQ_DEFAULT_PASS=guest `
  rabbitmq:3-management

# Wait for RabbitMQ to start (about 30 seconds)
Start-Sleep -Seconds 30

# Download and install plugin
docker exec rabbitmq bash -c "cd /opt/rabbitmq/plugins && wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/3.13.0/rabbitmq_delayed_message_exchange-3.13.0.ez"

# Enable plugin
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_delayed_message_exchange

# Restart
docker restart rabbitmq
```

---

## Option 3: Use Dockerfile (Best for Production)

Create a `Dockerfile` for RabbitMQ with the plugin:

```dockerfile
FROM rabbitmq:3-management

# Download and install delayed message exchange plugin
RUN apt-get update && apt-get install -y wget && \
    cd /opt/rabbitmq/plugins && \
    wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/3.13.0/rabbitmq_delayed_message_exchange-3.13.0.ez && \
    rabbitmq-plugins enable rabbitmq_delayed_message_exchange && \
    apt-get remove -y wget && apt-get clean
```

Then build and run:
```powershell
docker build -t rabbitmq-with-delayed-plugin .
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq-with-delayed-plugin
```

---

## After Enabling:

1. **Restart all backend services** (TaskService, SLAManagerService, etc.)
2. **Create a new task** and verify that delayed messages work
3. **Check logs** for "Scheduled delayed TaskOverdueEvent" messages

## Troubleshooting:

- If plugin doesn't appear: Make sure you downloaded the correct version (3.13.0 for RabbitMQ 3.13.7)
- If container won't start: Check Docker logs: `docker logs rabbitmq`
- The fallback worker will still catch overdue tasks every 5 minutes if delayed messages don't work

