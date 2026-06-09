1. add a react app to the project as a playground for the event storming diagram
2. the app will:
   3. allow user to edit the xml DSL in monaco-editor component at the bottom half of the screen
   4. render the event storming diagram in the top half of the screen using the xml DSL
   5. reuse the rendering for vscode extension and browser extension
6. the app will be built and run using vite at development time
7. style: tailwind css
8. ui component shadcn/ui
9. use TypeScript
10. setup eslint and prettier for code quality and formatting
11. setup playwright for end-to-end testing, add a test to verify that the app renders the diagram correctly based on the xml DSL input