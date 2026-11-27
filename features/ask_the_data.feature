Feature: Ask the data
  As a credit officer, journalist or community organisation
  I want to ask questions about land tenure in plain language
  So that I get an answer with the query and sources behind it, without knowing SQL

  The page reads the open data files in the browser with DuckDB-WASM. The assistant
  (Claude) writes the SQL, guided by the taxonomy and ontology. These scenarios run on
  the synthetic fixture (tabush.semantic.fixture), so the numbers are known.

  Background:
    Given the open data is published

  Scenario: Worked examples run on the live data without the assistant
    Given the assistant is not connected
    When I open "Ask the data"
    Then I see that the assistant is not connected
    When I choose the worked example "How many family farms in Canguçu overlap another CAR claim?"
    Then I see the reference query
    And the result has the columns "overlapping, family_farms, pct"
    And the result has the row "2, 4, 50"
    And the sources include "rural_properties" with its snapshot date
    And I save a screenshot "ask-worked-example"

  Scenario: The assistant answers with the query it ran and its sources
    Given the assistant will run the reference query of "properties-in-indigenous-lands" and then answer
    When I open "Ask the data"
    And I ask "Which rural properties overlap an indigenous land, and which land?"
    Then I see the step "Find properties that overlap indigenous lands" with 1 row
    And I see the answer
    And the sources include "edges" with its snapshot date
    And the assistant was sent the query result
    And I save a screenshot "ask-answer"

  Scenario: Only read-only queries can run
    Given the assistant will run "COPY rural_properties TO 'leak.csv'" and then answer
    When I open "Ask the data"
    And I ask "Export every property to a file"
    Then I see the step fail with "Only a single SELECT query can run here"
    And the assistant was told the query failed

  Scenario: The semantic layer can be browsed
    Given the assistant is not connected
    When I open "Ask the data"
    Then the semantic layer lists the table "rural_properties"
    When I open the "CAR record status" scheme
    Then it lists "PE" as "Pending"
    And I save a screenshot "ask-semantic-layer"
