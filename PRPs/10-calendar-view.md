# PRP 10: Calendar View

## Feature Overview

Provide a monthly calendar view at `/calendar` that displays todos on their due dates. Singapore public holidays are highlighted with their names. Users can navigate between months, click on a day to see its todos in a modal, and jump back to today. The active month is persisted in the URL query string.

---

## User Stories

- **As a user**, I want to see my todos on a calendar so I understand my upcoming workload.
- **As a user**, I want Singapore public holidays shown on the calendar so I can plan around them.
- **As a user**, I want to navigate to previous and next months.
- **As a user**, I want to click on a day to see the full list of todos due that day.
- **As a user**, I want the current month bookmarked in the URL so I can share or revisit it.

---

## User Flow

### View Calendar
1. User clicks the "Calendar" link in the navigation
2. Calendar page `/calendar` loads, defaulting to the current month
3. Month/year header displayed (e.g., "January 2025")
4. 7-column grid shows Sun–Sat headers and day cells

### Calendar Day Cell
- Shows the day number
- Current day is highlighted (e.g., blue circle)
- Weekends have a different background (light gray)
- Singapore holidays show the holiday name in a small label
- If todos are due on that day, a count badge appears (e.g., "3 todos")

### Navigate Months
1. User clicks "‹ Prev" or "Next ›" buttons
2. Calendar re-renders for the new month
3. URL updates to `?month=YYYY-MM`
4. "Today" button jumps back to current month

### View Day's Todos
1. User clicks on a day cell that has todos
2. A modal opens: "Todos for [Day, Month DD, YYYY]"
3. List shows all todos due on that day with their priority badges and completion status
4. User can close the modal with ×

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,      -- YYYY-MM-DD, Singapore timezone
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed Singapore public holidays (example subset)
INSERT INTO holidays (date, name) VALUES
  ('2025-01-01', 'New Year''s Day'),
  ('2025-01-29', 'Chinese New Year'),
  ('2025-01-30', 'Chinese New Year (Day 2)'),
  ('2025-04-18', 'Good Friday'),
  ('2025-05-01', 'Labour Day'),
  ('2025-05-12', 'Vesak Day'),
  ('2025-06-07', 'Hari Raya Haji'),
  ('2025-08-09', 'National Day'),
  ('2025-10-20', 'Deepavali'),
  ('2025-12-25', 'Christmas Day');
```

### API Endpoints

**`GET /api/holidays`**
- Accepts optional `?year=YYYY` query param (defaults to current year)
- Returns all holidays for the requested year
- Does not require authentication (public data)

### Calendar Generation Logic

```typescript
import { getSingaporeNow } from '@/lib/timezone';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth
} from 'date-fns';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday?: string;
  todos: Todo[];
}

function generateCalendar(year: number, month: number, todos: Todo[], holidays: Holiday[]): CalendarDay[][] {
  const monthStart = new Date(year, month - 1, 1);
  const gridStart = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 0 }); // Sunday
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = getSingaporeNow();

  const calDays: CalendarDay[] = days.map(date => ({
    date,
    isCurrentMonth: isSameMonth(date, monthStart),
    isToday: isSameDay(date, today),
    isWeekend: [0, 6].includes(date.getDay()),
    holiday: holidays.find(h => h.date === format(date, 'yyyy-MM-dd'))?.name,
    todos: todos.filter(t => t.due_date && isSameDay(new Date(t.due_date), date)),
  }));

  // Chunk into weeks (rows of 7)
  return Array.from({ length: calDays.length / 7 }, (_, i) =>
    calDays.slice(i * 7, i * 7 + 7)
  );
}
```

### URL State Management

```typescript
// app/calendar/page.tsx
import { useSearchParams, useRouter } from 'next/navigation';

function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const monthParam = searchParams.get('month'); // 'YYYY-MM'
  const now = getSingaporeNow();
  const [year, month] = monthParam
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  function navigate(newYear: number, newMonth: number) {
    router.push(`/calendar?month=${newYear}-${String(newMonth).padStart(2, '0')}`);
  }
  // ...
}
```

### TypeScript Types

```typescript
interface Holiday {
  id: number;
  date: string;   // YYYY-MM-DD
  name: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday?: string;
  todos: Todo[];
}
```

---

## UI Components

### Calendar Page Layout

```tsx
<div className="max-w-4xl mx-auto p-4">
  {/* Header */}
  <div className="flex items-center justify-between mb-4">
    <button onClick={prevMonth}>‹ Prev</button>
    <h1 className="text-xl font-bold">
      {format(new Date(year, month - 1), 'MMMM yyyy')}
    </h1>
    <button onClick={nextMonth}>Next ›</button>
    <button onClick={goToToday}>Today</button>
  </div>

  {/* Day Headers */}
  <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500 mb-1">
    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
      <div key={d}>{d}</div>
    ))}
  </div>

  {/* Calendar Grid */}
  {weeks.map((week, i) => (
    <div key={i} className="grid grid-cols-7">
      {week.map(day => (
        <DayCell key={day.date.toISOString()} day={day} onClick={openDayModal} />
      ))}
    </div>
  ))}
</div>
```

### Day Cell

```tsx
function DayCell({ day, onClick }: { day: CalendarDay; onClick: (day: CalendarDay) => void }) {
  return (
    <div
      onClick={() => day.todos.length > 0 && onClick(day)}
      className={cn(
        'min-h-20 p-1 border border-gray-100 dark:border-gray-800 text-sm',
        !day.isCurrentMonth && 'opacity-30',
        day.isWeekend && 'bg-gray-50 dark:bg-gray-900/50',
        day.todos.length > 0 && 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20',
      )}
    >
      {/* Day Number */}
      <span className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
        day.isToday && 'bg-blue-500 text-white font-bold',
      )}>
        {day.date.getDate()}
      </span>

      {/* Holiday */}
      {day.holiday && (
        <p className="text-xs text-orange-600 dark:text-orange-400 truncate mt-0.5">
          🎉 {day.holiday}
        </p>
      )}

      {/* Todo Count Badge */}
      {day.todos.length > 0 && (
        <span className="block mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
          {day.todos.length} todo{day.todos.length > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
```

### Day Detail Modal

```tsx
<Modal title={`Todos for ${format(selectedDay.date, 'EEEE, MMMM d, yyyy')}`} onClose={close}>
  {selectedDay.todos.length === 0 ? (
    <p className="text-gray-500">No todos due on this day.</p>
  ) : (
    <ul className="space-y-2">
      {selectedDay.todos.map(todo => (
        <li key={todo.id} className="flex items-center gap-2">
          <input type="checkbox" checked={todo.completed} readOnly />
          <span className={todo.completed ? 'line-through text-gray-400' : ''}>{todo.title}</span>
          <PriorityBadge priority={todo.priority} />
        </li>
      ))}
    </ul>
  )}
</Modal>
```

---

## Edge Cases

- **Month with 4 or 6 weeks**: Grid adapts (28–42 cells including padding days from prev/next month)
- **No todos due in a month**: Calendar renders normally with empty day cells
- **Holiday on a weekend**: Display both weekend styling and holiday name
- **Multiple holidays on the same day**: Rare but display the first; others truncated
- **Todos without due dates**: Not shown on the calendar (only due-date todos)
- **Navigating far future/past**: No enforced limit; calendar generates any month
- **URL tampering** (`?month=invalid`): Fall back to current month gracefully
- **Timezone**: All date comparisons use Singapore timezone to ensure correct day assignment

---

## Acceptance Criteria

- [ ] Calendar loads and displays current month by default
- [ ] Month/year header is correct
- [ ] Day headers show Sun–Sat
- [ ] Current day is highlighted
- [ ] Weekends have distinct styling
- [ ] Singapore public holidays display with their names
- [ ] Todos appear on their correct due dates
- [ ] Todo count badge shows number of todos on that day
- [ ] Clicking a day with todos opens a detail modal
- [ ] "Prev" and "Next" buttons navigate months
- [ ] "Today" button jumps back to current month
- [ ] URL updates to `?month=YYYY-MM` on navigation

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/10-calendar-view.spec.ts
test('Calendar loads current month by default')
test('Month header shows correct month and year')
test('Today is highlighted')
test('Navigate to next month - header updates')
test('Navigate to previous month - header updates')
test('Today button returns to current month')
test('Todo with due date appears on correct day')
test('Holiday appears on correct date with name')
test('Click day with todos - modal opens with todo list')
test('Click day without todos - no modal (or empty modal)')
test('URL updates to ?month=YYYY-MM on navigation')
```

### Unit Tests

```typescript
// tests/unit/calendar.test.ts
test('generateCalendar returns 4 weeks for February 2021 (28 days starting Sunday)')
test('generateCalendar returns 6 weeks for months needing padding')
test('isToday correctly identifies current day (Singapore timezone)')
test('Todos assigned to correct calendar day')
test('Invalid month URL param falls back to current month')
```

---

## Out of Scope

- Week or day view (month only)
- Creating todos directly from the calendar
- Editing todos from the calendar modal
- Dragging todos between calendar days
- iCal/Google Calendar export
- Holidays for non-Singapore regions

---

## Success Metrics

- Calendar renders in < 500ms for any given month
- All Singapore public holidays display on correct dates
- Correct day assignment for todos in Singapore timezone
- Navigation (prev/next/today) responds instantly (client-side)
- URL state allows bookmarking any month
