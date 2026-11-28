Feature: Map panels and real data on the map
  As a credit officer
  I want to see only real land tenure data once it is loaded, and to clear the panels off the map
  So that fake parcels never pass for real records and the map is not covered when I read it

  The land tenure layers are stubbed: a layer is "built" when its provenance file answers.

  Scenario: The fake portfolio is a fallback when no real layer is built
    Given no land tenure layer is built
    When I open the map
    Then I see the fake portfolio
    And I see the "Mock data" badge

  Scenario: Real land tenure data replaces the fake portfolio
    Given the "rural_properties" layer is built
    When I open the map
    Then I do not see the fake portfolio
    And I do not see the "Mock data" badge
    And I see the panel "Land tenure · public data"

  Scenario: Panels fold to their title, and all hide at once
    Given the "rural_properties" layer is built
    When I open the map
    And I fold the panel "Land tenure · public data"
    Then the panel "Land tenure · public data" shows only its title
    When I press "H"
    Then I see no panels on the map
    When I click "Show panels"
    Then the panel "Land tenure · public data" shows only its title
    When I fold the panel "Land tenure · public data"
    Then I see the panel "Land tenure · public data"
