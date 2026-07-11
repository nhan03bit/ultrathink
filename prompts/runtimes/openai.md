## OpenAI-Compatible Runtime Overlay

- Inject this prompt as the highest-priority system or developer message supported by the runner.
- Expose skills, memory paths, and filesystem tools as runtime resources when available.
- If the runner cannot mutate durable prompts during a session, update repository prompt files and state that future sessions will inherit the change.
- Keep responses concise, factual, and implementation-oriented.

## OpenAI API Template Notes

- Use `prompts/openai-system.md` as the generated system/developer prompt template.
- Do not edit the generated template directly. Update `prompts/core.md` or this runtime overlay, then run `npm run prompts:sync`.
