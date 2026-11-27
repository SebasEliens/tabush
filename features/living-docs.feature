Feature: Living docs site
  As a member of the Tabush team or a partner reviewing the project
  I want one static site with research, mocks, decisions and test evidence
  So that I can see what we decided, why, and that it works, without running anything

  Scenario: Read a research note synced from the repo
    Given the docs site is built from main
    When I open "Research" and pick "Technical requirements"
    Then I see the note from docs/research/technical-requirements.md
    And it says which repo file to edit

  Scenario: Test a decision against my own priorities
    Given I open decision record 0001
    When I set the weight of "Reuse the app's React and tokens" to 0
    Then the ranking updates without reloading the page

  Scenario: See how H3 resolution fits a family farm
    Given I open decision record 0002
    When I move the H3 resolution from 9 to 10
    Then the parcel is covered by more and smaller cells

  Scenario: Click through the frontend mock
    Given I open "Mocks"
    Then the live mock app loads inside the page with fake data
