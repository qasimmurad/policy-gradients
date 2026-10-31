The learning algorithm lives here, in `reinforce.py`.

It imports `RunLogger` from `tools.logger` and `export_policy` from
`tools.export`, logs every episode, and calls `export_policy` at the end so the
browser demo can replay the trained weights. Environment construction and the
random baseline are support code and live in `rl/envs/` and `rl/tools/`.
