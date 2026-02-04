---
name: todos
description: View and manage the todo list
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# View Todos

Display the todo list and optionally manage items.

## Steps

### 1. Check for TODO.md

If `.planning/TODO.md` doesn't exist:
```
No todos yet.
Add one: /bc:todo "Your idea here"
```

### 2. Read and Display

Read `.planning/TODO.md` and display:

```markdown
## TODOS

### Pending ([N] items)
- [ ] [description] *(added [date])*
- [ ] [description] *(added [date])*

### Done ([N] items)
- [x] [description] *(completed [date])*
```

### 3. Offer Actions

If there are pending items, use AskUserQuestion:

```
question: "What would you like to do?"
options:
  - label: "Nothing, just viewing"
    description: "Close the todo list"
  - label: "Mark item done"
    description: "Complete a todo item"
  - label: "Delete item"
    description: "Remove a todo item"
  - label: "Create phase from todo"
    description: "Promote a todo to a new phase"
```

### 4. Handle Actions

**Mark item done:**
- Ask which item (by number or description)
- Move from Pending to Done section
- Add completion date

**Delete item:**
- Ask which item
- Remove from list entirely
- Confirm deletion

**Create phase from todo:**
- Ask which item
- Run `/bc:new-phase "[todo description]"`
- Optionally mark the todo as done

### 5. Update TODO.md

After any changes, update the file and show the updated list.

---

## TODO.md Format

```markdown
# Todo List

Quick capture of ideas and tasks for later consideration.
These are not yet part of any phase—review periodically and promote to phases as needed.

---

## Pending

- [ ] Add user authentication
  *Added: 2024-01-15*

- [ ] Improve error messages
  *Added: 2024-01-14*

## Done

- [x] Set up CI/CD pipeline
  *Added: 2024-01-10*
  *Completed: 2024-01-12*
```
