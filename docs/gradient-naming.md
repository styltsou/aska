# Gradient naming

Gradient naming runs after a color save. The card keeps its current title while
the worker generates a replacement. The API discards a result if the gradient
or title changed after the job was queued.

SST stages select `google` and `gemini-3.5-flash-lite` by default. Set the
`GoogleAiApiKey` SST secret for each stage before using it. Set
`GRADIENT_NAMING_PROVIDER=off` when deploying to disable naming, or `openai`
to select the alternative provider. The provider key is available only to the
naming worker.

Before enabling a provider for real users, run
`bun run --cwd services/gradient-naming evaluate` with the provider and key in
the environment, review the fixture names, and tune the prompt if needed.
Apply the generated Drizzle migration with the normal deployment process.
