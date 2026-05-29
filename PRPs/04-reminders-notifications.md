# PRP 04: Reminders & Notifications

## Feature Overview

Allow users to set reminders on todos that have a due date. The app uses the browser Notifications API to send push notifications at the configured time before the due date. A polling mechanism checks every 30 seconds for pending notifications and prevents duplicates.

---

## User Stories

- **As a user**, I want to set a reminder on a todo so the browser notifies me before it's due.
- **As a user**, I want to choose how far in advance I'm reminded (15 minutes to 1 week before).
- **As a user**, I want to grant notification permissions from within the app.
- **As a user**, I want to see a 🔔 badge on todos with active reminders.
- **As a user**, I want to receive at most one notification per reminder event.

---

## User Flow

### Enable Notifications
1. User sees an "Enable Notifications" button in the app header (if permission not yet granted)
2. User clicks the button
3. Browser shows the native permission prompt
4. On approval, button disappears; polling begins

### Set a Reminder
1. User creates or edits a todo with a due date
2. The "Reminder" dropdown is enabled only when a due date is set
3. User selects a timing option (e.g., "1 hour before")
4. After save, the todo shows a 🔔 badge with the timing label

### Receive a Notification
1. Polling hook (`useNotifications`) calls `GET /api/notifications/check` every 30 seconds
2. API returns todos whose reminder time has passed but `last_notification_sent` is null or stale
3. Hook sends a browser notification: title = todo title, body = "Due in X minutes"
4. API updates `last_notification_sent` to prevent re-sending

---

## Technical Requirements

### Database Schema

```sql
-- Added to todos table
ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER;
ALTER TABLE todos ADD COLUMN last_notification_sent TEXT;
```

### Reminder Options

| Label | reminder_minutes |
|-------|-----------------|
| 15 minutes before | 15 |
| 30 minutes before | 30 |
| 1 hour before | 60 |
| 2 hours before | 120 |
| 1 day before | 1440 |
| 2 days before | 2880 |
| 1 week before | 10080 |

### API Endpoints

**`GET /api/notifications/check`**
- Requires authentication
- Returns todos where:
  - `due_date IS NOT NULL`
  - `completed = 0`
  - `reminder_minutes IS NOT NULL`
  - `(julianday(due_date) - julianday('now')) * 24 * 60 <= reminder_minutes`
  - `last_notification_sent IS NULL`
- After fetching, updates `last_notification_sent = datetime('now')` for each returned todo

### Custom Hook: `useNotifications`

Location: `lib/hooks/useNotifications.ts`

```typescript
export function useNotifications() {
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  useEffect(() => {
    if (permission !== 'granted') return;

    const poll = async () => {
      const res = await fetch('/api/notifications/check');
      const todos: Todo[] = await res.json();
      todos.forEach(todo => {
        new Notification(todo.title, {
          body: `Due: ${formatSingaporeDate(todo.due_date!)}`,
          icon: '/favicon.ico',
        });
      });
    };

    const interval = setInterval(poll, 30_000);
    poll(); // Immediate first check
    return () => clearInterval(interval);
  }, [permission]);

  return { permission, requestPermission };
}
```

### TypeScript Types

```typescript
interface ReminderOption {
  label: string;
  minutes: number;
}

const REMINDER_OPTIONS: ReminderOption[] = [
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '2 days before', minutes: 2880 },
  { label: '1 week before', minutes: 10080 },
];
```

---

## UI Components

### Enable Notifications Button

```tsx
{permission !== 'granted' && (
  <button onClick={requestPermission} className="btn-secondary">
    🔔 Enable Notifications
  </button>
)}
```

### Reminder Dropdown (Form)

```tsx
<select
  name="reminder_minutes"
  disabled={!hasDueDate}
  title={!hasDueDate ? 'Set a due date first' : undefined}
>
  <option value="">No reminder</option>
  {REMINDER_OPTIONS.map(opt => (
    <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
  ))}
</select>
```

### Reminder Badge (Todo Card)

```tsx
{todo.reminder_minutes && (
  <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full">
    🔔 {REMINDER_OPTIONS.find(o => o.minutes === todo.reminder_minutes)?.label ?? 'Reminder set'}
  </span>
)}
```

---

## Edge Cases

- **Permission denied**: Show a persistent notice explaining how to re-enable notifications in browser settings
- **Reminder without due date**: Reminder dropdown disabled; validation error if submitted with reminder but no due date
- **Tab not open**: Notifications only fire when the app tab is open and polling is active
- **Multiple tabs**: Each tab polls independently — `last_notification_sent` prevents duplicate notifications across tabs
- **Todo completed before reminder fires**: `completed = 1` excludes it from notification query
- **Recurring todo**: Each new instance starts with `last_notification_sent = NULL` so its reminder fires independently
- **Clock skew**: Server-side time used for notification check; client timezone display uses Singapore locale

---

## Acceptance Criteria

- [ ] "Enable Notifications" button requests browser permission
- [ ] All 7 reminder timing options available in the dropdown
- [ ] Reminder dropdown disabled when no due date is set
- [ ] Notifications fire at the correct time (within the 30-second polling window)
- [ ] Each todo sends at most one notification per reminder event
- [ ] 🔔 badge visible with timing label on todos with reminders
- [ ] Completed todos do not trigger notifications
- [ ] `last_notification_sent` updated after notification sent

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/04-reminders-notifications.spec.ts
test('Set reminder on todo with due date - badge appears')
test('Reminder dropdown disabled when no due date set')
test('API /api/notifications/check returns overdue reminders')
test('API /api/notifications/check does not return already-notified todos')
test('Completing a todo removes it from notification results')
```

### Manual Tests

```
- Grant notification permission in Chrome
- Create todo with due date 2 minutes from now and 1-minute reminder
- Wait for notification to appear
- Verify only one notification fires even with multiple tabs open
```

### Unit Tests

```typescript
// tests/unit/notifications.test.ts
test('Reminder time calculation: due_date minus reminder_minutes equals notify_at (Singapore timezone)')
test('last_notification_sent prevents duplicate notifications')
test('Completed todos excluded from notification check')
```

---

## Out of Scope

- Server-side push notifications (requires Service Worker + Push API)
- Email or SMS reminders
- Snooze functionality
- Notification history log
- Multiple reminders per todo

---

## Success Metrics

- Notification fires within 30 seconds of reminder time
- Zero duplicate notifications for the same todo
- Polling adds < 5ms overhead to UI rendering
- All 7 reminder options visible and selectable
