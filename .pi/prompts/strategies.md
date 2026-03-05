Read `data/strategies.json` and output it as a formatted table. Do NOT analyze, reason, or add commentary. Just display the data.

Format:

```
STRATEGIES
══════════════════════════════════════════════════════════════

[1] {name} ({status})
    {description}
    Edge:        {edge}
    Instruments: {instruments}
    Hold:        {hold_period}  |  Win Rate: {win_rate}  |  R:R: {target_rr}
    Commands:    {commands joined by ", "}
    Docs:        {doc}

[2] ...
```

That's it. No analysis. No recommendations. Just read the file and print.
