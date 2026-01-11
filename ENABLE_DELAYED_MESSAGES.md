# Enable RabbitMQ Delayed Message Exchange Plugin

The system now uses RabbitMQ delayed messages for efficient SLA deadline tracking. This requires the `rabbitmq_delayed_message_exchange` plugin to be enabled in RabbitMQ.

## Steps to Enable:

1. **Open PowerShell as Administrator**

2. **Navigate to RabbitMQ sbin folder:**
   ```powershell
   cd "C:\Program Files\RabbitMQ Server\rabbitmq_server-*\sbin"
   ```
   (Replace * with your version number, e.g., `rabbitmq_server-3.13.0`)

3. **Enable the delayed message exchange plugin:**
   ```powershell
   .\rabbitmq-plugins.bat enable rabbitmq_delayed_message_exchange
   ```

4. **Restart RabbitMQ service:**
   ```powershell
   .\rabbitmq-service.bat stop
   .\rabbitmq-service.bat start
   ```
   
   Or restart via Windows Services:
   - Press `Win + R`, type `services.msc`
   - Find "RabbitMQ" service
   - Right-click → Restart

5. **Verify plugin is enabled:**
   ```powershell
   .\rabbitmq-plugins.bat list
   ```
   You should see `[E*] rabbitmq_delayed_message_exchange` in the list (the `E*` means it's enabled and running).

## How It Works:

1. **When SLA is configured:** A delayed `TaskOverdueEvent` is published that will be delivered exactly at the SLA deadline time.

2. **At deadline:** RabbitMQ automatically delivers the message → TaskService marks the task as overdue.

3. **Fallback:** `SLAMonitorService` still runs every 5 minutes as a safety net to catch any missed overdue tasks.

## Benefits:

- ✅ **More accurate:** Messages arrive at the exact deadline time (not up to 1 minute later)
- ✅ **More efficient:** No constant polling - messages are delivered on-demand
- ✅ **Better scalability:** No periodic database queries
- ✅ **Fallback safety:** Background worker still runs every 5 minutes as backup

## After Enabling:

- Restart all backend services (TaskService, SLAManagerService, etc.)
- Create a new task and verify that it's marked as overdue at the exact deadline time
- Check logs to see "Scheduled delayed TaskOverdueEvent" messages

## Troubleshooting:

If delayed messages don't work:
- Verify plugin is enabled: `.\rabbitmq-plugins.bat list`
- Check RabbitMQ logs for errors
- The fallback worker will still catch overdue tasks (runs every 5 minutes)
- Check service logs for "Failed to publish delayed TaskOverdueEvent" warnings

