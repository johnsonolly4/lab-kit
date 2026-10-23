# My own queries

A query a lab member wrote for themself, grouped by the weekday name in `day`.

```dataview
TABLE WITHOUT ID day AS "Day", length(rows) AS "Open", rows.file.link AS "To-dos"
FROM "00 Planning/To-dos"
WHERE kind = "todo" AND !done AND day != "Done" AND day != "Backlog"
GROUP BY day
SORT day ASC
```

```dataview
LIST FROM "00 Planning/To-dos"
WHERE kind = "todo" AND day = "Fri" AND !done
```

```dataview
TASK FROM "00 Planning/To-dos"
WHERE day = "Mon"
```
