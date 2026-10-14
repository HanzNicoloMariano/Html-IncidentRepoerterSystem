# Incident Reporting System (IRS)

A working web application for the 63-laboratory Incident Reporting System course.
Built with **HTML + CSS + JavaScript** (no server needed). Data is stored in the browser.

**Workflow:** Reporter → Incident → Location → Investigation → Findings/Root Cause → Action → Resolution → Closure → Reports & Dashboard

## Run it
Open `index.html` in a browser.

## Demo accounts
| Username | Password | Role |
|---|---|---|
| admin | admin123 | Administrator |
| reporter | reporter123 | Reporter |
| officer | officer123 | Incident Officer |
| investigator | invest123 | Investigator |
| actionofficer | action123 | Action Officer |
| supervisor | super123 | Supervisor |
| manager | manager123 | Management |

## Files
- `index.html`, `style.css` – page and design
- `js/` – schema, core, logic, sample data, pages
- `database.sql` – the same database design for MySQL

The **Lab Map (1-63)** page inside the system shows where every lab is.

## Showing progress (unlocking labs)
Open `js/core.js` and change this line as you finish more labs:

```js
const UNLOCKED_LAB = 20;   // Labs 1-20 visible. Use 63 to show everything.
```
Upload that one file again to GitHub. Each upload is a dated entry in your history.
