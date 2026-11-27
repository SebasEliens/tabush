@llm
Feature: Golden questions
  The assistant's answers to the golden questions in semantic/examples.json must contain
  the numbers of the reference answer. This runs the real model, so it needs
  ANTHROPIC_API_KEY and costs a little: run it with `npm run e2e:llm` after changing the
  prompt, the taxonomy, the ontology or the model.

  Background:
    Given the open data is published
    And the assistant is connected

  Scenario Outline: <id>
    When I open "Ask the data"
    And I ask the golden question "<id>"
    Then the answer contains the numbers of the reference answer
    And the answer names its sources

    Examples:
      | id                              |
      | family-farms-double-claims      |
      | properties-in-indigenous-lands  |
      | indigenous-population-and-lands |
      | public-protected-area-claims    |
      | overlap-chains-to-indigenous-land |
