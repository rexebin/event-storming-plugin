1. always use /vsix-build to build the vsix file and reinstall the vsix file after each job.\
1. use superpowers when session start.
1. workflow: rubber duck challengethe requirement -> plan -> use rubber duck skill to review plan -> address plan review comments -> add/append agreed plan to spec -> implement(TDD style) -> use simplify skill to clean up code -> use rubber duck skill to review implementation -> address code review comments -> critique for readability -> refactor -> build vsix -> install vsix
1. sub-agents:
    planing agent: responsible for creating a plan to implement the feature.
    rubber duck agent: use rubber duck skill, responsible for reviewing the plan and implementation, providing feedback and suggestions for improvement.
    build agent: responsible for building the vsix file using /vsix-build and installing it after each job.
1. use codebase-memory-mcp where possible
2. boy scout rule: always leave the codebase cleaner than you found it.
3. should not allow any typescript warnings.

3. save the plan to ./claude/plans/{feature-name}.md and refer to it if context is lost. 