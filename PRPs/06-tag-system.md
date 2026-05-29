# PRP 06: Tag System

## Feature Overview

Allow users to create custom color-coded tags and assign them to todos. Tags support full CRUD management via a "Manage Tags" modal. Users can filter their todo list by clicking a tag badge, and tag changes propagate to all associated todos immediately.

---

## User Stories

- **As a user**, I want to create tags with custom names and colors to categorize my todos.
- **As a user**, I want to assign multiple tags to a single todo.
- **As a user**, I want to click a tag badge to filter todos by that tag.
- **As a user**, I want to edit a tag's name or color and see it update on all associated todos.
- **As a user**, I want to delete a tag, which removes it from all todos.

---

## User Flow

### Manage Tags
1. User clicks "Manage Tags" button in the toolbar
2. A modal opens showing all existing tags (name + color swatch + edit/delete buttons)
3. A form at the top allows creating a new tag: name input + color picker
4. User enters a name, selects a color, and clicks "Create"
5. New tag appears in the list

### Assign Tags to a Todo
1. User opens the create or edit form for a todo
2. A "Tags" section shows all user tags as checkboxes
3. User checks the desired tags
4. After save, colored tag badges appear on the todo card

### Filter by Tag
1. User clicks a tag badge on a todo card
2. The todo list filters to show only todos with that tag
3. A filter indicator bar appears: "Tag: [tag name] ×"
4. User clicks × or the tag badge again to clear the filter

### Edit a Tag
1. User opens "Manage Tags" modal
2. Clicks the edit (✎) button next to a tag
3. Inline form shows current name and color
4. User updates and saves
5. All todo cards immediately show the updated tag name/color

### Delete a Tag
1. User opens "Manage Tags" modal
2. Clicks the delete (🗑) button next to a tag
3. Confirmation: "Delete tag '[name]'? It will be removed from all todos."
4. On confirm, tag is deleted and removed from all associated todos

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE INDEX idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX idx_todo_tags_tag_id ON todo_tags(tag_id);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tags` | List all tags for current user |
| `POST` | `/api/tags` | Create a new tag |
| `PUT` | `/api/tags/[id]` | Update tag name/color |
| `DELETE` | `/api/tags/[id]` | Delete tag (removes from all todos) |
| `POST` | `/api/todos/[id]/tags` | Add a tag to a todo |
| `DELETE` | `/api/todos/[id]/tags` | Remove a tag from a todo (body: `{ tag_id }`) |

### TypeScript Types

```typescript
interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;     // CSS hex color (e.g., '#3B82F6')
  created_at: string;
}

interface CreateTagInput {
  name: string;
  color?: string;
}

interface UpdateTagInput {
  name?: string;
  color?: string;
}
```

---

## UI Components

### Manage Tags Modal

```tsx
<Modal title="Manage Tags" onClose={close}>
  {/* Create Tag Form */}
  <form onSubmit={createTag} className="flex gap-2 mb-4">
    <input type="text" placeholder="Tag name" value={name} onChange={setName} className="input flex-1" />
    <input type="color" value={color} onChange={setColor} className="w-10 h-10 rounded cursor-pointer" />
    <button type="submit" className="btn-primary">Create</button>
  </form>

  {/* Tag List */}
  <ul className="space-y-2">
    {tags.map(tag => (
      <li key={tag.id} className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
        {editing === tag.id ? (
          <InlineEditForm tag={tag} onSave={updateTag} onCancel={() => setEditing(null)} />
        ) : (
          <>
            <span className="flex-1">{tag.name}</span>
            <button onClick={() => setEditing(tag.id)}>✎</button>
            <button onClick={() => confirmDelete(tag)}>🗑</button>
          </>
        )}
      </li>
    ))}
  </ul>
</Modal>
```

### Tag Badge (Todo Card)

```tsx
{todo.tags?.map(tag => (
  <button
    key={tag.id}
    onClick={() => setTagFilter(tag.id)}
    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
    style={{ backgroundColor: tag.color }}
    title={`Filter by: ${tag.name}`}
  >
    {tag.name}
  </button>
))}
```

### Tag Checkboxes (Create/Edit Form)

```tsx
<fieldset>
  <legend className="text-sm font-medium">Tags</legend>
  <div className="flex flex-wrap gap-2 mt-1">
    {allTags.map(tag => (
      <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={selectedTagIds.includes(tag.id)}
          onChange={() => toggleTag(tag.id)}
        />
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
        <span className="text-sm">{tag.name}</span>
      </label>
    ))}
  </div>
</fieldset>
```

---

## Edge Cases

- **Duplicate tag name**: `UNIQUE(user_id, name)` — API returns `409 Conflict` with "Tag name already exists"
- **Empty tag name**: Validation error — "Tag name is required"
- **Delete tag with associated todos**: `ON DELETE CASCADE` on `todo_tags` handles cleanup automatically
- **Edit tag name to existing name**: Returns `409 Conflict`
- **No tags yet**: Show empty state in Manage Tags modal: "No tags yet. Create one above."
- **Tag filter + priority filter**: AND logic — both filters apply simultaneously
- **Tag color accessibility**: Suggest high-contrast text on colored badges (white text for dark colors)
- **Max tags per todo**: No enforced limit, but UI should handle overflow gracefully (wrap badges)

---

## Acceptance Criteria

- [ ] Tags are unique per user (duplicate name rejected)
- [ ] Custom colors work (hex color picker)
- [ ] Tag badges display on todo cards with correct color
- [ ] Clicking a tag badge filters the todo list
- [ ] Filter indicator shows tag name with a clear button
- [ ] Editing a tag name/color updates all todo cards immediately
- [ ] Deleting a tag removes it from all todo cards
- [ ] Tags can be assigned/unassigned in create and edit forms
- [ ] Multiple tags can be assigned to one todo

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/06-tag-system.spec.ts
test('Open Manage Tags modal')
test('Create a tag with name and color')
test('Duplicate tag name shows error')
test('Edit tag name - updates on all associated todos')
test('Edit tag color - updates on all associated todos')
test('Delete tag - removed from all todos')
test('Assign tag to todo via create form')
test('Assign multiple tags to one todo')
test('Click tag badge to filter todos')
test('Clear tag filter - all todos visible again')
test('Tag filter combined with priority filter uses AND logic')
```

### Unit Tests

```typescript
// tests/unit/tag-validation.test.ts
test('Empty tag name rejected')
test('Tag name trimmed before uniqueness check')
test('Hex color stored and returned correctly')
```

---

## Out of Scope

- Shared/global tags across users
- Tag hierarchies or nesting
- Tag-based statistics or reports
- Bulk tag assignment
- Tag autocomplete in a free-text input (uses checkboxes instead)

---

## Success Metrics

- Tag creation, editing, and deletion complete in < 500ms
- Filter by tag responds in < 100ms
- Zero orphan records in `todo_tags` after tag or todo deletion
- All tag operations scoped to the authenticated user (no cross-user data leakage)
